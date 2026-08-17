import { Client as QStashClient } from "@upstash/qstash";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserRedis } from "@/lib/security/user-credentials";
import { triggerHeartbeatWorkflow } from "@/lib/workflow/client";

function getQStash(): QStashClient | null {
  if (!process.env.QSTASH_TOKEN) {
    return null;
  }
  return new QStashClient({ token: process.env.QSTASH_TOKEN });
}

function statusKey(userId: string) {
  return `agent:heartbeat:schedules:${userId}`;
}

function fallbackScheduleIds(userId: string) {
  return {
    heartbeatScheduleId: `hb-${userId}`,
    synthesisScheduleId: `syn-${userId}`,
    morningScheduleId: `morning-${userId}`,
    sandboxKeepaliveScheduleId: `sandbox-keepalive-${userId}`,
  };
}

async function setSchedulesPaused(userId: string, paused: boolean) {
  const qstash = getQStash();
  if (!qstash) {
    throw new Error("QSTASH_TOKEN not configured");
  }

  const redis = await getUserRedis(userId);
  const stored = redis
    ? await redis.get<Record<string, string>>(statusKey(userId))
    : null;
  const schedules = { ...fallbackScheduleIds(userId), ...(stored ?? {}) };
  const ids = Object.entries(schedules)
    .filter(([key, value]) => key.endsWith("ScheduleId") && !!value)
    .map(([, value]) => value);

  const settled = await Promise.allSettled(
    ids.map((schedule) =>
      paused
        ? qstash.schedules.pause({ schedule })
        : qstash.schedules.resume({ schedule })
    )
  );

  const failures = settled.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new Error(
      `Failed to ${paused ? "pause" : "resume"} ${failures.length} heartbeat schedule(s)`
    );
  }

  if (!redis) {
    throw new Error("Redis is not configured for heartbeat status persistence");
  }
  await redis.set(`agent:status:${userId}:paused`, paused);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const internalSecret =
    req.headers.get("x-agent-secret") || req.headers.get("x-heartbeat-secret");
  const configuredSecret =
    process.env.AGENT_DELEGATE_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  const internalUserId = req.headers.get("x-user-id")?.trim();
  const isInternal = Boolean(
    internalUserId && configuredSecret && internalSecret === configuredSecret
  );
  const userId = isInternal ? internalUserId : session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action } = (await req.json()) as {
    action: "sync" | "pause" | "resume";
  };

  try {
    switch (action) {
      case "sync":
        if (!process.env.QSTASH_TOKEN || !process.env.BASE_URL) {
          return NextResponse.json(
            { error: "QStash workflow is not configured" },
            { status: 503 }
          );
        }
        {
          const triggered = await triggerHeartbeatWorkflow({ userId });
          if (!triggered) {
            return NextResponse.json(
              { error: "Heartbeat workflow could not be triggered" },
              { status: 503 }
            );
          }
        }
        break;

      case "pause": {
        await setSchedulesPaused(userId, true);
        break;
      }

      case "resume": {
        await setSchedulesPaused(userId, false);
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, action });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Agent Action] ${action} failed:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
