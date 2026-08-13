// lib/ai/sanitize-messages.ts

import type { ChatMessage } from "@/lib/types";

/**
 * Walks the UI-message array and ensures every `tool-call` part on an
 * assistant message has a matching `tool-result` part in the SAME message.
 *
 * This situation arises when:
 *  - The user sends a new message while the previous stream is still in-flight.
 *  - The stream is aborted (browser tab close, network drop, etc.).
 *  - `saveIntermediateMessages` flushed a partial assistant turn that contained
 *    a tool-call but the tool-result hadn't been received yet.
 *
 * Without this fix, the Vercel AI Gateway returns:
 *   400 – No tool output found for function call <id>
 *
 * Strategy: inject a synthetic error tool-result for every orphaned tool-call
 * so the history is always self-consistent when forwarded to the model.
 */
export function sanitizeDanglingToolCalls(
  messages: ChatMessage[]
): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant") return msg;

    const parts = (msg.parts ?? []) as any[];

    // Collect tool-call and tool-result IDs from this message's parts
    const toolCallIds = new Set<string>(
      parts
        .filter((p) => p.type === "tool-call" && p.toolCallId)
        .map((p) => p.toolCallId as string)
    );

    const resolvedIds = new Set<string>(
      parts
        .filter((p) => p.type === "tool-result" && p.toolCallId)
        .map((p) => p.toolCallId as string)
    );

    // Also handle the SDK's compound `tool-invocation` part format
    // where both call + result live in a single part object.
    for (const p of parts) {
      if (p.type === "tool-invocation") {
        const state = p.toolInvocation?.state ?? p.state;
        const tcId: string | undefined =
          p.toolInvocation?.toolCallId ?? p.toolCallId;
        if (tcId) {
          toolCallIds.add(tcId);
          // If the invocation already has a result, mark it resolved
          if (
            state === "result" ||
            state === "complete" ||
            p.toolInvocation?.result !== undefined
          ) {
            resolvedIds.add(tcId);
          }
        }
      }
    }

    const danglingIds = [...toolCallIds].filter((id) => !resolvedIds.has(id));
    if (danglingIds.length === 0) return msg;

    console.warn(
      `[sanitizeDanglingToolCalls] Patching ${danglingIds.length} dangling tool call(s) in message ${msg.id}:`,
      danglingIds
    );

    const syntheticResults = danglingIds.map((tcId) => {
      const matchingCall = parts.find(
        (p) =>
          p.toolCallId === tcId ||
          p.toolInvocation?.toolCallId === tcId
      );
      const toolName =
        matchingCall?.toolName ??
        matchingCall?.toolInvocation?.toolName ??
        "unknown";

      return {
        type: "tool-result" as const,
        toolCallId: tcId,
        toolName,
        result: {
          error:
            "Tool result unavailable – request was interrupted before the tool finished executing.",
        },
        isError: true,
      };
    });

    return {
      ...msg,
      parts: [...parts, ...syntheticResults],
    };
  });
}

/**
 * Patches `accumulatedParts` (the raw parts array built during streaming)
 * before flushing them to the database via `saveIntermediateMessages`.
 *
 * This prevents the DB from ever persisting an assistant row with a dangling
 * tool-call, so future sessions can't reload corrupted history.
 */
export function patchAccumulatedParts(parts: any[]): any[] {
  const toolCallIds = new Set<string>(
    parts
      .filter((p) => p.type === "tool-call" && p.toolCallId)
      .map((p) => p.toolCallId as string)
  );

  const resolvedIds = new Set<string>(
    parts
      .filter((p) => p.type === "tool-result" && p.toolCallId)
      .map((p) => p.toolCallId as string)
  );

  const danglingIds = [...toolCallIds].filter((id) => !resolvedIds.has(id));
  if (danglingIds.length === 0) return parts;

  console.warn(
    `[patchAccumulatedParts] Appending synthetic results for ${danglingIds.length} dangling tool call(s):`,
    danglingIds
  );

  const syntheticResults = danglingIds.map((tcId) => {
    const matchingCall = parts.find((p) => p.toolCallId === tcId);
    return {
      type: "tool-result" as const,
      toolCallId: tcId,
      toolName: matchingCall?.toolName ?? "unknown",
      result: {
        error:
          "Tool result unavailable – stream was interrupted before the tool finished executing.",
      },
      isError: true,
    };
  });

  return [...parts, ...syntheticResults];
}
