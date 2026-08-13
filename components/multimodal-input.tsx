"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  Brain,
  CheckIcon,
  Eye,
  MicIcon,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorBadge,
  ModelSelectorContent,
  ModelSelectorDescription,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemAttachment,
  QueueItemContent,
  QueueItemFile,
  QueueItemImage,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import {
  chatModels,
  DEFAULT_CHAT_MODEL,
  modelsByProvider,
} from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn, generateUUID } from "@/lib/utils";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import { ArrowUpIcon, BotIcon, PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { SuggestedActions } from "./suggested-actions";
import { Button } from "./ui/button";
import type { VisibilityType } from "./visibility-selector";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result?.toString().split(",")[1];
      if (base64data) {
        resolve(base64data);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<
    Array<{
      id: string;
      text: string;
      attachments: Attachment[];
      isAgentMode: boolean;
    }>
  >([]);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!hasAutoFocused.current && width) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const triggerAgent = useCallback(
    async (taskText: string) => {
      const trimmed = taskText.trim();
      if (!trimmed) {
        return;
      }

      const isSlashCommand = trimmed.toLowerCase().startsWith("/agent ");
      const task = isSlashCommand ? trimmed.slice(7).trim() : trimmed;
      if (!task) {
        return;
      }

      const displayMessage = isSlashCommand ? trimmed : `/agent ${trimmed}`;

      // Reset input immediately for snappy UX.
      setInput("");
      setLocalStorageInput("");
      resetHeight();
      if (width && width > 768) {
        textareaRef.current?.focus();
      }

      // Optimistically add the user message to the local UI state.
      // The server will persist it via upsertMessages; the IDs match so
      // no duplicate appears when the next poll arrives.
      const userMessageId = generateUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user" as const,
          parts: [{ type: "text" as const, text: displayMessage }],
          createdAt: new Date(),
          attachments: [],
        },
      ]);

      // Push URL so the back button works correctly.
      window.history.pushState({}, "", `/chat/${chatId}`);

      // Hit the authenticated trigger endpoint.
      try {
        const res = await fetch("/api/agent/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task,
            chatId,
            model: selectedModelId,
            userMessageId, // for idempotent server-side upsert
            visibility: selectedVisibilityType,
          }),
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          toast.error(
            `Agent run failed: ${
              (err as { error?: string }).error ?? res.statusText
            }`
          );
          // Remove the optimistic message on failure so the user can retry.
          setMessages((prev) => prev.filter((m) => m.id !== userMessageId));
        }
        // On success: the polling loop in chat.tsx (activeAgentTasks) picks up
        // the AgentTask row created by the server and starts fetching progress
        // messages every 4 seconds. No extra wiring needed here.
      } catch (err) {
        console.error("[AgentRun] Fetch failed:", err);
        toast.error(
          "Could not reach the agent service. Check your connection."
        );
        setMessages((prev) => prev.filter((m) => m.id !== userMessageId));
      }
    },
    [
      chatId,
      selectedModelId,
      selectedVisibilityType,
      setInput,
      setLocalStorageInput,
      setMessages,
      width,
      resetHeight,
    ]
  );

  const isProcessingQueueRef = useRef(false);

  useEffect(() => {
    if (
      status === "ready" &&
      queuedMessages.length > 0 &&
      !isProcessingQueueRef.current
    ) {
      isProcessingQueueRef.current = true;

      const nextMessage = queuedMessages[0];
      if (!nextMessage) {
        isProcessingQueueRef.current = false;
        return;
      }

      // Dequeue message
      setQueuedMessages((prev) => prev.slice(1));

      toast.info("Auto-dispatching queued message...");

      setTimeout(() => {
        if (nextMessage.isAgentMode) {
          triggerAgent(nextMessage.text);
        } else {
          window.history.pushState({}, "", `/chat/${chatId}`);
          sendMessage({
            role: "user",
            parts: [
              ...nextMessage.attachments.map((attachment) => ({
                type: "file" as const,
                url: attachment.url,
                name: attachment.name,
                mediaType: attachment.contentType,
              })),
              {
                type: "text" as const,
                text: nextMessage.text,
              },
            ],
          });
        }
        isProcessingQueueRef.current = false;
      }, 100);
    }
  }, [status, queuedMessages, triggerAgent, sendMessage, chatId]);

  const submitForm = useCallback(async () => {
    // ── Agent Mode Handling ──────────────────────────────────────────────────
    if (isAgentMode || input.trim().toLowerCase().startsWith("/agent ")) {
      await triggerAgent(input);
      // Keep isAgentMode sticky if it was explicitly toggled on via button
      return;
    }

    // Normal message flow (unchanged from original)
    window.history.pushState({}, "", `/chat/${chatId}`);

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text" as const,
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    setMessages,
    width,
    chatId,
    resetHeight,
    selectedModelId,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      // Prevent default paste behavior for images
      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch (error) {
        console.error("Error uploading pasted images:", error);
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  // Add paste event listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Audio Recording State and Refs
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isStoppingRef = useRef(false);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16_000,
          channelCount: 1,
        },
      });
      // Try to use a lower bitrate if supported to speed up upload
      const options = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 16_000 }
        : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      isStoppingRef.current = false;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size === 0) {
          return;
        }
        if (isStoppingRef.current) {
          return;
        }

        audioChunksRef.current.push(event.data);

        // Build a rolling blob of all chunks so far for better context
        const rollingBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        const mimeType = mediaRecorder.mimeType;

        try {
          const base64Audio = await blobToBase64(rollingBlob);
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioData: base64Audio, mimeType }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.text) {
              // Replace input with latest full transcription (rolling window covers full speech so far)
              setInput(data.text);
            }
          } else {
            console.error("Transcription failed", await response.text());
          }
        } catch (err) {
          console.error("Transcription error", err);
        }
      };

      mediaRecorder.start(1500); // fire ondataavailable every 1.5s while recording
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error", err);
      toast.error("Microphone access denied or unavailable.");
    }
  }, [setInput]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      isStoppingRef.current = true;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      audioChunksRef.current = []; // clear for next session
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className={cn("relative flex w-full flex-col gap-3", className)}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      <input
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="flex w-full min-w-0 flex-col gap-0">
        {queuedMessages.length > 0 && (
          <Queue className="w-full bg-card/95 border-border/70 shadow-none backdrop-blur-xl max-w-full animate-in fade-in slide-in-from-bottom-1 rounded-t-2xl rounded-b-none border-b-0 pb-0">
            <QueueSection defaultOpen={true}>
              <QueueSectionTrigger className="hover:bg-muted/60">
                <QueueSectionLabel
                  count={queuedMessages.length}
                  icon={
                    <span className="size-4 text-primary animate-pulse flex items-center justify-center shrink-0">
                      <BotIcon />
                    </span>
                  }
                  label={
                    queuedMessages.length === 1
                      ? "Message Queued"
                      : "Messages Queued"
                  }
                />
              </QueueSectionTrigger>
              <QueueSectionContent>
                <QueueList className="mt-1">
                  {queuedMessages.map((msg) => (
                    <QueueItem
                      className="relative flex flex-row items-start justify-between py-1.5 border-b border-border/30 last:border-0"
                      key={msg.id}
                    >
                      <div className="flex items-start gap-2.5 grow min-w-0">
                        <QueueItemIndicator
                          className="mt-1.5 shrink-0"
                          completed={false}
                        />
                        <div className="flex flex-col min-w-0 grow gap-0.5">
                          <QueueItemContent className="text-foreground/90 text-xs font-sans font-medium line-clamp-2">
                            {msg.isAgentMode ? (
                              <span className="font-semibold text-primary mr-1 select-none">
                                [Agent]
                              </span>
                            ) : null}
                            {msg.text || "(empty message)"}
                          </QueueItemContent>
                          {msg.attachments.length > 0 && (
                            <QueueItemAttachment className="mt-1 flex flex-wrap gap-1.5">
                              {msg.attachments.map((att) => (
                                <div
                                  className="flex items-center gap-1"
                                  key={att.url}
                                >
                                  {att.contentType?.startsWith("image/") ? (
                                    <QueueItemImage
                                      className="h-6 w-6 rounded object-cover border border-border/40 shadow-2xs"
                                      src={att.url}
                                    />
                                  ) : (
                                    <QueueItemFile>{att.name}</QueueItemFile>
                                  )}
                                </div>
                              ))}
                            </QueueItemAttachment>
                          )}
                        </div>
                      </div>
                      <QueueItemActions className="shrink-0 ml-2 gap-0.5">
                        <QueueItemAction
                          className="size-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                          title="Edit message"
                          onClick={() => {
                            // bring this queued message back into the input for editing
                            const found = queuedMessages.find(
                              (m) => m.id === msg.id
                            );
                            if (found) {
                              setQueuedMessages((prev) =>
                                prev.filter((m) => m.id !== msg.id)
                              );
                              setInput(found.text);
                              setIsAgentMode(found.isAgentMode);
                              setAttachments(found.attachments);
                              requestAnimationFrame(() => {
                                textareaRef.current?.focus();
                                adjustHeight();
                              });
                            }
                          }}
                        >
                          <Pencil className="size-3" />
                        </QueueItemAction>
                        <QueueItemAction
                          className="size-6 rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove from queue"
                          onClick={() => {
                            setQueuedMessages((prev) =>
                              prev.filter((m) => m.id !== msg.id)
                            );
                          }}
                        >
                          <Trash2 className="size-3" />
                        </QueueItemAction>
                      </QueueItemActions>
                    </QueueItem>
                  ))}
                </QueueList>
              </QueueSectionContent>
            </QueueSection>
          </Queue>
        )}

        <PromptInput
          className={cn(
            "panel-hairline w-full min-w-0 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-lg backdrop-blur-xl transition-all duration-200 hover:border-muted-foreground/40 focus-within:border-primary/50 focus-within:shadow-xl sm:p-2",
            queuedMessages.length > 0 && "rounded-t-none border-t-border/40"
          )}
          onSubmit={(event) => {
            event.preventDefault();
            if (!input.trim() && attachments.length === 0) {
              return;
            }
            if (status === "ready") {
              submitForm();
            } else {
              setQueuedMessages((prev) => [
                ...prev,
                {
                  id: generateUUID(),
                  text: input,
                  attachments,
                  isAgentMode:
                    isAgentMode ||
                    input.trim().toLowerCase().startsWith("/agent "),
                },
              ]);
              setInput("");
              setAttachments([]);
              resetHeight();
              toast.success("Message added to queue!");
            }
          }}
        >
          {(attachments.length > 0 || uploadQueue.length > 0) && (
            <div
              className="flex flex-row items-end gap-2 overflow-x-scroll"
              data-testid="attachments-preview"
            >
              {attachments.map((attachment) => (
                <PreviewAttachment
                  attachment={attachment}
                  key={attachment.url}
                  onRemove={() => {
                    setAttachments((currentAttachments) =>
                      currentAttachments.filter((a) => a.url !== attachment.url)
                    );
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                />
              ))}

              {uploadQueue.map((filename) => (
                <PreviewAttachment
                  attachment={{
                    url: "",
                    name: filename,
                    contentType: "",
                  }}
                  isUploading={true}
                  key={filename}
                />
              ))}
            </div>
          )}
          <div className="flex flex-row items-start gap-1 sm:gap-2">
            <PromptInputTextarea
              className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm leading-6 outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
              data-testid="multimodal-input"
              disableAutoResize={true}
              maxHeight={200}
              minHeight={40}
              onChange={handleInput}
              placeholder="Send a message..."
              ref={textareaRef}
              rows={1}
              value={input}
            />
          </div>
          <PromptInputToolbar className="border-top-0! border-t-0! px-0.5 pb-0.5 shadow-none dark:border-0 dark:border-transparent!">
            <PromptInputTools className="gap-0 sm:gap-0.5">
              <AttachmentsButton
                fileInputRef={fileInputRef}
                selectedModelId={selectedModelId}
                status={status}
              />
              <ModelSelectorCompact
                onModelChange={onModelChange}
                selectedModelId={selectedModelId}
              />
              {/* Agent mode is temporarily hidden while the workflow surface is being consolidated. */}
              {/*
              <Button
                className={cn(
                  "h-8 gap-1.5 rounded-lg px-2.5 text-xs transition-all duration-300",
                  isAgentMode && "agent-active"
                )}
                disabled={status !== "ready"}
                onClick={(event) => {
                  event.preventDefault();
                  setIsAgentMode(!isAgentMode);
                  textareaRef.current?.focus();
                }}
                variant="ghost"
              >
                <BotIcon />
                Agent
              </Button>
              */}
            </PromptInputTools>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                className={cn(
                  "aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent",
                  isRecording && "animate-pulse text-red-500 hover:text-red-600"
                )}
                data-testid="mic-button"
                disabled={status !== "ready"}
                onClick={(event) => {
                  event.preventDefault();
                  toggleRecording();
                }}
                title={isRecording ? "Stop recording" : "Start recording"}
                variant="ghost"
              >
                <MicIcon size={16} />
              </Button>

              {(status === "submitted" || status === "streaming") &&
              !input.trim() ? (
                <StopButton setMessages={setMessages} stop={stop} />
              ) : (
                <PromptInputSubmit
                  className="size-8 rounded-lg bg-primary text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  data-testid="send-button"
                  disabled={!input.trim() || uploadQueue.length > 0}
                  status={status}
                >
                  <ArrowUpIcon size={14} />
                </PromptInputSubmit>
              )}
            </div>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const selectedModel = chatModels.find((m) => m.id === selectedModelId);
  const hasVision = selectedModel
    ? selectedModel.features.vision
    : !selectedModelId.includes("reasoning") &&
      !selectedModelId.includes("think") &&
      !selectedModelId.includes("thinking");

  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || !hasVision}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedModel =
    chatModels.find((m) => m.id === selectedModelId) ??
    chatModels.find((m) => m.id === DEFAULT_CHAT_MODEL) ??
    chatModels[0];
  const [provider] = selectedModel.id.split("/");

  // Provider display names
  const providerNames: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    xai: "xAI",
    deepseek: "DeepSeek",
    minimax: "MiniMax",
    zai: "Zhipu GLM",
    inception: "Inception",
    alibaba: "Qwen",
    perplexity: "Perplexity",
    nvidia: "NVIDIA",
    moonshotai: "Moonshot AI",
    reasoning: "Reasoning",
  };

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          className="h-8 w-auto max-w-[190px] gap-1.5 rounded-lg px-2.5 text-xs"
          variant="ghost"
        >
          {provider && <ModelSelectorLogo provider={provider} />}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          {Object.entries(modelsByProvider).map(
            ([providerKey, providerModels]) => (
              <ModelSelectorGroup
                heading={providerNames[providerKey] ?? providerKey}
                key={providerKey}
              >
                {providerModels.map((model) => {
                  const logoProvider = model.id.split("/")[0];
                  return (
                    <ModelSelectorItem
                      key={model.id}
                      onSelect={() => {
                        onModelChange?.(model.id);
                        setCookie("chat-model", model.id);
                        setOpen(false);
                      }}
                      value={model.id}
                    >
                      <ModelSelectorLogo provider={logoProvider} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <ModelSelectorName>{model.name}</ModelSelectorName>
                          <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground/70">
                            {model.features.reasoning && (
                              <span title="Reasoning">
                                <Brain className="size-3.5" />
                              </span>
                            )}
                            {model.features.vision && (
                              <span title="Vision">
                                <Eye className="size-3.5" />
                              </span>
                            )}
                            {model.features.tools && (
                              <span title="Tools">
                                <Wrench className="size-3.5" />
                              </span>
                            )}
                          </span>
                          {model.reasoningEffort && (
                            <ModelSelectorBadge tone="muted">
                              {model.reasoningEffort}
                            </ModelSelectorBadge>
                          )}
                        </div>
                        {model.description && (
                          <ModelSelectorDescription>
                            {model.description}
                          </ModelSelectorDescription>
                        )}
                      </div>
                      {model.id === selectedModel.id && (
                        <CheckIcon className="ml-auto size-4 shrink-0" />
                      )}
                    </ModelSelectorItem>
                  );
                })}
              </ModelSelectorGroup>
            )
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-8 rounded-lg bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
