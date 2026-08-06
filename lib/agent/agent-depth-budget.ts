/**
 * lib/agent/agent-depth-budget.ts
 *
 * Production-grade depth limits and hourly spawn budgets for the A2A system.
 *
 * Without these guards, a spawned child agent can spawn more child agents
 * infinitely — burning API credits and causing runaway costs.
 *
 * Two independent controls:
 *
 * 1. DEPTH LIMIT — maximum nesting depth of agent spawns.
 *    Root agent = depth 0. Its children = depth 1. Etc.
 *    Configurable via AGENT_MAX_DEPTH env var (default: 4).
 *
 * 2. HOURLY SPAWN BUDGET — maximum number of agent spawns per user per hour.
 *    Protects against "spawn storms" from runaway orchestration loops.
 *    Configurable via AGENT_MAX_HOURLY_SPAWNS env var (default: 50).
 *
 * Both limits are stored in Upstash Redis.
 */

import { Redis } from "@upstash/redis";

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

const MAX_DEPTH = Number(process.env.AGENT_MAX_DEPTH ?? 4);
const MAX_HOURLY_SPAWNS = Number(process.env.AGENT_MAX_HOURLY_SPAWNS ?? 50);

/** Slot key for hourly budget: rounds down to the current UTC hour. */
function hourSlot(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
}

export type DepthCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "depth_limit_reached" | "budget_exceeded"; detail: string };

/**
 * Check whether spawning a new child agent is permitted, and if so,
 * atomically increment the hourly spawn counter.
 *
 * @param userId      The user who owns this agent chain.
 * @param rootTaskId  The task ID of the root agent (used to namespace depth tracking).
 * @param currentDepth The current agent's depth (root = 0).
 */
export async function checkAndIncrementSpawnBudget(
  userId: string,
  rootTaskId: string,
  currentDepth: number
): Promise<DepthCheckResult> {
  // 1. Depth check — fast, no Redis needed
  if (currentDepth >= MAX_DEPTH) {
    return {
      allowed: false,
      reason: "depth_limit_reached",
      detail: `Agent at depth ${currentDepth} cannot spawn children. Max depth is ${MAX_DEPTH}. ` +
        `Handle this task directly or escalate to a human.`,
    };
  }

  const redis = getRedis();
  if (!redis) {
    // Redis unavailable — allow spawn but log warning (degraded mode)
    console.warn(
      "[agent-depth-budget] Redis unavailable — spawn budget not enforced."
    );
    return { allowed: true };
  }

  // 2. Hourly budget check + atomic increment
  const budgetKey = `agent:budget:${userId}:${hourSlot()}`;
  try {
    // INCR returns the new value after increment
    const newCount = await redis.incr(budgetKey);

    // Set TTL on first increment (2 hours to cover edge cases at hour boundary)
    if (newCount === 1) {
      await redis.expire(budgetKey, 2 * 60 * 60);
    }

    if (newCount > MAX_HOURLY_SPAWNS) {
      // Roll back the increment to avoid permanently blocking the user
      await redis.decr(budgetKey).catch(() => {});
      return {
        allowed: false,
        reason: "budget_exceeded",
        detail: `Hourly agent spawn budget exhausted (${MAX_HOURLY_SPAWNS} spawns/hour). ` +
          `Budget resets at the top of the next UTC hour. Slow down or increase AGENT_MAX_HOURLY_SPAWNS.`,
      };
    }
  } catch (err) {
    // Redis error — fail open (allow spawn) but log
    console.error("[agent-depth-budget] Redis error during budget check:", err);
  }

  return { allowed: true };
}

/**
 * Get current spawn stats for a user (for observability / debugging).
 */
export async function getSpawnStats(userId: string): Promise<{
  hourlySpawns: number;
  maxHourlySpawns: number;
  maxDepth: number;
}> {
  const redis = getRedis();
  if (!redis) {
    return { hourlySpawns: 0, maxHourlySpawns: MAX_HOURLY_SPAWNS, maxDepth: MAX_DEPTH };
  }

  const budgetKey = `agent:budget:${userId}:${hourSlot()}`;
  const count = (await redis.get<number>(budgetKey)) ?? 0;

  return {
    hourlySpawns: count,
    maxHourlySpawns: MAX_HOURLY_SPAWNS,
    maxDepth: MAX_DEPTH,
  };
}
