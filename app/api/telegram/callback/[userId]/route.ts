/**
 * Telegram callback query handler.
 * Route: POST /api/telegram/callback/[userId]
 *
 * Handles inline keyboard button presses for background HITL tool approvals:
 * - `approve:<approvalId>` -> marks decision as approved in Redis so agent resumes
 * - `reject:<approvalId>`  -> marks decision as rejected in Redis
 */

import { updateApprovalDecision } from "@/lib/ai/tools/background-approval";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Verify secret token
  const secretToken = request.headers.get("x-telegram-bot-api-secret-token");
  if (
    process.env.TELEGRAM_SECRET_TOKEN &&
    secretToken !== process.env.TELEGRAM_SECRET_TOKEN
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userId } = await params;

  try {
    const update = await request.json();
    const callbackQuery = update.callback_query;

    if (callbackQuery?.data) {
      const data = String(callbackQuery.data);
      const [action, approvalId] = data.split(":");

      if ((action === "approve" || action === "reject") && approvalId) {
        await updateApprovalDecision(
          userId,
          approvalId,
          action === "approve" ? "approved" : "rejected"
        );

        // Acknowledge callback query to Telegram so button spinner stops
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken && callbackQuery.id) {
          await fetch(
            `https://api.telegram.org/bot${botToken}/answerCallbackQuery`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: callbackQuery.id,
                text: action === "approve" ? "✅ Action approved! Agent resuming..." : "❌ Action rejected.",
              }),
            }
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("[telegram-callback] Error handling callback query:", err);
  }

  return new Response("OK", { status: 200 });
}
