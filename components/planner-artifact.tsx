"use client";

import { CalendarDays, Download, GripVertical, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PlannerEvent = {
  date?: string;
  title?: string;
  time?: string;
  tag?: string;
  priority?: string;
  notes?: string;
};

type PlannerContent = {
  description?: string;
  events?: PlannerEvent[];
};

export function PlannerArtifact({
  content,
  onDownload,
  onSaveContent,
}: {
  content: string;
  onDownload?: () => void;
  onSaveContent?: (content: string, debounce: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  let planner: PlannerContent = {};

  try {
    planner = JSON.parse(content) as PlannerContent;
  } catch {
    // Keep the editor useful while streamed JSON is incomplete.
  }

  const events = planner.events?.length
    ? planner.events
    : [{ date: "", title: "", time: "", tag: "Task", notes: "" }];

  const saveEvents = (nextEvents: PlannerEvent[]) => {
    onSaveContent?.(
      JSON.stringify({ ...planner, events: nextEvents }, null, 2),
      false
    );
  };

  const updateEvent = (index: number, patch: Partial<PlannerEvent>) => {
    saveEvents(
      events.map((event, eventIndex) =>
        eventIndex === index ? { ...event, ...patch } : event
      )
    );
  };

  const addEvent = () => {
    saveEvents([
      ...events,
      { date: "New date", title: "New task", time: "09:00", tag: "Task" },
    ]);
  };

  return (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent}>
      <div className="min-h-full bg-background p-4 text-foreground sm:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <CalendarDays className="size-3.5" /> Planner
              </p>
              <h1 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">
                {planner.description ? "Operating plan" : "A week with room to think"}
              </h1>
            </div>
            <div className="flex gap-2">
              {onSaveContent ? (
                <Button
                  className="gap-1.5"
                  onClick={() => setIsEditing((value) => !value)}
                  size="sm"
                  variant="outline"
                >
                  <Pencil className="size-3.5" /> {isEditing ? "Done" : "Edit"}
                </Button>
              ) : null}
              <Button className="gap-1.5" onClick={onDownload} size="sm">
                <Download className="size-3.5" /> Download
              </Button>
            </div>
          </div>

          {planner.description ? (
            <RichArtifactMarkdown className="mt-5 max-w-2xl text-sm prose-p:text-muted-foreground prose-strong:text-foreground">
              {planner.description}
            </RichArtifactMarkdown>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Schedule</h2>
            {isEditing ? (
              <Button className="gap-1.5" onClick={addEvent} size="sm" variant="ghost">
                <Plus className="size-3.5" /> Add task
              </Button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-2">
            {events.map((event, index) => (
              <div
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:gap-4"
                key={`${event.date}-${event.title}-${index}`}
              >
                <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    className="h-8 w-full text-xs sm:w-24"
                    onChange={(e) => updateEvent(index, { date: e.target.value })}
                    value={event.date ?? ""}
                  />
                ) : (
                  <div className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {event.date}
                  </div>
                )}
                <div className="hidden h-10 w-px bg-border sm:block" />
                <div className="flex-1">
                  {isEditing ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        className="h-8 text-sm"
                        onChange={(e) => updateEvent(index, { title: e.target.value })}
                        value={event.title ?? ""}
                      />
                      <Input
                        className="h-8 text-sm"
                        onChange={(e) => updateEvent(index, { time: e.target.value })}
                        value={event.time ?? ""}
                      />
                      <Input
                        className="h-8 text-xs sm:col-span-2"
                        onChange={(e) => updateEvent(index, { notes: e.target.value })}
                        placeholder="Markdown notes"
                        value={event.notes ?? ""}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="font-medium">{event.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {event.time}
                        {event.priority ? ` · ${event.priority} priority` : ""}
                      </div>
                      {event.notes ? (
                        <RichArtifactMarkdown className="mt-2 text-xs text-muted-foreground">
                          {event.notes}
                        </RichArtifactMarkdown>
                      ) : null}
                    </>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    className="h-8 w-full text-xs sm:w-24"
                    onChange={(e) => updateEvent(index, { tag: e.target.value })}
                    value={event.tag ?? "Task"}
                  />
                ) : (
                  <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {event.tag || "Task"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ArtifactSourceEditor>
  );
}
