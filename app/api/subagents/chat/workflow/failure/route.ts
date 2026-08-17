// app/api/subagents/chat/workflow/failure/route.ts
// Called by Upstash Workflow when all retries are exhausted.

import { Receiver } from "@upstash/qstash";
import { type NextRequest, NextResponse } from "next/server";
import { getAgentTaskByIdOnly, updateAgentTask } from "@/lib/db/queries";
import {
  getSubagentChatMessages,
  saveSubagentChatMessages,
} from "@/lib/subagent-redis";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

function getReceiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

export async function POST(req: NextRequest) {
  const receiver = getReceiver();
  let rawBody: string;

  if (receiver) {
    rawBody = await req.text();
    const signature = req.headers.get("upstash-signature") ?? "";
    const valid = await receiver
      .verify({ signature, body: rawBody, clockTolerance: 5 })
      .catch(() => false);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "QSTASH signing keys are not configured" },
        { status: 500 }
      );
    }
    const expected = process.env.AGENT_DELEGATE_SECRET?.trim();
    if (!expected || req.headers.get("x-agent-secret") !== expected) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    rawBody = await req.text();
  }

  try {
    const body = JSON.parse(rawBody);
    const { taskId, userId, agentSlug, error } = body as {
      taskId?: string;
      userId?: string;
      agentSlug?: string;
      error?: string;
    };

    if (!taskId || !userId || !agentSlug) {
      return NextResponse.json(
        { ok: false, error: "Missing taskId, userId, or agentSlug" },
        { status: 400 }
      );
    }

    const task = await getAgentTaskByIdOnly(taskId);
    if (!task || task.userId !== userId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    await updateAgentTask({
      id: taskId,
      userId: task.userId,
      status: "failed",
      result: { error: error ?? "Workflow failed after all retries" },
    });

    // Save error message to Redis chat so the user sees the failure
    const messages = await getSubagentChatMessages(task.userId, agentSlug);
    const errorMessage: ChatMessage = {
      id: generateUUID(),
      role: "assistant",
      parts: [
        {
          type: "text" as const,
          text: `⚠️ The agent encountered an error and could not complete the task: ${error ?? "Unknown error"}. Please try again.`,
        },
      ],
    } as any;
    await saveSubagentChatMessages(task.userId, agentSlug, [
      ...messages,
      errorMessage,
    ]);
  } catch (e) {
    console.error("[Subagent Chat Workflow Failure] Handler error:", e);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
