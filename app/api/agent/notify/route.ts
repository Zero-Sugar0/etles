import { type NextRequest, NextResponse } from "next/server";
import { notifyWorkflow } from "@/lib/workflow/client";

const AGENT_NOTIFY_SECRET =
  process.env.AGENT_DELEGATE_SECRET?.trim() || process.env.AUTH_SECRET?.trim();

export async function POST(req: NextRequest) {
  if (!AGENT_NOTIFY_SECRET) {
    return NextResponse.json(
      { error: "Internal agent secret is not configured" },
      { status: 500 }
    );
  }
  const secret = req.headers.get("x-agent-secret");
  if (secret !== AGENT_NOTIFY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { eventId, eventData, workflowRunId } = body;
    if (!eventId || !eventData) {
      return NextResponse.json(
        { error: "Missing eventId or eventData" },
        { status: 400 }
      );
    }
    await notifyWorkflow(eventId, eventData, workflowRunId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[Agent Notify] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
