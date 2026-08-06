/**
 * lib/ai/tools/background-approval.ts
 *
 * Polling Human-in-the-Loop (HITL) gate for background/autonomous agent runs.
 *
 * When an agent runs autonomously (via A2A, webhooks, or scheduled tasks) and
 * invokes an irreversible tool (Stripe payments, sending emails, posting social),
 * standard UI `needsApproval` flags won't work because there's no active user session.
 *
 * This wrapper:
 *   1. Saves the pending approval request to Upstash Redis.
 *   2. Sends a Telegram interactive message with Approve / Reject buttons (if configured).
 *   3. Polls Redis until the user approves or rejects via Telegram/Web UI callback.
 *   4. If approved → executes original tool.
 *   5. If rejected or timed out → safely returns structured rejection object to the agent.
 */

import { Redis } from "@upstash/redis";
import { generateUUID } from "@/lib/utils";
import { isIrreversibleTool } from "./with-approval";

function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface PendingApprovalRecord {
  approvalId: string;
  userId: string;
  chatId?: string;
  agentSlug?: string;
  toolName: string;
  args: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: string;
  decisionAt?: string;
}

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes max wait in background step

/**
 * Saves a pending approval request to Redis with 24h TTL.
 */
export async function createPendingApproval(
  record: Omit<PendingApprovalRecord, "createdAt" | "status">
): Promise<PendingApprovalRecord> {
  const fullRecord: PendingApprovalRecord = {
    ...record,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const redis = getRedis();
  if (redis) {
    const key = `agent:approval:${record.userId}:${record.approvalId}`;
    await redis.set(key, JSON.stringify(fullRecord), { ex: 24 * 60 * 60 });
  }

  return fullRecord;
}

/**
 * Updates the approval decision in Redis (called by Telegram callback route).
 */
export async function updateApprovalDecision(
  userId: string,
  approvalId: string,
  status: "approved" | "rejected"
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  const key = `agent:approval:${userId}:${approvalId}`;
  const raw = await redis.get<string | PendingApprovalRecord>(key);
  if (!raw) return false;

  const record: PendingApprovalRecord =
    typeof raw === "string" ? JSON.parse(raw) : raw;

  record.status = status;
  record.decisionAt = new Date().toISOString();

  await redis.set(key, JSON.stringify(record), { ex: 24 * 60 * 60 });
  return true;
}

/**
 * Sends a Telegram message asking for approval if bot credentials are set up.
 */
async function notifyTelegramApproval(
  record: PendingApprovalRecord
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const redis = getRedis();
  if (!botToken || !redis) return;

  // Retrieve user's saved telegram chat ID
  const tgChatId = await redis.get<number>(`user:${record.userId}:telegram_chat_id`);
  if (!tgChatId) return;

  const argsSnippet = JSON.stringify(record.args, null, 2);
  const text =
    `🔐 *Approval Requested by Agent*\n\n` +
    `*Tool:* \`${record.toolName}\`\n` +
    (record.agentSlug ? `*Agent:* \`${record.agentSlug}\`\n` : "") +
    `*Args preview:*\n\`\`\`json\n${argsSnippet.slice(0, 300)}\n\`\`\`\n\n` +
    `Approve this action to let the agent continue autonomously.`;

  const inline_keyboard = [
    [
      {
        text: "✅ Approve",
        callback_data: `approve:${record.approvalId}`,
      },
      {
        text: "❌ Reject",
        callback_data: `reject:${record.approvalId}`,
      },
    ],
  ];

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: tgChatId,
        text,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard },
      }),
    });
  } catch (err) {
    console.error("[background-approval] Telegram notification failed:", err);
  }
}

/**
 * Wraps tool definitions so background runs safely pause & poll for HITL approval
 * on irreversible actions.
 */
export function withBackgroundApproval(
  tools: Record<string, unknown>,
  opts: {
    userId: string;
    chatId?: string;
    agentSlug?: string;
    isBackground?: boolean;
  }
): Record<string, unknown> {
  if (!opts.isBackground) {
    return tools; // Interactive chat handles UI approvals via needsApproval: true
  }

  const result: Record<string, unknown> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    if (
      toolDef &&
      typeof toolDef === "object" &&
      typeof (toolDef as any).execute === "function" &&
      isIrreversibleTool(name)
    ) {
      const originalExecute = (toolDef as any).execute;

      const wrappedExecute = async (args: Record<string, unknown>) => {
        const approvalId = generateUUID();

        const pending = await createPendingApproval({
          approvalId,
          userId: opts.userId,
          chatId: opts.chatId,
          agentSlug: opts.agentSlug,
          toolName: name,
          args,
        });

        // Fire-and-forget Telegram notification
        notifyTelegramApproval(pending).catch(() => {});

        console.log(
          `[background-approval] Tool "${name}" paused for HITL approval (ID: ${approvalId})`
        );

        const redis = getRedis();
        const start = Date.now();

        // Poll Redis for user decision
        while (Date.now() - start < DEFAULT_TIMEOUT_MS) {
          if (!redis) break;

          const key = `agent:approval:${opts.userId}:${approvalId}`;
          const raw = await redis.get<string | PendingApprovalRecord>(key);
          if (raw) {
            const record: PendingApprovalRecord =
              typeof raw === "string" ? JSON.parse(raw) : raw;

            if (record.status === "approved") {
              console.log(`[background-approval] Tool "${name}" APPROVED. Executing...`);
              return await originalExecute(args);
            }

            if (record.status === "rejected") {
              console.warn(`[background-approval] Tool "${name}" REJECTED by user.`);
              return {
                success: false,
                approved: false,
                reason: "user_rejected",
                message: `Action ${name} was explicitly rejected by the user via Telegram/UI.`,
              };
            }
          }

          await sleep(DEFAULT_POLL_INTERVAL_MS);
        }

        console.warn(`[background-approval] Tool "${name}" approval TIMED OUT.`);
        return {
          success: false,
          approved: false,
          reason: "approval_timeout",
          message: `Action ${name} timed out after 15 minutes waiting for user approval.`,
        };
      };

      result[name] = {
        ...toolDef,
        execute: wrappedExecute,
      };
    } else {
      result[name] = toolDef;
    }
  }

  return result;
}
