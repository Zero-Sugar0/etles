import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentManifest,
  filterComposioToolsForManifest,
  filterInternalToolsForManifest,
} from "../lib/agent/production-manifest";
import { getSubAgentBySlug } from "../lib/agent/subagent-definitions";

function requireAgent(slug: string) {
  const agent = getSubAgentBySlug(slug);
  assert.ok(agent, `Expected agent ${slug} to exist`);
  return agent;
}

test("builds high-risk finance manifests with financial approval", () => {
  const manifest = buildAgentManifest(requireAgent("finance"));

  assert.equal(manifest.department, "finance");
  assert.equal(manifest.riskLevel, "high");
  assert.equal(manifest.approvalMode, "financial_or_legal");
  assert.ok(manifest.allowedComposioToolkits.includes("stripe"));
  assert.ok(manifest.outputFields.includes("needsApproval"));
});

test("scopes Composio tools to the agent manifest", () => {
  const manifest = buildAgentManifest(requireAgent("sdr"));
  const scoped = filterComposioToolsForManifest(
    {
      APOLLO_SEARCH_PEOPLE: {},
      GMAIL_SEND_EMAIL: {},
      GITHUB_CREATE_ISSUE: {},
      STRIPE_CREATE_PAYMENT: {},
    },
    manifest
  );

  assert.deepEqual(Object.keys(scoped).sort(), [
    "APOLLO_SEARCH_PEOPLE",
    "GMAIL_SEND_EMAIL",
  ]);
});

test("browser operator gets browser and sandbox packs without finance tools", () => {
  const manifest = buildAgentManifest(requireAgent("browser_operator"));

  assert.ok(manifest.allowedToolPacks.includes("browser"));
  assert.ok(manifest.allowedToolPacks.includes("sandbox"));
  assert.equal(manifest.allowedToolPacks.includes("cloud"), false);
  assert.equal(manifest.allowedComposioToolkits.includes("stripe"), false);
});

test("internal tool scoping keeps browser tools out of finance agents", () => {
  const manifest = buildAgentManifest(requireAgent("finance"));
  const scoped = filterInternalToolsForManifest(
    {
      browserNavigate: {},
      listGoals: {},
      postgresQuery: {},
      readScratchpad: {},
      twilioSendSMS: {},
    },
    manifest
  );

  assert.deepEqual(Object.keys(scoped).sort(), [
    "listGoals",
    "readScratchpad",
  ]);
});
