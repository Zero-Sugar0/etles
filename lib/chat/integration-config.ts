export const SUPPORTED_CHAT_PLATFORMS = [
  "slack",
  "discord",
  "teams",
  "gchat",
  "telegram",
  "github",
  "linear",
  "whatsapp",
  "resend",
  "sendblue",
] as const;

export function maskSecret(value: string | null | undefined) {
  return value ? `••••••••${value.slice(-4)}` : "";
}

export function isMaskedSecret(value: unknown) {
  return typeof value === "string" && value.startsWith("••••••••");
}
