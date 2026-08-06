/**
 * app/api/agent/webhook-worker/route.ts
 *
 * Durable QStash worker for processing webhook-triggered agent tasks.
 *
 * This replaces the `waitUntil` approach in the webhook trigger route.
 * QStash POSTs here when a webhook triggers an agent. The worker:
 *   1. Verifies the QStash signature (ensures only QStash can call this)
 *   2. Runs the agent task
 *   3. Returns 2xx on success (QStash marks delivered)
 *   4. Returns 5xx on failure (QStash retries with backoff, up to configured retries)
 *
 * Hosting note: This route is designed to run on Render (no 60s limit) or
 * Vercel Pro/Enterprise. maxDuration is set to 300 seconds (5 minutes).
 * Adjust via the WEBHOOK_WORKER_TIMEOUT_SECS env var if needed.
 */

import { Receiver } from "@upstash/qstash";
import { type NextRequest, NextResponse } from "next/server";
import { runSubAgent } from "@/lib/agent/subagent-runner";
import { createAgentTask, getChatsByUserId } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

export const maxDuration = 300;

export interface WebhookWorkerPayload {
  userId: string;
  agentSlug: string;
  task: string;
  chatId?: string;
  triggerName?: string;
  /** Optional: parent event ID for A2A notification */
  parentEventId?: string;
}

function getReceiver(): Receiver | null {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return null;
  }
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
}

export async function POST(req: NextRequest) {
  // ── Signature verification ────────────────────────────────────────────────
  const receiver = getReceiver();
  if (receiver) {
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing upstash-signature header" },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    const isValid = await receiver.verify({
      signature,
      body: rawBody,
    }).catch(() => false);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid QStash signature" },
        { status: 401 }
      );
    }

    // Parse body after verification
    let payload: WebhookWorkerPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    return await processPayload(payload);
  }

  // ── Dev mode: no signature verification ──────────────────────────────────
  // QSTASH signing keys not set — allow in development only
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "QSTASH_CURRENT_SIGNING_KEY not configured" },
      { status: 500 }
    );
  }

  const payload = (await req.json()) as WebhookWorkerPayload;
  return await processPayload(payload);
}

async function processPayload(payload: WebhookWorkerPayload): Promise<NextResponse> {
  const { userId, agentSlug, task, triggerName, parentEventId } = payload;

  if (!userId || !agentSlug || !task) {
    return NextResponse.json(
      { error: "Missing required fields: userId, agentSlug, task" },
      { status: 400 }
    );
  }

  // Resolve chatId — use provided or fall back to the user's most recent chat
  let chatId = payload.chatId;
  if (!chatId) {
    try {
      const result = await getChatsByUserId({
        id: userId,
        limit: 1,
        startingAfter: null,
        endingBefore: null,
      });
      chatId = result?.chats?.[0]?.id;
    } catch {
      // non-fatal — agent will run without a chatId (no message persistence)
    }
  }

  const taskId = generateUUID();

  try {
    // Create the DB task record before running so it's visible in the UI
    await createAgentTask({
      id: taskId,
      userId,
      chatId,
      agentType: agentSlug,
      task,
    });
  } catch (err) {
    console.error("[webhook-worker] Failed to create agent task record:", err);
    // Non-fatal — continue with the run
  }

  console.log(
    `[webhook-worker] Running agent "${agentSlug}" for user ${userId}` +
      (triggerName ? ` (trigger: ${triggerName})` : "")
  );

  try {
    const result = await runSubAgent({
      taskId,
      userId,
      chatId,
      agentType: agentSlug,
      task,
      parentEventId,
    });

    if (result.success) {
      return NextResponse.json({ success: true, taskId }, { status: 200 });
    }

    // Agent ran but reported failure — return 5xx so QStash retries
    console.error(`[webhook-worker] Agent "${agentSlug}" reported failure:`, result.error);
    return NextResponse.json(
      { success: false, error: result.error, taskId },
      { status: 500 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook-worker] Unhandled error for agent "${agentSlug}":`, msg);
    // Return 5xx to trigger QStash retry
    return NextResponse.json(
      { success: false, error: msg, taskId },
      { status: 500 }
    );
  }
}
