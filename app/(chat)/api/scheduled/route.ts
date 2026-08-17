//app/(chat)/api/scheduled/route.ts

import { Receiver } from "@upstash/qstash";
import { generateText, stepCountIs } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { getBackgroundModel } from "@/lib/ai/providers";
import { readAgentSkill } from "@/lib/ai/tools/agent-skills";
import { getWeather } from "@/lib/ai/tools/get-weather";
import {
  deleteMemory,
  recallMemory,
  saveMemory,
  updateMemory,
} from "@/lib/ai/tools/memory";
import * as twilioWhatsApp from "@/lib/ai/tools/twilio-whatsapp";
import {
  getBotIntegration,
  getChatsByUserId,
  saveMessages,
  updateAgentTask,
} from "@/lib/db/queries";
import { createAgentScheduleEvent, getAgentSchedule, updateAgentSchedule } from "@/lib/db/queries/agent-calendar";
import { generateUUID } from "@/lib/utils";
import { sendLongMessage } from "@/lib/telegram/api";
import { getUserRedis, resolveUserCredential } from "@/lib/security/user-credentials";
import { getComposioClient } from "@/lib/composio-client";

function getReceiver() {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, message, taskId } = body;

    if (!userId || !taskId) return NextResponse.json({ ok: false, error: "Invalid schedule payload" }, { status: 400 });
    const schedule = await getAgentSchedule(userId, taskId);
    if (schedule && schedule.status !== "active") {
      return NextResponse.json({ ok: true, skipped: true, reason: `Schedule is ${schedule.status}` });
    }
    if (schedule) {
      await updateAgentSchedule(userId, taskId, { lastRunAt: new Date(), retryCount: 0 });
      await createAgentScheduleEvent({ id: generateUUID(), scheduleId: taskId, userId, eventKey: `${taskId}:fired:${body.messageId ?? new Date().toISOString()}`, type: "fired", metadata: { qstashMessageId: body.messageId ?? null } });
    }

    console.log(`[QStash] Proactive trigger: "${message}" for user ${userId}`);

    // 1. Get the most recent chat for this user to append the reminder to
    const { chats } = await getChatsByUserId({
      id: userId,
      limit: 1,
      startingAfter: null,
      endingBefore: null,
    });

    const activeChat = chats[0];
    if (!activeChat) {
      console.warn(
        `[QStash] No active chat found for user ${userId}. Skipping reminder.`
      );
      const telegram = await getBotIntegration({ userId, platform: "telegram" });
      if (
        telegram &&
        await getUserRedis(userId)
      ) {
        const redis = await getUserRedis(userId);
        if (!redis) throw new Error("Redis connection unavailable");
        const chatKeys = await redis.keys(`tg:chat:${userId}:*`);
        await Promise.all(
          chatKeys.map(async (key) => {
            const telegramChatId = Number(key.split(":").at(-1));
            if (!Number.isNaN(telegramChatId)) {
              await sendLongMessage(telegram.botToken, telegramChatId, `Reminder: ${message}`);
            }
          })
        );
        return NextResponse.json({ ok: true, delivered: "telegram" });
      }
      return NextResponse.json({ ok: false, error: "No active chat or Telegram session found" });
    }

    const chatId = activeChat.id;

    // 2. Initialize tools for the proactive agent
    // We only include non-UI tools (no artifacts/documents)
    let composioTools: Record<string, any> = {};
    try {
      const composioClient = await getComposioClient(userId);
      const composioSession = await composioClient.create(userId, {
        manageConnections: true,
        multiAccount: { enable: true, maxAccountsPerToolkit: 5 },
      });
      composioTools = await composioSession.tools();
    } catch (e) {
      console.error("[QStash] Failed to load Composio tools:", e);
    }

    const tools = {
      ...composioTools,
      getWeather,
      readAgentSkill: readAgentSkill(),
      saveMemory: saveMemory({ userId }),
      recallMemory: recallMemory({ userId }),
      updateMemory: updateMemory({ userId }),
      deleteMemory: deleteMemory({ userId }),
      // Twilio WhatsApp Tools
      twilioWhatsAppSendMessage: twilioWhatsApp.twilioWhatsAppSendMessage({
        userId,
      }),
      twilioWhatsAppGetMessage: twilioWhatsApp.twilioWhatsAppGetMessage({
        userId,
      }),
      twilioWhatsAppListMessages: twilioWhatsApp.twilioWhatsAppListMessages({
        userId,
      }),
      twilioWhatsAppSendTemplate: twilioWhatsApp.twilioWhatsAppSendTemplate({
        userId,
      }),
      twilioWhatsAppCreateTemplate: twilioWhatsApp.twilioWhatsAppCreateTemplate(
        { userId }
      ),
      twilioWhatsAppListTemplates: twilioWhatsApp.twilioWhatsAppListTemplates({
        userId,
      }),
      twilioWhatsAppGetTemplate: twilioWhatsApp.twilioWhatsAppGetTemplate({
        userId,
      }),
      twilioWhatsAppDeleteTemplate: twilioWhatsApp.twilioWhatsAppDeleteTemplate(
        { userId }
      ),
      twilioWhatsAppSubmitApproval: twilioWhatsApp.twilioWhatsAppSubmitApproval(
        { userId }
      ),
      twilioWhatsAppGetApprovalStatus:
        twilioWhatsApp.twilioWhatsAppGetApprovalStatus({ userId }),
      twilioWhatsAppListSenders: twilioWhatsApp.twilioWhatsAppListSenders({
        userId,
      }),
    };

    // 3. Run the proactive agent
    const systemInstruction = `You are Etles, the user's highly capable proactive AI assistant. 
A scheduled reminder or recurring task has just fired: "${message}".

Your objective is to fulfill this reminder immediately and autonomously. You are running in a background job, so the user cannot respond to follow-up questions. You must act independently.

Follow these strict guidelines:
1. ANALYSIS: Determine exactly what the reminder requires (e.g., sending an email, fetching data, updating a document, or simply notifying the user).
2. EXECUTION: Use your available tools to perform the required actions. If it involves external services (like Gmail, Calendar, Notion, etc.), execute them using the appropriate tools.
3. NOTIFICATION: If the task requires notifying the user of the outcome or reminding them of something:
   - First, use the \`recallMemory\` tool to search for their Telegram Chat ID or preferences.
   - If you find a way to contact them (e.g., via a Telegram or messaging tool), send them a concise, helpful summary of what was completed.
   - If no external contact method is found, your final text response will serve as the notification in their chat interface.
4. ERRORS: If a tool call fails, try to recover or gracefully report the failure in your final response.
5. EFFICIENCY: Complete the task in as few steps as possible. Do not overcomplicate or add unnecessary actions.
6. ALWAYS UPDATE THE USER: If you successfully complete the reminder task, make sure to update the user in some way, either through a tool or in your final response. Do not leave them wondering if it was done. update the on telegram and never ask for their telegram id use the recall memory tool to find the telegram id if you need to send them a message.

Today's date is ${new Date().toLocaleDateString()}.
Be direct, professional, and efficient. Do not ask for user confirmation.`;

    const result = await generateText({
      model: getBackgroundModel(),
      system: systemInstruction,
      prompt: `Reminder triggered: ${message}`,
      tools,
      stopWhen: stepCountIs(25),
    });

    // 4. Save the interaction back to the database
    const messagesToSave: any[] = [];
    const timestamp = new Date();

    // Save the reminder trigger
    messagesToSave.push({
      id: generateUUID(),
      chatId,
      role: "user",
      parts: [{ type: "text", text: `⏰Scheduled: ${message}` }],
      attachments: [],
      createdAt: timestamp,
    });

    // Save assistant text response
    if (result.text) {
      messagesToSave.push({
        id: generateUUID(),
        chatId,
        role: "assistant",
        parts: [{ type: "text", text: result.text }],
        attachments: [],
        createdAt: new Date(timestamp.getTime() + 1000), // Ensure later timestamp
      });
    }

    // Save tool executions if any — tool-call and tool-result are merged into a
    // single assistant message per step. The AI SDK UIMessage schema has no
    // "tool" role; results live as parts inside assistant messages.
    if (result.steps) {
      let offset = 2000;
      for (const step of result.steps) {
        if (!step.toolCalls?.length) {
          continue;
        }
        for (const call of step.toolCalls) {
          const toolCallId = (call as any).toolCallId;
          const toolResult = step.toolResults?.find(
            (r: any) => r.toolCallId === toolCallId
          );

          const parts: any[] = [
            {
              type: "tool-call",
              toolCallId,
              toolName: (call as any).toolName,
              args: (call as any).args,
            },
          ];

          if (toolResult) {
            parts.push({
              type: "tool-result",
              toolCallId,
              toolName: (call as any).toolName,
              result: (toolResult as any).result,
            });
          }

          messagesToSave.push({
            id: generateUUID(),
            chatId,
            role: "assistant",
            parts,
            attachments: [],
            createdAt: new Date(timestamp.getTime() + offset),
          });

          offset += 1000;
        }
      }
    }

    await saveMessages({ messages: messagesToSave });

    // Background tools do not include Telegram sending. Deliver explicitly
    // after the scheduled work succeeds so reminders reach the user's bot.
    try {
      const telegram = await getBotIntegration({ userId, platform: "telegram" });
      if (
        telegram &&
        await getUserRedis(userId)
      ) {
        const redis = await getUserRedis(userId);
        if (!redis) throw new Error("Redis connection unavailable");
        const chatKeys = await redis.keys(`tg:chat:${userId}:*`);
        const notification = result.text?.trim() || `Reminder: ${message}`;
        await Promise.all(
          chatKeys.map(async (key) => {
            const telegramChatId = Number(key.split(":").at(-1));
            if (!Number.isNaN(telegramChatId)) {
              await sendLongMessage(telegram.botToken, telegramChatId, notification);
            }
          })
        );
      }
    } catch (deliveryError) {
      console.error("[QStash] Reminder completed but Telegram delivery failed:", deliveryError);
    }

    if (schedule) {
      await updateAgentSchedule(userId, taskId, {
        status: schedule.kind === "reminder" ? "completed" : "active",
        lastError: null,
      });
      await createAgentScheduleEvent({
        id: generateUUID(),
        scheduleId: taskId,
        userId,
        eventKey: `${taskId}:completed:${body.messageId ?? new Date().toISOString()}`,
        type: "completed",
        metadata: { toolCount: result.toolCalls?.length ?? 0 },
      });
    }

    if (taskId) {
      try {
        await updateAgentTask({
          id: taskId,
          userId,
          status: "completed",
          result: { text: result.text, toolCalls: result.toolCalls },
        });
      } catch (err) {
        console.warn(`[QStash] Could not update AgentTask ${taskId}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Proactive trigger completed",
      actionTaken: result.text,
      toolCount: result.toolCalls?.length ?? 0,
    });
  } catch (error: any) {
    console.error("[QStash] Proactive trigger failed:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const receiver = getReceiver();
  if (receiver) {
    const rawBody = await req.text();
    const signature = req.headers.get("upstash-signature") ?? "";
    const valid = await receiver
      .verify({ signature, body: rawBody, clockTolerance: 5 })
      .catch(() => false);

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid QStash signature" },
        { status: 401 }
      );
    }

    return handler(
      new NextRequest(req.url, {
        method: "POST",
        headers: req.headers,
        body: rawBody,
      })
    );
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "QStash signing keys are not configured" },
      { status: 500 }
    );
  }

  return handler(req);
}
