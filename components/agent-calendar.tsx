"use client";

import { CalendarClock, CheckCircle2, CirclePause, Clock3, MoreHorizontal, Play, RotateCcw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Schedule = { id: string; title: string; message: string; agentSlug: string; department: string | null; kind: string; status: string; cron: string | null; timezone: string; nextRunAt: string | null; lastRunAt: string | null; retryCount: number; lastError: string | null; qstashId: string | null };
const fetcher = (url: string) => fetch(url).then((response) => response.json());
const statusStyles: Record<string, string> = { active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", paused: "border-amber-500/30 bg-amber-500/10 text-amber-300", failed: "border-destructive/30 bg-destructive/10 text-destructive", cancelled: "border-muted bg-muted text-muted-foreground", completed: "border-sky-500/30 bg-sky-500/10 text-sky-300" };

export function AgentCalendar() {
  const { data, mutate, isLoading } = useSWR<{ schedules: Schedule[] }>("/api/agent/calendar", fetcher, { refreshInterval: 15000 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const schedules = useMemo(() => (data?.schedules ?? []).filter((item) => (status === "all" || item.status === status) && `${item.title} ${item.message} ${item.agentSlug}`.toLowerCase().includes(query.toLowerCase())), [data?.schedules, query, status]);

  async function act(id: string, action: string) {
    await fetch(`/api/agent/calendar/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    mutate();
  }

  return <div className="flex min-h-full w-full min-w-0 flex-col gap-5 overflow-x-hidden p-3 sm:gap-6 sm:p-4 md:p-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-primary"><CalendarClock className="size-4" /><span className="font-mono text-xs uppercase tracking-[0.2em]">Operations / Calendar</span></div><h1 className="text-3xl font-semibold tracking-tight">Agent calendar</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A durable view of reminders, recurring work, approvals, and execution history. QStash is the source of truth for delivery.</p></div>
      <Button className="w-full sm:w-auto" onClick={() => document.getElementById("new-schedule")?.scrollIntoView({ behavior: "smooth" })}><Clock3 className="mr-2 size-4" /> New schedule</Button>
    </div>
    <div className="grid gap-3 md:grid-cols-3"><Stat label="Visible schedules" value={String(schedules.length)} /><Stat label="Active" value={String((data?.schedules ?? []).filter((item) => item.status === "active").length)} tone="text-emerald-300" /><Stat label="Needs attention" value={String((data?.schedules ?? []).filter((item) => item.status === "failed").length)} tone="text-destructive" /></div>
    <Card className="border-border/70 bg-card/70"><CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:p-4 md:flex-row"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schedules, agents, or actions" className="min-w-0 md:max-w-sm" /><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full md:w-44"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{["active", "paused", "failed", "completed", "cancelled"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></CardContent></Card>
    <section className="space-y-3" aria-live="polite">{isLoading ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Loading durable schedules…</div> : schedules.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No schedules match this view.</div> : schedules.map((item) => <ScheduleRow key={item.id} item={item} onAction={act} />)}</section>
    <Card id="new-schedule" className="border-primary/20 bg-primary/5"><CardHeader><CardTitle className="text-base">Create from chat</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Ask Etles to “remind me tomorrow” or “run this every Monday at 9am.” Agent-created schedules appear here with an auditable lifecycle and stable IDs.</CardContent></Card>
  </div>;
}

function Stat({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) { return <Card className="bg-card/50"><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className={cn("mt-2 text-2xl font-semibold", tone)}>{value}</p></CardContent></Card>; }
function ScheduleRow({ item, onAction }: { item: Schedule; onAction: (id: string, action: string) => void }) { const isPaused = item.status === "paused"; return <Card className="overflow-hidden border-border/70 bg-card/60"><CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="outline" className={cn("capitalize", statusStyles[item.status])}>{item.status}</Badge><Badge variant="secondary" className="font-mono text-[10px] uppercase">{item.kind}</Badge><span className="font-mono text-[11px] text-muted-foreground">{item.agentSlug}</span></div><h2 className="truncate font-medium">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.message}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground"><span>{item.nextRunAt ? `Next ${new Date(item.nextRunAt).toLocaleString()}` : item.cron ?? "One-shot"}</span><span>{item.timezone}</span>{item.qstashId && <span>QStash {item.qstashId.slice(0, 12)}…</span>}</div>{item.lastError && <p className="mt-2 text-xs text-destructive">{item.lastError}</p>}</div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => onAction(item.id, isPaused ? "resume" : "pause")} aria-label={isPaused ? "Resume schedule" : "Pause schedule"}>{isPaused ? <Play className="size-4" /> : <CirclePause className="size-4" />}</Button>{item.status === "failed" && <Button size="sm" variant="outline" onClick={() => onAction(item.id, "retry")} aria-label="Retry failed schedule"><RotateCcw className="size-4" /></Button>}<Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onAction(item.id, "cancel")} aria-label="Cancel schedule"><XCircle className="size-4" /></Button></div></CardContent></Card>; }
