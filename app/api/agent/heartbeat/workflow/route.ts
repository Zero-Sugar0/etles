/**
 * Heartbeat Workflow — durable proactive agent.
 * Route: POST /api/agent/heartbeat/workflow/
 *
 * Triggered every four hours per user by QStash cron → /api/agent/heartbeat
 * which calls triggerHeartbeatWorkflow() → this endpoint.
 *
 * Steps:
 * 1. recall-context  — pull recent memory + weekly synthesis
 * 2. check-signals   — composio tools to check calendar, email, tasks
 * 3. decide-and-act  — AI decides if proactive message is warranted
 * 4. deliver         — save to chat + push Telegram if needed
 */

import { serve } from "@upstash/workflow/nextjs";
import { generateText, stepCountIs } from "ai";
import { getBackgroundModel } from "@/lib/ai/providers";
import { getActiveGoalsSnapshot } from "@/lib/ai/tools/goals";
import { searchKnowledgeGraph } from "@/lib/ai/tools/knowledge-graph";
import { searchFreshNews } from "@/lib/ai/tools/tavily-search";
import {
  getActiveAgentTasksByChatId,
  getBotIntegration,
  getChatsByUserId,
  saveMessages,
} from "@/lib/db/queries";
import { sendLongMessage } from "@/lib/telegram/api";
import {
  markSilenceCheckInSent,
  shouldSendSilenceCheckIn,
} from "@/lib/user-activity";
import { generateUUID } from "@/lib/utils";
import { getUserRedis } from "@/lib/security/user-credentials";
import { WORKFLOW_BASE_URL } from "@/lib/workflow/client";
import { getComposioClient } from "@/lib/composio-client";

export const maxDuration = 300;

