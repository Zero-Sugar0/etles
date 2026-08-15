/**
 * lib/ai/tools/secrets-vault.ts
 *
 * Encrypted per-user Secrets Vault powered by Upstash Redis.
 *
 * Allows Etles to securely store, retrieve, list, and delete user credentials
 * (API keys, SSH keys, passwords, database URLs, env vars) for use inside
 * sandboxes, browsers, and remote servers.
 *
 * Encryption: AES-256-GCM with server-side master key (SECRETS_ENCRYPTION_KEY or fallback).
 */

import crypto from "crypto";
import { tool } from "ai";
import { z } from "zod";
import { getUserRedis } from "@/lib/security/user-credentials";

function getMasterKey(): Buffer {
  const secret = process.env.SECRETS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: SECRETS_ENCRYPTION_KEY or AUTH_SECRET environment variable must be set in production."
      );
    }
    console.warn(
      "[SecretsVault] WARNING: SECRETS_ENCRYPTION_KEY not set. Using dev fallback key."
    );
    return crypto
      .createHash("sha256")
      .update("etles-dev-only-fallback-secret-key-32b")
      .digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decrypt(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function secretKey(userId: string, name: string): string {
  return `agent:vault:${userId}:${name.toLowerCase()}`;
}

function secretIndexKey(userId: string): string {
  return `agent:vault_index:${userId}`;
}

// ── Exported Core Utility Functions ─────────────────────────────────────────

export async function saveUserSecret(
  userId: string,
  name: string,
  value: string,
  category = "general"
): Promise<void> {
  const redis = await getUserRedis(userId);
  if (!redis) throw new Error("Redis connection unavailable.");

  const encryptedValue = encrypt(value);
  const payload = JSON.stringify({
    name,
    category,
    value: encryptedValue,
    updatedAt: new Date().toISOString(),
  });

  await redis.set(secretKey(userId, name), payload);
  await redis.sadd(secretIndexKey(userId), name.toLowerCase());
}

export async function getUserSecret(
  userId: string,
  name: string
): Promise<{ name: string; value: string; category: string; updatedAt: string } | null> {
  const redis = await getUserRedis(userId);
  if (!redis) return null;

  const raw = await redis.get<string>(secretKey(userId, name));
  if (!raw) return null;

  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    const decryptedValue = decrypt(data.value);
    return {
      name: data.name,
      category: data.category || "general",
      value: decryptedValue,
      updatedAt: data.updatedAt,
    };
  } catch (e: any) {
    console.error(`[SecretsVault] Failed decrypting secret ${name}:`, e);
    return null;
  }
}

export async function getAllUserSecrets(
  userId: string
): Promise<Record<string, string>> {
  const redis = await getUserRedis(userId);
  if (!redis) return {};

  const names = await redis.smembers<string[]>(secretIndexKey(userId));
  if (!names || names.length === 0) return {};

  const result: Record<string, string> = {};
  for (const name of names) {
    const secret = await getUserSecret(userId, name);
    if (secret) {
      result[secret.name] = secret.value;
    }
  }
  return result;
}

export async function deleteUserSecret(
  userId: string,
  name: string
): Promise<boolean> {
  const redis = await getUserRedis(userId);
  if (!redis) return false;

  await redis.del(secretKey(userId, name));
  await redis.srem(secretIndexKey(userId), name.toLowerCase());
  return true;
}

// ── Agent AI Tools ──────────────────────────────────────────────────────────

export function getSecretsVaultTools({ userId }: { userId: string }) {
  return {
    saveSecret: saveSecretTool({ userId }),
    getSecret: getSecretTool({ userId }),
    listSecrets: listSecretsTool({ userId }),
    deleteSecret: deleteSecretTool({ userId }),
  };
}

export const saveSecretTool = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Save a secret or credential into the user's encrypted Secrets Vault. " +
      "Use to store API keys, SSH keys, logins, passwords, tokens, or environment variables. " +
      "Secrets persist securely across sessions and are automatically available to sandboxes.",
    inputSchema: z.object({
      name: z
        .string()
        .describe(
          "Identifier name for the secret, e.g., 'ORACLE_SSH_KEY', 'GITHUB_TOKEN', 'AWS_ACCESS_KEY_ID'."
        ),
      value: z.string().describe("The secret value or key content."),
      category: z
        .enum(["api_key", "ssh_key", "password", "env_var", "general"])
        .optional()
        .default("general")
        .describe("Category of secret for automatic bootstrap handling."),
    }),
    execute: async ({ name, value, category }) => {
      try {
        await saveUserSecret(userId, name, value, category);
        return {
          success: true,
          message: `Secret '${name}' saved securely in encrypted vault.`,
        };
      } catch (error: any) {
        return { success: false, error: error?.message ?? String(error) };
      }
    },
  });

export const getSecretTool = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Verify and retrieve metadata for a secret from the user's encrypted Secrets Vault by name. " +
      "Values are masked in responses to prevent raw credentials from leaking into chat history.",
    inputSchema: z.object({
      name: z.string().describe("Name of the secret to check."),
    }),
    execute: async ({ name }) => {
      try {
        const secret = await getUserSecret(userId, name);
        if (!secret) {
          return { success: false, error: `Secret '${name}' not found in vault.` };
        }
        const masked =
          secret.value.length > 4
            ? secret.value.slice(0, 2) + "****" + secret.value.slice(-2)
            : "****";
        return {
          success: true,
          name: secret.name,
          category: secret.category,
          exists: true,
          valueMasked: masked,
          length: secret.value.length,
          updatedAt: secret.updatedAt,
        };
      } catch (error: any) {
        return { success: false, error: error?.message ?? String(error) };
      }
    },
  });

export const listSecretsTool = ({ userId }: { userId: string }) =>
  tool({
    description:
      "List all secret names saved in the user's vault (without exposing values). " +
      "Use to inspect what credentials and keys are available for sandboxes or integrations.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const redis = await getUserRedis(userId);
        if (!redis) {
          return { success: false, error: "Vault storage unavailable." };
        }
        const names = await redis.smembers<string[]>(secretIndexKey(userId));
        return {
          success: true,
          secrets: names || [],
          count: (names || []).length,
        };
      } catch (error: any) {
        return { success: false, error: error?.message ?? String(error) };
      }
    },
  });

export const deleteSecretTool = ({ userId }: { userId: string }) =>
  tool({
    description: "Delete a secret from the user's vault by name.",
    inputSchema: z.object({
      name: z.string().describe("Name of the secret to delete."),
    }),
    execute: async ({ name }) => {
      try {
        const deleted = await deleteUserSecret(userId, name);
        return {
          success: deleted,
          message: deleted
            ? `Secret '${name}' deleted.`
            : `Secret '${name}' did not exist.`,
        };
      } catch (error: any) {
        return { success: false, error: error?.message ?? String(error) };
      }
    },
  });
