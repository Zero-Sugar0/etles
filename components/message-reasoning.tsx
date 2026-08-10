"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./ai-elements/chain-of-thought";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
  durationMs?: number;
};

export function MessageReasoning({
  isLoading,
  reasoning,
  durationMs,
}: MessageReasoningProps) {
  const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading);
  const startedAtRef = useRef<number | null>(isLoading ? Date.now() : null);
  const [elapsedMs, setElapsedMs] = useState(durationMs ?? 0);

  useEffect(() => {
    if (isLoading && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
    if (!isLoading && startedAtRef.current !== null && !durationMs) {
      setElapsedMs(Date.now() - startedAtRef.current);
    }
  }, [durationMs, isLoading]);

  useEffect(() => {
    if (!isLoading || durationMs) return;
    const interval = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [durationMs, isLoading]);

  const thoughtDuration = durationMs ?? elapsedMs;
  const durationLabel = useMemo(() => {
    if (!thoughtDuration) return "";
    return `${(thoughtDuration / 1000).toFixed(1)}s`;
  }, [thoughtDuration]);

  useEffect(() => {
    if (isLoading) {
      setHasBeenStreaming(true);
    }
  }, [isLoading]);

  return (
    <ChainOfThought
      className="w-full max-w-2xl gap-2"
      data-testid="message-reasoning"
      defaultOpen={hasBeenStreaming}
    >
      <ChainOfThoughtHeader>
        <span className="flex items-center gap-2">
          {isLoading ? "Thinking" : "Thoughts"}
          {!isLoading && durationLabel ? (
            <span className="text-muted-foreground text-xs">
              {durationLabel}
            </span>
          ) : null}
        </span>
      </ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        <ChainOfThoughtStep
          description={
            isLoading ? "Reasoning in progress" : "Completed reasoning"
          }
          label={
            <span className="whitespace-pre-wrap break-words text-muted-foreground">
              {reasoning}
            </span>
          }
          status={isLoading ? "active" : "complete"}
        />
      </ChainOfThoughtContent>
    </ChainOfThought>
  );
}
