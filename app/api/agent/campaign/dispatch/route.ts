import { Receiver } from "@upstash/qstash";
import { type NextRequest, NextResponse } from "next/server";
import {
  claimCampaignQueueItem,
  getCampaignQueueItemForDispatch,
  markCampaignQueueItemFailed,
  markCampaignQueueItemSent,
  updateCampaignQueueStatus,
} from "@/lib/db/queries";
import { dispatchCampaignContent } from "@/lib/ai/tools/campaign-dispatch";

const MAX_ATTEMPTS = 3;

function getReceiver() {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  return currentSigningKey && nextSigningKey
    ? new Receiver({ currentSigningKey, nextSigningKey })
    : null;
}

export async function POST(req: NextRequest) {
  const receiver = getReceiver();
  let rawBody: string;
  if (receiver) {
    rawBody = await req.text();
    const valid = await receiver
      .verify({
        signature: req.headers.get("upstash-signature") ?? "",
        body: rawBody,
        clockTolerance: 5,
      })
      .catch(() => false);
    if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "QSTASH signing keys are not configured" }, { status: 500 });
    }
    const secret = process.env.AGENT_DELEGATE_SECRET?.trim();
    if (!secret || req.headers.get("x-agent-secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    rawBody = await req.text();
  }

  let itemId: string;
  try {
    const body = JSON.parse(rawBody) as { itemId?: string };
    if (!body.itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    itemId = body.itemId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const record = await getCampaignQueueItemForDispatch(itemId);
  if (!record) return NextResponse.json({ error: "Campaign item not found" }, { status: 404 });
  if (["sent", "rejected", "dead_letter"].includes(record.item.status)) {
    return NextResponse.json({ ok: true, skipped: true, status: record.item.status });
  }
  if (record.item.scheduledFor > new Date()) {
    return NextResponse.json({ error: "Campaign item is not due yet" }, { status: 409 });
  }

  const claimed = await claimCampaignQueueItem(itemId);
  if (!claimed) return NextResponse.json({ ok: true, skipped: true, reason: "Already claimed or not approved" });

  try {
    const result = await dispatchCampaignContent({
      channel: claimed.channel,
      recipient: claimed.recipient,
      content: claimed.content,
      userId: record.userId,
    });
    await markCampaignQueueItemSent(itemId, result.providerMessageId);
    return NextResponse.json({ ok: true, status: "sent", providerMessageId: result.providerMessageId ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign dispatch failed";
    const deadLetter = claimed.attempts >= MAX_ATTEMPTS;
    await markCampaignQueueItemFailed(itemId, message, deadLetter);
    if (!deadLetter) {
      await updateCampaignQueueStatus(itemId, record.userId, "approved");
      return NextResponse.json({ ok: false, error: message, retry: true }, { status: 500 });
    }
    return NextResponse.json({ ok: false, status: "dead_letter", error: message });
  }
}
