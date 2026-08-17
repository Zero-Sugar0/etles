import { createHash } from "node:crypto";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import {
  getChatByPlatformThreadId,
  getLatestChatByUserId,
  linkChatToPlatform,
  saveChat,
} from "@/lib/db/queries";
import { getInternalAgentSecret } from "@/lib/security/internal-agent";
import { generateUUID } from "@/lib/utils";
import { stableMessageId } from "./message-identity";

type PlatformTurnInput = {
  userId: string;
  platform: string;
  threadId: string;
  text: string;
  chatId: string;
  externalMessageId?: string;
  attachments?: Array<{
    name?: string;
    mimeType?: string;
    url?: string;
    fetchData?: () => Promise<Buffer | Uint8Array>;
  }>;
};

function platformThreadKey(platform: string, userId: string, threadId: string) {
  // Keep the user in the key even when two users connect the same external
  // workspace. This is also the identifier persisted by the Chat table.
  const raw = `${platform}:${userId}:${threadId}`;
  if (raw.length <= 255) return raw;
  const threadHash = createHash("sha256").update(threadId).digest("hex");
  return `${platform}:${userId}:sha256-${threadHash}`.slice(0, 255);
}

export async function getOrCreatePlatformChat({
  userId,
  platform,
  threadId,
  title,
}: {
  userId: string;
  platform: string;
  threadId: string;
  title: string;
}) {
  const platformThreadId = platformThreadKey(platform, userId, threadId);
  const linked = await getChatByPlatformThreadId({ platformThreadId });
  if (linked) return { chatId: linked.id, platformThreadId };

  // Adopt one unlinked web chat so a user can continue an existing
  // conversation from a connected channel. Never adopt another platform's
  // chat because those conversations may belong to a different account.
  const latest = await getLatestChatByUserId({ userId });
  if (latest) {
    const linked = await linkChatToPlatform({
      chatId: latest.id,
      platformThreadId,
    });
    if (linked) return { chatId: latest.id, platformThreadId };
  }

  const chatId = generateUUID();
  try {
    await saveChat({
      id: chatId,
      userId,
      title,
      visibility: "private",
      platformThreadId,
    });
    return { chatId, platformThreadId };
  } catch {
    // A duplicate delivery may race another worker after the unique
    // platform-thread constraint is installed. Reuse the winner's chat.
    const existing = await getChatByPlatformThreadId({ platformThreadId });
    if (existing) return { chatId: existing.id, platformThreadId };
    throw new Error("Could not create a persistent platform chat");
  }
}

function appBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    `http://localhost:${process.env.PORT || 3000}`
  );
}

type PlatformAgentResult = { text: string; approvalRequested: boolean };

function createUITextStream(
  body: ReadableStream<Uint8Array>,
  result: { text: string; approvalRequested: boolean }
) {
  return (async function* () {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let errorMessage: string | undefined;
    let approvalRequested = false;

    const consume = (line: string): string | null => {
      if (!line.startsWith("data:")) return null;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return null;
      try {
        const chunk = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          text?: string;
          errorText?: string;
        };
        if (chunk.type === "text-delta" && chunk.delta) {
          text += chunk.delta;
          return chunk.delta;
        }
        if (chunk.type === "text" && chunk.text) text += chunk.text;
        if (chunk.type === "tool-approval-request") approvalRequested = true;
        if (chunk.type === "error") errorMessage = chunk.errorText || "Chat request failed";
      } catch {
        // The stream can contain provider-specific non-JSON lines. Ignore
        // those while continuing to collect the assistant text.
      }
      return null;
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const delta = consume(line);
          if (delta) yield delta;
        }
        if (done) break;
      }
      if (buffer) {
        const delta = consume(buffer);
        if (delta) yield delta;
      }
      if (errorMessage) throw new Error(errorMessage);
      result.text = text.trim();
      result.approvalRequested = approvalRequested;
    } finally {
      reader.releaseLock();
    }
  })();
}

/**
 * Run a channel message through the same authenticated route used by the web
 * chat. This keeps prompts, tools, artifacts, approvals, BYOK, memory, and
 * model selection in one place instead of maintaining a second agent.
 */
async function startPlatformAgentTurn(input: PlatformTurnInput) {
  const attachmentParts: Array<{
    type: "file";
    mediaType: string;
    name: string;
    url: string;
  }> = [];

  for (const attachment of input.attachments ?? []) {
    try {
      let url = attachment.url;
      if (!url && attachment.fetchData) {
        const data = await attachment.fetchData();
        // Keep authenticated platform files private. The main route accepts
        // data URLs, so the file never needs to be copied to a public bucket.
        const buffer = Buffer.from(data);
        if (buffer.byteLength <= 8 * 1024 * 1024) {
          url = `data:${attachment.mimeType || "application/octet-stream"};base64,${buffer.toString("base64")}`;
        }
      }
      if (url) {
        attachmentParts.push({
          type: "file",
          mediaType: attachment.mimeType || "application/octet-stream",
          name: (attachment.name || "attachment").slice(0, 100),
          url,
        });
      }
    } catch (error) {
      console.error("[platform-agent] Failed to ingest attachment:", error);
    }
  }

  const response = await fetch(new URL("/api/chat", appBaseUrl()), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.userId}`,
      "x-etles-internal-key": getInternalAgentSecret(),
    },
    signal: AbortSignal.timeout(
      Number(process.env.CHANNEL_CHAT_TIMEOUT_MS || 120_000)
    ),
    body: JSON.stringify({
      id: input.chatId,
      message: {
        id: stableMessageId(input.platform, input.threadId, input.externalMessageId),
        role: "user",
        parts: [
          { type: "text", text: input.text.trim() || "Please inspect the attached file." },
          ...attachmentParts,
        ],
      },
      selectedChatModel:
        process.env.CHANNEL_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL,
      selectedVisibilityType: "private",
    }),
  });

  if (!response.ok || !response.body) {
    await response.text().catch(() => "");
    throw new Error(`Main chat request failed (${response.status})`);
  }
  return response.body;
}

/** Stream the canonical web-agent response directly through a Chat SDK thread. */
export async function postPlatformAgentTurn(
  thread: { post: (stream: AsyncIterable<string>) => Promise<unknown> },
  input: PlatformTurnInput
): Promise<PlatformAgentResult> {
  const body = await startPlatformAgentTurn(input);
  const result: PlatformAgentResult = { text: "", approvalRequested: false };
  await thread.post(createUITextStream(body, result));
  return result;
}
