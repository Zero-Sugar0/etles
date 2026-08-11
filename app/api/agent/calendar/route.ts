import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getAgentDepartment } from "@/lib/agent/departments";
import { getDepartmentLeadSlug } from "@/lib/agent/departments";
import { createAgentScheduleEvent, insertAgentSchedule, listAgentScheduleEvents, listAgentSchedules } from "@/lib/db/queries/agent-calendar";
import { generateUUID } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scheduleId = request.nextUrl.searchParams.get("scheduleId") ?? undefined;
  const schedules = await listAgentSchedules(session.user.id);
  const events = await listAgentScheduleEvents(session.user.id, scheduleId);
  return NextResponse.json({ schedules, events });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const message = String(body.message ?? "").trim();
  const agentSlug = String(body.agentSlug ?? "executive_lead").trim();
  const kind = body.kind === "cron" ? "cron" : "reminder";
  if (!title || !message) return NextResponse.json({ error: "Title and message are required." }, { status: 400 });
  const idempotencyKey = String(body.idempotencyKey ?? `${session.user.id}:${agentSlug}:${title}:${body.startsAt ?? body.cron ?? ""}`);
  const schedule = await insertAgentSchedule({
    id: generateUUID(), userId: session.user.id, agentSlug, department: getAgentDepartment(agentSlug), title, message, kind,
    cron: kind === "cron" ? String(body.cron ?? "") : null, timezone: String(body.timezone ?? "UTC"),
    startsAt: body.startsAt ? new Date(body.startsAt) : null, nextRunAt: body.startsAt ? new Date(body.startsAt) : null,
    idempotencyKey, payload: body.payload ?? {},
  });
  await createAgentScheduleEvent({ id: generateUUID(), scheduleId: schedule.id, userId: session.user.id, eventKey: `${schedule.id}:created`, type: "created", metadata: { lead: getDepartmentLeadSlug((schedule.department ?? "general") as Parameters<typeof getDepartmentLeadSlug>[0]) } });
  return NextResponse.json({ schedule }, { status: 201 });
}
