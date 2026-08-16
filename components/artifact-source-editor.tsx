"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Suggestion } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

export function ArtifactSourceEditor({
  content,
  onSaveContent,
  suggestions = [],
  editMode = false,
  children,
}: {
  content: string;
  onSaveContent?: (content: string, debounce: boolean) => void;
  suggestions?: Suggestion[];
  editMode?: boolean;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);

  useEffect(() => {
    if (!editing) setDraft(content);
  }, [content, editing]);

  useEffect(() => {
    if (editMode) setEditing(true);
  }, [editMode]);

  if (!onSaveContent) return <>{children}</>;

  const applySuggestion = (suggestion: Suggestion) => {
    if (!content.includes(suggestion.originalText)) return;
    onSaveContent(
      content.replace(suggestion.originalText, suggestion.suggestedText),
      false
    );
  };

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
      ) : (
        <>
          {children}
          {suggestions.length > 0 && (
            <aside className="mx-auto mb-5 w-[min(100%-2rem,56rem)] rounded-lg border border-border bg-card p-3 shadow-sm">
              <h2 className="text-sm font-semibold">Suggestions</h2>
              <div className="mt-2 grid gap-2">
                {suggestions.map((suggestion) => (
                  <div className="rounded-md border border-border/70 p-3 text-sm" key={suggestion.id}>
                    <p className="text-muted-foreground">{suggestion.description}</p>
                    <p className="mt-2 line-through text-muted-foreground">{suggestion.originalText}</p>
                    <p className="mt-1">{suggestion.suggestedText}</p>
                    <Button className="mt-2" onClick={() => applySuggestion(suggestion)} size="sm">
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </>
      )}
    </div>
  );
}
