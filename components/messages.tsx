import type { UseChatHelpers } from "@ai-sdk/react";
import {
  ArrowDownIcon,
  Loader2,
  StopCircleIcon,
  TerminalIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useActiveAgentTasks } from "@/hooks/use-active-agent-tasks";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { Button } from "./ui/button";

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
        <div className="mx-auto flex min-w-0 max-w-4xl flex-col gap-3 px-2 py-5 md:gap-4 md:px-3 md:py-6">
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
            <section
              aria-label="Active agent work"
              aria-live="polite"
              className="flex flex-col gap-3 mt-3 mb-5 rounded-2xl border border-primary/20 bg-card/85 p-3 shadow-sm backdrop-blur transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-1.5 pb-3 select-none">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <TerminalIcon aria-hidden="true" className="size-3.5" />
                  </span>
                  <div>
                    <h2 className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">
                      Agent workspace
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Your team is working in parallel
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[10px] font-semibold text-primary">
                  {activeTasks.length} active
                </span>
              </div>

              {/* Console Rows */}
              <div className="flex flex-col divide-y divide-border/20 max-h-[220px] overflow-y-auto">
                {activeTasks.map((task) => {
                  const isStopping = !!cancellingTasks[task.id];
                  return (
                    <div
                      className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 py-2.5 px-1.5 hover:bg-muted/30 transition-colors duration-150 group"
                      key={task.id}
                    >
                      {/* Left Side: Pulse + Agent Slug */}
                      <div className="flex items-center gap-2.5 min-w-0 md:w-[170px] shrink-0">
                        <span className="relative flex size-1.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0 font-mono text-xs font-semibold">
                          <span className="text-foreground truncate uppercase tracking-wide">
                            {task.agentType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 shrink-0">
                            ({task.id.slice(0, 6)})
                          </span>
                        </div>
                      </div>

                      {/* Center Side: Interactive terminal prompt line */}
                      <div className="flex items-center gap-2 min-w-0 grow">
                        <span className="text-primary/70 font-mono text-xs shrink-0 select-none font-bold">
                          &gt;
                        </span>
                        <p
                          className="font-mono text-xs text-muted-foreground truncate leading-none md:max-w-[420px] hover:text-foreground transition-colors duration-150 select-all cursor-text"
                          title={task.task}
                        >
                          {task.task}
                        </p>
                      </div>

                      {/* Right Side: Action Trigger */}
                      <Button
                        className="h-6 px-2 rounded-md text-[10px] font-mono font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 shrink-0 gap-1 ml-auto md:ml-0 opacity-80 group-hover:opacity-100"
                        disabled={isStopping}
                        onClick={() => handleCancelTask(task.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {isStopping ? (
                          <Loader2 className="size-3 animate-spin text-destructive" />
                        ) : (
                          <StopCircleIcon className="size-3 text-destructive/75" />
                        )}
                        <span>{isStopping ? "stopping..." : "stop"}</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
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
