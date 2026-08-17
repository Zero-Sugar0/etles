import crypto from "node:crypto";

function masterKey() {
  const secret = process.env.SECRETS_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SECRETS_ENCRYPTION_KEY or AUTH_SECRET is required in production");
  }
  return crypto
    .createHash("sha256")
    .update(secret || "etles-local-development-key")
    .digest();
}

export function encryptCredential(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptCredential(payload: string) {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Invalid encrypted credential");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Reads old plaintext BotIntegration rows without breaking existing users. */
export function decryptLegacyCredential(value: string) {
  return value.startsWith("v1:") ? decryptCredential(value) : value;
}

export function isEncryptedCredential(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v1:");
}

export function credentialHint(value: string) {
  return value.length >= 4 ? `••••${value.slice(-4)}` : "••••";
}

const SENSITIVE_EXTRA_KEY = /(secret|token|privateKey|apiKey|password|credential|key)$/i;

export function encryptExtraConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (
        typeof entry === "string" &&
        SENSITIVE_EXTRA_KEY.test(key) &&
        !isEncryptedCredential(entry)
      ) {
        return [key, encryptCredential(entry)];
      }
      return [key, entry];
    })
  );
}

export function decryptExtraConfig(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (typeof entry === "string" && isEncryptedCredential(entry)) {
        return [key, decryptCredential(entry)];
      }
      return [key, entry];
    })
  );
}
