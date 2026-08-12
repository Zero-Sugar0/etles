/**
 * Telegram AI workflow — durable via Upstash Workflow.
 *
 * Route: POST /api/telegram/workflow
 *
 * Each step runs as its own HTTP invocation so the 60 s / 300 s Vercel
 * serverless limit never applies to the full AI execution. The endpoint's
 * own maxDuration (300 s) governs each individual step.
 *
 * Triggered by: app/api/telegram/[userId]/route.ts → after() block
 */

import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { Redis } from "@upstash/redis";
import { serve } from "@upstash/workflow/nextjs";
import { generateText, stepCountIs } from "ai";
import { buildEtlesTelegramTools } from "@/lib/ai/build-etles-telegram-tools";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel, getTelegramModel } from "@/lib/ai/providers";
import {
  getChatByPlatformThreadId,
  getLatestChatByUserId,
  linkChatToPlatform,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from "@/lib/db/queries";
import {
  getCachedSystemPrompt,
  setCachedSystemPrompt,
} from "@/lib/prompt-cache";
import { getSessionTail, saveSessionTail } from "@/lib/session-tail";
import {
  deleteMessage,
  editMessageText,
  sendLongMessage,
  sendStatusMessage,
  startTypingHeartbeat,
} from "@/lib/telegram/api";
import { touchUserActivity } from "@/lib/user-activity";
import { generateUUID } from "@/lib/utils";
import {
  WORKFLOW_BASE_URL,
  type TelegramWorkflowPayload,
} from "@/lib/workflow/client";

export const maxDuration = 300;

// ── Singletons (reused across warm invocations) ───────────────────────────────

const composio = new Composio({ provider: new VercelProvider() });

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Option A — Unified chat memory.
 *
 * Resolution order:
 * 1. Redis cache hit → verify it still exists in DB.
 * 2. DB lookup by platformThreadId → already linked.
 * 3. User's most recent unlinked web chat → re-link it so Telegram
 *    continues right where the web conversation left off.
 * 4. Create a brand-new chat and link it.
 *
 * The Redis cache is kept for speed; the DB is the source of truth.
 */
async function getOrCreateChat(
  ownerUserId: string,
  telegramChatId: number,
  senderName: string
): Promise<string> {
  const threadId = `telegram:${ownerUserId}:${telegramChatId}`;
  const cacheKey = `tg:chat:${ownerUserId}:${telegramChatId}`;

  // 1. Fast path: Redis cache
  if (redis) {
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const existing = await getChatByPlatformThreadId({
        platformThreadId: threadId,
      });
      if (existing?.id === cached) return cached;
      // Cache is stale — fall through
    }
  }

  // 2. DB lookup for an already-linked chat
  const linked = await getChatByPlatformThreadId({ platformThreadId: threadId });
  if (linked) {
    if (redis) await redis.set(cacheKey, linked.id, { ex: 60 * 60 * 24 * 90 });
    return linked.id;
  }

  // 3. Option A: adopt the user's most recent web chat
  const latestWebChat = await getLatestChatByUserId({ userId: ownerUserId });
  if (latestWebChat) {
    await linkChatToPlatform({ chatId: latestWebChat.id, platformThreadId: threadId });
    if (redis) await redis.set(cacheKey, latestWebChat.id, { ex: 60 * 60 * 24 * 90 });
    return latestWebChat.id;
  }

  // 4. No web chat exists — create one
  const chatId = generateUUID();
  await saveChat({
    id: chatId,
    userId: ownerUserId,
    title: `Telegram: ${senderName}`,
    visibility: "private",
    platformThreadId: threadId,
  });
  if (redis) await redis.set(cacheKey, chatId, { ex: 60 * 60 * 24 * 90 });
  return chatId;
}

