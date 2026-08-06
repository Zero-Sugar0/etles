"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Layers,
  Linkedin,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CampaignQueueItem, Mission } from "@/lib/db/schema";
import {
  deleteCampaignQueueItemAction,
  updateCampaignQueueItemContentAction,
  updateCampaignQueueItemStatusAction,
  updateMissionStatusAction,
} from "./actions";

interface CampaignDashboardClientProps {
  initialMissions: Mission[];
  initialQueueItems: CampaignQueueItem[];
}

export function CampaignDashboardClient({
  initialMissions,
  initialQueueItems,
}: CampaignDashboardClientProps) {
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [queueItems, setQueueItems] =
    useState<CampaignQueueItem[]>(initialQueueItems);
  const [activeTab, setActiveTab] = useState<string>("pending_review");
  const [editingItemId, setEditingEditingItemId] = useState<string | null>(
    null
  );
  const [editContent, setEditContent] = useState<string>("");

  // Action: Toggle Mission status (Pause/Resume)
  const handleToggleMission = async (mission: Mission) => {
    const nextStatus = mission.status === "running" ? "paused" : "running";
    const toastId = toast.loading(
      `${nextStatus === "paused" ? "Pausing" : "Resuming"} campaign...`
    );

    const res = await updateMissionStatusAction(mission.id, nextStatus);
    if (res.success && res.mission) {
      setMissions((prev) =>
        prev.map((m) => (m.id === mission.id ? (res.mission as Mission) : m))
      );
      toast.success(
        `Campaign ${nextStatus === "paused" ? "paused" : "resumed"} successfully!`,
        { id: toastId }
      );
    } else {
      toast.error(res.error || "Failed to update campaign status", {
        id: toastId,
      });
    }
  };

  // Action: Change Campaign Queue Item status (Approve / Reject)
  const handleUpdateItemStatus = async (
    id: string,
    nextStatus: CampaignQueueItem["status"]
  ) => {
    const actionLabel = nextStatus === "approved" ? "Approving" : "Rejecting";
    const toastId = toast.loading(`${actionLabel} draft sequence...`);

    const res = await updateCampaignQueueItemStatusAction(id, nextStatus);
    if (res.success && res.item) {
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === id ? (res.item as CampaignQueueItem) : item
        )
      );
      toast.success(
        `Draft successfully ${nextStatus === "approved" ? "approved & queued" : "skipped"}!`,
        { id: toastId }
      );
    } else {
      toast.error(res.error || "Failed to process item status", {
        id: toastId,
      });
    }
  };

  // Action: Delete Campaign Queue Item
  const handleDeleteItem = async (id: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete this drafted sequence?"
    );
    if (!confirmDelete) {
      return;
    }

    const toastId = toast.loading("Deleting drafted campaign element...");
    const res = await deleteCampaignQueueItemAction(id);
    if (res.success) {
      setQueueItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Draft successfully deleted!", { id: toastId });
    } else {
      toast.error(res.error || "Failed to delete drafted item", {
        id: toastId,
      });
    }
  };

  // Inline Edit: Start Editing
  const startEditing = (item: CampaignQueueItem) => {
    setEditingEditingItemId(item.id);
    setEditContent(item.content);
  };

  // Inline Edit: Save Content
  const saveEditedContent = async (id: string) => {
    const toastId = toast.loading("Saving content adjustments...");
    const res = await updateCampaignQueueItemContentAction(id, editContent);
    if (res.success && res.item) {
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === id ? (res.item as CampaignQueueItem) : item
        )
      );
      setEditingEditingItemId(null);
      toast.success("Draft edits saved successfully!", { id: toastId });
    } else {
      toast.error(res.error || "Failed to update draft content", {
        id: toastId,
      });
    }
  };

  // Filter Items by active Tab
  const filteredItems = queueItems.filter((item) => item.status === activeTab);

  // Stats Counters
  const pendingCount = queueItems.filter(
    (item) => item.status === "pending_review"
  ).length;
  const approvedCount = queueItems.filter(
    (item) => item.status === "approved"
  ).length;
  const sentCount = queueItems.filter((item) => item.status === "sent").length;
  const rejectedCount = queueItems.filter(
    (item) => item.status === "rejected"
  ).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 bg-background">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center gap-3">
            <SidebarToggle />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              Campaign Workspace
            </h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-2xl">
            Audit, refine, and approve auto-generated SDR emails, social
            content, and community touchpoints before they run live.
          </p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* ── LEFT PANEL: ACTIVE CAMPAIGNS ── */}
        <div className="xl:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Active Campaigns
            </h2>
            <Badge className="rounded-full" variant="secondary">
              {missions.length} Registered
            </Badge>
          </div>

          <div className="space-y-4">
            {missions.length > 0 ? (
              missions.map((mission) => {
                const percentComplete = Math.min(
                  Math.round((mission.currentDay / mission.durationDays) * 100),
                  100
                );

                return (
                  <Card
                    className="overflow-hidden border border-sidebar-border bg-sidebar/50 backdrop-blur-xl transition-all duration-300 hover:shadow-md"
                    key={mission.id}
                  >
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <h3
                            className="text-sm sm:text-base font-bold truncate pr-2"
                            title={mission.goal}
                          >
                            {mission.goal}
                          </h3>
                          {mission.productUrl && (
                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                              {mission.productUrl}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={`capitalize font-semibold shrink-0 select-none ${
                            mission.status === "running"
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : mission.status === "paused"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          }`}
                          variant="outline"
                        >
                          <span
                            className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${
                              mission.status === "running"
                                ? "bg-green-500 animate-pulse"
                                : "bg-current"
                            }`}
                          />
                          {mission.status}
                        </Badge>
                      </div>

                      {/* Day and Progress bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                          <span>Timeline Progression</span>
                          <span>
                            Day {mission.currentDay} / {mission.durationDays}
                          </span>
                        </div>
                        <Progress
                          className="h-2 rounded-full"
                          value={percentComplete}
                        />
                        <div className="text-[10px] text-muted-foreground text-right">
                          {percentComplete}% Complete
                        </div>
                      </div>

                      {/* Detailed info */}
                      {mission.startupDescription && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-2.5 rounded-lg border">
                          {mission.startupDescription}
                        </p>
                      )}

                      {/* Controls */}
                      <div className="pt-2 flex items-center justify-between border-t border-sidebar-border gap-2">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started:{" "}
                          {new Date(mission.createdAt).toLocaleDateString()}
                        </span>
                        <Button
                          className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                            mission.status === "running"
                              ? "hover:bg-amber-500/10 hover:text-amber-600"
                              : "hover:bg-green-500/10 hover:text-green-600"
                          }`}
                          onClick={() => handleToggleMission(mission)}
                          size="sm"
                          variant="ghost"
                        >
                          {mission.status === "running" ? (
                            <>
                              <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-1.5 h-3.5 w-3.5" /> Resume
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center p-8 py-16 text-center border rounded-xl border-dashed bg-sidebar/20">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground leading-none">
                  No Active Campaigns
                </p>
                <p className="text-xs text-muted-foreground/60 max-w-[200px] mt-1.5">
                  Launch a multi-week mission via chat to activate campaign
                  automation lists.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: CAMPAIGN WORKLIST QUEUE ── */}
        <div className="xl:col-span-2 space-y-6">
          <Tabs
            className="space-y-6"
            defaultValue="pending_review"
            onValueChange={setActiveTab}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sidebar-border pb-1.5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Campaign Worklist
                Queue
              </h2>

              <TabsList className="grid grid-cols-4 max-w-[420px] h-9 p-1 bg-muted/60">
                <TabsTrigger
                  className="text-[10px] sm:text-xs px-2.5 rounded-md relative"
                  value="pending_review"
                >
                  Review
                  {pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-1 ring-background">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  className="text-[10px] sm:text-xs px-2.5 rounded-md relative"
                  value="approved"
                >
                  Approved
                  {approvedCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[9px] font-bold text-white ring-1 ring-background">
                      {approvedCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  className="text-[10px] sm:text-xs px-2.5 rounded-md relative"
                  value="sent"
                >
                  Sent
                  {sentCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white ring-1 ring-background">
                      {sentCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  className="text-[10px] sm:text-xs px-2.5 rounded-md relative"
                  value="rejected"
                >
                  Skipped
                  {rejectedCount > 0 && (
                    <span className="absolute -top-1.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-muted-foreground/40 px-1 text-[9px] font-bold text-white ring-1 ring-background">
                      {rejectedCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              className="space-y-4 focus-visible:outline-none"
              value={activeTab}
            >
              <AnimatePresence mode="popLayout">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isEditing = editingItemId === item.id;
                    const channelConfig = getChannelConfig(item.channel);

                    return (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        initial={{ opacity: 0, y: 15 }}
                        key={item.id}
                        layout
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="border overflow-hidden bg-card/60 shadow-sm hover:shadow-md transition-all duration-300">
                          {/* Card Header Section */}
                          <div className="p-4 sm:p-5 border-b border-sidebar-border bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              {/* Channel Badge */}
                              <Badge
                                className={`flex items-center gap-1.5 select-none font-bold uppercase tracking-wider ${channelConfig.style}`}
                              >
                                {channelConfig.icon}
                                {item.channel}
                              </Badge>

                              {/* Recipient Details */}
                              <span
                                className="text-xs font-semibold text-foreground/80 truncate max-w-[200px] sm:max-w-xs"
                                title={item.recipient}
                              >
                                <span className="text-muted-foreground mr-1">
                                  To:
                                </span>{" "}
                                {item.recipient}
                              </span>
                            </div>

                            {/* Date Scheduled */}
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-semibold">
                              <Calendar className="h-3 w-3" />
                              Scheduled:{" "}
                              {new Date(item.scheduledFor).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Card Body Section */}
                          <div className="p-4 sm:p-5 space-y-4">
                            {isEditing ? (
                              <div className="space-y-3">
                                <textarea
                                  className="w-full min-h-[160px] p-3 text-xs sm:text-sm font-sans bg-background border border-primary/25 rounded-xl shadow-inner focus:outline-none focus:ring-1 focus:ring-primary/40 leading-relaxed resize-y"
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  value={editContent}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    className="h-8 rounded-lg px-3 text-xs"
                                    onClick={() =>
                                      setEditingEditingItemId(null)
                                    }
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    className="h-8 rounded-lg px-3.5 text-xs font-bold gap-1.5 shadow-sm"
                                    onClick={() => saveEditedContent(item.id)}
                                    size="sm"
                                    variant="default"
                                  >
                                    <Save className="h-3.5 w-3.5" /> Save Edits
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="relative group/content">
                                <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed p-3 sm:p-4 rounded-xl bg-muted/20 border text-foreground/90 max-h-[220px] overflow-y-auto">
                                  {item.content}
                                </div>
                                <div className="absolute top-2.5 right-2 opacity-0 group-hover/content:opacity-100 transition-opacity">
                                  <Button
                                    className="h-7 w-7 p-0 rounded-md shadow-sm border"
                                    onClick={() => startEditing(item)}
                                    size="sm"
                                    title="Edit Draft Content"
                                    variant="secondary"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Card Actions Bottom Block */}
                            {!isEditing && (
                              <div className="pt-3 border-t border-sidebar-border flex flex-wrap items-center justify-between gap-3">
                                <span className="text-[10px] text-muted-foreground">
                                  Last modified:{" "}
                                  {new Date(
                                    item.updatedAt
                                  ).toLocaleTimeString()}
                                </span>

                                <div className="flex items-center gap-2">
                                  {item.status === "pending_review" && (
                                    <>
                                      <Button
                                        className="h-8 px-3 rounded-lg text-xs font-semibold border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() =>
                                          handleUpdateItemStatus(
                                            item.id,
                                            "rejected"
                                          )
                                        }
                                        size="sm"
                                        variant="outline"
                                      >
                                        <X className="mr-1.5 h-3.5 w-3.5" />{" "}
                                        Skip
                                      </Button>
                                      <Button
                                        className="h-8 px-3.5 rounded-lg text-xs font-bold gap-1.5 bg-green-600 hover:bg-green-600/90 text-white border-green-600/20 shadow-sm"
                                        onClick={() =>
                                          handleUpdateItemStatus(
                                            item.id,
                                            "approved"
                                          )
                                        }
                                        size="sm"
                                        variant="default"
                                      >
                                        <Check className="h-3.5 w-3.5" />{" "}
                                        Approve & Queue
                                      </Button>
                                    </>
                                  )}

                                  {item.status === "approved" && (
                                    <Button
                                      className="h-8 px-3 rounded-lg text-xs"
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          item.id,
                                          "pending_review"
                                        )
                                      }
                                      size="sm"
                                      variant="outline"
                                    >
                                      Move back to Review
                                    </Button>
                                  )}

                                  {item.status !== "sent" && (
                                    <Button
                                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                      onClick={() => handleDeleteItem(item.id)}
                                      size="sm"
                                      title="Delete Draft Permanent"
                                      variant="ghost"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}

                                  {item.status === "sent" && (
                                    <span className="text-xs text-green-500 font-semibold flex items-center gap-1 select-none">
                                      <CheckCircle2 className="h-4 w-4" />{" "}
                                      Executed & Dispatched
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  <motion.div
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center p-12 py-20 text-center border border-dashed rounded-2xl bg-sidebar/10 min-h-[300px]"
                    initial={{ opacity: 0 }}
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                      {activeTab === "pending_review" && (
                        <Check className="h-6 w-6 text-green-500" />
                      )}
                      {activeTab === "approved" && (
                        <Clock className="h-6 w-6 text-primary" />
                      )}
                      {activeTab === "sent" && (
                        <ArrowRight className="h-6 w-6 text-blue-500" />
                      )}
                      {activeTab === "rejected" && (
                        <X className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-none text-muted-foreground">
                      {activeTab === "pending_review" && "Review Queue Cleared"}
                      {activeTab === "approved" &&
                        "No Approved Items Scheduled"}
                      {activeTab === "sent" && "No Sent Campaigns Recorded"}
                      {activeTab === "rejected" &&
                        "No Skipped Campaign Elements"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 max-w-sm mt-2 leading-relaxed">
                      {activeTab === "pending_review" &&
                        "Awesome job! All auto-generated SDR and social campaign sequences have been reviewed and approved."}
                      {activeTab === "approved" &&
                        "Once you approve items in your Review queue, they'll appear here, waiting on their scheduled timelines to dispatch."}
                      {activeTab === "sent" &&
                        "As queued emails and social posts dispatch live, their final tracking logs and reports will register here."}
                      {activeTab === "rejected" &&
                        "Items that were skipped or rejected during manual review will accumulate here for history audits."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function getChannelConfig(channel: CampaignQueueItem["channel"]) {
  switch (channel) {
    case "email":
      return {
        icon: <Mail className="h-3.5 w-3.5" />,
        style:
          "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/10",
      };
    case "linkedin":
      return {
        icon: <Linkedin className="h-3.5 w-3.5" />,
        style:
          "bg-cyan-500/10 text-cyan-500 border-cyan-500/20 hover:bg-cyan-500/10",
      };
    case "reddit":
      return {
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        style:
          "bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/10",
      };
    default:
      return {
        icon: <Clock className="h-3.5 w-3.5" />,
        style: "bg-muted text-muted-foreground hover:bg-muted",
      };
  }
}
