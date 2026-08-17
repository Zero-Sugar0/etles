import { createHash } from "node:crypto";
import { generateUUID } from "@/lib/utils";

export function stableMessageId(
  platform: string,
  threadId: string,
  messageId?: string
) {
  if (!messageId) return generateUUID();
  const digest = createHash("sha256")
    .update(`${platform}:${threadId}:${messageId}`)
    .digest("hex")
    .slice(0, 32);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${((Number.parseInt(digest.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${digest.slice(18, 20)}-${digest.slice(20)}`;
}