// ── Internal tool labels (camelCase — these are from lib/ai/tools) ─────────────
const INTERNAL_TOOL_LABELS: Record<string, string> = {
  // Memory
  saveMemory: "🧠 Saving to memory",
  recallMemory: "🧠 Recalling from memory",
  updateMemory: "🧠 Updating memory",
  deleteMemory: "🧠 Deleting a memory",
  searchPastConversations: "🔎 Searching conversation history",
  // Knowledge graph
  upsertKnowledgeEntity: "🕸 Updating knowledge graph",
  addKnowledgeRelation: "🕸 Linking knowledge entities",
  getKnowledgeEntity: "🕸 Looking up knowledge graph",
  searchKnowledgeGraph: "🕸 Searching knowledge graph",
  deleteKnowledgeEntity: "🕸 Removing from knowledge graph",
  deleteKnowledgeRelation: "🕸 Removing knowledge relation",
  // Goals & planning
  addGoal: "🎯 Adding a goal",
  updateGoal: "🎯 Updating a goal",
  logGoalProgress: "🎯 Logging goal progress",
  listGoals: "🎯 Checking goals",
  deleteGoal: "🎯 Removing a goal",
  createPlan: "🗺 Creating a plan",
  addPlanTask: "🗺 Adding a task to plan",
  updatePlanTask: "🗺 Updating a plan task",
  listPlans: "🗺 Reviewing plans",
  cancelPlan: "🗺 Cancelling a plan",
  deletePlan: "🗺 Deleting a plan",
  // Search
  tavilySearch: "🔍 Searching the web",
  tavilyExtract: "🔍 Extracting web content",
  tavilyCrawl: "🔍 Crawling a website",
  tavilyMap: "🔍 Mapping a website",
  // Scheduling
  setReminder: "⏰ Setting a reminder",
  setCronJob: "⏰ Scheduling a recurring task",
  listSchedules: "⏰ Checking your schedules",
  deleteSchedule: "⏰ Removing a schedule",
  deleteReminder: "⏰ Removing a reminder",
  // Sub-agents & missions
  delegateToSubAgent: "🤝 Delegating to a sub-agent",
  getSubAgentResult: "🤝 Checking sub-agent result",
  listSubAgents: "🤝 Listing sub-agents",
  launchMission: "🚀 Launching a mission",
  getMissionStatus: "🚀 Checking mission status",
  // Sandbox / code
  createSandbox: "🖥 Creating a sandbox",
  listSandboxes: "🖥 Listing sandboxes",
  deleteSandbox: "🖥 Removing a sandbox",
  executeCommand: "💻 Running a command",
  runCode: "💻 Executing code",
  listFiles: "📁 Listing files",
  readFile: "📄 Reading a file",
  writeFile: "✏️ Writing a file",
  createDirectory: "📁 Creating a directory",
  searchFiles: "🔎 Searching files",
  replaceInFiles: "✏️ Editing files",
  gitClone: "🐙 Cloning a repo",
  gitStatus: "🐙 Checking git status",
  gitCommit: "🐙 Committing changes",
  gitPush: "🐙 Pushing to git",
  gitPull: "🐙 Pulling from git",
  gitBranch: "🐙 Managing git branches",
  getPreviewLink: "🔗 Getting preview link",
  runBackgroundProcess: "⚙️ Running a background process",
  lspDiagnostics: "🔍 Checking code diagnostics",
  archiveSandbox: "🖥 Archiving sandbox",
  // Browser
  browserUseRunTask: "🌐 Running browser task",
  browserUseStartTask: "🌐 Starting browser task",
  browserUseGetTask: "🌐 Checking browser task",
  browserSetup: "🌐 Setting up browser",
  browserNavigate: "🌐 Navigating to a page",
  browserInteract: "🌐 Interacting with page",
  browserExtract: "🌐 Extracting page content",
  browserScreenshot: "📸 Taking screenshot",
  // Twilio
  twilioSendSMS: "📱 Sending an SMS",
  twilioMakeCall: "📞 Making a phone call",
  twilioWhatsAppSendMessage: "💬 Sending a WhatsApp message",
  // Cloud
  awsS3: "☁️ Working with S3",
  awsEC2: "☁️ Working with EC2",
  awsLambda: "☁️ Running Lambda",
  gcpStorage: "☁️ Working with GCP Storage",
  gcpFunctions: "☁️ Running Cloud Functions",
  azureStorage: "☁️ Working with Azure Storage",
  // Databases
  postgresQuery: "🗄 Querying PostgreSQL",
  mysqlQuery: "🗄 Querying MySQL",
  mongodbQuery: "🗄 Querying MongoDB",
  // Proactive
  activateHeartbeat: "💓 Setting up heartbeat",
  setMorningBriefingTime: "🌅 Scheduling morning briefing",
  getAgentSystemStatus: "⚙️ Checking system status",
  // Misc
  getWeather: "🌤 Checking the weather",
  wikiQuery: "📚 Querying knowledge base",
  wikiIngest: "📚 Ingesting to knowledge base",
  readAgentSkill: "🛠 Reading agent skill",
  setupTrigger: "⚡ Setting up a trigger",
  listActiveTriggers: "⚡ Listing active triggers",
  removeTrigger: "⚡ Removing a trigger",
  // Legal
  analyzeContract: "📜 Analysing contract",
  compareContracts: "📜 Comparing contracts",
  extractClauses: "📜 Extracting clauses",
  complianceCheck: "📜 Checking compliance",
  redlineContract: "📜 Redlining contract",
};

