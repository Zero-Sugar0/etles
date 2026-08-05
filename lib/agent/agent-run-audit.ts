import { Redis } from "@upstash/redis";

export type AgentRunAuditEvent =
  | "agent_run_started"
  | "agent_run_completed"
  | "agent_run_failed";

export interface AgentRunAuditPayload {
  agentType: string;
  approvalMode?: string;
  chatId?: string;
  durationMs?: number;
  error?: string;
  riskLevel?: string;
  scopedToolCount?: number;
  taskId: string;
  timestamp?: string;
  userId: string;
}

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

export async function auditAgentRunEvent(
  event: AgentRunAuditEvent,
  payload: AgentRunAuditPayload
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  const timestamp = payload.timestamp ?? new Date().toISOString();
  const entry = JSON.stringify({ event, ...payload, timestamp });
  const taskKey = `agent:audit:task:${payload.taskId}`;
  const userKey = `agent:audit:user:${payload.userId}`;

  try {
    await Promise.all([
      redis.rpush(taskKey, entry),
      redis.lpush(userKey, entry),
      redis.expire(taskKey, 60 * 60 * 24 * 30),
      redis.ltrim(userKey, 0, 199),
      redis.expire(userKey, 60 * 60 * 24 * 30),
    ]);
  } catch (err) {
    console.error("[AgentAudit] Failed to write audit event:", err);
  }
}
