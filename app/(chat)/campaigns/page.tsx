import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { isUserOnboarded } from "@/lib/ai/tools/memory";
import { getMissionsByUserId, getCampaignQueueByMissionId } from "@/lib/db/queries";
import { CampaignDashboardClient } from "./campaign-dashboard-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campaign Workspace | Etles AI",
  description: "Audit, refine, and approve auto-generated SDR emails, social content, and community touchpoints before they run live.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading Campaign Workspace...</div>}>
      <CampaignsPage />
    </Suspense>
  );
}

async function CampaignsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return redirect("/login");
  }

  // Robust server-side check for onboarding status
  const onboarded = await isUserOnboarded(session.user.id);
  if (!onboarded) {
    return redirect("/onboarding");
  }

  // Fetch all active/completed/paused missions for this user
  const missions = await getMissionsByUserId(session.user.id);

  // Fetch all campaign queue items across all user missions
  const queueItemsLists = await Promise.all(
    missions.map((m) => getCampaignQueueByMissionId(m.id))
  );
  const initialQueueItems = queueItemsLists.flat();

  return (
    <CampaignDashboardClient
      initialMissions={missions}
      initialQueueItems={initialQueueItems}
    />
  );
}
