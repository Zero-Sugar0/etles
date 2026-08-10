/**
 * lib/workflow/client.ts
 *
 * Central Upstash Workflow client — every workflow trigger lives here.
 * This ensures one place to audit, one place to update base URLs, and
 * no import-time surprises from scattered trigger() calls.
 *
 * FIXED: triggerHeartbeatWorkflow + triggerWeeklySynthesisWorkflow now have
 * proper return types and are documented (were imported everywhere but barely defined).
 *
 * ADDED: triggerMorningBriefingWorkflow for personalized morning briefings.
 * ADDED: triggerCollaborationWorkflow for A2A multi-agent orchestration.
 */

import { Client as QStashClient } from "@upstash/qstash";
import { Client } from "@upstash/workflow";

const token = process.env.QSTASH_TOKEN;
const appBaseUrl =
  process.env.BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

/**
 * Public base URL used as the workflow step-callback origin.
 *
 * @upstash/workflow's serve() uses this (via the baseUrl option, or the
 * UPSTASH_WORKFLOW_URL env var) to override the origin it would otherwise
 * infer from the incoming request. Without it, if a request ever arrives with
 * a localhost origin, QStash rejects the step callback with:
 *   'invalid destination url: endpoint resolves to a loopback address: ::1'
 * which cancels the workflow run (heartbeat / morning / synthesis...).
 *
 * Prefer UPSTASH_WORKFLOW_URL (the documented global override — set it equal
 * to BASE_URL), then fall back to BASE_URL / RENDER_EXTERNAL_URL.
 */
export const WORKFLOW_BASE_URL =
  process.env.UPSTASH_WORKFLOW_URL ||
  process.env.BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export function getWorkflowClient(): Client | null {
  if (!token) {
    return null;
  }
  return new Client({
    baseUrl: process.env.QSTASH_URL,
    token,
  });
}

export function isWorkflowEnabled(): boolean {
  return Boolean(token && appBaseUrl);
}

// ── Sub-agent workflow ────────────────────────────────────────────────────────

export type WorkflowTriggerPayload = {
  taskId: string;
  userId: string;
  chatId: string;
  agentType: string;
  task: string;
  /** Optional: parent workflow run ID to notify when this task completes (A2A). */
  parentEventId?: string;
  /** Optional: parent workflow run ID for lookback notification. */
  parentWorkflowRunId?: string;
  /** Depth of this agent in the A2A spawn chain (root = 0). Used for recursion depth limits. */
  depth?: number;
  /** Task ID of the root agent — used to namespace the hourly spawn budget in Redis. */
  rootTaskId?: string;
};

export async function triggerAgentWorkflow(
  payload: WorkflowTriggerPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const workflowUrl = `${appBaseUrl}/api/agent/workflow`;
  const failureUrl = `${appBaseUrl}/api/agent/workflow/failure`;
  const { workflowRunId } = await client.trigger({
    url: workflowUrl,
    body: payload,
    retries: 3,
    failureUrl,
  });
  return { workflowRunId };
}

// ── Subagent chat workflow ────────────────────────────────────────────────────

export type SubagentChatWorkflowPayload = {
  taskId: string;
  userId: string;
  agentSlug: string;
  chatId?: string;
};

export async function triggerSubagentChatWorkflow(
  payload: SubagentChatWorkflowPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const workflowUrl = `${appBaseUrl}/api/subagents/chat/workflow`;
  const failureUrl = `${appBaseUrl}/api/subagents/chat/workflow/failure`;
  const { workflowRunId } = await client.trigger({
    url: workflowUrl,
    body: payload,
    retries: 3,
    failureUrl,
  });
  return { workflowRunId };
}

// ── Telegram workflow ─────────────────────────────────────────────────────────

export type TelegramWorkflowPayload = {
  ownerUserId: string;
  botToken: string;
  telegramChatId: number;
  senderName: string;
  userText: string;
  baseUrl: string;
};

export async function triggerTelegramWorkflow(
  payload: TelegramWorkflowPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const { workflowRunId } = await client.trigger({
    url: `${appBaseUrl}/api/telegram/workflow`,
    body: payload,
    retries: 3,
    failureUrl: `${appBaseUrl}/api/telegram/workflow/failure`,
  });
  return { workflowRunId };
}

