"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { Bell, FolderKanban, MessageCircleMore, NotebookPen } from "lucide-react";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Suggestions, Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestedActions = [
    {
      icon: MessageCircleMore,
      text: "What have we discussed about my project so far?",
    },
    {
      icon: Bell,
      text: "Remind me in 2 hours to check my Gmail",
    },
    {
      icon: FolderKanban,
      text: "Create a new task in my Notion for the project sync",
    },
    {
      icon: NotebookPen,
      text: "Remember that I prefer using TypeScript for my projects",
    },
  ];

  return (
    <Suggestions
      className="py-1"
      data-testid="suggested-actions"
    >
      {suggestedActions.map(({ icon: Icon, text }, index) => (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          initial={{ opacity: 0, x: 20 }}
          key={text}
          transition={{ delay: 0.05 * index }}
          className="shrink-0"
        >
          <Suggestion
            className="flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-card/65 px-3 py-1.5 text-muted-foreground text-xs shadow-xs backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-card hover:text-foreground hover:shadow-xs"
            onClick={(suggestion) => {
              window.history.pushState({}, "", `/chat/${chatId}`);
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestion }],
              });
            }}
            suggestion={text}
          >
            <Icon className="size-3 text-primary shrink-0" />
            <span className="truncate max-w-[280px] sm:max-w-none">{text}</span>
          </Suggestion>
        </motion.div>
      ))}
    </Suggestions>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
