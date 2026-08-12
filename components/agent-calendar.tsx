"use client";

import {
  CalendarClock,
  CalendarDays,
  CirclePause,
  Clock3,
  List,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Schedule = {
  id: string;
  title: string;
  message: string;
  agentSlug: string;
  department: string | null;
  kind: string;
  status: string;
  cron: string | null;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  retryCount: number;
  lastError: string | null;
};
const fetcher = (url: string) => fetch(url).then((response) => response.json());
const statusStyles: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  paused: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
  cancelled: "border-muted bg-muted text-muted-foreground",
  completed: "border-sky-500/30 bg-sky-500/10 text-sky-300",
};
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AgentCalendar() {
  const { data, mutate, isLoading } = useSWR<{ schedules: Schedule[] }>(
    "/api/agent/calendar",
    fetcher,
    { refreshInterval: 15_000 }
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState(() => new Date());
  const schedules = useMemo(
    () =>
      (data?.schedules ?? []).filter(
        (item) =>
          (status === "all" || item.status === status) &&
          `${item.title} ${item.message} ${item.agentSlug}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [data?.schedules, query, status]
  );
  async function act(id: string, action: string) {
    await fetch(`/api/agent/calendar/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    mutate();
  }
  const scheduledDays = useMemo(
    () =>
      new Set(
        schedules
          .filter((item) => item.nextRunAt)
          .map((item) => new Date(item.nextRunAt as string).toDateString())
      ),
    [schedules]
  );

  return (
    <div className="flex min-h-full w-full min-w-0 flex-col gap-5 overflow-x-hidden p-3 sm:gap-6 sm:p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <CalendarClock className="size-4" />
            <span className="font-mono text-xs uppercase tracking-[0.2em]">
              Operations / Calendar
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Agent calendar
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            See what Etles is scheduled to do, when it will happen, and what
            needs your attention.
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() =>
            document
              .getElementById("new-schedule")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <Clock3 className="mr-2 size-4" /> New schedule
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Visible schedules" value={String(schedules.length)} />
        <Stat
          label="Active"
          tone="text-emerald-300"
          value={String(
            (data?.schedules ?? []).filter((item) => item.status === "active")
              .length
          )}
        />
        <Stat
          label="Needs attention"
          tone="text-destructive"
          value={String(
            (data?.schedules ?? []).filter((item) => item.status === "failed")
              .length
          )}
        />
      </div>
      <Card className="border-border/70 bg-card/70">
        <CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:p-4 md:flex-row">
          <Input
            className="min-w-0 md:max-w-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search schedules, agents, or actions"
            value={query}
          />
          <Select onValueChange={setStatus} value={status}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["active", "paused", "failed", "completed", "cancelled"].map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Tabs className="min-w-0" defaultValue="list">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="list">
            <List className="mr-2 size-4" />
            List
          </TabsTrigger>
          <TabsTrigger value="month">
            <CalendarDays className="mr-2 size-4" />
            Month
          </TabsTrigger>
          <TabsTrigger value="agenda">
            <Clock3 className="mr-2 size-4" />
            Agenda
          </TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="list">
          <ScheduleList
            isLoading={isLoading}
            onAction={act}
            schedules={schedules}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="month">
          <MonthView
            month={month}
            scheduledDays={scheduledDays}
            schedules={schedules}
            setMonth={setMonth}
          />
        </TabsContent>
        <TabsContent className="mt-4" value="agenda">
          <AgendaView onAction={act} schedules={schedules} />
        </TabsContent>
      </Tabs>
      <Card className="border-primary/20 bg-primary/5" id="new-schedule">
        <CardContent className="p-4 text-sm leading-6 text-muted-foreground sm:p-5">
          <span className="font-medium text-foreground">Create from chat.</span>{" "}
          Ask Etles to “remind me tomorrow” or “run this every Monday at 9am.”
          Agent-created schedules appear here with an auditable lifecycle and
          stable IDs.
        </CardContent>
      </Card>
    </div>
  );
}
function Stat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-2 text-2xl font-semibold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}
function ScheduleList({
  schedules,
  isLoading,
  onAction,
}: {
  schedules: Schedule[];
  isLoading: boolean;
  onAction: (id: string, action: string) => void;
}) {
  return (
    <section aria-live="polite" className="space-y-3">
      {isLoading ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Loading durable schedules…
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No schedules match this view.
        </div>
      ) : (
        schedules.map((item) => (
          <ScheduleRow item={item} key={item.id} onAction={onAction} />
        ))
      )}
    </section>
  );
}
function ScheduleRow({
  item,
  onAction,
}: {
  item: Schedule;
  onAction: (id: string, action: string) => void;
}) {
  const isPaused = item.status === "paused";
  return (
    <Card className="overflow-hidden border-border/70 bg-card/60">
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              className={cn("capitalize", statusStyles[item.status])}
              variant="outline"
            >
              {item.status}
            </Badge>
            <Badge
              className="font-mono text-[10px] uppercase"
              variant="secondary"
            >
              {item.kind}
            </Badge>
            <span className="font-mono text-[11px] text-muted-foreground">
              {item.agentSlug}
            </span>
          </div>
          <h2 className="truncate font-medium">{item.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {item.message}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span>
              {item.nextRunAt
                ? `Next ${new Date(item.nextRunAt).toLocaleString()}`
                : (item.cron ?? "One-shot")}
            </span>
            <span>{item.timezone}</span>
          </div>
          {item.lastError && (
            <p className="mt-2 text-xs text-destructive">{item.lastError}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            aria-label={isPaused ? "Resume schedule" : "Pause schedule"}
            onClick={() => onAction(item.id, isPaused ? "resume" : "pause")}
            size="sm"
            variant="outline"
          >
            {isPaused ? (
              <Play className="size-4" />
            ) : (
              <CirclePause className="size-4" />
            )}
          </Button>
          {item.status === "failed" && (
            <Button
              aria-label="Retry failed schedule"
              onClick={() => onAction(item.id, "retry")}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button
            aria-label="Cancel schedule"
            className="text-destructive hover:text-destructive"
            onClick={() => onAction(item.id, "cancel")}
            size="sm"
            variant="ghost"
          >
            <XCircle className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
function MonthView({
  month,
  setMonth,
  schedules,
  scheduledDays,
}: {
  month: Date;
  setMonth: (date: Date) => void;
  schedules: Schedule[];
  scheduledDays: Set<string>;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = first.getDay();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= days
        ? new Date(month.getFullYear(), month.getMonth(), day)
        : null;
    }
  );
  return (
    <Card className="border-border/70 bg-card/60">
      <CardContent className="p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <Button
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            size="icon"
            variant="outline"
          >
            ‹
          </Button>
          <h2 className="text-base font-semibold sm:text-lg">
            {monthNames[month.getMonth()]} {month.getFullYear()}
          </h2>
          <Button
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            size="icon"
            variant="outline"
          >
            ›
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day) => (
            <div
              className="p-2 text-[10px] font-medium uppercase text-muted-foreground"
              key={day}
            >
              {day}
            </div>
          ))}
          {cells.map((date, index) => (
            <div
              className="min-h-16 rounded-lg border border-border/50 p-1.5 text-left sm:min-h-24 sm:p-2"
              key={date ? date.toISOString() : `empty-${index}`}
            >
              {date && (
                <>
                  <span
                    className={cn(
                      "text-xs",
                      date.toDateString() === new Date().toDateString() &&
                        "flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {scheduledDays.has(date.toDateString()) && (
                    <span
                      className="mt-2 block size-2 rounded-full bg-primary"
                      title="Scheduled activity"
                    />
                  )}
                  {schedules
                    .filter(
                      (item) =>
                        item.nextRunAt &&
                        new Date(item.nextRunAt).toDateString() ===
                          date.toDateString()
                    )
                    .slice(0, 1)
                    .map((item) => (
                      <p
                        className="mt-1 hidden truncate text-[10px] text-muted-foreground sm:block"
                        key={item.id}
                      >
                        {item.title}
                      </p>
                    ))}
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
function AgendaView({
  schedules,
  onAction,
}: {
  schedules: Schedule[];
  onAction: (id: string, action: string) => void;
}) {
  const items = schedules
    .filter((item) => item.nextRunAt)
    .sort(
      (a, b) =>
        new Date(a.nextRunAt as string).getTime() -
        new Date(b.nextRunAt as string).getTime()
    );
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing scheduled yet.
        </div>
      ) : (
        items.map((item) => (
          <div
            className="flex gap-3 rounded-xl border border-border/70 bg-card/60 p-4"
            key={item.id}
          >
            <div className="flex w-16 shrink-0 flex-col items-center border-r border-border pr-3 text-center">
              <span className="text-xs text-muted-foreground">
                {new Date(item.nextRunAt as string).toLocaleDateString(
                  undefined,
                  { weekday: "short" }
                )}
              </span>
              <strong className="text-lg">
                {new Date(item.nextRunAt as string).getDate()}
              </strong>
              <span className="text-[10px] text-muted-foreground">
                {new Date(item.nextRunAt as string).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusStyles[item.status]} variant="outline">
                  {item.status}
                </Badge>
                <span className="font-medium">{item.title}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.message}
              </p>
              <Button
                className="mt-3"
                onClick={() =>
                  onAction(
                    item.id,
                    item.status === "paused" ? "resume" : "pause"
                  )
                }
                size="sm"
                variant="ghost"
              >
                {item.status === "paused" ? "Resume" : "Pause"}
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
