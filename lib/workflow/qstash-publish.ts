/**
 * lib/workflow/qstash-publish.ts
 *
 * Thin wrapper around @upstash/qstash for publishing background jobs.
 *
 * Used by the webhook trigger route to durably enqueue agent tasks instead of
 * using `waitUntil` (which is ephemeral and not retry-safe).
 *
 * QStash handles:
 *   - Guaranteed delivery (retries on 5xx responses from the worker)
 *   - Configurable retry count
 *   - Optional delay before first delivery
 *   - Signature verification on the receiving worker
 */

import { Client } from "@upstash/qstash";

function getQStashClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) {
    return null;
  }
  return new Client({
    token: process.env.QSTASH_TOKEN,
    baseUrl: process.env.QSTASH_URL,
  });
}

export interface QStashPublishOptions {
  /** Full URL of the receiving worker route, e.g. https://yourapp.com/api/agent/webhook-worker */
  url: string;
  /** JSON-serializable body */
  body: unknown;
  /** Number of delivery retries on failure (default: 3) */
  retries?: number;
  /** Delay in seconds before first delivery (default: 0) */
  delaySecs?: number;
}

/**
 * Publish a job to QStash for durable background delivery.
 * Returns the message ID, or null if QStash is not configured.
 *
 * On success: QStash will POST the body to `url`. If the worker returns
 * a non-2xx response, QStash retries up to `retries` times with backoff.
 */
export async function publishToQStash(
  opts: QStashPublishOptions
): Promise<{ messageId: string } | null> {
  const client = getQStashClient();
  if (!client) {
    console.warn(
      "[publishToQStash] QSTASH_TOKEN not set — falling back to fire-and-forget."
    );
    return null;
  }

  const response = await client.publishJSON({
    url: opts.url,
    body: opts.body,
    retries: opts.retries ?? 3,
    delay: opts.delaySecs ?? 0,
  });

  return { messageId: response.messageId };
}

export function isQStashEnabled(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}
