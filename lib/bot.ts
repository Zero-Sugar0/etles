import { createGoogleChatAdapter } from "@chat-adapter/gchat";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createLinearAdapter } from "@chat-adapter/linear";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import { createResendAdapter } from "@resend/chat-sdk-adapter";
import { createSendblueAdapter } from "chat-adapter-sendblue";
import { Chat, ConsoleLogger } from "chat";
import { Pool } from "pg";
import { getBotIntegration } from "@/lib/db/queries";
import { attachHandlers } from "./bot-handlers";

// Share state adapters per user/platform while keeping Chat SDK's locks,
// subscriptions, and dedupe keys isolated between customer integrations.
let postgresPool: Pool | null = null;
const states = new Map<string, ReturnType<typeof createPostgresState>>();
function getSharedState(userId: string, platform: string) {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL or DATABASE_URL is required for Chat SDK state");
  }
  const pool =
    (postgresPool ??= new Pool({ connectionString, max: 10 }));
  const key = `${userId}:${platform}`;
  let state = states.get(key);
  if (!state) {
    state = createPostgresState({
      client: pool,
      keyPrefix: `etles:${userId}:${platform}`,
    });
    states.set(key, state);
  }
  return state;
}

function parseJsonConfig(value: string, platform: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${platform} JSON credentials`);
  }
}

export async function buildUserBot(userId: string, platform: string) {
  const integration = await getBotIntegration({ userId, platform });

  if (!integration) {
    console.error(
      `[buildUserBot] No integration found for user ${userId} on ${platform}`
    );
    throw new Error("Integration missing");
  }

  const state = getSharedState(userId, platform);
  const extraConfig =
    (integration.extraConfig as Record<string, any> | null) ?? {};
  let adapter;

  switch (platform) {
    case "slack":
      adapter = createSlackAdapter({
        botToken: integration.botToken,
        signingSecret: integration.signingSecret || "",
      });
      break;

    case "teams":
      adapter = createTeamsAdapter({
        appId: integration.botToken,
        appPassword: integration.signingSecret || "",
        appTenantId: extraConfig.appTenantId,
        appType: extraConfig.appType || "SingleTenant",
      });
      break;

    case "gchat":
      adapter = createGoogleChatAdapter({
        credentials: parseJsonConfig(integration.botToken, "Google Chat"),
        googleChatProjectNumber: extraConfig.googleChatProjectNumber,
      });
      break;

    case "discord": {
      const { createDiscordAdapter } = await import("@chat-adapter/discord");
      adapter = createDiscordAdapter({
        botToken: integration.botToken,
        applicationId: extraConfig.applicationId,
        publicKey: integration.signingSecret || undefined,
      });
      break;
    }

    case "telegram":
      adapter = createTelegramAdapter({
        botToken: integration.botToken,
        secretToken: process.env.TELEGRAM_SECRET_TOKEN || undefined,
        mode: "webhook",
      });
      break;

    case "github":
      adapter = integration.signingSecret
        ? createGitHubAdapter({
            appId: integration.botToken,
            installationId: extraConfig.installationId
              ? Number(extraConfig.installationId)
              : undefined,
            privateKey: integration.signingSecret,
            webhookSecret: extraConfig.webhookSecret || "",
            botUserId: extraConfig.botUserId
              ? Number(extraConfig.botUserId)
              : undefined,
          })
        : createGitHubAdapter({
            token: integration.botToken,
            webhookSecret: extraConfig.webhookSecret || "",
            botUserId: extraConfig.botUserId
              ? Number(extraConfig.botUserId)
              : undefined,
          });
      break;

    case "linear":
      adapter = createLinearAdapter({
        webhookSecret: integration.signingSecret || "",
        apiKey: integration.botToken,
      });
      break;

    case "whatsapp":
      adapter = createWhatsAppAdapter({
        accessToken: integration.botToken,
        appSecret: integration.signingSecret || "",
        logger: new ConsoleLogger("info"),
        phoneNumberId: extraConfig.phoneNumberId,
        userName: "Etles",
        verifyToken: extraConfig.verifyToken,
      });
      break;

    case "resend": {
      adapter = createResendAdapter({
        apiKey: integration.botToken,
        webhookSecret: integration.signingSecret || "",
        fromAddress: extraConfig.fromAddress || "bot@etles.app",
        fromName: extraConfig.fromName || "Etles AI",
      });
      break;
    }

    case "sendblue": {
      const allowedServices = extraConfig.allowedServices
        ? String(extraConfig.allowedServices)
            .split(",")
            .map((service) => service.trim())
            .filter(Boolean)
        : undefined;
      adapter = createSendblueAdapter({
        apiKey: integration.botToken,
        apiSecret: integration.signingSecret || undefined,
        defaultFromNumber: String(extraConfig.fromNumber),
        webhookSecret: extraConfig.webhookSecret || undefined,
        allowedServices: allowedServices as
          | Array<"iMessage" | "SMS" | "RCS">
          | undefined,
      });
      break;
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  const bot = new Chat({
    userName: "Etles",
    adapters: { [platform]: adapter },
    state,
    // Webhook retries and long AI turns must not create duplicate replies.
    // PostgreSQL state provides the distributed lock and dedupe store.
    dedupeTtlMs: 24 * 60 * 60 * 1000,
    concurrency: "queue",
    onLockConflict: "drop",
  });

  attachHandlers(bot, platform, userId);

  await bot.initialize();

  return bot;
}
