//app/api/agent/workflow/failure/route.ts
import { Receiver } from "@upstash/qstash";
import { type NextRequest, NextResponse } from "next/server";
import { getAgentTaskByIdOnly, updateAgentTask } from "@/lib/db/queries";

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
    const { taskId, userId, error } = body as {
      taskId?: string;
      userId?: string;
      error?: string;
    };
    if (!taskId || !userId) {
      return NextResponse.json(
        { ok: false, error: "Missing taskId or userId" },
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
      result: { error: error ?? "Workflow failed" },
    });
  } catch (e) {
    console.error("[Workflow Failure] Handler error:", e);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
