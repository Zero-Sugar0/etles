//components/message.tsx
"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { parseSubAgentHandoffMarker } from "@/lib/agent/sub-agent-handoff-markers";
import { decodeWorkflowProgress } from "@/lib/agent/workflow-progress";
import type { ChartToolPayload } from "@/lib/ai/tools/render-chart";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, isToolCall, isToolResult } from "@/lib/utils";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "./ai-elements/confirmation";
import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "./ai-elements/plan";
import { Shimmer } from "./ai-elements/shimmer";
import { ExpandableToolPill } from "./ai-elements/tool-pill";
import { Video } from "./ai-elements/video";
import { useDataStream } from "./data-stream-provider";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import {
  AgentActionCard,
  type AgentActionData,
  isResult,
  parseAgentMessage,
} from "./elements/agent-action";
import { ChartDisplay } from "./elements/chart-display";
import { EventCard, parseEventMessage } from "./elements/event";
import { ExpandableContent } from "./elements/expandable-content";
import { MermaidDisplay } from "./elements/mermaid-display";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { WorkflowProgressCard } from "./elements/workflow-step";
import { ImageEditor } from "./image-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { GeneratedImageCarousel } from "./generated-image-carousel";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { Weather } from "./weather";
import { YahooFinanceDisplay } from "./elements/yahoo-finance-display";

