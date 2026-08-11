import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { agentSchedule, agentScheduleEvent } from "../schema";
import { db } from "../queries";

export async function listAgentSchedules(userId: string) {
  return db.select().from(agentSchedule).where(eq(agentSchedule.userId, userId)).orderBy(desc(agentSchedule.nextRunAt), desc(agentSchedule.updatedAt));
}

export async function getAgentSchedule(userId: string, id: string) {
  const [schedule] = await db.select().from(agentSchedule).where(and(eq(agentSchedule.userId, userId), eq(agentSchedule.id, id))).limit(1);
  return schedule ?? null;
}

export async function listAgentScheduleEvents(userId: string, scheduleId?: string) {
  return db.select().from(agentScheduleEvent).where(scheduleId ? and(eq(agentScheduleEvent.userId, userId), eq(agentScheduleEvent.scheduleId, scheduleId)) : eq(agentScheduleEvent.userId, userId)).orderBy(desc(agentScheduleEvent.createdAt));
}

export async function createAgentScheduleEvent(input: typeof agentScheduleEvent.$inferInsert) {
  const [existing] = await db.select().from(agentScheduleEvent).where(and(eq(agentScheduleEvent.userId, input.userId), eq(agentScheduleEvent.eventKey, input.eventKey))).limit(1);
  if (existing) return existing;
  const [event] = await db.insert(agentScheduleEvent).values(input).returning();
  return event;
}

export async function updateAgentSchedule(userId: string, id: string, values: Partial<typeof agentSchedule.$inferInsert>) {
  const [schedule] = await db.update(agentSchedule).set({ ...values, updatedAt: new Date() }).where(and(eq(agentSchedule.userId, userId), eq(agentSchedule.id, id))).returning();
  return schedule ?? null;
}

export async function insertAgentSchedule(input: typeof agentSchedule.$inferInsert) {
  const [schedule] = await db.insert(agentSchedule).values(input).returning();
  return schedule;
}

export { db };

export async function deleteAgentSchedule(userId: string, id: string) {
  const [schedule] = await db.update(agentSchedule).set({ status: "cancelled", updatedAt: new Date() }).where(and(eq(agentSchedule.userId, userId), eq(agentSchedule.id, id))).returning();
  return schedule ?? null;
}

export { agentSchedule, agentScheduleEvent };