/**
 * Composio tools arrive as TOOLKIT_ACTION_NAME (all caps, underscores).
 * We derive a human-friendly label from the toolkit prefix.
 */
const COMPOSIO_TOOLKIT_LABELS: Record<string, string> = {
  GMAIL: "📧 Gmail",
  GOOGLECALENDAR: "📅 Google Calendar",
  GOOGLEDRIVE: "📁 Google Drive",
  GOOGLEDOCS: "📄 Google Docs",
  GOOGLESHEETS: "📊 Google Sheets",
  GOOGLETASKS: "✅ Google Tasks",
  GOOGLECONTACTS: "👤 Google Contacts",
  GOOGLEMEET: "📹 Google Meet",
  GOOGLESEARCH: "🔍 Google Search",
  GITHUB: "🐙 GitHub",
  GITLAB: "🐙 GitLab",
  SLACK: "💬 Slack",
  NOTION: "📒 Notion",
  DISCORD: "💬 Discord",
  TWITTER: "🐦 Twitter / X",
  TWITTEROAUTH: "🐦 Twitter / X",
  LINKEDIN: "💼 LinkedIn",
  HUBSPOT: "🎯 HubSpot",
  SALESFORCE: "☁️ Salesforce",
  PIPEDRIVE: "🎯 Pipedrive",
  STRIPE: "💳 Stripe",
  SHOPIFY: "🛍 Shopify",
  AIRTABLE: "📊 Airtable",
  ASANA: "✅ Asana",
  JIRA: "🐛 Jira",
  TRELLO: "📋 Trello",
  CLICKUP: "✅ ClickUp",
  ZOOM: "📹 Zoom",
  CALENDLY: "📅 Calendly",
  DROPBOX: "📦 Dropbox",
  ONEDRIVE: "📦 OneDrive",
  FIGMA: "🎨 Figma",
  LINEAR: "📋 Linear",
  ZENDESK: "🎧 Zendesk",
  INTERCOM: "💬 Intercom",
  MAILCHIMP: "📧 Mailchimp",
  TYPEFORM: "📝 Typeform",
  WEBFLOW: "🌐 Webflow",
  WORDPRESS: "📝 WordPress",
  REDDIT: "📱 Reddit",
  YOUTUBE: "▶️ YouTube",
  SPOTIFY: "🎵 Spotify",
  WHATSAPP: "💬 WhatsApp",
  TELEGRAM: "✈️ Telegram",
  TWILIO: "📱 Twilio",
  SENDGRID: "📧 SendGrid",
  POSTMARK: "📧 Postmark",
  PAGERDUTY: "🚨 PagerDuty",
  DATADOG: "📊 Datadog",
  SENTRY: "🐛 Sentry",
  VERCEL: "▲ Vercel",
  NETLIFY: "🌐 Netlify",
  AWS: "☁️ AWS",
  GCP: "☁️ Google Cloud",
  AZURE: "☁️ Azure",
  SNOWFLAKE: "❄️ Snowflake",
  SUPABASE: "🗄 Supabase",
  MONGODB: "🍃 MongoDB",
  POSTGRES: "🐘 PostgreSQL",
  MYSQL: "🗄 MySQL",
  REDIS: "🔴 Redis",
  OPENAI: "🤖 OpenAI",
  ANTHROPIC: "🤖 Anthropic",
};

