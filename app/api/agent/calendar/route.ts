import { type NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { auth } from "@/app/(auth)/auth";
import { getAgentDepartment, getDepartmentLeadSlug } from "@/lib/agent/departments";
import { getNextCronRunDate } from "@/lib/ai/tools/cron-calculator";
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

  const scheduleId = generateUUID();
  const baseUrl = process.env.BASE_URL || new URL(request.url).origin;
  let qstashId: string | null = null;
  let nextRunAt: Date | null = null;

  try {
    const client = new Client({
      baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io",
      token: process.env.QSTASH_TOKEN || "not-needed",
    });

    if (kind === "cron") {
      const cronStr = String(body.cron ?? "0 9 * * *").trim();
      nextRunAt = getNextCronRunDate(cronStr);
      const res = await client.schedules.create({
        destination: `${baseUrl}/api/scheduled`,
        cron: cronStr,
        body: JSON.stringify({ type: "cron", userId: session.user.id, name: title, message, taskId: scheduleId }),
        headers: { "Content-Type": "application/json" },
        retries: 3,
        scheduleId: `cron-${session.user.id}-${scheduleId}`,
        deduplicationId: `${session.user.id}-${scheduleId}`,
      } as any);
      qstashId = res.scheduleId;
    } else {
      const startsAtDate = body.startsAt ? new Date(body.startsAt) : new Date(Date.now() + 3600 * 1000);
      nextRunAt = startsAtDate;
      const delay = Math.max(1, Math.floor((startsAtDate.getTime() - Date.now()) / 1000));
      const res = await client.publishJSON({
        url: `${baseUrl}/api/scheduled`,
        body: { type: "reminder", userId: session.user.id, message, taskId: scheduleId, label: title, scheduledAt: new Date().toISOString() },
        delay,
        retries: 3,
        label: title,
      });
      qstashId = res.messageId;
    }
  } catch (qstashErr) {
    console.warn("[calendar.POST] QStash scheduling warning:", qstashErr);
  }

  const idempotencyKey = String(body.idempotencyKey ?? `${session.user.id}:${kind}:${title}:${scheduleId}`);
  const schedule = await insertAgentSchedule({
    id: scheduleId,
    userId: session.user.id,
    agentSlug,
    department: getAgentDepartment(agentSlug),
    title,
    message,
    kind,
    cron: kind === "cron" ? String(body.cron ?? "0 9 * * *") : null,
    timezone: String(body.timezone ?? "UTC"),
    startsAt: body.startsAt ? new Date(body.startsAt) : nextRunAt,
    nextRunAt: nextRunAt ?? (body.startsAt ? new Date(body.startsAt) : null),
    qstashId,
    idempotencyKey,
    payload: body.payload ?? {},
  });

  await createAgentScheduleEvent({
    id: generateUUID(),
    scheduleId: schedule.id,
    userId: session.user.id,
    eventKey: `${schedule.id}:created`,
    type: "created",
    metadata: { lead: getDepartmentLeadSlug((schedule.department ?? "general") as Parameters<typeof getDepartmentLeadSlug>[0]), qstashId },
  });

  return NextResponse.json({ schedule }, { status: 201 });
}
