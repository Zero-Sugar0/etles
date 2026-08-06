"use server";

import { revalidatePath } from "next/cache";
import {
  deleteCampaignQueueItem,
  updateCampaignQueueContent,
  updateCampaignQueueStatus,
  updateMissionStatus,
} from "@/lib/db/queries";
import type { CampaignQueueItem, Mission } from "@/lib/db/schema";

export async function updateCampaignQueueItemStatusAction(
  id: string,
  status: CampaignQueueItem["status"]
) {
  try {
    const result = await updateCampaignQueueStatus(id, status);
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
    const result = await updateCampaignQueueContent(id, content);
    revalidatePath("/campaigns");
    return { success: true, item: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: "Failed to edit draft content" };
  }
}

export async function deleteCampaignQueueItemAction(id: string) {
  try {
    const result = await deleteCampaignQueueItem(id);
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
    const result = await updateMissionStatus(id, status);
    revalidatePath("/campaigns");
    return { success: true, mission: result };
  } catch (error) {
    console.error("Action failed:", error);
    return { success: false, error: "Failed to update mission status" };
  }
}
