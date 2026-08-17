import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const read = (path: string) => readFileSync(resolve(path), "utf8");

test("heartbeat pause is enforced before workflow work begins", () => {
  const workflow = read("app/api/agent/heartbeat/workflow/route.ts");
  assert.match(workflow, /check-heartbeat-paused/);
  assert.match(workflow, /Skipped paused workflow/);
  assert.match(workflow, /getUserRedis\(userId\)/);
});

test("heartbeat controls expose pause and resume to chat and Telegram", () => {
  const proactive = read("lib/ai/tools/proactive.ts");
  const chat = read("app/(chat)/api/chat/route.ts");
  const telegram = read("lib/ai/build-etles-telegram-tools.ts");

  assert.match(proactive, /export const pauseHeartbeat/);
  assert.match(proactive, /export const resumeHeartbeat/);
  assert.match(chat, /pauseHeartbeat/);
  assert.match(chat, /resumeHeartbeat/);
  assert.match(telegram, /pauseHeartbeat/);
  assert.match(telegram, /resumeHeartbeat/);
});

test("activation cannot overwrite an explicit paused state", () => {
  const activation = read("app/api/agent/heartbeat/activate/route.ts");
  assert.match(activation, /agent:status:\$\{userId\}:paused/);
  assert.match(activation, /Heartbeat is paused/);
  assert.match(activation, /status: 409/);
});

test("agent status reports paused instead of active schedules", () => {
  const proactive = read("lib/ai/tools/proactive.ts");
  assert.match(proactive, /agent:status:\$\{userId\}:paused/);
  assert.match(proactive, /PAUSED — proactive schedules are paused/);
  assert.match(proactive, /schedulesActive: !isPaused/);
});

test("heartbeat enforces dated, recent email signals", () => {
  const workflow = read("app/api/agent/heartbeat/workflow/route.ts");
  assert.match(workflow, /emailCutoffDate/);
  assert.match(workflow, /Older or undated email may be background context/);
  assert.match(workflow, /old billing\/payment email/);
  assert.match(workflow, /normalizeSignals\(parsed, runStartedAt\.getTime\(\)\)/);
});
