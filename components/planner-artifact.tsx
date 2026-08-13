"use client";

import { CalendarDays, Download, GripVertical } from "lucide-react";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";

export function PlannerArtifact({
  content,
  onDownload,
}: {
  content: string;
  onDownload?: () => void;
}) {
  let events: {
    date?: string;
    title?: string;
    time?: string;
    tag?: string;
    priority?: string;
    notes?: string;
  }[] = [];
  try {
    events = JSON.parse(content).events ?? [];
  } catch {
    // Use the thoughtful default week when content is not valid JSON.
  }
  if (!events.length) {
    events = [
      { date: "Mon 14", title: "Weekly planning", time: "09:00", tag: "Focus" },
      {
        date: "Tue 15",
        title: "Product review",
        time: "11:30",
        tag: "Meeting",
      },
      {
        date: "Wed 16",
        title: "Research synthesis",
        time: "14:00",
        tag: "Deep work",
      },
    ];
  }
  return (
    <div className="min-h-full bg-[#f0ece3] p-5 text-[#19312e] sm:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#647572]">
              <CalendarDays className="size-4" /> Planner
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold">
              A week with room to think
            </h1>
          </div>
          <Button
            className="gap-2 bg-[#123b3a] text-white"
            onClick={onDownload}
          >
            <Download className="size-4" /> Download
          </Button>
        </div>
        {(() => {
          try {
            const parsed = JSON.parse(content) as { description?: string };
            return parsed.description ? (
              <RichArtifactMarkdown className="mt-6 max-w-2xl prose-p:text-[#65746f] prose-strong:text-[#173f3a]">
                {parsed.description}
              </RichArtifactMarkdown>
            ) : null;
          } catch {
            return null;
          }
        })()}
        <div className="mt-8 grid gap-3">
          {events.map((event) => (
            <div
              className="flex items-center gap-4 rounded-2xl border border-[#c8d2ce] bg-[#f7f5ef] p-4 shadow-sm"
              key={`${event.date}-${event.title}`}
            >
              <GripVertical className="size-4 text-[#647572]" />
              <div className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-[#647572]">
                {event.date}
              </div>
              <div className="h-10 w-px bg-[#c8d2ce]" />
              <div className="flex-1">
                <div className="font-medium">{event.title}</div>
                <div className="mt-1 text-sm text-[#65746f]">
                  {event.time}{" "}
                  {event.priority ? `· ${event.priority} priority` : ""}
                </div>
                {event.notes ? (
                  <p className="mt-2 text-xs text-[#65746f]">{event.notes}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-[#f2c8b7] px-3 py-1 text-xs font-medium text-[#6b3427]">
                {event.tag || "Task"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
