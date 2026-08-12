"use client";

import { CalendarDays, Download, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlannerArtifact({
  content,
  onDownload,
}: {
  content: string;
  onDownload?: () => void;
}) {
  let events: { date?: string; title?: string; time?: string; tag?: string }[] =
    [];
  try {
    events = JSON.parse(content).events ?? [];
  } catch {}
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
    <div className="min-h-full bg-[#ebe7dd] p-5 text-[#183231] sm:p-10">
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
        <div className="mt-8 grid gap-3">
          {events.map((event, index) => (
            <div
              className="flex items-center gap-4 rounded-2xl border border-[#c8d2ce] bg-[#f7f5ef] p-4 shadow-sm"
              key={`${event.date}-${event.title}-${index}`}
            >
              <GripVertical className="size-4 text-[#647572]" />
              <div className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-[#647572]">
                {event.date}
              </div>
              <div className="h-10 w-px bg-[#c8d2ce]" />
              <div className="flex-1">
                <div className="font-medium">{event.title}</div>
                <div className="mt-1 text-sm text-[#647572]">{event.time}</div>
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
