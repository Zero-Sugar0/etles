/**
 * Shared AI tool builder for Chat SDK platform bots (Slack, Linear, Discord, etc.)
 */

import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { getWeather } from "@/lib/ai/tools/get-weather";
import {
  recallMemory,
  saveMemory,
} from "@/lib/ai/tools/memory";
import { readAgentSkill } from "@/lib/ai/tools/agent-skills";
import { wikiQuery } from "@/lib/ai/tools/wiki";
import {
  readScratchpad,
  writeScratchpad,
} from "@/lib/ai/tools/scratchpad";

const composio = new Composio({ provider: new VercelProvider() });

export async function buildPlatformAgentTools({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}) {
  let composioTools: Record<string, unknown> = {};
  try {
    const session = await composio.create(userId, { manageConnections: true });
    composioTools = await session.tools();
  } catch {
    /* Composio optional */
  }

  return {
    ...composioTools,
    getWeather,
    readScratchpad: readScratchpad({ userId, keyId: chatId }),
    writeScratchpad: writeScratchpad({ userId, keyId: chatId }),
    saveMemory: saveMemory({ userId }),
    recallMemory: recallMemory({ userId }),
    wikiQuery: wikiQuery({ userId }),
    readAgentSkill: readAgentSkill(),
  };
}

export const BOT_SYSTEM_PROMPT =
  "You are Etles, an AI chief of staff replying on a chat platform (Slack, Linear, Discord, etc.). " +
  "Be concise and actionable. Use connected integrations via Composio when the user asks you to take action. " +
  "Use readAgentSkill for platform setup guides (chat-sdk, composio) and recallMemory for user context.";