export type HeartbeatPayload = {
  userId: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isRecentOrFuture(value: unknown, cutoffMs: number): boolean {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= cutoffMs;
}

function normalizeSignals(
  value: {
    hasUrgentItems: boolean;
    hasNews: boolean;
    hasNewItems: boolean;
    urgentSummary: string;
    emailSnapshot: Array<{ subject: string; sender: string; receivedAt: string; importance: string }>;
    items: Array<{ category: "urgent" | "informational" | "already_reported"; summary: string; source: string; occurredAt: string; fingerprint: string; actionTaken: string; needsUser: boolean }>;
    news: Array<{ headline: string; source: string; url: string; publishedAt?: string; whyItMatters: string }>;
    connectionSuggestions: Array<{ service: string; why: string; help: string }>;
    actionsTaken: string[];
    actionsNeedingUser: string[];
  },
  nowMs: number
) {
  const emailCutoff = nowMs - 7 * MS_PER_DAY;
  const emailSnapshot = value.emailSnapshot.filter((email) =>
    isRecentOrFuture(email.receivedAt, emailCutoff)
  );
  const items = value.items.filter((item) =>
    item.source.toLowerCase() !== "email" ||
    isRecentOrFuture(item.occurredAt, emailCutoff)
  );
  const hasUrgentItems = items.some((item) => item.category === "urgent");
  const hasNewItems = items.some((item) => item.category !== "already_reported");

  return {
    ...value,
    emailSnapshot,
    items,
    hasUrgentItems,
    hasNewItems,
    urgentSummary: hasUrgentItems ? value.urgentSummary : "",
  };
}

export const { POST } = serve<HeartbeatPayload>(async (context) => {
  const { userId } = context.requestPayload;
  const runStartedAt = new Date();
  const currentDateTime = runStartedAt.toISOString();
  const currentDate = currentDateTime.slice(0, 10);
  const emailCutoffDate = new Date(
    runStartedAt.getTime() - 7 * MS_PER_DAY
  ).toISOString();

  // A schedule pause can race with a delivery that is already in-flight.
  // Re-check the durable flag before any memory, integration, or model work.
  const isPaused = await context.run("check-heartbeat-paused", async () => {
    const redis = await getUserRedis(userId);
    if (!redis) return false;
    const paused = await redis.get(`agent:status:${userId}:paused`);
    return paused === true || paused === "true";
  });

  if (isPaused) {
    console.log(`[Heartbeat] Skipped paused workflow for user: ${userId}`);
    return { ok: true, skipped: "paused" };
  }

  console.log(`[Heartbeat] Starting workflow for user: ${userId}`);

  // ── Step 1: Recall context ────────────────────────────────────────────────
  const memoryContext = await context.run("recall-context", async () => {
    try {
      const index = new (await import("@upstash/vector")).Index({
        url: process.env.UPSTASH_VECTOR_REST_URL!,
        token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      });
      const ns = index.namespace(`memory-${userId}`);

      // Recall recent priorities and weekly synthesis in parallel
      const [priorities, heartbeatReports, latestSynthesis] = await Promise.all([
        ns.query({
          data: "priorities commitments urgent tasks deadlines",
          topK: 8,
          includeMetadata: true,
        }),
        ns.query({
          data: "heartbeat report what Etles previously informed the user proactive update",
          topK: 8,
          includeMetadata: true,
        }),
        ns.fetch(["weekly_synthesis"]),
      ]);

      const memoryLines = priorities
        .map((r) => {
          const metadata = r.metadata as any;
          const date = metadata?.reportedAt ?? metadata?.updatedAt ?? metadata?.savedAt;
          return metadata?.content ? `[${date ?? "undated"}] ${metadata.content}` : null;
        })
        .filter(Boolean)
        .join("\n");
      const reportLines = heartbeatReports
        .map((r) => {
          const metadata = r.metadata as any;
          const date = metadata?.reportedAt ?? metadata?.updatedAt ?? metadata?.savedAt;
          return metadata?.content ? `[${date ?? "undated"}] ${metadata.content}` : null;
        })
        .filter(Boolean)
        .join("\n");
      const latestSynthesisMetadata = latestSynthesis[0]?.metadata as any;
      const weeklyBrief = latestSynthesisMetadata?.content ?? "";

      const [goals, graph] = await Promise.all([
        getActiveGoalsSnapshot(userId, 5),
        searchKnowledgeGraph({ userId }).execute?.(
          {
            query: "user identity priorities projects people commitments risks",
            limit: 8,
          },
          {} as never
        ),
      ]);

      return {
        memoryLines: [memoryLines, reportLines ? `Previous heartbeat reports:\n${reportLines}` : ""]
          .filter(Boolean)
          .join("\n"),
        weeklyBrief,
        goals,
        graph: graph ?? { success: false, results: [] },
      };
    } catch {
      return { memoryLines: "", weeklyBrief: "", goals: [], graph: { results: [] } };
    }
  });

  // ── Step 2: Get active chat + open tasks ──────────────────────────────────
  const contextData = await context.run("load-tasks-and-chat", async () => {
    const { chats } = await getChatsByUserId({
      id: userId,
      limit: 1,
      startingAfter: null,
      endingBefore: null,
    });
    const activeChat = chats[0];
    if (!activeChat) {
      return { chatId: null as string | null, openTasks: [] as string[] };
    }

    const tasks = await getActiveAgentTasksByChatId(activeChat.id, userId);
    const openTasks = tasks.map((t) => `[${t.agentType}] ${t.task}`);
    return { chatId: activeChat.id, openTasks };
  });

  // ── Step 3: Load Composio signals (calendar, email) ───────────────────────
  const news = await context.run("check-current-news", async () => {
    if (!process.env.TAVILY_API_KEY) return [];
    try {
      const focus = [memoryContext.memoryLines, memoryContext.weeklyBrief]
        .filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 1200);
      const query = focus
        ? `latest important news in the last 48 hours relevant to these user priorities: ${focus}`
        : "latest important world, business, technology, and local news in the last 48 hours";
      return await searchFreshNews(query, { days: 2, maxResults: 6 });
    } catch (error) {
      console.error("[Heartbeat] current-news search failed:", error);
      return [];
    }
  });

  const signals = await context.run("check-signals", async () => {
    let composioTools: Record<string, unknown> = {};
    try {
      const session = await (await getComposioClient(userId)).create(userId, {
        multiAccount: { enable: true, maxAccountsPerToolkit: 5 },
      });
      composioTools = (await session.tools()) as Record<string, unknown>;
    } catch {
      /* Composio optional */
    }

    try {
      const result = await generateText({
        model: getBackgroundModel(),
        system: `You are Etles's background intelligence scanner. The authoritative current UTC date is ${currentDate}; the authoritative current UTC timestamp is ${currentDateTime}. Before deciding anything, inspect the connected tools available to you. Graph freshness: entities, facts, and relations are dated. Prefer the newest relevant confirmed fact, include dates when freshness changes the conclusion, and do not treat stale conflicting graph data as current without verification.

DATE SAFETY RULES (mandatory):
- Treat an email as current only when its receivedAt is a valid ISO timestamp on or after ${emailCutoffDate}. Older or undated email may be background context, never an urgent or actionable heartbeat item.
- Never tell the user to check, reply to, or act on an old billing/payment email merely because it exists in search results. Require a recent message or a current open payment/task status.
- Calendar checks focus on future events in the next 24 hours. Tasks may remain relevant when overdue, but include their due date and explicitly say they are overdue.
- Every surfaced item must include a concrete ISO date or say it is undated; undated items cannot be urgent.

You MUST attempt these checks when the relevant Composio tools are available:
1. Gmail or email: retrieve exactly the 3 newest relevant emails when at least 3 exist. Use newest-first ordering or an explicit recent-date filter. If fewer than 3 exist, return every available email and state the count. Never substitute older search results for the newest messages.
2. Google Calendar or calendar: retrieve events in the next 24 hours, with special attention to the next 4 hours, conflicts, and preparation needs.
3. Connected task/project tools: retrieve overdue and due-soon work.
If a connection or tool is unavailable, skip it without guessing and report that it was not connected. Never claim an email or event was checked unless a tool returned it.

Return a JSON object with this exact shape:
{
"hasUrgentItems": boolean,
"hasNews": boolean,
"hasNewItems": boolean,
  "urgentSummary": "1-3 sentence plain text summary if urgent, empty string if not",
"emailSnapshot": [{"subject":"...","sender":"...","receivedAt":"...","importance":"urgent|important|normal"}],
"items": [{"category":"urgent|informational|already_reported","summary":"...","source":"email|calendar|task|news|other","occurredAt":"ISO date or unknown","fingerprint":"stable concise identifier","actionTaken":"what Etles did, or none","needsUser":true}],
"news": [{"headline":"...","source":"...","url":"...","publishedAt":"...","whyItMatters":"..."}],
"connectionSuggestions": [{"service":"Gmail","why":"...","help":"..."}],
"actionsTaken": ["safe action completed"],
"actionsNeedingUser": ["action requiring user approval"]
}

Check: upcoming calendar events (next 4 hours), unread high-priority emails received since ${emailCutoffDate}, overdue tasks.
Also review the supplied current-news results. Include news only when it is relevant and published within the last 48 hours. Never invent headlines, dates, sources, URLs, or implications. Set hasNews true only when at least one supplied result is genuinely useful to this user, even if it is not urgent.
Be selective — only flag genuinely urgent items. If nothing urgent, set hasUrgentItems: false.
Compare findings with previous heartbeat reports supplied in context. Mark unchanged findings as already_reported and set hasNewItems false when there is no new or materially changed item.
Safe execution policy: resolve low-risk internal work when the connected tool supports it, such as updating a clearly completed task or recording a follow-up. Draft but do not send external messages, make payments, delete data, or change appointments without user approval. Record every action in actionsTaken or actionsNeedingUser.
Return ONLY the JSON object, no other text.`,
        prompt: `Current date/time: ${new Date().toISOString()}\n\nKnown user memory:\n${memoryContext.memoryLines}\n\nActive goals:\n${JSON.stringify(memoryContext.goals)}\n\nKnowledge graph context:\n${JSON.stringify(memoryContext.graph)}\n\nOpen tasks:\n${contextData.openTasks.join("\n") || "None"}\n\nAvailable Composio tools (use these to inspect connected services):\n${Object.keys(composioTools).join(", ") || "None"}\n\nFresh news search results (use only supplied URLs):\n${JSON.stringify(news)}\n\nNow perform the required email, calendar, and task checks before deciding.`,
        tools: composioTools as any,
        stopWhen: stepCountIs(5),
      });

      const clean = result.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean) as {
        hasUrgentItems: boolean;
        hasNews: boolean;
        hasNewItems: boolean;
        urgentSummary: string;
        emailSnapshot: Array<{ subject: string; sender: string; receivedAt: string; importance: string }>;
        items: Array<{ category: "urgent" | "informational" | "already_reported"; summary: string; source: string; occurredAt: string; fingerprint: string; actionTaken: string; needsUser: boolean }>;
        news: Array<{ headline: string; source: string; url: string; publishedAt?: string; whyItMatters: string }>;
        connectionSuggestions: Array<{ service: string; why: string; help: string }>;
        actionsTaken: string[];
        actionsNeedingUser: string[];
      };
      return normalizeSignals(parsed, runStartedAt.getTime());
    } catch (error) {
      // Never let a model/tool failure crash the heartbeat — degrade gracefully.
      console.error("[Heartbeat] check-signals failed:", error);
      return { hasUrgentItems: false, hasNews: false, hasNewItems: false, urgentSummary: "", emailSnapshot: [], items: [], news: [], connectionSuggestions: [], actionsTaken: [], actionsNeedingUser: [] };
    }
  });

  // Persist every scan, including quiet scans, as a structured dated audit record.
  await context.run("save-heartbeat-history", async () => {
    try {
      const index = new (await import("@upstash/vector")).Index({
        url: process.env.UPSTASH_VECTOR_REST_URL!,
        token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
      });
      const ns = index.namespace(`memory-${userId}`);
      const runAt = new Date().toISOString();
      const runId = `heartbeat_run_${runAt.replace(/[^0-9]/g, "")}_${generateUUID()}`;
      const record = {
        runId,
        runAt,
        hasUrgentItems: signals.hasUrgentItems,
        hasNewItems: signals.hasNewItems,
        emailSnapshot: signals.emailSnapshot,
        items: signals.items,
        news: signals.news,
        connectionSuggestions: signals.connectionSuggestions,
        actionsTaken: signals.actionsTaken,
        actionsNeedingUser: signals.actionsNeedingUser,
      };
      await ns.upsert({
        id: runId,
        data: `Heartbeat scan ${runAt}: ${JSON.stringify(record)}`,
        metadata: {
          key: runId,
          content: JSON.stringify(record),
          tags: ["heartbeat", "history", "structured"],
          source: "heartbeat",
          reportedAt: runAt,
          savedAt: runAt,
          updatedAt: runAt,
        },
      });
    } catch (error) {
      console.error("[Heartbeat] history persistence failed:", error);
    }
  });

  // ── Step 4: Update Heartbeat Status (always — dashboard reads this even without a chat)
  await context.run("update-status", async () => {
    const redis =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new (await import("@upstash/redis")).Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          })
        : null;
    if (!redis) {
      return;
    }

    await redis.set(
      `agent:status:${userId}:heartbeat`,
      JSON.stringify({
        lastRun: new Date().toISOString(),
        status: "success",
      }),
      { ex: 86_400 * 7 }
    );
  });

  // ── Step 5: Gentle check-in if we have not heard from the user in a while ─
  await context.run("silence-check-in", async () => {
    const { should } = await shouldSendSilenceCheckIn(userId);
    if (!should) {
      return;
    }

    const integration = await getBotIntegration({
      userId,
      platform: "telegram",
    });
    if (!integration) {
      return;
    }

    const redis =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new (await import("@upstash/redis")).Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          })
        : null;
    if (!redis) {
      return;
    }

    const keys = await redis.keys(`tg:chat:${userId}:*`);
    if (keys.length === 0) {
      return;
    }

    const checkIn =
      "<b>Quick check-in</b>\n\n" +
      "I have not heard from you in a bit. If anything is blocking you or you want me to pick something up, reply here and I will jump on it.";
    const goals = await getActiveGoalsSnapshot(userId, 1);
    const goalHint =
      goals.length > 0
        ? `\n\n<b>Goal focus:</b> ${goals[0].title}${
            goals[0].nextAction ? `\nNext action: ${goals[0].nextAction}` : ""
          }`
        : "";
    const checkInWithGoals = `${checkIn}${goalHint}`;

    for (const key of keys) {
      const telegramChatId = Number(key.split(":").at(-1));
      if (!Number.isNaN(telegramChatId)) {
        await sendLongMessage(
          integration.botToken,
          telegramChatId,
          checkInWithGoals
        );
      }
    }

    await markSilenceCheckInSent(userId);

    if (contextData.chatId) {
      await saveMessages({
        messages: [
          {
            id: generateUUID(),
            chatId: contextData.chatId,
            role: "assistant",
            parts: [
              { type: "text", text: checkInWithGoals.replace(/<\/?b>/g, "") },
            ],
            attachments: [],
            createdAt: new Date(),
          },
        ] as any,
      });

    }
  });

  if (!contextData.chatId) {
    return;
  }

  // No urgent items — stop here, don't bother the user further
  if (!signals.hasNewItems || (!signals.hasUrgentItems && !signals.hasNews)) {
    return;
  }

  // ── Step 6: Generate proactive message ────────────────────────────────────
  const proactiveMessage = await context.run("generate-message", async () => {
    const { text } = await generateText({
      model: getBackgroundModel(),
      system: `You are Etles, the user's proactive AI chief of staff. You're reaching out because something important needs their attention.

Write a SHORT, direct Telegram message (max 6 sentences). No fluff. Lead with the concrete item and recommended next action. If news is included, name the source and link the supplied URL; never present an old or unverified item as breaking news. Do not repeat generic check-in language. Use Telegram HTML formatting only: <b>bold</b>, <i>italic</i>, and <a href="URL">source</a>.`,
      prompt: `Current date/time: ${new Date().toISOString()}\n\nUrgent items detected:\n${signals.urgentSummary}\n\nDetails:\n${signals.items.map((item) => typeof item === "string" ? item : `${item.category}: ${item.summary} (${item.actionTaken || "no action"})`).join("\n")}\n\nVerified fresh news candidates:\n${JSON.stringify(signals.news ?? [])}\n\nConnection suggestions:\n${JSON.stringify(signals.connectionSuggestions ?? [])}\n\nActions already taken:\n${JSON.stringify(signals.actionsTaken ?? [])}\n\nActions needing user:\n${JSON.stringify(signals.actionsNeedingUser ?? [])}\n\nKnown user context:\n${JSON.stringify({ goals: memoryContext.goals, graph: memoryContext.graph })}\n\nWeekly context:\n${memoryContext.weeklyBrief}`,
    });
    return text.trim();
  });

  // ── Step 7: Save to chat + push Telegram ─────────────────────────────────
  console.log(`[Heartbeat] Delivering urgent notification to user: ${userId}`);
  await context.run("deliver", async () => {
    // Save to chat
    await saveMessages({
      messages: [
        {
          id: generateUUID(),
          chatId: contextData.chatId!,
          role: "assistant",
          parts: [{ type: "text", text: proactiveMessage }],
          attachments: [],
          createdAt: new Date(),
        },
      ] as any,
    });

    const reportDate = new Date().toISOString();
    const index = new (await import("@upstash/vector")).Index({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    });
    const ns = index.namespace(`memory-${userId}`);
    const reportId = `heartbeat_report_${reportDate.replace(/[^0-9]/g, "")}_${generateUUID()}`;
    await ns.upsert({
      id: reportId,
      data: `Heartbeat report from ${reportDate}: ${proactiveMessage}`,
      metadata: {
        key: reportId,
        content: proactiveMessage,
        tags: ["heartbeat", "report", "proactive"],
        source: "heartbeat",
        reportedAt: reportDate,
        savedAt: reportDate,
        updatedAt: reportDate,
      },
    });

    // Push via Telegram if connected
    const integration = await getBotIntegration({
      userId,
      platform: "telegram",
    });
    if (!integration) {
      return;
    }

    // Get the user's Telegram chat ID from Redis
    const redis =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new (await import("@upstash/redis")).Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          })
        : null;
    if (!redis) {
      return;
    }

    // Scan for tg:chat:{userId}:* keys to find active Telegram chats
    const keys = await redis.keys(`tg:chat:${userId}:*`);
    for (const key of keys) {
      const telegramChatId = Number(key.split(":").at(-1));
      if (!isNaN(telegramChatId)) {
        await sendLongMessage(
          integration.botToken,
          telegramChatId,
          proactiveMessage
        );
      }
    }
  });
}, { baseUrl: WORKFLOW_BASE_URL });