const PurePreviewMessage = ({
  addToolApprovalResponse,
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
}: {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const role = message.role as string;
  const isAssistant = role === "assistant";
  const isTool = role === "tool";
  const hasVisibleContent = message.parts.some((part: any) => {
    const type = part.type;
    if (type === "text" && part.text?.trim()) {
      return true;
    }
    if (type === "reasoning" && part.text?.trim()) {
      return true;
    }
    if (
      [
        "file",
        "image",
        "imageDelta",
        "sheetDelta",
        "codeDelta",
        "suggestion",
      ].includes(type)
    ) {
      return true;
    }
    if (
      typeof type === "string" &&
      type.startsWith("tool-") &&
      type !== "tool-call" &&
      type !== "tool-result" &&
      !type.includes("invocation")
    ) {
      return true;
    }

    // Everything else (tool-call, tool-result, etc.) is considered non-visible for the main bubble
    return false;
  });

  if ((isAssistant || isTool) && !hasVisibleContent && !isLoading) {
    return null;
  }

  const hasAgentResult = message.parts.some((part: any) => {
    if (part.type === "text" && part.text) {
      const parsed = parseAgentMessage(part.text);
      return parsed && isResult(parsed) && !parsed.error;
    }
    return false;
  });

  return (
    <div
      className="group/message fade-in w-full animate-in duration-150"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-1.5 md:gap-2", {
          "justify-end": role === "user" && mode !== "edit",
          "justify-start": role === "assistant" || role === "tool",
        })}
      >
        {/* {message.role === "assistant" && !hasAgentResult && (
          <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <SparklesIcon size={14} />
          </div>
        )} */}

        <div
          className={cn("flex flex-col", {
            "ml-11": message.role === "assistant" && hasAgentResult,
            "gap-1.5 md:gap-3": message.parts?.some(
              (p) =>
                p.type === "text" &&
                p.text?.trim() &&
                !parseSubAgentHandoffMarker(p.text)
            ),
            "w-full":
              (message.role === "assistant" &&
                (message.parts?.some(
                  (p) =>
                    p.type === "text" &&
                    p.text?.trim() &&
                    !parseSubAgentHandoffMarker(p.text)
                ) ||
                  message.parts?.some((p) => p.type.startsWith("tool-")))) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[80%]":
              message.role === "user" && mode !== "edit",
            "items-end": message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            if (!part || typeof part !== "object") {
              return null;
            }
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            const isConsecutiveTool =
              index > 0 &&
              (isToolCall(message.parts[index - 1]) ||
                isToolResult(message.parts[index - 1])) &&
              (isToolCall(part) || isToolResult(part));

            if (type === "reasoning") {
              const hasContent = part.text?.trim().length > 0;
              if (hasContent) {
                const isStreaming =
                  "state" in part && part.state === "streaming";
                return (
                  <MessageReasoning
                    isLoading={isLoading || isStreaming}
                    key={key}
                    durationMs={
                      typeof (part as any).durationMs === "number"
                        ? (part as any).durationMs
                        : typeof (part as any).metadata?.durationMs === "number"
                          ? (part as any).metadata.durationMs
                          : undefined
                    }
                    reasoning={part.text}
                  />
                );
              }
            }

            if (type === "text") {
              const rawText = part.text ?? "";
              if (parseSubAgentHandoffMarker(rawText)) {
                return null;
              }

              // ---------- WORKFLOW_PROGRESS card (must come before the other prefixes) -----
              const workflowProgress = decodeWorkflowProgress(rawText);
              if (workflowProgress) {
                return (
                  <WorkflowProgressCard key={key} progress={workflowProgress} />
                );
              }
              // ---------- end WORKFLOW_PROGRESS block --------------------------------------

              let conversationalText = rawText;
              let partAgent: AgentActionData | null = null;
              let partEvent: any = null;

              if (rawText.includes("###AGENT_DELEGATED###")) {
                const [prefix, ...rest] = rawText.split(
                  "###AGENT_DELEGATED###"
                );
                conversationalText = prefix;
                try {
                  partAgent = JSON.parse(rest.join("###AGENT_DELEGATED###"));
                } catch {}
              } else if (rawText.includes("###AGENT_RESULT###")) {
                const [prefix, ...rest] = rawText.split("###AGENT_RESULT###");
                conversationalText = prefix;
                try {
                  partAgent = JSON.parse(rest.join("###AGENT_RESULT###"));
                } catch {}
              } else if (rawText.includes("###EVENT###")) {
                const [prefix, ...rest] = rawText.split("###EVENT###");
                conversationalText = prefix;
                try {
                  partEvent = JSON.parse(rest.join("###EVENT###"));
                } catch {}
              } else {
                partAgent = parseAgentMessage(rawText);
                if (!partAgent) {
                  partEvent = parseEventMessage(rawText);
                }
                if (partAgent || partEvent) {
                  conversationalText = "";
                }
              }

              return (
                <div className="flex flex-col gap-3 w-full" key={key}>
                  {conversationalText.trim() && (
                    <MessageContent
                      className={cn({
                        "ml-auto w-fit min-w-[32px] max-w-full break-words rounded-2xl rounded-br-md border border-primary/15 bg-foreground px-3.5 py-2.5 text-left text-[13px] text-background leading-relaxed shadow-sm":
                          message.role === "user",
                        "w-full bg-transparent px-0 py-0 text-left text-[13px] leading-relaxed":
                          message.role === "assistant",
                      })}
                      data-testid="message-content"
                    >
                      {message.role === "user" ? (
                        <ExpandableContent>
                          <div className="whitespace-pre-wrap">
                            {conversationalText}
                          </div>
                        </ExpandableContent>
                      ) : (
                        <Response>{conversationalText}</Response>
                      )}
                    </MessageContent>
                  )}

                  {(partEvent || partAgent) && (
                    <MessageContent
                      className="bg-transparent px-0 py-0 text-left w-full text-[13px]"
                      data-testid="message-content-cards"
                    >
                      {partEvent ? (
                        <EventCard event={partEvent} />
                      ) : partAgent && !isResult(partAgent) ? (
                        <AgentActionCard agent={partAgent} />
                      ) : null}
                    </MessageContent>
                  )}
                </div>
              );
            }

            if (mode === "edit") {
              return (
                <div
                  className="flex w-full min-w-0 flex-row items-start justify-end gap-2 sm:gap-3"
                  key={key}
                >
                  <div className="min-w-0 flex-1 md:max-w-[80%]">
                    <MessageEditor
                      key={message.id}
                      message={message}
                      regenerate={regenerate}
                      setMessages={setMessages}
                      setMode={setMode}
                    />
                  </div>
                </div>
              );
            }

            if (type === "tool-getWeather") {
              const { toolCallId, state } = part;
              const approvalId = (part as { approval?: { id: string } })
                .approval?.id;
              const isDenied =
                state === "output-denied" ||
                (state === "approval-responded" &&
                  (part as { approval?: { approved?: boolean } }).approval
                    ?.approved === false);
              const widthClass = "w-[min(100%,450px)]";

              if (state === "output-available") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Weather weatherAtLocation={part.output} />
                  </div>
                );
              }

              if (isDenied) {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader
                        state="output-denied"
                        type="tool-getWeather"
                      />
                      <ToolContent>
                        <div className="px-4 py-3 text-muted-foreground text-sm">
                          Weather lookup was denied.
                        </div>
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              if (state === "approval-responded") {
                return (
                  <div className={widthClass} key={toolCallId}>
                    <Tool className="w-full" defaultOpen={true}>
                      <ToolHeader state={state} type="tool-getWeather" />
                      <ToolContent>
                        <ToolInput input={part.input} />
                      </ToolContent>
                    </Tool>
                  </div>
                );
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool className="w-full" defaultOpen={true}>
                    <ToolHeader state={state} type="tool-getWeather" />
                    <ToolContent>
                      {(state === "input-available" ||
                        state === "approval-requested") && (
                        <ToolInput input={part.input} />
                      )}

                      <Confirmation
                        approval={{ id: approvalId! }}
                        className="mx-4 mb-4"
                        state={state}
                      >
                        <ConfirmationRequest>
                          <ConfirmationTitle>
                            Approve checking the weather for{" "}
                            {part.input?.city ||
                              `${part.input?.latitude}, ${part.input?.longitude}`}
                            ?
                          </ConfirmationTitle>
                          <ConfirmationActions>
                            <ConfirmationAction
                              onClick={() => {
                                addToolApprovalResponse({
                                  id: approvalId!,
                                  approved: false,
                                  reason: "User denied weather lookup",
                                });
                              }}
                              variant="outline"
                            >
                              Deny
                            </ConfirmationAction>
                            <ConfirmationAction
                              onClick={() => {
                                addToolApprovalResponse({
                                  id: approvalId!,
                                  approved: true,
                                });
                              }}
                            >
                              Allow
                            </ConfirmationAction>
                          </ConfirmationActions>
                        </ConfirmationRequest>

                        <ConfirmationAccepted>
                          <div className="flex items-center gap-2 text-emerald-500">
                            <CheckCircle2 className="size-4" />
                            <span className="text-sm font-medium">
                              Weather lookup approved.
                            </span>
                          </div>
                        </ConfirmationAccepted>

                        <ConfirmationRejected>
                          <div className="flex items-center gap-2 text-destructive">
                            <XCircle className="size-4" />
                            <span className="text-sm font-medium">
                              Weather lookup denied.
                            </span>
                          </div>
                        </ConfirmationRejected>
                      </Confirmation>
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if ((type as string) === "tool-getYahooFinance") {
              const financePart = part as any;
              const { toolCallId, state } = financePart;
              const output = financePart.output as any;
              if (
                state === "output-available" &&
                output &&
                !output.error &&
                output.type === "yahoo-finance"
              ) {
                return <YahooFinanceDisplay data={output} key={toolCallId} />;
              }
              return (
                <Tool
                  className="w-full max-w-2xl"
                  defaultOpen={state !== "input-streaming"}
                  key={toolCallId}
                >
                  <ToolHeader state={state} type={type} />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={financePart.input} />
                    )}
                    {state === "output-error" && (
                      <ToolOutput output="Could not load market data." />
                    )}
                    {state === "output-available" && output?.error && (
                      <ToolOutput output={output.error} />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (type === "tool-renderChart") {
              const { toolCallId, state } = part;
              const widthClass =
                "w-full max-w-full min-w-0 sm:max-w-[min(100%,720px)]";

              if (state === "output-available") {
                const out = part.output ?? (part as any).result;
                if (
                  out &&
                  typeof out === "object" &&
                  "error" in out &&
                  out.error != null
                ) {
                  return (
                    <div
                      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm dark:bg-red-950/40 dark:text-red-400"
                      key={toolCallId}
                    >
                      {String((out as { error: unknown }).error)}
                    </div>
                  );
                }
                if (
                  out &&
                  typeof out === "object" &&
                  "chartType" in out &&
                  "labels" in out &&
                  "series" in out
                ) {
                  return (
                    <div className={widthClass} key={toolCallId}>
                      <ChartDisplay spec={out as ChartToolPayload} />
                    </div>
                  );
                }
                return (
                  <div className={widthClass} key={toolCallId}>
                    <p className="text-muted-foreground text-sm">
                      Chart data was invalid or incomplete.
                    </p>
                  </div>
                );
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool
                    className="w-full"
                    defaultOpen={state !== "input-streaming"}
                  >
                    <ToolHeader state={state} type={type} />
                    <ToolContent>
                      {state === "input-available" && (
                        <ToolInput input={part.input} />
                      )}
                      {state === "output-error" && (
                        <div className="px-4 py-3 text-destructive text-sm">
                          Could not render the chart.
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if (
              type === "tool-renderMermaid" ||
              type === "tool-renderFlowchart"
            ) {
              const { toolCallId, state } = part;
              const widthClass =
                "w-full max-w-full min-w-0 sm:max-w-[min(100%,720px)]";

              if (state === "output-available") {
                const out = part.output ?? (part as any).result;
                if (
                  out &&
                  typeof out === "object" &&
                  "error" in out &&
                  out.error != null
                ) {
                  return (
                    <div
                      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm dark:bg-red-950/40 dark:text-red-400"
                      key={toolCallId}
                    >
                      {String((out as { error: unknown }).error)}
                    </div>
                  );
                }
                if (
                  out &&
                  typeof out === "object" &&
                  "chart" in out &&
                  typeof out.chart === "string"
                ) {
                  return (
                    <div className={widthClass} key={toolCallId}>
                      <MermaidDisplay
                        chart={(out as { chart: string }).chart}
                        description={
                          (out as { description?: string }).description ??
                          undefined
                        }
                        title={(out as { title?: string }).title ?? undefined}
                      />
                    </div>
                  );
                }
                return (
                  <div className={widthClass} key={toolCallId}>
                    <p className="text-muted-foreground text-sm">
                      Diagram data was invalid or incomplete.
                    </p>
                  </div>
                );
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool
                    className="w-full"
                    defaultOpen={state !== "input-streaming"}
                  >
                    <ToolHeader state={state} type={type} />
                    <ToolContent>
                      {state === "input-available" && (
                        <ToolInput input={part.input} />
                      )}
                      {state === "output-error" && (
                        <div className="px-4 py-3 text-destructive text-sm">
                          Could not render the diagram.
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if ((type as string) === "tool-generateImage") {
              const partAny = part as any;
              const { toolCallId, state } = partAny;
              const widthClass =
                "w-full max-w-full min-w-0 sm:max-w-[min(100%,720px)]";

              if (state === "output-available") {
                const out = partAny.output;
                const imageOutputs = Array.isArray(out?.images)
                  ? out.images.filter(
                      (image: any) => typeof image?.url === "string"
                    )
                  : out?.url
                    ? [out]
                    : [];
                if (
                  out &&
                  typeof out === "object" &&
                  "error" in out &&
                  out.error != null
                ) {
                  return (
                    <div
                      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm dark:bg-red-950/40 dark:text-red-400"
                      key={toolCallId}
                    >
                      {String((out as { error: unknown }).error)}
                    </div>
                  );
                }

                if (imageOutputs.length > 0) {
                  return (
                    <div className={widthClass} key={toolCallId}>
                      <GeneratedImageCarousel
                        images={imageOutputs.map((image: any) => ({
                          url: image.url,
                          alt: image.originalPrompt || "Generated image",
                        }))}
                      />
                    </div>
                  );
                }

                // If no URL but no error, either it's incomplete or failing silently
                return null;
              }

              const requestedCount = Number(
                partAny.input?.count ?? partAny.input?.numberOfImages ?? 1
              );
              const total =
                Number.isFinite(requestedCount) && requestedCount > 0
                  ? Math.min(requestedCount, 12)
                  : 1;
              const progress =
                state === "input-streaming"
                  ? 18
                  : state === "input-available"
                    ? 27
                    : 62;

              return (
                <div className={widthClass} key={toolCallId}>
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20 p-3 shadow-sm sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold tracking-tight text-foreground">
                          Image results ({total})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Creating your variations
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Loading… {progress}%
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Array.from({ length: total }, (_, index) => (
                        <Skeleton
                          className="aspect-[4/5] w-full rounded-2xl"
                          key={`${toolCallId}-${index}`}
                        />
                      ))}
                    </div>
                  </div>
                  <Tool className="mt-2 w-full" defaultOpen={false}>
                    <ToolHeader state={state} type={type} />
                    <ToolContent>
                      {state === "input-available" && (
                        <ToolInput input={partAny.input} />
                      )}
                      {state === "output-error" && (
                        <div className="px-4 py-3 text-destructive text-sm">
                          Could not generate the image.
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if ((type as string) === "tool-generateVideo") {
              const partAny = part as any;
              const { toolCallId, state } = partAny;
              const widthClass =
                "w-full max-w-full min-w-0 sm:max-w-[min(100%,720px)]";

              if (state === "output-available") {
                const out = partAny.output;
                if (
                  out &&
                  typeof out === "object" &&
                  "error" in out &&
                  out.error != null
                ) {
                  return (
                    <div
                      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600 text-sm dark:bg-red-950/40 dark:text-red-400"
                      key={toolCallId}
                    >
                      {String((out as { error: unknown }).error)}
                    </div>
                  );
                }

                if (
                  out &&
                  typeof out === "object" &&
                  "url" in out &&
                  typeof out.url === "string"
                ) {
                  return (
                    <div className={widthClass} key={toolCallId}>
                      <Video
                        aspectRatio={
                          out.aspectRatio === "9:16" ? "portrait" : "video"
                        }
                        url={out.url}
                      />
                    </div>
                  );
                }

                return null;
              }

              return (
                <div className={widthClass} key={toolCallId}>
                  <Tool
                    className="w-full"
                    defaultOpen={state !== "input-streaming"}
                  >
                    <ToolHeader state={state} type={type} />
                    <ToolContent>
                      {state === "input-available" && (
                        <ToolInput input={partAny.input} />
                      )}
                      {state === "output-error" && (
                        <div className="px-4 py-3 text-destructive text-sm">
                          Could not generate the video.
                        </div>
                      )}
                    </ToolContent>
                  </Tool>
                </div>
              );
            }

            if (type === "tool-createDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error creating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <DocumentPreview
                  isReadonly={isReadonly}
                  key={toolCallId}
                  result={part.output}
                />
              );
            }

            if (type === "tool-updateDocument") {
              const { toolCallId } = part;

              if (part.output && "error" in part.output) {
                return (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-500 dark:bg-red-950/50"
                    key={toolCallId}
                  >
                    Error updating document: {String(part.output.error)}
                  </div>
                );
              }

              return (
                <div className="relative" key={toolCallId}>
                  <DocumentPreview
                    args={{ ...part.output, isUpdate: true }}
                    isReadonly={isReadonly}
                    result={part.output}
                  />
                </div>
              );
            }

            if (type === "tool-requestSuggestions") {
              const { toolCallId, state } = part;

              return (
                <Tool defaultOpen={true} key={toolCallId}>
                  <ToolHeader state={state} type="tool-requestSuggestions" />
                  <ToolContent>
                    {state === "input-available" && (
                      <ToolInput input={part.input} />
                    )}
                    {state === "output-available" && (
                      <ToolOutput
                        errorText={undefined}
                        output={
                          "error" in part.output ? (
                            <div className="rounded border p-2 text-red-500">
                              Error: {String(part.output.error)}
                            </div>
                          ) : (
                            <DocumentToolResult
                              isReadonly={isReadonly}
                              result={part.output}
                              type="request-suggestions"
                            />
                          )
                        }
                      />
                    )}
                  </ToolContent>
                </Tool>
              );
            }

            if (
              [
                "tool-createPlan",
                "tool-updatePlanTask",
                "tool-addPlanTask",
                "tool-cancelPlan",
              ].includes(type as string)
            ) {
              const planOutput =
                (part as any).output?.plan ??
                (part as any).result?.plan ??
                (part as any).input;
              const planId = planOutput?.id ?? planOutput?.planId;
              const latestPlanIndex = planId
                ? message.parts.reduce((latest, candidate, candidateIndex) => {
                    if (!candidate || typeof candidate !== "object") return latest;
                    const candidateType = (candidate as any).type as string;
                    if (!candidateType?.startsWith("tool-")) return latest;
                    const candidatePlan = (candidate as any).output?.plan ?? (candidate as any).result?.plan ?? (candidate as any).input;
                    return candidatePlan?.id === planId || candidatePlan?.planId === planId ? candidateIndex : latest;
                  }, -1)
                : index;
              if (latestPlanIndex !== index) return null;
              const planTasks = Array.isArray(planOutput?.tasks)
                ? planOutput.tasks
                : [];
              const planStatus = planOutput?.status ?? "active";
              const completedCount = planTasks.filter(
                (task: any) => task.status === "completed"
              ).length;
              if (!planOutput?.title) {
                return null;
              }
              return (
                <Plan className="w-full max-w-2xl" defaultOpen key={planId ? `plan-${planId}` : key}>
                  <PlanHeader>
                    <div className="min-w-0">
                      <PlanTitle>{String(planOutput.title)}</PlanTitle>
                      {planOutput.description && (
                        <PlanDescription>
                          {String(planOutput.description)}
                        </PlanDescription>
                      )}
                    </div>
                    <PlanTrigger />
                  </PlanHeader>
                  <PlanContent>
                    <div className="flex flex-col gap-2">
                      {planTasks.map((task: any, taskIndex: number) => (
                        <div
                          className="flex items-start gap-2 text-sm"
                          key={task.id ?? `${planOutput.title}-${taskIndex}`}
                        >
                          <span className="mt-0.5 text-muted-foreground">
                            {task.status === "completed" ? "✓" : task.status === "cancelled" ? "×" : "○"}
                          </span>
                          <span
                            className={cn(
                              (task.status === "completed" || task.status === "cancelled") &&
                                "text-muted-foreground line-through"
                            )}
                          >
                            {String(task.text ?? task)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </PlanContent>
                  <PlanFooter>
                    <span className="text-muted-foreground text-xs">
                      {planStatus === "cancelled" ? "Cancelled · " : ""}
                      {completedCount}/{planTasks.length} tasks complete
                    </span>
                  </PlanFooter>
                </Plan>
              );
            }

            if (
              type.startsWith("tool-") &&
              "toolCallId" in part &&
              "state" in part
            ) {
              const { toolCallId, state } = part;

              // Only show error if output.error is a real non-null string
              const rawError =
                "output" in part &&
                part.output &&
                typeof part.output === "object" &&
                "error" in part.output &&
                (part.output as any).error != null
                  ? String((part.output as any).error)
                  : undefined;

              // If the tool has a redirect URL (like OAuth), surface it prominently
              const redirectUrl =
                "output" in part &&
                part.output &&
                typeof part.output === "object"
                  ? (part.output as any).url || (part.output as any).redirectUrl
                  : undefined;

              const fallbackToolCallId =
                "toolCallId" in part ? (part.toolCallId as string) : "";
              const fallbackState =
                "state" in part ? (part.state as string) : "output-available";
              const actualToolCallId = toolCallId || fallbackToolCallId;
              const actualState = state || fallbackState;
              const approvalId = (part as any).approval?.id;

              return (
                <ExpandableToolPill
                  actualToolCallId={actualToolCallId}
                  addToolApprovalResponse={addToolApprovalResponse}
                  approvalId={approvalId}
                  isConsecutiveTool={isConsecutiveTool}
                  key={actualToolCallId}
                  part={part}
                  rawError={rawError}
                  redirectUrl={redirectUrl}
                  state={actualState}
                  type={type}
                />
              );
            }

            return null;
          })}

          {!isReadonly && (
            <div className="mt-1 opacity-100 transition-opacity duration-150 group-focus-within/message:opacity-100 md:mt-1.5 md:opacity-0 md:group-hover/message:opacity-100">
              <MessageActions
                chatId={chatId}
                isLoading={isLoading}
                key={`action-${message.id}`}
                message={message}
                setMode={setMode}
                vote={vote}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div
      className="group/message fade-in w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex items-start justify-start gap-3">
        {/* <div className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
          <div className="animate-pulse">
            <SparklesIcon size={14} />
          </div>
        </div> */}

        <div className="flex w-full flex-col gap-2 md:gap-4">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card/70 px-3 py-1.5 text-muted-foreground text-sm shadow-xs backdrop-blur">
            <Shimmer duration={1.5}>Thinking</Shimmer>
            <span className="inline-flex opacity-80">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
