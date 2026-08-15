import "server-only";

import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { resolveUserCredential } from "@/lib/security/user-credentials";

/**
 * Resolve Composio credentials without changing the existing deployment setup:
 * the server key always wins, and a user's encrypted key is only a fallback.
 */
export async function getComposioClient(userId?: string) {
  const apiKey = await resolveUserCredential(
    userId,
    "composio",
    "COMPOSIO_API_KEY",
    ["COMPOSIO_API_KEY"]
  );

  return apiKey
    ? new Composio({ apiKey, provider: new VercelProvider() } as any)
    : new Composio({ provider: new VercelProvider() });
}

