import { type NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { auth } from "@/app/(auth)/auth";
import {
  createAgentScheduleEvent,
  deleteAgentSchedule,
  getAgentSchedule,
  listAgentScheduleEvents,
  updateAgentSchedule,
} from "@/lib/db/queries/agent-calendar";
import { generateUUID } from "@/lib/utils";

async function cancelQStashJob(qstashId?: string | null, kind?: string | null) {
  if (!qstashId) return;
  try {
    const client = new Client({
      baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io",
      token: process.env.QSTASH_TOKEN || "not-needed",
    });
    if (kind === "cron") {
      await client.schedules.delete(qstashId);
    } else {
      await client.messages.delete(qstashId);
    }
  } catch (err) {
    console.warn("[calendar.cancelQStashJob] QStash cleanup warning:", err);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const schedule = await getAgentSchedule(session.user.id, id);
  if (!schedule)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    schedule,
    events: await listAgentScheduleEvents(session.user.id, id),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getAgentSchedule(session.user.id, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const action = String(body.action ?? "");
  const status =
    action === "pause"
      ? "paused"
      : action === "resume"
        ? "active"
        : action === "cancel"
          ? "cancelled"
          : action === "retry"
            ? "active"
            : undefined;

  if (action === "cancel") {
    await cancelQStashJob(existing.qstashId, existing.kind);
  }

  const schedule = status
    ? await updateAgentSchedule(session.user.id, id, {
        status,
        lastError: action === "retry" ? null : undefined,
      })
    : await updateAgentSchedule(session.user.id, id, {
        nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : undefined,
        timezone: body.timezone,
      });

  if (!schedule)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await createAgentScheduleEvent({
    id: generateUUID(),
    scheduleId: id,
    userId: session.user.id,
    eventKey: `${id}:${action}:${Date.now()}`,
    type: action || "updated",
    metadata: body,
  });

  return NextResponse.json({ schedule });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getAgentSchedule(session.user.id, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await cancelQStashJob(existing.qstashId, existing.kind);

  const schedule = await deleteAgentSchedule(session.user.id, id);
  if (!schedule)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await createAgentScheduleEvent({
    id: generateUUID(),
    scheduleId: id,
    userId: session.user.id,
    eventKey: `${id}:cancelled:${Date.now()}`,
    type: "cancelled",
    metadata: {},
  });

  return NextResponse.json({ schedule });
}
