import type { UseChatHelpers } from "@ai-sdk/react";
import {
  ArrowDownIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2,
  StopCircleIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type AgentTask,
  useActiveAgentTasks,
} from "@/hooks/use-active-agent-tasks";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { ExpandableContent } from "./elements/expandable-content";
import { Response } from "./elements/response";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { Button } from "./ui/button";

type AgentActivityGroupProps = {
  tasks: AgentTask[];
  cancellingTasks: Record<string, boolean>;
  onCancel: (taskId: string) => void;
};

function AgentActivityGroup({
  tasks,
  cancellingTasks,
  onCancel,
}: AgentActivityGroupProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState(true);
  const workingTasks = tasks.filter(
    (task) => task.status === "pending" || task.status === "running"
  );
  const completedTasks = tasks.filter(
    (task) => task.status === "completed" || task.status === "failed"
  );

  return (
    <section
      aria-label="Agent activity"
      aria-live="polite"
      className="mx-1 mt-2 mb-4 overflow-hidden rounded-xl border border-border/70 bg-card/80 shadow-xs backdrop-blur"
    >
      <button
        aria-expanded={openGroup}
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        onClick={() => setOpenGroup((value) => !value)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BotIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            {workingTasks.length > 0
              ? `${workingTasks.length} ${workingTasks.length === 1 ? "agent" : "agents"} working…`
              : `${completedTasks.length} ${completedTasks.length === 1 ? "agent" : "agents"} done`}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            openGroup && "rotate-180"
          )}
        />
      </button>

      {openGroup && (
        <div className="border-t border-border/60 px-2">
          {workingTasks.map((task) => {
            const isOpen = openId === task.id;
            const isStopping = Boolean(cancellingTasks[task.id]);
            return (
              <div
                className="border-b border-border/50 last:border-b-0"
                key={task.id}
              >
                <button
                  aria-controls={`agent-detail-${task.id}`}
                  aria-expanded={isOpen}
                  className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  onClick={() => setOpenId(isOpen ? null : task.id)}
                  type="button"
                >
                  <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                    <span
                      aria-hidden="true"
                      className="absolute size-2 animate-pulse rounded-full bg-primary"
                    />
                    <span className="sr-only">Working</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium capitalize text-foreground">
                      {task.agentType.replace(/_/g, " ")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {task.task}
                    </span>
                  </span>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <div
                    className="flex flex-col gap-3 px-11 pb-3"
                    id={`agent-detail-${task.id}`}
                  >
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {task.task}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground/70">
                        run {task.id.slice(0, 8)}
                      </span>
                      <Button
                        className="h-8 rounded-md px-2.5 text-xs text-muted-foreground hover:text-destructive"
                        disabled={isStopping}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCancel(task.id);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {isStopping ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-3.5 animate-spin"
                          />
                        ) : (
                          <StopCircleIcon
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        )}
                        {isStopping ? "Stopping" : "Stop agent"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {completedTasks.length > 0 && (
            <details
              className="border-t border-border/60"
              open={workingTasks.length === 0}
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-1 text-sm text-muted-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                <span className="flex items-center gap-2">
                  <CheckIcon
                    aria-hidden="true"
                    className="size-4 text-emerald-500"
                  />
                  {completedTasks.length}{" "}
                  {completedTasks.length === 1 ? "agent" : "agents"} done
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-4 transition-transform details-open:rotate-180"
                />
              </summary>
              <div className="pb-1">
                {completedTasks.map((task) => (
                  <div key={task.id}>
                    <div className="flex min-h-12 items-center gap-3 border-t border-border/40 px-1 py-2">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          task.status === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-emerald-500/10 text-emerald-500"
                        )}
                      >
                        <CheckIcon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium capitalize text-foreground">
                          {task.agentType.replace(/_/g, " ")}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {task.status === "failed"
                            ? "Task failed"
                            : "Completed"}
                        </span>
                      </span>
                      <button
                        aria-label={`View ${task.agentType.replace(/_/g, " ")} details`}
                        className="rounded-md p-2 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        onClick={() =>
                          setOpenId(openId === task.id ? null : task.id)
                        }
                        type="button"
                      >
                        <ChevronDownIcon
                          aria-hidden="true"
                          className={cn(
                            "size-4",
                            openId === task.id && "rotate-180"
                          )}
                        />
                      </button>
                    </div>
                    {openId === task.id && (
                      <div className="max-w-full overflow-hidden px-11 pb-4 text-xs leading-relaxed text-muted-foreground [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_p]:my-1.5 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-2 [&_ul]:my-2">
                        <ExpandableContent maxLines={6}>
                          <Response>
                            {task.result?.text ||
                              task.result?.error ||
                              task.task}
                          </Response>
                        </ExpandableContent>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
  highlightTaskId?: string | null;
  onHighlightConsumed?: () => void;
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId: _selectedModelId,
  highlightTaskId,
  onHighlightConsumed,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    status,
  });

  const { tasks: activeTasks, mutate: mutateTasks } =
    useActiveAgentTasks(chatId);
  const [cancellingTasks, setCancellingTasks] = useState<
    Record<string, boolean>
  >({});

  const handleCancelTask = async (taskId: string) => {
    setCancellingTasks((prev) => ({ ...prev, [taskId]: true }));
    try {
      const res = await fetch(`/api/agent/tasks/${taskId}/cancel`, {
        method: "POST",
      });
      if (res.ok) {
        await mutateTasks();
      }
    } catch (err) {
      console.error("Failed to cancel task", err);
    } finally {
      setCancellingTasks((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const highlightFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    if (!highlightTaskId) {
      return undefined;
    }
    highlightFailTimerRef.current = setTimeout(() => {
      onHighlightConsumed?.();
    }, 12_000);
    return () => {
      if (highlightFailTimerRef.current) {
        clearTimeout(highlightFailTimerRef.current);
        highlightFailTimerRef.current = null;
      }
    };
  }, [highlightTaskId, onHighlightConsumed]);

  useEffect(() => {
    if (!highlightTaskId || !messagesContainerRef.current) {
      return undefined;
    }

    const root = messagesContainerRef.current;
    const escaped =
      typeof CSS !== "undefined" && "escape" in CSS
        ? CSS.escape(highlightTaskId)
        : highlightTaskId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const el = root.querySelector(`[data-agent-task-id="${escaped}"]`);

    if (!(el instanceof HTMLElement)) {
      return undefined;
    }

    if (highlightFailTimerRef.current) {
      clearTimeout(highlightFailTimerRef.current);
      highlightFailTimerRef.current = null;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(
      "ring-2",
      "ring-primary",
      "ring-offset-2",
      "ring-offset-background"
    );

    const clearRing = window.setTimeout(() => {
      el.classList.remove(
        "ring-2",
        "ring-primary",
        "ring-offset-2",
        "ring-offset-background"
      );
      onHighlightConsumed?.();
    }, 3200);

    return () => {
      window.clearTimeout(clearRing);
      el.classList.remove(
        "ring-2",
        "ring-primary",
        "ring-offset-2",
        "ring-offset-background"
      );
    };
  }, [highlightTaskId, messages, onHighlightConsumed]);

  useDataStream();

  return (
    <div className="relative flex-1">
      <div
        className="absolute inset-0 touch-pan-y overflow-y-auto"
        ref={messagesContainerRef}
      >
        <div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-3 overflow-x-hidden px-2 py-5 md:gap-4 md:px-3 md:py-6">
          {messages.length === 0 && <Greeting />}

          {messages.map((message, index) => (
            <PreviewMessage
              addToolApprovalResponse={addToolApprovalResponse}
              chatId={chatId}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              isReadonly={isReadonly}
              key={message.id}
              message={message}
              regenerate={regenerate}
              requiresScrollPadding={
                hasSentMessage && index === messages.length - 1
              }
              setMessages={setMessages}
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
            />
          ))}

          {status === "submitted" &&
            !messages.some((msg) =>
              msg.parts?.some(
                (part) => "state" in part && part.state === "approval-responded"
              )
            ) && <ThinkingMessage />}

          {activeTasks && activeTasks.length > 0 && (
            <AgentActivityGroup
              cancellingTasks={cancellingTasks}
              onCancel={handleCancelTask}
              tasks={activeTasks}
            />
          )}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </div>
      </div>

      <button
        aria-label="Scroll to bottom"
        className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border/70 bg-card/90 p-2 shadow-md backdrop-blur transition-all hover:bg-card ${
          isAtBottom
            ? "pointer-events-none scale-0 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
        onClick={() => scrollToBottom("smooth")}
        type="button"
      >
        <ArrowDownIcon className="size-3.5" />
      </button>
    </div>
  );
}

export const Messages = PureMessages;
