import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const read = (path: string) => readFileSync(resolve(path), "utf8");

test("workflow and scheduled entry points fail closed without signed delivery", () => {
  for (const path of [
    "app/api/agent/workflow/failure/route.ts",
    "app/api/subagents/chat/workflow/failure/route.ts",
    "app/(chat)/api/scheduled/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /upstash-signature/);
    assert.match(source, /verify\(/);
    assert.match(source, /NODE_ENV.*production/);
    assert.match(source, /QSTASH.*signing keys|QStash signing keys/i);
  }
});

test("failure callbacks enforce task ownership before mutation", () => {
  for (const path of [
    "app/api/agent/workflow/failure/route.ts",
    "app/api/subagents/chat/workflow/failure/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /getAgentTaskByIdOnly\(taskId\)/);
    assert.match(source, /task\.userId !== userId/);
    assert.match(source, /status: \"failed\"/);
  }
});

test("campaign mutations authenticate and carry the caller user id", () => {
  const actions = read("app/(chat)/campaigns/actions.ts");
  const queries = read("lib/db/queries.ts");
  assert.match(actions, /const userId = await requireUserId\(\)/);
  assert.match(actions, /updateCampaignQueueStatus\(id, userId/);
  assert.match(actions, /updateCampaignQueueContent\(id, userId/);
  assert.match(actions, /deleteCampaignQueueItem\(id, userId/);
  assert.match(actions, /updateMissionStatus\(id, userId/);
  assert.match(queries, /eq\(mission\.userId, userId\)/);
  assert.match(queries, /campaignQueue\.missionId/);
});

test("task cancellation is authenticated, owner-scoped, and cancels the workflow", () => {
  const source = read("app/api/agent/tasks/[taskId]/cancel/route.ts");
  assert.match(source, /auth\(\)/);
  assert.match(source, /getAgentTaskById\(\{\s*id: taskId,\s*userId:/s);
  assert.match(source, /cancelWorkflow\(workflowRunId\)/);
  assert.match(source, /updateAgentTask\(\{[\s\S]*userId:/);
});

test("Telegram approval callbacks require the configured secret and acknowledge decisions", () => {
  const source = read("app/api/telegram/callback/[userId]/route.ts");
  assert.match(source, /x-telegram-bot-api-secret-token/);
  assert.match(source, /TELEGRAM_SECRET_TOKEN/);
  assert.match(source, /updateApprovalDecision\(/);
  assert.match(source, /answerCallbackQuery/);
});

test("A2A coordination has parent context and bounded spawn controls", () => {
  const runner = read("lib/agent/subagent-runner.ts");
  const budget = read("lib/agent/agent-depth-budget.ts");
  const bus = read("lib/agent/agent-bus.ts");
  assert.match(runner, /parentEventId/);
  assert.match(runner, /depth/);
  assert.match(runner, /rootTaskId/);
  assert.match(budget, /MAX_DEPTH/);
  assert.match(budget, /MAX_HOURLY_SPAWNS/);
  assert.match(bus, /notifyParentAgent/);
});
