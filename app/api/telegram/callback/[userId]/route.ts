/**
 * Telegram callback query handler.
 * Route: POST /api/telegram/callback/[userId]
 *
 * Legacy callback entry point for inline keyboard button presses. With the
 * queueApproval flow removed, all tool approvals now use the native AI SDK
 * `needsApproval` mechanism (rendered in the chat UI). Telegram bot messages
 * are handled by the main webhook route; callback queries are acknowledged
 * gracefully here for backward compatibility so Telegram stays responsive.
 */

// Re-export a no-op-safe handler that acknowledges updates.
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

  return new Response("OK", { status: 200 });
}