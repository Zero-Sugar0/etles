"use server";

import { auth } from "@/app/(auth)/auth";
import { revalidatePath } from "next/cache";
import {
  deleteCampaignQueueItem,
  updateCampaignQueueContent,
  updateCampaignQueueStatus,
  updateMissionStatus,
} from "@/lib/db/queries";
import type { CampaignQueueItem, Mission } from "@/lib/db/schema";
import { publishToQStash } from "@/lib/workflow/qstash-publish";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

function getAppBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  )?.replace(/\/$/, "");
}

async function enqueueApprovedCampaignItem(
  item: CampaignQueueItem
): Promise<void> {
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) throw new Error("BASE_URL is not configured for campaign dispatch.");
  const delaySecs = Math.max(
    0,
    Math.ceil((item.scheduledFor.getTime() - Date.now()) / 1000)
  );
  const result = await publishToQStash({
    url: `${baseUrl}/api/agent/campaign/dispatch`,
    body: { itemId: item.id },
    delaySecs,
    retries: 3,
    deduplicationId: `campaign-dispatch:${item.id}`,
  });
  if (!result) throw new Error("QStash is not configured for campaign dispatch.");
}

export async function updateCampaignQueueItemStatusAction(
  id: string,
  status: CampaignQueueItem["status"]
) {
  try {
    const userId = await requireUserId();
    const result = await updateCampaignQueueStatus(id, userId, status);
    if (status === "approved") {
      try {
        await enqueueApprovedCampaignItem(result);
      } catch (error) {
        await updateCampaignQueueStatus(id, userId, "pending_review");
        throw error;
      }
    }
    revalidatePath("/campaigns");
    return { success: true, item: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: "Failed to update item status" };
  }
}

export async function updateCampaignQueueItemContentAction(
  id: string,
  content: string
) {
  try {
    const userId = await requireUserId();
    const result = await updateCampaignQueueContent(id, userId, content);
    revalidatePath("/campaigns");
    return { success: true, item: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: "Failed to edit draft content" };
  }
}

export async function deleteCampaignQueueItemAction(id: string) {
  try {
    const userId = await requireUserId();
    const result = await deleteCampaignQueueItem(id, userId);
    revalidatePath("/campaigns");
    return { success: true, item: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: "Failed to delete item" };
  }
}

export async function updateMissionStatusAction(
  id: string,
  status: Mission["status"]
) {
  try {
    const userId = await requireUserId();
    const result = await updateMissionStatus(id, userId, status);
    revalidatePath("/campaigns");
    return { success: true, mission: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: "Failed to update mission status" };
  }
}
