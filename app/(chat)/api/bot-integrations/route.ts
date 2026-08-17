import { type NextRequest, NextResponse } from "next/server";
import {
  getBotIntegration,
  getUserBotIntegrations,
  saveBotIntegration,
} from "@/lib/db/queries";
import {
  registerTelegramWebhook,
  validateTelegramToken,
} from "@/lib/telegram/webhook-registration";
import {
  isMaskedSecret,
  maskSecret,
  SUPPORTED_CHAT_PLATFORMS,
} from "@/lib/chat/integration-config";
import { auth } from "../../../(auth)/auth";

const MASK_PREFIX = "••••••••";

function maskExtraConfig(extraConfig: unknown) {
  if (!extraConfig || typeof extraConfig !== "object") {
    return extraConfig;
  }

  return Object.fromEntries(
    Object.entries(extraConfig as Record<string, unknown>).map(
      ([key, value]) => {
        const shouldMask =
          typeof value === "string" &&
          /(secret|token|privateKey|apiKey|password)/i.test(key);

        return [key, shouldMask ? maskSecret(value) : value];
      }
    )
  );
}

function validateExtraConfig(
  platform: string,
  signingSecret: string | null | undefined,
  extraConfig: Record<string, unknown>
) {
  const missing: string[] = [];

  if (
    [
      "slack",
      "discord",
      "teams",
      "github",
      "linear",
      "whatsapp",
      "resend",
      "sendblue",
    ].includes(platform) &&
    !signingSecret
  ) {
    missing.push(
      platform === "discord"
        ? "public key"
        : platform === "teams"
          ? "app password"
            : platform === "whatsapp"
              ? "verify token"
              : platform === "sendblue"
                ? "API secret"
              : "signing secret"
    );
  }

  if (platform === "github" && !extraConfig.webhookSecret) {
    missing.push("webhook secret");
  }

  if (platform === "discord" && !extraConfig.applicationId) {
    missing.push("application ID");
  }

  if (platform === "whatsapp") {
    if (!extraConfig.verifyToken) {
      missing.push("verify token");
    }
    if (!extraConfig.phoneNumberId) {
      missing.push("phone number ID");
    }
  }

  if (platform === "resend") {
    if (!extraConfig.fromAddress) {
      missing.push("from address");
    }
    if (!extraConfig.fromName) {
      missing.push("from name");
    }
  }

  if (platform === "sendblue" && !extraConfig.fromNumber) {
    missing.push("Sendblue number");
  }

  if (
    platform === "sendblue" &&
    extraConfig.fromNumber &&
    !/^\+[1-9]\d{6,14}$/.test(String(extraConfig.fromNumber))
  ) {
    return "Sendblue number must be in E.164 format, for example +15551234567.";
  }

  if (platform === "sendblue" && extraConfig.allowedServices) {
    const allowed = String(extraConfig.allowedServices)
      .split(",")
      .map((service) => service.trim())
      .filter(Boolean);
    if (allowed.some((service) => !["iMessage", "SMS", "RCS"].includes(service))) {
      return "Sendblue services must be iMessage, SMS, or RCS.";
    }
  }

  if (missing.length > 0) {
    return `Missing required ${platform} field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`;
  }

  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const integrations = await getUserBotIntegrations({
      userId: session.user.id,
    });

    // Obfuscate tokens before sending to client for security
    const safeIntegrations = integrations.map((i: any) => ({
      ...i,
      botToken: maskSecret(i.botToken),
      signingSecret: maskSecret(i.signingSecret),
      extraConfig: maskExtraConfig(i.extraConfig),
    }));

    return NextResponse.json(safeIntegrations);
  } catch (error) {
    console.error(
      "[bot-integrations] GET failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { platform, botToken, signingSecret, extraConfig } = await req.json();

    if (
      !platform ||
      !SUPPORTED_CHAT_PLATFORMS.includes(
        platform as (typeof SUPPORTED_CHAT_PLATFORMS)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Unsupported bot platform" },
        { status: 400 }
      );
    }

    const existing = await getBotIntegration({
      userId: session.user.id,
      platform,
    });

    const resolvedBotToken =
      isMaskedSecret(botToken) && existing?.botToken
        ? existing.botToken
        : botToken;
    const resolvedSigningSecret =
      isMaskedSecret(signingSecret) && existing?.signingSecret
        ? existing.signingSecret
        : signingSecret || null;

    const resolvedExtraConfig = {
      ...((existing?.extraConfig as Record<string, unknown> | null) ?? {}),
      ...((extraConfig as Record<string, unknown> | null) ?? {}),
    };

    for (const [key, value] of Object.entries(resolvedExtraConfig)) {
      if (isMaskedSecret(value)) {
        resolvedExtraConfig[key] =
          (existing?.extraConfig as Record<string, unknown> | null)?.[key] ??
          "";
      }
    }

    if (!resolvedBotToken || isMaskedSecret(resolvedBotToken)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (isMaskedSecret(resolvedSigningSecret)) {
      return NextResponse.json(
        { error: "Please enter new keys to update configuration." },
        { status: 400 }
      );
    }

    const validationError = validateExtraConfig(
      platform,
      resolvedSigningSecret,
      resolvedExtraConfig
    );
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (platform === "gchat") {
      try {
        JSON.parse(resolvedBotToken);
      } catch {
        return NextResponse.json(
          { error: "Google Chat service account JSON is invalid." },
          { status: 400 }
        );
      }
    }

    // Validate Telegram token before saving — ensures token works and keys are stored correctly
    if (platform === "telegram") {
      const validation = await validateTelegramToken(resolvedBotToken);
      if (!validation.ok) {
        return NextResponse.json(
          { error: `Invalid Telegram bot token: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    await saveBotIntegration({
      userId: session.user.id,
      platform,
      botToken: resolvedBotToken,
      signingSecret: resolvedSigningSecret,
      extraConfig: resolvedExtraConfig,
    });

    if (platform === "telegram") {
      const baseUrl = process.env.BASE_URL || new URL(req.url).origin;
      const isLocalhost =
        baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
      if (isLocalhost) {
        return NextResponse.json(
          {
            success: false,
            error:
              "BASE_URL must be a public URL for Telegram. Set BASE_URL in .env to your ngrok or deployment URL (e.g. https://xxx.ngrok.io). Telegram cannot reach localhost.",
          },
          { status: 400 }
        );
      }
      const result = await registerTelegramWebhook(
        resolvedBotToken,
        session.user.id,
        baseUrl
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: `Saved but webhook registration failed: ${result.error}` },
          { status: 207 } // Partial success
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[bot-integrations] POST failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return NextResponse.json(
      { error: "Failed to save integration" },
      { status: 500 }
    );
  }
}
