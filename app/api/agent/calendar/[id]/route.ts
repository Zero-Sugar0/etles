import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { createAgentScheduleEvent, deleteAgentSchedule, getAgentSchedule, listAgentScheduleEvents, updateAgentSchedule } from "@/lib/db/queries/agent-calendar";
import { generateUUID } from "@/lib/utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const schedule = await getAgentSchedule(session.user.id, id);
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ schedule, events: await listAgentScheduleEvents(session.user.id, id) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const action = String(body.action ?? "");
  const status = action === "pause" ? "paused" : action === "resume" ? "active" : action === "cancel" ? "cancelled" : action === "retry" ? "active" : undefined;
  const schedule = status ? await updateAgentSchedule(session.user.id, id, { status, lastError: action === "retry" ? null : undefined }) : await updateAgentSchedule(session.user.id, id, { nextRunAt: body.nextRunAt ? new Date(body.nextRunAt) : undefined, timezone: body.timezone });
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await createAgentScheduleEvent({ id: generateUUID(), scheduleId: id, userId: session.user.id, eventKey: `${id}:${action}:${Date.now()}`, type: action || "updated", metadata: body });
  return NextResponse.json({ schedule });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const schedule = await deleteAgentSchedule(session.user.id, id);
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await createAgentScheduleEvent({ id: generateUUID(), scheduleId: id, userId: session.user.id, eventKey: `${id}:cancelled:${Date.now()}`, type: "cancelled", metadata: {} });
  return NextResponse.json({ schedule });
}
