import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  canAccessWorkspace,
  canManageWorkspace,
  canRemoveWorkspaceMember,
} from "../lib/tenancy/policy";

test("workspace access requires an active membership", () => {
  assert.equal(canAccessWorkspace({ status: "active", role: "member" }), true);
  assert.equal(canAccessWorkspace({ status: "invited", role: "member" }), false);
  assert.equal(canAccessWorkspace({ status: "suspended", role: "admin" }), false);
  assert.equal(canAccessWorkspace(null), false);
});

test("only owners and admins can manage workspace membership", () => {
  assert.equal(canManageWorkspace("owner"), true);
  assert.equal(canManageWorkspace("admin"), true);
  assert.equal(canManageWorkspace("member"), false);
  assert.equal(canManageWorkspace("viewer"), false);
  assert.equal(canManageWorkspace(undefined), false);
});

test("workspace owners cannot be removed", () => {
  assert.equal(canRemoveWorkspaceMember("owner", "admin"), true);
  assert.equal(canRemoveWorkspaceMember("admin", "member"), true);
  assert.equal(canRemoveWorkspaceMember("admin", "owner"), false);
  assert.equal(canRemoveWorkspaceMember("member", "viewer"), false);
});

test("tenancy schema and migrations contain the required isolation columns", () => {
  const schema = readFileSync(resolve("lib/db/schema.ts"), "utf8");
  const workspaceMigration = readFileSync(
    resolve("lib/db/migrations/0022_mature_hercules.sql"),
    "utf8"
  );
  const scopedRecordsMigration = readFileSync(
    resolve("lib/db/migrations/0023_simple_silverclaw.sql"),
    "utf8"
  );

  assert.match(schema, /export const workspace = pgTable/);
  assert.match(schema, /export const workspaceMember = pgTable/);
  assert.match(schema, /workspaceId: uuid\("workspaceId"\)/);
  assert.match(workspaceMigration, /CREATE TABLE IF NOT EXISTS "Workspace"/);
  assert.match(workspaceMigration, /CREATE TABLE IF NOT EXISTS "WorkspaceMember"/);
  assert.match(scopedRecordsMigration, /ALTER TABLE "Chat" ADD COLUMN "workspaceId" uuid/);
  assert.match(scopedRecordsMigration, /ALTER TABLE "AgentTask" ADD COLUMN "workspaceId" uuid/);
});
