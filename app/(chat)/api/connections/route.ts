// app/(chat)/api/connections/route.ts
import { guestRegex } from "@/lib/constants";
import { getComposioClient } from "@/lib/composio-client";
import { auth } from "../../../(auth)/auth";

function getComposioErrorStatus(error: unknown) {
  const candidate = error as {
    status?: unknown;
    cause?: { status?: unknown };
  };
  const status = candidate?.status ?? candidate?.cause?.status;
  return typeof status === "number" ? status : undefined;
}

function isComposioAuthError(error: unknown) {
  return getComposioErrorStatus(error) === 401;
}

function toolkitKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function accountToolkitKeys(account: any) {
  return [
    account?.toolkit?.slug,
    account?.toolkit?.key,
    account?.toolkit?.name,
    account?.appName,
    account?.appId,
  ]
    .map(toolkitKey)
    .filter(Boolean);
}

// GET: List all toolkits and their connection status
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isGuest = guestRegex.test(session?.user?.email ?? "");
  if (isGuest) {
    return Response.json(
      { error: "Unauthorized: Guest access not allowed" },
      { status: 401 }
    );
  }

  try {
    const composio = await getComposioClient(session.user.id);
    // Fetch all toolkits from Composio SDK directly
    let allApps: any = await composio.toolkits.get();
    if (!Array.isArray(allApps)) {
      allApps = allApps?.items || [];
    }

    // Fetch the user's connected accounts. Keep the request unfiltered for
    // compatibility with the installed 0.15 SDK, then apply the documented
    // ACTIVE status locally so a newer SDK filter cannot break this page.
    const connectedApps = new Map<
      string,
      Array<{ id: string; alias?: string }>
    >();
    try {
      const userAccounts = await composio.connectedAccounts.list({
        userIds: [session.user.id],
      });
      const items = userAccounts?.items ?? [];
      for (const rawAcc of items) {
        const acc = rawAcc as any;
        if (acc.status && String(acc.status).toUpperCase() !== "ACTIVE") {
          continue;
        }
        const keys = accountToolkitKeys(acc);
        if (keys.length === 0 || !acc.id) {
          continue;
        }
        const entry = { id: acc.id, alias: acc.alias || undefined };
        for (const key of keys) {
          const existing = connectedApps.get(key) ?? [];
          if (!existing.some((account) => account.id === entry.id)) {
            existing.push(entry);
          }
          connectedApps.set(key, existing);
        }
      }
    } catch (accountError) {
      console.error("Failed to fetch connected accounts:", accountError);
      // Non-fatal: continue with empty connected map; toolkits still load
    }

    // Format a raw Composio app name/key to a human-readable Title Case label
    const formatAppName = (nameOrKey: string): string => {
      return nameOrKey
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    return Response.json({
      toolkits: allApps.map((t: any) => {
        const slug = t.slug || t.key || "";
        const requiresAuth = !t.noAuth && !t.no_auth;
        const accounts = [
          ...(connectedApps.get(toolkitKey(slug)) ?? []),
          ...(connectedApps.get(toolkitKey(t.name)) ?? []),
        ].filter(
          (account, index, all) =>
            all.findIndex((candidate) => candidate.id === account.id) === index
        );
        return {
          slug,
          name: formatAppName(t.name || slug),
          logo: t.meta?.logo || t.logo,
          requiresAuth,
          // No-auth tools are always available — treat as connected by default
          isConnected: !requiresAuth || accounts.length > 0,
          // Backward-compatible: first (most recently connected) account id
          connectedAccountId: accounts[0]?.id,
          // Multi-account: all connected accounts for this toolkit
          connectedAccounts: accounts,
        };
      }),
    });
  } catch (error: any) {
    const status = getComposioErrorStatus(error);
    console.error("Failed to fetch Composio toolkits", {
      status,
      code: error?.code,
    });

    if (isComposioAuthError(error)) {
      return Response.json(
        {
          error:
            "Composio authentication failed. Check the deployment key or add a valid Composio key in Profile > Secrets.",
          code: "COMPOSIO_AUTH_INVALID",
          toolkits: [],
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        error: "Failed to load toolkits",
        code: "COMPOSIO_TOOLKIT_FETCH_FAILED",
        toolkits: [],
      },
      { status: 500 }
    );
  }
}

// POST: Start an OAuth flow for a specific toolkit
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isGuest = guestRegex.test(session?.user?.email ?? "");
  if (isGuest) {
    return Response.json(
      { error: "Unauthorized: Guest access not allowed" },
      { status: 401 }
    );
  }

  const { toolkit, alias }: { toolkit: string; alias?: string } =
    await req.json();
  try {
    const composio = await getComposioClient(session.user.id);
    const baseUrl =
      process.env.BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined) ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : new URL(req.url).origin);

    const composioSession = await composio.create(session.user.id);

    const connectionRequest = await composioSession.authorize(toolkit, {
      ...(alias ? { alias } : {}),
      callbackUrl: `${baseUrl}/settings/connections`,
    });

    return Response.json({ redirectUrl: connectionRequest.redirectUrl });
  } catch (error: any) {
    const status = getComposioErrorStatus(error);
    console.error("Failed to initiate Composio authorization", {
      status,
      code: error?.code,
    });

    return Response.json(
      {
        error: isComposioAuthError(error)
          ? "Composio authentication failed. Check the deployment key or add a valid Composio key in Profile > Secrets."
          : "Failed to initiate connection",
        code: isComposioAuthError(error)
          ? "COMPOSIO_AUTH_INVALID"
          : "COMPOSIO_CONNECTION_FAILED",
      },
      { status: isComposioAuthError(error) ? 401 : 500 }
    );
  }
}
