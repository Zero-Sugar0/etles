import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptCredential,
  decryptExtraConfig,
  decryptLegacyCredential,
  encryptCredential,
  encryptExtraConfig,
} from "../lib/security/credential-crypto";
import {
  isMaskedSecret,
  maskSecret,
  SUPPORTED_CHAT_PLATFORMS,
} from "../lib/chat/integration-config";
import { stableMessageId } from "../lib/chat/message-identity";

process.env.SECRETS_ENCRYPTION_KEY =
  process.env.SECRETS_ENCRYPTION_KEY ||
  "test-only-channel-credential-key-32-bytes";

test("channel credentials round-trip long values without exposing plaintext", () => {
  const value = "xoxb-" + "a".repeat(100_000);
  const encrypted = encryptCredential(value);

  assert.notEqual(encrypted, value);
  assert.equal(decryptCredential(encrypted), value);
  assert.equal(decryptLegacyCredential(value), value);
});

test("sensitive integration extra config is encrypted while public config remains readable", () => {
  const encrypted = encryptExtraConfig({
    applicationId: "123",
    webhookSecret: "private-webhook-secret",
    phoneNumberId: "456",
  });
  assert.equal((encrypted as any).applicationId, "123");
  assert.notEqual((encrypted as any).webhookSecret, "private-webhook-secret");
  assert.deepEqual(decryptExtraConfig(encrypted), {
    applicationId: "123",
    webhookSecret: "private-webhook-secret",
    phoneNumberId: "456",
  });
});

test("integration masking never returns the complete secret", () => {
  const masked = maskSecret("xoxb-secret-value");
  assert.equal(masked.endsWith("alue"), true);
  assert.equal(masked.includes("xoxb-secret"), false);
  assert.equal(isMaskedSecret(masked), true);
});

test("platform message ids are deterministic UUIDs", () => {
  const first = stableMessageId("slack", "thread-1", "message-1");
  assert.equal(first, stableMessageId("slack", "thread-1", "message-1"));
  assert.notEqual(first, stableMessageId("slack", "thread-1", "message-2"));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("the integration catalog contains every configured Chat SDK adapter", () => {
  for (const platform of [
    "slack",
    "discord",
    "teams",
    "gchat",
    "telegram",
    "whatsapp",
    "sendblue",
  ]) {
    assert.ok(SUPPORTED_CHAT_PLATFORMS.includes(platform as any));
  }
});
