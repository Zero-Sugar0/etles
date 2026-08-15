import "server-only";

import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { Redis } from "@upstash/redis";
import { getUserCredential } from "@/lib/db/queries";

const credentialContext = new AsyncLocalStorage<string>();

export function withUserCredentialContext<T>(userId: string, fn: () => Promise<T>) {
  return credentialContext.run(userId, fn);
}

function masterKey() {
  const secret = process.env.SECRETS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SECRETS_ENCRYPTION_KEY or AUTH_SECRET is required in production");
  }
  return crypto.createHash("sha256").update(secret || "etles-local-development-key").digest();
}

export function encryptUserCredential(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptUserCredential(payload: string) {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted credential");
  const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function credentialHint(value: string) {
  return value.length >= 4 ? `••••${value.slice(-4)}` : "••••";
}

export async function resolveUserCredential(
  userId: string | undefined,
  provider: string,
  keyName: string,
  environmentNames: string[]
) {
  const environmentValue = environmentNames.map((name) => process.env[name]?.trim()).find(Boolean);
  if (environmentValue) return environmentValue;
  const effectiveUserId = userId ?? credentialContext.getStore();
  if (!effectiveUserId) return undefined;
  const saved = await getUserCredential(effectiveUserId, provider, keyName);
  return saved ? decryptUserCredential(saved.encryptedValue) : undefined;
}

export async function getUserRedis(userId?: string) {
  const url = await resolveUserCredential(userId, "upstash", "UPSTASH_REDIS_REST_URL", ["UPSTASH_REDIS_REST_URL"]);
  const token = await resolveUserCredential(userId, "upstash", "UPSTASH_REDIS_REST_TOKEN", ["UPSTASH_REDIS_REST_TOKEN"]);
  return url && token ? new Redis({ url, token }) : null;
}
