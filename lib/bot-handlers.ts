import type { SlackAdapter } from "@chat-adapter/slack";
import type { Chat } from "chat";
import {
  getOrCreatePlatformChat,
  postPlatformAgentTurn,
} from "@/lib/chat/platform-agent";

async function postAIResponse(thread: any, text: string) {
  try {
    await thread.post({
      markdown: text || "I completed the request, but there was no text response.",
    });
  } catch (error) {
    console.error(
      "[bot-handlers] Failed to post error response:",
      error instanceof Error ? error.message : "unknown error"
    );
  }
}

/**
 * Core AI response logic — shared by onNewMention and onNewMessage.
 * Subscribes the thread, creates a DB chat record, runs streamText,
 * saves messages, and posts the response.
 */
async function handleFirstMessage(
  thread: any,
  message: any,
  platform: string,
  ownerUserId: string
) {
  try {
    try {
      await thread.startTyping("Thinking...");
    } catch {
      /* best-effort — no-op on unsupported platforms */
    }

    await thread.subscribe();

    const { chatId } = await getOrCreatePlatformChat({
      userId: ownerUserId,
      platform,
      threadId: thread.id,
      title: `Chat from ${message?.author?.fullName || "External Platform"}`,
    });
    await thread.setState({ chatId });
    const result = await postPlatformAgentTurn(thread, {
      userId: ownerUserId,
      platform,
      threadId: thread.id,
      chatId,
      text: message?.text || "",
      externalMessageId: message?.id,
      attachments: message?.attachments,
    });
    if (!result.text && result.approvalRequested) {
      await postAIResponse(
        thread,
        "This action needs your approval. Open the Etles web chat for this conversation to approve or deny it."
      );
    }
  } catch (error) {
    console.error(
      `[bot-handlers] ${platform} first turn failed:`,
      error instanceof Error ? error.message : "unknown error"
    );
    await postAIResponse(
      thread,
      "I could not complete that request right now. Please try again in a moment."
    );
  }
}

export function attachHandlers(
  bot: Chat,
  platform: string,
  ownerUserId: string
) {
  // ── Slack Assistants API ────────────────────────────────────────────────────
  if (platform === "slack") {
    bot.onAssistantThreadStarted(async (event) => {
      const slack = bot.getAdapter("slack") as SlackAdapter;
      await slack.setSuggestedPrompts(event.channelId, event.threadTs, [
        { title: "Get started", message: "What can you help me with?" },
        { title: "Summarize", message: "Summarize the current channel" },
      ]);
    });

    bot.onAssistantContextChanged(async (event) => {
      const slack = bot.getAdapter("slack") as SlackAdapter;
      await slack.setAssistantStatus(
        event.channelId,
        event.threadTs,
        "Updating context..."
      );
    });
  }

  // ── @mention in unsubscribed channel thread ─────────────────────────────────
  // Fires on: Slack, Teams, GChat, Discord, GitHub, Linear when bot is @-mentioned.
  // Does NOT fire on: Telegram DMs, WhatsApp — those platforms route to onNewMessage.
  bot.onNewMention(async (thread, message) => {
    await handleFirstMessage(thread, message, platform, ownerUserId);
  });

  // ── Direct messages ─────────────────────────────────────────────────────────
  // Use the SDK's DM route instead of a broad regex handler. This prevents a
  // channel message from being processed twice and covers Telegram/WhatsApp
  // DMs where users cannot mention the bot.
  bot.onDirectMessage(async (thread, message) => {
    await handleFirstMessage(thread, message, platform, ownerUserId);
  });

  // ── Follow-up messages in subscribed threads ────────────────────────────────
  bot.onSubscribedMessage(async (thread, message) => {
    try {
      try {
        await thread.startTyping("Thinking...");
      } catch {
        /* best-effort */
      }

      const state = (await thread.state) as { chatId: string } | null;
      const chatId = state?.chatId;

      if (!chatId) {
        console.error("[bot-handlers] No chatId in thread state for follow-up");
        return;
      }

      const result = await postPlatformAgentTurn(thread, {
        userId: ownerUserId,
        platform,
        threadId: thread.id,
        chatId,
        text: message?.text || "",
        externalMessageId: message?.id,
        attachments: message?.attachments,
      });
      if (!result.text && result.approvalRequested) {
        await postAIResponse(
          thread,
          "This action needs your approval. Open the Etles web chat for this conversation to approve or deny it."
        );
      }
    } catch (error) {
      console.error(
        `[bot-handlers] ${platform} follow-up failed:`,
        error instanceof Error ? error.message : "unknown error"
      );
      await postAIResponse(
        thread,
        "I could not complete that request right now. Please try again in a moment."
      );
    }
  });
}
