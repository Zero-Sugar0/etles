"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ArtifactSourceEditor({
  content,
  onSaveContent,
  children,
}: {
  content: string;
  onSaveContent?: (content: string, debounce: boolean) => void;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  if (!onSaveContent) return <>{children}</>;

  return (
    <div className="relative min-h-full">
      <div className="sticky top-0 z-20 flex justify-end border-b border-border/60 bg-background/95 p-2 backdrop-blur">
        {editing ? (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setDraft(content);
                setEditing(false);
              }}
              size="sm"
              variant="ghost"
            >
              <X /> Cancel
            </Button>
            <Button
              onClick={() => {
                onSaveContent(draft, false);
                setEditing(false);
              }}
              size="sm"
            >
              <Check /> Save changes
            </Button>
          </div>
        ) : (
          <Button onClick={() => setEditing(true)} size="sm" variant="outline">
            <Pencil /> Edit content
          </Button>
        )}
      </div>
      {editing ? (
        <textarea
          aria-label="Edit artifact content"
          className="min-h-[calc(100dvh-120px)] w-full resize-y bg-background p-5 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          value={draft}
        />
      ) : children}
    </div>
  );
}
