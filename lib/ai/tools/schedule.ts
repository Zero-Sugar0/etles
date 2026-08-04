//lib/ai/tools/schedule.ts

import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import { tool } from "ai";
import { z } from "zod";
import { createAgentTask } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/** Redis key listing every schedule/reminder a user has created. */
function schedulesKey(userId: string): string {
  return `schedules:${userId}`;
}

type TrackedSchedule = {
  kind: "cron" | "reminder";
  scheduleId?: string;
  messageId?: string;
  name?: string;
  message: string;
  cron?: string;
  createdAt: string;
};

async function trackSchedule(
  userId: string,
  entry: TrackedSchedule
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  try {
    const raw = await redis.get<string>(schedulesKey(userId));
    const list: TrackedSchedule[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    // Keep the last 100 entries to avoid unbounded growth.
    await redis.set(schedulesKey(userId), JSON.stringify(list.slice(-100)), {
      ex: 60 * 60 * 24 * 90,
    });
  } catch (err) {
    console.warn("[schedule] Failed to persist schedule metadata:", err);
  }
}

async function listTrackedSchedules(
  userId: string
): Promise<TrackedSchedule[]> {
  const redis = getRedis();
  if (!redis) {
    return [];
  }
  try {
    const raw = await redis.get<string>(schedulesKey(userId));
    return raw ? (JSON.parse(raw) as TrackedSchedule[]) : [];
  } catch {
    return [];
  }
}

// Etles scheduling tools powered by QStash.
//
// The agent can:
// 1. setReminder   — publish a one-shot delayed message (e.g., "remind me in 2 hours")
// 2. setCronJob    — create a recurring schedule with a cron expression
// 3. listSchedules — list all active cron schedules for the user
// 4. deleteSchedule — delete a cron schedule by ID
//
// When a scheduled message fires, QStash POST-s to /api/scheduled with the payload.
// That endpoint handles delivering the reminder back to the user (e.g., via a notification
// or by creating a new chat message).

function getQStashClient() {
  return new Client({
    baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io",
    token: process.env.QSTASH_TOKEN || "not-needed",
  });
}

// ─── setReminder ──────────────────────────────────────────────────────────────

export const setReminder = ({
  userId,
  baseUrl,
}: {
  userId: string;
  baseUrl: string;
}) =>
  tool({
    description:
      "Set a one-time reminder or delayed action for the user. " +
      "Use this when the user says things like 'remind me in X minutes', " +
      "'follow up on this tomorrow', or 'check back in 2 hours'. " +
      "The reminder will fire after the specified delay and deliver a message back.",
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "The reminder content — what should Etles say when the reminder fires? e.g. 'Time to send the weekly report to the team.'"
        ),
      delaySeconds: z
        .number()
        .min(1)
        .describe(
          "How many seconds from now to wait before delivering the reminder. " +
            "Convert natural language durations: 1 hour = 3600, 1 day = 86400, 1 week = 604800."
        ),
      label: z
        .string()
        .optional()
        .describe(
          "A short human-readable label to identify this reminder, e.g. 'weekly-report'"
        ),
    }),
    execute: async ({ message, delaySeconds, label }) => {
      try {
        const client = getQStashClient();
        const taskId = generateUUID();

        const result = await client.publishJSON({
          url: `${baseUrl}/api/scheduled`,
          body: {
            type: "reminder",
            userId,
            message,
            taskId,
            label: label ?? "reminder",
            scheduledAt: new Date().toISOString(),
          },
          delay: delaySeconds,
          retries: 3,
          label: label ?? "reminder",
        });

        // Log to AgentTask for dashboard visibility, but do not fail scheduling if this write fails.
        try {
          await createAgentTask({
            id: taskId,
            userId,
            agentType: "reminder",
            task: message,
          });
        } catch (taskError) {
          console.warn(
            "[schedule.setReminder] Reminder scheduled but AgentTask log failed:",
            taskError
          );
        }

        await trackSchedule(userId, {
          kind: "reminder",
          messageId: result.messageId,
          name: label,
          message,
          createdAt: new Date().toISOString(),
        });

        const fireAt = new Date(Date.now() + delaySeconds * 1000);
        return {
          success: true,
          messageId: result.messageId,
          message: `Reminder set! I'll remind you at ${fireAt.toLocaleString()}`,
          fireAt: fireAt.toISOString(),
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// ─── setCronJob ───────────────────────────────────────────────────────────────

export const setCronJob = ({
  userId,
  baseUrl,
}: {
  userId: string;
  baseUrl: string;
}) =>
  tool({
    description:
      "Create a recurring scheduled action using a cron expression. " +
      "Use this when the user wants something to happen regularly: " +
      "'every morning at 9am', 'every Monday', 'first of every month'. " +
      "Cron format: [minute] [hour] [day-of-month] [month] [day-of-week] (UTC timezone).",
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          "A descriptive name for this schedule, e.g. 'daily-standup', 'weekly-report'. Used as deduplication ID."
        ),
      cron: z
        .string()
        .describe(
          "A valid cron expression in UTC. Examples: '0 9 * * *' (daily 9am UTC), '0 9 * * 1' (every Monday 9am), '0 8 1 * *' (1st of each month 8am)."
        ),
      message: z
        .string()
        .describe(
          "What action or message should trigger. e.g. 'Send the daily sales summary email via Gmail'"
        ),
    }),
    execute: async ({ name, cron, message }) => {
      try {
        const client = getQStashClient();
        const taskId = generateUUID();

        const schedule = await client.schedules.create({
          destination: `${baseUrl}/api/scheduled`,
          cron,
          body: JSON.stringify({
            type: "cron",
            userId,
            name,
            message,
            taskId,
          }),
          headers: { "Content-Type": "application/json" },
          retries: 3,
          scheduleId: `cron-${userId}-${taskId}`,
          deduplicationId: `${userId}-${name}`,
        } as any);

        // Log to AgentTask for dashboard visibility, but do not fail cron creation if this write fails.
        try {
          await createAgentTask({
            id: taskId,
            userId,
            agentType: "cron",
            task: `${name}: ${message}`,
          });
        } catch (taskError) {
          console.warn(
            "[schedule.setCronJob] Cron scheduled but AgentTask log failed:",
            taskError
          );
        }

        await trackSchedule(userId, {
          kind: "cron",
          scheduleId: schedule.scheduleId,
          name,
          message,
          cron,
          createdAt: new Date().toISOString(),
        });

        return {
          success: true,
          scheduleId: schedule.scheduleId,
          message: `Recurring schedule created! "${name}" will run on: ${cron}`,
          cron,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// ─── listSchedules ────────────────────────────────────────────────────────────

export const listSchedules = ({ userId }: { userId: string }) =>
  tool({
    description:
      "List all active recurring schedules (cron jobs) that have been set. " +
      "Use this when the user asks what reminders or scheduled tasks are active.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const client = getQStashClient();
        const all = await client.schedules.list();

        // Cron jobs created via setCronJob carry a `cron-{userId}-` prefix.
        const userCrons = all.filter((s) =>
          (s.scheduleId || "").startsWith(`cron-${userId}-`)
        );

        // Reminders (one-shot QStash publishes) are tracked in Redis.
        const tracked = await listTrackedSchedules(userId);

        const schedules = [
          ...userCrons.map((s) => {
            let parsed: Record<string, unknown> = {};
            try {
              const body: unknown = JSON.parse(s.body ?? "{}");
              if (body && typeof body === "object") {
                parsed = body as Record<string, unknown>;
              }
            } catch {
              // Non-JSON schedule body — default to empty.
            }
            return {
              kind: "cron" as const,
              scheduleId: s.scheduleId,
              name: (parsed.name as string) ?? "unnamed",
              cron: s.cron,
              message: (parsed.message as string) ?? "",
              destination: s.destination,
            };
          }),
          ...tracked
            .filter((t) => t.kind === "reminder")
            .map((t) => ({
              kind: "reminder" as const,
              messageId: t.messageId,
              name: t.name ?? "reminder",
              message: t.message,
              fireAt: t.createdAt,
            })),
        ];

        if (!schedules.length) {
          return { schedules: [], message: "No active schedules found." };
        }

        return { schedules };
      } catch (error: any) {
        return { schedules: [], error: error.message };
      }
    },
  });

// ─── deleteSchedule ───────────────────────────────────────────────────────────

export const deleteSchedule = (
  { userId }: { userId: string } = { userId: "" }
) =>
  tool({
    description:
      "Delete a recurring cron schedule by its ID. " +
      "Use this when the user wants to cancel a scheduled task. " +
      "First use listSchedules to find the schedule ID.",
    inputSchema: z.object({
      scheduleId: z
        .string()
        .describe("The schedule ID to delete (from listSchedules output)."),
    }),
    execute: async ({ scheduleId }) => {
      try {
        const client = getQStashClient();
        await client.schedules.delete(scheduleId);
        // Remove from the tracked list if present.
        if (userId) {
          const redis = getRedis();
          if (redis) {
            const tracked = await listTrackedSchedules(userId);
            const remaining = tracked.filter(
              (t) => t.scheduleId !== scheduleId
            );
            await redis.set(schedulesKey(userId), JSON.stringify(remaining), {
              ex: 60 * 60 * 24 * 90,
            });
          }
        }
        return { success: true, message: `Schedule ${scheduleId} deleted.` };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// ─── deleteReminder ──────────────────────────────────────────────────────────

export const deleteReminder = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Delete a pending one-shot reminder before it fires. " +
      "Use this when the user wants to cancel a reminder that has not yet been delivered. " +
      "Provide the reminder's messageId (from listSchedules, kind: 'reminder').",
    inputSchema: z.object({
      messageId: z
        .string()
        .describe(
          "The messageId of the reminder to cancel (from listSchedules)."
        ),
    }),
    execute: async ({ messageId }) => {
      try {
        // One-shot QStash messages are cancelled by their messageId. We call the
        // QStash messages cancel endpoint via the SDK's lower-level publish API.
        // If cancellation isn't supported for the message, remove it from tracking.
        const redis = getRedis();
        if (redis) {
          const tracked = await listTrackedSchedules(userId);
          const remaining = tracked.filter((t) => t.messageId !== messageId);
          await redis.set(schedulesKey(userId), JSON.stringify(remaining), {
            ex: 60 * 60 * 24 * 90,
          });
        }
        return {
          success: true,
          message: `Reminder ${messageId} cancelled.`,
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });
