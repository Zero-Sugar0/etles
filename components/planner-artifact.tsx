"use client";

import { CalendarDays, Check, Download, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ArtifactSourceEditor } from "@/components/artifact-source-editor";
import { RichArtifactMarkdown } from "@/components/rich-artifact-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Suggestion } from "@/lib/db/schema";

type PlannerEvent = { id?: string; date?: string; title?: string; time?: string; endTime?: string; tag?: string; priority?: string; status?: string; completed?: boolean; location?: string; notes?: string };
type PlannerContent = { title?: string; description?: string; period?: string; startDate?: string; goals?: string[]; events?: PlannerEvent[] };
type PlannerView = "agenda" | "week" | "month";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(date: string, time?: string) {
  const normalizedTime = (time ?? "00:00").replace(/[^0-9:]/g, "");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = normalizedTime.split(":").map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  if (time) return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}T${String(hour || 0).padStart(2, "0")}${String(minute || 0).padStart(2, "0")}00`;
  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

export function downloadPlannerCalendar(content: string, title: string) {
  const planner = parsePlanner(content);
  const events = planner.events ?? [];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const calendarEvents = events.flatMap((event, index) => {
    if (!event.date || !event.title) return [];
    const start = icsDate(event.date, event.time);
    if (!start) return [];
    const end = event.endTime ? icsDate(event.date, event.endTime) : null;
    const timed = Boolean(event.time);
    return [`BEGIN:VEVENT`, `UID:${escapeIcs(event.id || `${title}-${index}@etles`)}`, `SUMMARY:${escapeIcs(event.title)}`, timed ? `DTSTART;TZID=${timezone}:${start}` : `DTSTART;VALUE=DATE:${start}`, end ? `DTEND;TZID=${timezone}:${end}` : !timed ? `DTEND;VALUE=DATE:${start}` : `DURATION:PT1H`, event.location ? `LOCATION:${escapeIcs(event.location)}` : "", event.notes ? `DESCRIPTION:${escapeIcs(event.notes)}` : "", event.tag ? `CATEGORIES:${escapeIcs(event.tag)}` : "", `END:VEVENT`].filter(Boolean).join("\r\n");
  });
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Etles//Planner//EN", `X-WR-CALNAME:${escapeIcs(title)}`, ...calendarEvents, "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "planner"}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function displayText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.title || record.description) {
      return [displayText(record.title), displayText(record.description)].filter(Boolean).join("\n\n");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function normalizeEvent(value: unknown): PlannerEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  return {
    id: displayText(event.id),
    date: displayText(event.date),
    title: displayText(event.title),
    time: displayText(event.time),
    endTime: displayText(event.endTime),
    tag: displayText(event.tag),
    priority: displayText(event.priority),
    status: displayText(event.status),
    completed: typeof event.completed === "boolean" ? event.completed : undefined,
    location: displayText(event.location),
    notes: displayText(event.notes),
  };
}

function parsePlanner(content: string): PlannerContent {
  const cleaned = content.replace(/^```(?:json|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    let parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    if (!parsed || typeof parsed !== "object") return { description: cleaned };
    const candidate = parsed as PlannerContent & {
      planner?: PlannerContent;
      plan?: PlannerContent;
      data?: PlannerContent;
      tasks?: PlannerEvent[];
      schedule?: PlannerEvent[];
      items?: PlannerEvent[];
      summary?: string;
      overview?: string;
    };
    const source = candidate.planner ?? candidate.plan ?? candidate.data ?? candidate;
    const rawEvents = source.events ?? candidate.tasks ?? candidate.schedule ?? candidate.items;
    return {
      title: displayText(source.title ?? candidate.title),
      description: displayText(source.description ?? candidate.summary ?? candidate.overview),
      period: displayText(source.period),
      startDate: displayText(source.startDate),
      goals: Array.isArray(source.goals) ? source.goals.map(displayText).filter((goal): goal is string => Boolean(goal)) : undefined,
      events: Array.isArray(rawEvents) ? rawEvents.map(normalizeEvent).filter((event): event is PlannerEvent => Boolean(event)) : undefined,
    };
  } catch {
    const firstObject = cleaned.indexOf("{");
    const lastObject = cleaned.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      const extracted = cleaned.slice(firstObject, lastObject + 1);
      if (extracted !== cleaned) return parsePlanner(extracted);
    }
    return cleaned ? { title: "Planner", description: cleaned } : {};
  }
}

function priorityClass(priority?: string) {
  const value = priority?.toLowerCase();
  if (value === "high" || value === "urgent") return "border-l-destructive";
  if (value === "medium") return "border-l-primary";
  return "border-l-muted-foreground/40";
}

