import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { Redis } from "@upstash/redis";
import { getUserCredential } from "@/lib/db/queries";
import {
  credentialHint,
  decryptCredential,
  encryptCredential,
} from "./credential-crypto";

const credentialContext = new AsyncLocalStorage<string>();

export function withUserCredentialContext<T>(userId: string, fn: () => Promise<T>) {
  return credentialContext.run(userId, fn);
}

export const encryptUserCredential = encryptCredential;
export const decryptUserCredential = decryptCredential;
export { credentialHint };

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
