"use client";

import { useEffect, useState } from "react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./ai-elements/chain-of-thought";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
};

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading);

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
        {isLoading ? "Thinking" : "Chain of Thought"}
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