function toolLabel(toolName: string): string {
  // 1. Exact match — internal tools (camelCase)
  if (toolName in INTERNAL_TOOL_LABELS) {
    return `${INTERNAL_TOOL_LABELS[toolName]}…`;
  }

  // 2. Composio convention: TOOLKIT_ACTION_NAME (all caps, underscores)
  //    Extract the toolkit prefix and look it up.
  if (toolName === toolName.toUpperCase() && toolName.includes("_")) {
    const prefix = toolName.split("_")[0];
    if (prefix in COMPOSIO_TOOLKIT_LABELS) {
      const action = toolName
        .slice(prefix.length + 1)
        .toLowerCase()
        .replace(/_/g, " ");
      return `${COMPOSIO_TOOLKIT_LABELS[prefix]}: ${action}…`;
    }
  }

  // 3. Generic fallback — humanise whatever the tool name is
  return `🔧 ${toolName.replace(/_/g, " ")}…`;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export const { POST } = serve<TelegramWorkflowPayload>(
  async (context) => {
    const sendFailure = async (message: string) => {
      try {
        await sendLongMessage(
          context.requestPayload.botToken,
          context.requestPayload.telegramChatId,
          message
        );
      } catch (error) {
        console.error(
          "[TelegramWorkflow] Failed to send failure message:",
          error
        );
      }
    };
    const {
      ownerUserId,
      botToken,
      telegramChatId,
      senderName,
      userText,
      baseUrl,
    } = context.requestPayload;
    const statusMessageId = await context.run("status-start", async () => {
      return sendStatusMessage(
        botToken,
        telegramChatId,
        "🤖 <b>Etles is on it</b>\n\nAnalyzing your request..."
      );
    });

    // ── Step 1: Get / create DB chat, persist user message ──────────────────────
    const chatId = await context.run("setup-chat", async () => {
      const id = await getOrCreateChat(ownerUserId, telegramChatId, senderName);

      await saveMessages({
        messages: [
          {
            id: generateUUID(),
            chatId: id,
            role: "user",
            parts: [{ type: "text" as const, text: userText }],
            attachments: [],
            createdAt: new Date(),
          },
        ] as any,
      });

      await touchUserActivity(ownerUserId);

      return id;
    });

    // ── Step 2: Load conversation history ───────────────────────────────────────
    // Returned as plain JSON so Workflow can cache and replay the step.
    const history = await context.run("load-history", async () => {
      if (statusMessageId) {
        await editMessageText(
          botToken,
          telegramChatId,
          statusMessageId,
          "🧠 <b>Etles is thinking</b>\n\nGathering conversation context..."
        );
      }
      const dbMessages = await getMessagesByChatId({ id: chatId });
      return dbMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => {
          const textPart = (m.parts as any[]).find(
            (p: any) => p.type === "text"
          );
          return {
            role: m.role as "user" | "assistant",
            content: textPart?.text ?? "",
          };
        })
        .filter((m) => m.content.length > 0);
    });

    // ── Step 3: Run AI (the expensive step — gets its own 300 s window) ──────────
    const { aiText, toolCallParts } = await context.run("run-ai", async () => {
      if (statusMessageId) {
        await editMessageText(
          botToken,
          telegramChatId,
          statusMessageId,
          "🛠 <b>Working with tools</b>\n\nCalling apps and planning the best answer..."
        );
      }
      const stopTyping = startTypingHeartbeat(botToken, telegramChatId);
      let composioTools: Record<string, unknown> = {};
      try {
        const session = await composio.create(ownerUserId, {
          manageConnections: true,
          multiAccount: { enable: true, maxAccountsPerToolkit: 5 },
        });
        composioTools = await session.tools();
      } catch (e) {
        console.error("[TelegramWorkflow] Composio tools failed:", e);
      }

      const telegramModel = getTelegramModel();
      const sessionTail = await getSessionTail(ownerUserId);
      const promptSignature = JSON.stringify({
        selectedChatModel: telegramModel.modelId,
        skipArtifacts: true,
        surface: "telegram-workflow",
      });

      let cachedPrompt = await getCachedSystemPrompt({
        userId: ownerUserId,
        scope: "telegram",
        signature: promptSignature,
      });

      if (!cachedPrompt) {
        cachedPrompt = systemPrompt({
          selectedChatModel: telegramModel.modelId,
          requestHints: {
            latitude: undefined,
            longitude: undefined,
            city: undefined,
            country: undefined,
          },
          sessionTail: [], // history is cached separately now
          skipArtifacts: true,
        });

        await setCachedSystemPrompt({
          userId: ownerUserId,
          scope: "telegram",
          signature: promptSignature,
          prompt: cachedPrompt,
        });
      }

      // Append session tail separately to the cached base prompt
      const { sessionTailPrompt } = await import("@/lib/ai/prompts");
      const corePrompt = `${cachedPrompt}${sessionTailPrompt(sessionTail ?? [])}`;

      const allMessages = [
        ...history,
        { role: "user" as const, content: userText },
      ];

      const tools = buildEtlesTelegramTools({
        userId: ownerUserId,
        chatId,
        baseUrl,
        composioTools,
      });

      const { text, toolCalls } = await generateText({
        model: telegramModel,
        system: corePrompt,
        messages: allMessages,
        stopWhen: stepCountIs(25),
        tools,
        onStepFinish: async ({ toolCalls: stepToolCalls }) => {
          // Update the status message with what the AI just did
          if (statusMessageId && stepToolCalls && stepToolCalls.length > 0) {
            const label = toolLabel(stepToolCalls[0].toolName);
            try {
              await editMessageText(
                botToken,
                telegramChatId,
                statusMessageId,
                `${label}…`
              );
            } catch {
              // Non-fatal — the status message update failing should never
              // stop the AI from producing a response.
            }
          }
        },
      }).finally(() => {
        stopTyping();
      });

      // Serialise tool calls for Workflow state caching
      const serialisedToolCalls =
        toolCalls?.map((tc) => ({
          type: "tool-call" as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: (tc as any).args,
        })) ?? [];

      return { aiText: text, toolCallParts: serialisedToolCalls };
    });

    // ── Step 4: Persist assistant message + deliver to Telegram ─────────────────
    // NOTE: Do NOT wrap context.run() in try/catch — @upstash/workflow throws
    // WorkflowAbort after each step intentionally. Catching it causes false
    // "Delivery failed" errors and workflow cancellation.
    await context.run("save-and-send", async () => {
      if (statusMessageId) {
        await editMessageText(
          botToken,
          telegramChatId,
          statusMessageId,
          "✅ <b>Done</b>\n\nSending your response..."
        );
      }
      await saveMessages({
        messages: [
          {
            id: generateUUID(),
            chatId,
            role: "assistant",
            parts: [
              { type: "text" as const, text: aiText },
              ...toolCallParts,
            ],
            attachments: [],
            createdAt: new Date(),
          },
        ] as any,
      });

      if (aiText.trim()) {
        await sendLongMessage(botToken, telegramChatId, aiText);
      } else {
        await sendFailure(
          "I completed the request but did not receive a text response. Please try again."
        );
      }

      const recent = await getMessagesByChatId({ id: chatId });
      const tail = recent
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-5)
        .map((m) => {
          const textPart = (
            m.parts as { type: string; text?: string }[]
          ).find((p) => p.type === "text");
          return {
            role: m.role as "user" | "assistant",
            text: textPart?.text ?? "",
          };
        })
        .filter((m) => m.text.length > 0);
      await saveSessionTail(ownerUserId, tail);
      if (statusMessageId) {
        await deleteMessage(botToken, telegramChatId, statusMessageId);
      }
    });
  },
  {
    baseUrl: WORKFLOW_BASE_URL,
  }
);