// ── Composio webhook workflow ─────────────────────────────────────────────────

export type ComposioWebhookWorkflowPayload = {
  userId: string;
  triggerSlug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  chatId: string;
  eventId: string;
};

export async function triggerComposioWebhookWorkflow(
  payload: ComposioWebhookWorkflowPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const { workflowRunId } = await client.trigger({
    url: `${appBaseUrl}/api/composio/workflow`,
    body: payload,
    retries: 2,
  });
  return { workflowRunId };
}

// ── Agent-Run Workflow (slash /agent command) ─────────────────────────────────

export type AgentRunWorkflowPayload = {
  taskId: string;
  userId: string;
  chatId: string;
  /** The raw task text typed after /agent */
  task: string;
  /** Model ID, e.g. "google/gemini-3-flash" */
  model: string;
  /** User message ID — pre-generated by the browser so the DB write is idempotent */
  userMessageId: string;
};

export async function triggerAgentRunWorkflow(
  payload: AgentRunWorkflowPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const { workflowRunId } = await client.trigger({
    url: `${appBaseUrl}/api/agent/run/workflow`,
    body: payload,
    retries: 2,
    // No failureUrl needed — the trigger route handles cleanup if trigger itself fails.
  });
  return { workflowRunId };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Upstash API supports lookback via workflowRunId; @upstash/workflow types may lag. */
type NotifyParams = {
  eventId: string;
  eventData?: unknown;
  workflowRunId?: string;
};

export async function notifyWorkflow(
  eventId: string,
  eventData: Record<string, unknown>,
  workflowRunId?: string
): Promise<void> {
  const client = getWorkflowClient();
  if (!client) {
    return;
  }

  const notify = client.notify as (params: NotifyParams) => Promise<unknown>;
  await notify({
    eventId,
    eventData,
    ...(workflowRunId === undefined ? {} : { workflowRunId }),
  });
}

export async function cancelWorkflow(workflowRunId: string): Promise<void> {
  const client = getWorkflowClient();
  if (!client) {
    return;
  }

  await client.cancel({ ids: workflowRunId });
}

// ── Morning briefing workflow (NEW) ───────────────────────────────────────────

export type MorningBriefingPayload = {
  userId: string;
  /** User's local time preference, e.g. "08:00" */
  preferredTime?: string;
};

/**
 * Triggers the focused morning briefing — a faster, leaner version of the
 * heartbeat designed to fire at the user's configured wake-up time.
 * Route: POST /api/agent/morning/workflow
 */
export async function triggerMorningBriefingWorkflow(
  payload: MorningBriefingPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const { workflowRunId } = await client.trigger({
    url: `${appBaseUrl}/api/agent/morning/workflow`,
    body: payload,
    retries: 2,
  });
  return { workflowRunId };
}

// ── Heartbeat and Synthesis triggers ──────────────────────────────────────────

export type HeartbeatWorkflowPayload = {
  userId: string;
};

/**
 * Triggers the hourly background intelligence scan for a user.
 * Route: POST /api/agent/heartbeat/workflow
 */
export async function triggerHeartbeatWorkflow(
  payload: HeartbeatWorkflowPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const { workflowRunId } = await client.trigger({
    url: `${appBaseUrl}/api/agent/heartbeat/workflow`,
    body: payload,
    retries: 2,
  });
  return { workflowRunId };
}

export type SynthesisWorkflowPayload = {
  userId: string;
};

/**
 * Triggers the Monday 8am weekly synthesis workflow.
 * Route: POST /api/agent/heartbeat/synthesis
 */
export async function triggerWeeklySynthesisWorkflow(
  payload: SynthesisWorkflowPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const { workflowRunId } = await client.trigger({
    url: `${appBaseUrl}/api/agent/heartbeat/synthesis`,
    body: payload,
    retries: 2,
  });
  return { workflowRunId };
}

// ── A2A collaboration workflow (NEW) ──────────────────────────────────────────

export type CollaborationTaskPayload = {
  /** The taskId of the child agent being spawned */
  taskId: string;
  userId: string;
  chatId: string;
  agentType: string;
  task: string;
  /**
   * The eventId that the parent workflow is waiting on.
   * Child agent notifies this event when it completes.
   * Format: "collab:{coordinationId}:{taskId}"
   */
  parentEventId: string;
  /** Optional: workflowRunId of the parent for lookback notification */
  parentWorkflowRunId?: string;
};

/**
 * Triggers a child agent workflow for A2A collaboration.
 * The child will call notifyWorkflow(parentEventId) when done so the parent
 * can use context.waitForEvent() to collect results.
 */
export async function triggerCollaborationWorkflow(
  payload: CollaborationTaskPayload
): Promise<{ workflowRunId: string } | null> {
  const client = getWorkflowClient();
  if (!client || !appBaseUrl) {
    return null;
  }

  const workflowUrl = `${appBaseUrl}/api/agent/workflow`;
  const failureUrl = `${appBaseUrl}/api/agent/workflow/failure`;

  const { workflowRunId } = await client.trigger({
    url: workflowUrl,
    body: payload as WorkflowTriggerPayload,
    retries: 2,
    failureUrl,
  });
  return { workflowRunId };
}

export async function registerUserCrons(userId: string): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  if (!token || !appBaseUrl) {
    return;
  }

  const heartbeatUrl = `${appBaseUrl}/api/agent/heartbeat`;
  const heartbeatSecret = process.env.AGENT_DELEGATE_SECRET ?? "dev-internal";
  const qstash = new QStashClient({
    token,
    baseUrl: process.env.QSTASH_URL,
  });

  const results: Record<string, string> = {};

  try {
    const heartbeat = await qstash.schedules.create({
      destination: heartbeatUrl,
      cron: "0 * * * *",
      body: JSON.stringify({ userId, type: "heartbeat" }),
      headers: {
        "Content-Type": "application/json",
        "x-heartbeat-secret": heartbeatSecret,
      },
      scheduleId: `hb-${userId}`,
    });
    results.heartbeatScheduleId = heartbeat.scheduleId;
  } catch (err) {
    console.error("[registerUserCrons] heartbeat schedule failed:", err);
  }

  try {
    const synthesis = await qstash.schedules.create({
      destination: heartbeatUrl,
      cron: "0 8 * * 1",
      body: JSON.stringify({ userId, type: "weekly_synthesis" }),
      headers: {
        "Content-Type": "application/json",
        "x-heartbeat-secret": heartbeatSecret,
      },
      scheduleId: `syn-${userId}`,
    });
    results.synthesisScheduleId = synthesis.scheduleId;
  } catch (err) {
    console.error("[registerUserCrons] synthesis schedule failed:", err);
  }

  // Morning briefing cron — created so pause/resume of `morning-{userId}` is valid.
  try {
    const morning = await qstash.schedules.create({
      destination: `${appBaseUrl}/api/agent/morning/workflow`,
      cron: "0 8 * * *",
      body: JSON.stringify({ userId }),
      headers: {
        "Content-Type": "application/json",
        "x-heartbeat-secret": heartbeatSecret,
      },
      scheduleId: `morning-${userId}`,
    });
    results.morningScheduleId = morning.scheduleId;
  } catch (err) {
    console.error("[registerUserCrons] morning briefing schedule failed:", err);
  }

  // Persist schedule IDs so getAgentSystemStatus shows ACTIVE
  if (
    results.heartbeatScheduleId &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const existing =
      (await redis.get<Record<string, string>>(
        `agent:heartbeat:schedules:${userId}`
      )) ?? {};
    await redis.set(
      `agent:heartbeat:schedules:${userId}`,
      JSON.stringify({ ...existing, ...results }),
      { ex: 60 * 60 * 24 * 365 }
    );
  }
}

export async function pauseUserCrons(userId: string): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";
  if (!token) {
    return;
  }

  await Promise.allSettled([
    fetch(`${qstashUrl}/v2/schedules/hb-${userId}/pause`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${qstashUrl}/v2/schedules/syn-${userId}/pause`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${qstashUrl}/v2/schedules/morning-${userId}/pause`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);
}

export async function resumeUserCrons(userId: string): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";
  if (!token) {
    return;
  }

  await Promise.allSettled([
    fetch(`${qstashUrl}/v2/schedules/hb-${userId}/resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${qstashUrl}/v2/schedules/syn-${userId}/resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${qstashUrl}/v2/schedules/morning-${userId}/resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);
}
