import { Redis } from "@upstash/redis";
import { tool } from "ai";
import { z } from "zod";
import { generateUUID } from "@/lib/utils";

export type TaskStatus = "pending" | "completed";

export type PlanTask = {
  id: string;
  text: string;
  status: TaskStatus;
  notes?: string;
  completedAt?: string;
  createdAt: string;
};

export type PlanningItem = {
  id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "archived";
  tasks: PlanTask[];
  createdAt: string;
  updatedAt: string;
};

function getRedis() {
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

function plansSetKey(userId: string) {
  return `planner:${userId}:ids`;
}

function planItemKey(userId: string, planId: string) {
  return `planner:${userId}:item:${planId}`;
}

async function readPlan(
  redis: Redis,
  userId: string,
  planId: string
): Promise<PlanningItem | null> {
  const raw = await redis.get<string>(planItemKey(userId, planId));
  if (!raw) {
    return null;
  }
  return typeof raw === "string"
    ? (JSON.parse(raw) as PlanningItem)
    : (raw as PlanningItem);
}

// ─── createPlan ─────────────────────────────────────────────────────────────
export const createPlan = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Create a new multi-step plan, todo list, or operational checklist for a specific objective. " +
      "Use this to structure complex multi-stage tasks or track a checklist of deliverables.",
    inputSchema: z.object({
      title: z
        .string()
        .describe("The high-level goal or title of this plan/checklist."),
      description: z
        .string()
        .optional()
        .default("")
        .describe("A brief summary of what this plan covers."),
      tasks: z
        .array(z.string())
        .describe("A list of initial checklist tasks in execution order."),
    }),
    execute: async ({ title, description, tasks }) => {
      const redis = getRedis();
      if (!redis) {
        return { success: false, error: "Redis is not configured." };
      }

      const now = new Date().toISOString();
      const planId = generateUUID();

      const planTasks: PlanTask[] = tasks.map((text) => ({
        id: generateUUID(),
        text,
        status: "pending",
        createdAt: now,
      }));

      const plan: PlanningItem = {
        id: planId,
        title,
        description,
        status: "active",
        tasks: planTasks,
        createdAt: now,
        updatedAt: now,
      };

      await Promise.all([
        redis.set(planItemKey(userId, planId), JSON.stringify(plan)),
        redis.sadd(plansSetKey(userId), planId),
      ]);

      return { success: true, plan };
    },
  });

// ─── addPlanTask ────────────────────────────────────────────────────────────
export const addPlanTask = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Add one or more checklist tasks to an existing plan or todo list.",
    inputSchema: z.object({
      planId: z.string().describe("The ID of the plan to modify."),
      tasks: z
        .array(z.string())
        .describe("List of new task descriptions to add to the checklist."),
    }),
    execute: async ({ planId, tasks }) => {
      const redis = getRedis();
      if (!redis) {
        return { success: false, error: "Redis is not configured." };
      }

      const current = await readPlan(redis, userId, planId);
      if (!current) {
        return { success: false, error: "Plan not found." };
      }

      const now = new Date().toISOString();
      const newTasks: PlanTask[] = tasks.map((text) => ({
        id: generateUUID(),
        text,
        status: "pending",
        createdAt: now,
      }));

      const updated: PlanningItem = {
        ...current,
        tasks: [...current.tasks, ...newTasks],
        updatedAt: now,
      };

      await redis.set(planItemKey(userId, planId), JSON.stringify(updated));
      return { success: true, plan: updated };
    },
  });

// ─── updatePlanTask ─────────────────────────────────────────────────────────
export const updatePlanTask = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Update the status (complete/pending) or notes of a specific task within a plan/checklist.",
    inputSchema: z.object({
      planId: z.string().describe("The ID of the plan."),
      taskId: z
        .string()
        .describe("The ID of the specific task/checklist item to update."),
      status: z
        .enum(["pending", "completed"])
        .optional()
        .describe("Mark the task as completed or pending."),
      notes: z
        .string()
        .optional()
        .describe(
          "Optional progress details or execution logs for this specific task."
        ),
    }),
    execute: async ({ planId, taskId, status, notes }) => {
      const redis = getRedis();
      if (!redis) {
        return { success: false, error: "Redis is not configured." };
      }

      const current = await readPlan(redis, userId, planId);
      if (!current) {
        return { success: false, error: "Plan not found." };
      }

      const now = new Date().toISOString();
      let taskUpdated = false;

      const updatedTasks = current.tasks.map((task) => {
        if (task.id === taskId) {
          taskUpdated = true;
          return {
            ...task,
            ...(status === undefined ? {} : { status }),
            ...(notes === undefined ? {} : { notes }),
            ...(status === "completed" ? { completedAt: now } : {}),
          };
        }
        return task;
      });

      if (!taskUpdated) {
        return {
          success: false,
          error: `Task item "${taskId}" not found in this plan.`,
        };
      }

      // Automatically determine if the whole plan is completed
      const allCompleted = updatedTasks.every((t) => t.status === "completed");
      const computedStatus = allCompleted
        ? ("completed" as const)
        : current.status;

      const updated: PlanningItem = {
        ...current,
        tasks: updatedTasks,
        status: computedStatus,
        updatedAt: now,
      };

      await redis.set(planItemKey(userId, planId), JSON.stringify(updated));
      return { success: true, plan: updated };
    },
  });

// ─── listPlans ──────────────────────────────────────────────────────────────
export const listPlans = ({ userId }: { userId: string }) =>
  tool({
    description:
      "List all active, completed, or archived plans, todo lists, and checklists.",
    inputSchema: z.object({
      status: z
        .enum(["active", "completed", "archived"])
        .optional()
        .describe("Filter plans by current status."),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of plans to return."),
    }),
    execute: async ({ status, limit }) => {
      const redis = getRedis();
      if (!redis) {
        return { success: false, error: "Redis is not configured." };
      }

      const ids = await redis.smembers<string[]>(plansSetKey(userId));
      const plans: PlanningItem[] = [];

      for (const id of ids ?? []) {
        const plan = await readPlan(redis, userId, id);
        if (!plan) {
          continue;
        }
        if (status && plan.status !== status) {
          continue;
        }
        plans.push(plan);
      }

      const sorted = plans
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);

      // Enhance results with high-level statistics for each plan
      const enhancedPlans = sorted.map((p) => {
        const totalTasks = p.tasks.length;
        const completedTasks = p.tasks.filter(
          (t) => t.status === "completed"
        ).length;
        const percentComplete =
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return {
          ...p,
          stats: {
            totalTasks,
            completedTasks,
            percentComplete,
          },
        };
      });

      return {
        success: true,
        plans: enhancedPlans,
        count: enhancedPlans.length,
      };
    },
  });

// ─── deletePlan ─────────────────────────────────────────────────────────────
export const deletePlan = ({ userId }: { userId: string }) =>
  tool({
    description: "Delete an entire plan or checklist permanently.",
    inputSchema: z.object({
      planId: z.string().describe("The ID of the plan to delete."),
    }),
    execute: async ({ planId }) => {
      const redis = getRedis();
      if (!redis) {
        return { success: false, error: "Redis is not configured." };
      }

      await Promise.all([
        redis.del(planItemKey(userId, planId)),
        redis.srem(plansSetKey(userId), planId),
      ]);

      return { success: true, message: `Deleted plan ${planId}.` };
    },
  });
