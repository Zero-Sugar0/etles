/**
 * lib/ai/tools/with-retry.ts
 *
 * Wraps tool `execute` functions with exponential backoff retry logic.
 *
 * Applies to Composio and any other external integration tools.
 * The tool schema (description, inputSchema) is preserved exactly so
 * Composio compatibility and the AI SDK's tool registration are unaffected.
 *
 * Retry behavior:
 *   - Retries on: 429, 500, 502, 503, 504, ECONNRESET, ETIMEDOUT, fetch failed
 *   - Does NOT retry: 400, 401, 403, 404 (client errors — retrying won't help)
 *   - Exponential backoff: baseDelayMs * 2^attempt (jittered ±20%)
 *   - Default: 3 attempts, 500ms base delay → 500ms, 1000ms, 2000ms
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;

/** HTTP status codes that indicate a transient server-side error worth retrying. */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Error message substrings that indicate transient network issues. */
const RETRYABLE_ERROR_HINTS = [
  "econnreset",
  "etimedout",
  "fetch failed",
  "network error",
  "socket hang up",
  "connection reset",
  "epipe",
  "rate limit",
  "too many requests",
];

function isRetryable(error: unknown): boolean {
  if (!error) return false;

  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  // Check status code embedded in error (Composio surfaces these)
  const statusMatch = msg.match(/\b(status|code|statuscode)[:\s]*(\d{3})\b/);
  if (statusMatch) {
    const code = Number(statusMatch[2]);
    if (code >= 400 && code < 500 && code !== 429) return false; // 4xx (except 429) = not retryable
    if (RETRYABLE_STATUS_CODES.has(code)) return true;
  }

  return RETRYABLE_ERROR_HINTS.some((hint) => msg.includes(hint));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredDelay(baseMs: number, attempt: number): number {
  const exponential = baseMs * 2 ** attempt;
  const jitter = exponential * (0.8 + Math.random() * 0.4); // ±20%
  return Math.min(jitter, 30_000); // cap at 30s
}

type AnyToolDef = {
  description?: string;
  inputSchema?: unknown;
  execute?: (...args: any[]) => Promise<any>;
  [key: string]: unknown;
};

/**
 * Wraps a record of tool definitions so every `execute` function retries
 * on transient errors with exponential backoff.
 *
 * Usage:
 *   const composioTools = await session.tools();
 *   const retriableTools = withRetry(composioTools);
 */
export function withRetry(
  tools: Record<string, unknown>,
  opts?: { maxAttempts?: number; baseDelayMs?: number }
): Record<string, unknown> {
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  const result: Record<string, unknown> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    if (
      toolDef === null ||
      typeof toolDef !== "object" ||
      typeof (toolDef as AnyToolDef).execute !== "function"
    ) {
      // Not a tool or no execute fn — pass through unchanged
      result[name] = toolDef;
      continue;
    }

    const original = toolDef as AnyToolDef;
    const originalExecute = original.execute as (...args: any[]) => Promise<any>;

    const wrappedExecute = async (...args: any[]): Promise<any> => {
      let lastError: unknown;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await originalExecute(...args);
        } catch (err) {
          lastError = err;

          if (!isRetryable(err)) {
            // Non-transient error — fail immediately, no retry
            throw err;
          }

          if (attempt < maxAttempts - 1) {
            const delay = jitteredDelay(baseDelayMs, attempt);
            console.warn(
              `[withRetry] Tool "${name}" failed (attempt ${attempt + 1}/${maxAttempts}). ` +
                `Retrying in ${Math.round(delay)}ms. Error: ${err instanceof Error ? err.message : String(err)}`
            );
            await sleep(delay);
          }
        }
      }

      // All attempts exhausted
      console.error(
        `[withRetry] Tool "${name}" failed after ${maxAttempts} attempts.`
      );
      throw lastError;
    };

    result[name] = {
      ...original,
      execute: wrappedExecute,
    };
  }

  return result;
}
