/**
 * Onboarding completion hook.
 * Route: POST /api/onboarding/complete
 *
 * Called by Etles after the user finishes onboarding.
 * Registers per-user QStash crons for:
 * - Hourly heartbeat (proactive check-ins)
 * - Weekly synthesis (Monday 8am UTC)
 *
 * Also saves onboarding_complete to memory so the system prompt
 * stops injecting the onboarding flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { Index } from "@upstash/vector";
import { registerUserCrons, triggerHeartbeatWorkflow } from "@/lib/workflow/client";

export async function POST(req: NextRequest) {
  // Accept both authenticated users and internal agent calls
  const agentSecret = req.headers.get("x-agent-secret");
  const isInternal = agentSecret === (process.env.AGENT_DELEGATE_SECRET ?? "dev-internal");

  let userId: string;

  if (isInternal) {
    const body = await req.json() as { userId?: string };
    if (!body.userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }
    userId = body.userId;
  } else {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
  }

  try {
    // 1. Save onboarding_complete to memory
    const index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    });
    const ns = index.namespace(`memory-${userId}`);
    await ns.upsert({
      id: "onboarding_complete",
      data: "User has completed onboarding setup with Etles.",
      metadata: {
        key: "onboarding_complete",
        content: "User has completed onboarding setup with Etles.",
        tags: ["onboarding", "setup"],
        savedAt: new Date().toISOString(),
      },
    });

    // 2. Register QStash crons + persist schedule IDs (idempotent scheduleId)
    await registerUserCrons(userId);

    // 3. Seed Business Framework Knowledge Graph (BMC, KPI tree, OKR & WBR templates)
    const { seedBusinessFramework } = await import("@/lib/agent/seed-business-framework");
    await seedBusinessFramework(userId).catch((err) => {
      console.error("[Onboarding Complete] Seed business framework failed:", err);
    });

    // 3. Full activation (morning briefing + sandbox keepalive schedules)
    const baseUrl =
      process.env.BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    await fetch(`${baseUrl}/api/agent/heartbeat/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": process.env.AGENT_DELEGATE_SECRET ?? "dev-internal",
        "x-user-id": userId,
      },
      body: JSON.stringify({ morningHour: 7 }),
    }).catch((err) => {
      console.error("[Onboarding Complete] Heartbeat activate failed:", err);
    });

    // 4. Trigger immediate heartbeat so the user sees "Active" status right away
    await triggerHeartbeatWorkflow({ userId });

    return NextResponse.json({
      ok: true,
      message: "Onboarding complete. Heartbeat and weekly synthesis crons registered.",
    });
  } catch (err: any) {
    console.error("[Onboarding Complete] Failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