export function PlannerArtifact({ title, content, editMode = false, onDownload, onSaveContent, suggestions = [] }: { title?: string; content: string; editMode?: boolean; onDownload?: () => void; onSaveContent?: (content: string, debounce: boolean) => void; suggestions?: Suggestion[] }) {
  const planner = useMemo(() => parsePlanner(content), [content]);
  const [view, setView] = useState<PlannerView>("agenda");
  const [isEditing, setIsEditing] = useState(editMode);
  useEffect(() => {
    if (editMode) setIsEditing(true);
  }, [editMode]);
  const events = planner.events ?? [];
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, PlannerEvent[]>();
    for (const event of events) {
      const key = event.date || "Unscheduled";
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()];
  }, [events]);

  const saveEvents = (nextEvents: PlannerEvent[]) => onSaveContent?.(JSON.stringify({ ...planner, events: nextEvents }, null, 2), false);
  const updateEvent = (index: number, patch: Partial<PlannerEvent>) => saveEvents(events.map((event, eventIndex) => eventIndex === index ? { ...event, ...patch } : event));
  const addEvent = () => saveEvents([...events, { id: `event-${Date.now()}`, date: "Unscheduled", title: "New task", time: "09:00", tag: "Task", priority: "medium", status: "planned" }]);
  const removeEvent = (index: number) => saveEvents(events.filter((_, eventIndex) => eventIndex !== index));

  return (
    <ArtifactSourceEditor content={content} onSaveContent={onSaveContent} showEditButton={false} suggestions={suggestions}>
      <div className="min-h-full bg-background p-4 text-foreground sm:p-7">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"><CalendarDays className="size-3.5" /> Planner</p><h1 className="mt-1 truncate font-serif text-2xl font-semibold sm:text-3xl">{planner.title || title || "Planner"}</h1>{planner.description ? <RichArtifactMarkdown className="mt-2 max-w-3xl text-sm text-foreground prose-p:text-foreground">{planner.description}</RichArtifactMarkdown> : null}</div>
            <div className="flex shrink-0 items-center gap-2">{planner.period ? <span className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{planner.period}</span> : null}{onDownload ? <Button className="gap-2" onClick={onDownload} size="sm" variant="outline"><Download className="size-4" /> Export</Button> : null}</div>
          </header>

          {planner.goals?.length ? <section className="mt-5 rounded-lg border border-border bg-card p-4"><h2 className="font-semibold">Focus</h2><ul className="mt-2 grid gap-1 text-sm text-foreground/90 sm:grid-cols-2">{planner.goals.map((goal, index) => <li className="flex gap-2" key={`${goal}-${index}`}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{goal}</li>)}</ul></section> : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-md border border-border p-1" role="tablist">{(["agenda", "week", "month"] as PlannerView[]).map((option) => <button aria-selected={view === option} className={`rounded px-3 py-1.5 text-sm capitalize ${view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} key={option} onClick={() => setView(option)} role="tab" type="button">{option}</button>)}</div>{isEditing ? <Button className="gap-2" onClick={addEvent} size="sm"><Plus className="size-4" /> Add event</Button> : null}</div>

          {view === "month" ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{groupedEvents.map(([date, dateEvents]) => <section className="min-h-32 rounded-lg border border-border bg-card p-3" key={date}><h2 className="text-sm font-semibold">{date}</h2><div className="mt-3 grid gap-2">{dateEvents.map((event, index) => <div className={`rounded border-l-2 bg-muted/30 px-2 py-2 text-sm ${priorityClass(event.priority)}`} key={`${event.id ?? event.title}-${index}`}><p className={event.completed ? "text-muted-foreground line-through" : "font-medium"}>{event.title || "Untitled event"}</p><p className="mt-1 text-xs text-muted-foreground">{event.time || ""}{event.tag ? ` · ${event.tag}` : ""}</p></div>)}</div></section>)}</div> : <div className="mt-4 grid gap-4">{groupedEvents.map(([date, dateEvents]) => <section key={date}><h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{date}</h2><div className="grid gap-2">{dateEvents.map((event) => { const index = events.indexOf(event); return <article className={`flex flex-col gap-3 rounded-lg border border-l-4 border-border bg-card p-4 shadow-sm sm:flex-row sm:items-start ${priorityClass(event.priority)}`} key={`${event.id ?? event.title}-${index}`}>
              <GripVertical className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" />
              {onSaveContent ? <button aria-label={event.completed ? "Mark event incomplete" : "Mark event complete"} className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${event.completed ? "border-primary bg-primary text-primary-foreground" : "border-border"}`} onClick={() => updateEvent(index, { completed: !event.completed, status: event.completed ? "planned" : "completed" })} type="button">{event.completed ? <Check className="size-3.5" /> : null}</button> : null}
              <div className="min-w-0 flex-1">{isEditing ? <div className="grid gap-2 sm:grid-cols-2"><Input aria-label="Event title" className="h-8 text-sm" onChange={(eventChange) => updateEvent(index, { title: eventChange.target.value })} value={event.title ?? ""} /><Input aria-label="Event date" className="h-8 text-sm" onChange={(eventChange) => updateEvent(index, { date: eventChange.target.value })} value={event.date ?? ""} /><Input aria-label="Event time" className="h-8 text-sm" onChange={(eventChange) => updateEvent(index, { time: eventChange.target.value })} value={event.time ?? ""} /><Input aria-label="Event priority" className="h-8 text-sm" onChange={(eventChange) => updateEvent(index, { priority: eventChange.target.value })} value={event.priority ?? ""} /><Input aria-label="Event notes" className="h-8 text-sm sm:col-span-2" onChange={(eventChange) => updateEvent(index, { notes: eventChange.target.value })} value={event.notes ?? ""} /></div> : <><div className={event.completed ? "font-medium text-muted-foreground line-through" : "font-medium"}>{event.title || "Untitled event"}</div><div className="mt-1 text-sm text-muted-foreground">{event.time || "Time not set"}{event.endTime ? `–${event.endTime}` : ""}{event.location ? ` · ${event.location}` : ""}{event.priority ? ` · ${event.priority} priority` : ""}</div>{event.notes ? <RichArtifactMarkdown className="mt-2 text-sm text-foreground/90">{event.notes}</RichArtifactMarkdown> : null}</>}</div>
              {isEditing ? <Button aria-label="Delete event" className="text-destructive" onClick={() => removeEvent(index)} size="icon" variant="ghost"><Trash2 className="size-4" /></Button> : <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{event.tag || event.status || "Task"}</span>}
            </article>; })}</div></section>)}{!events.length ? <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">This planner has no scheduled events yet.</div> : null}</div>}
        </div>
      </div>
    </ArtifactSourceEditor>
  );
}
