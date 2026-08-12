"use client";

import {
  ArrowLeft,
  Bell,
  Bot,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Hash,
  Mail,
  Shield,
  Sparkles,
  User as UserIcon,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { BotIntegrationsPanel } from "@/components/bot-integrations-panel";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { guestRegex } from "@/lib/constants";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const user = session?.user;
  const isGuest = guestRegex.test(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  async function saveName() {
    const parts = name.trim().split(/\s+/);
    if (!parts[0]) {
      return;
    }
    await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || parts[0],
      }),
    });
    await update({ name: name.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="min-h-full overflow-y-auto bg-background p-3 sm:p-5 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 sm:gap-7">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarToggle />
            <Button
              className="size-8 shrink-0"
              onClick={() => router.push("/chat")}
              size="icon"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                Control room / Identity
              </p>
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                Your agent profile
              </h1>
            </div>
          </div>
          <Badge className="hidden shrink-0 gap-1.5 sm:flex" variant="outline">
            <Bot className="size-3.5" /> Agent-ready
          </Badge>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden border-border/70 bg-card/70">
            <div className="h-2 bg-primary" />
            <CardHeader className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-3xl border border-border bg-muted shadow-sm sm:size-28">
                {user?.email && !isGuest ? (
                  <Image
                    alt="Profile avatar"
                    className="object-cover"
                    fill
                    src={`https://avatar.vercel.sh/${user.email}?size=128`}
                  />
                ) : (
                  <UserIcon className="absolute inset-0 m-auto size-12 text-muted-foreground" />
                )}
                <Button
                  className="absolute bottom-1 right-1 size-7 rounded-full"
                  size="icon"
                  variant="secondary"
                >
                  <Camera className="size-3.5" />
                </Button>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="truncate text-2xl sm:text-3xl">
                    {isGuest
                      ? "Guest User"
                      : user?.name || user?.email?.split("@")[0] || "User"}
                  </CardTitle>
                  <Badge
                    className="bg-emerald-500/10 text-emerald-400"
                    variant="secondary"
                  >
                    {isGuest ? "Temporary" : "Active"}
                  </Badge>
                </div>
                <CardDescription className="mt-2 flex items-center gap-2">
                  <Mail className="size-4" />
                  {user?.email || "No email provided"}
                </CardDescription>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Give Etles enough context to act like your operations partner,
                  not just another chat window.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-4 sm:p-5">
              <Metric icon={Zap} label="Agent tasks" value="482" />
              <Metric icon={Sparkles} label="Signals" value="1.2k" />
              <Metric icon={Clock3} label="Schedules" value="12" />
              <Metric icon={Shield} label="Reliability" value="99.4%" />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/70">
            <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-3">
              <CardTitle className="text-base">Agent preferences</CardTitle>
              <CardDescription>
                Control how Etles keeps you in the loop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-5 pt-2 sm:p-6 sm:pt-2">
              <Preference
                checked={notifications}
                description="Get updates when jobs finish or need input."
                icon={Bell}
                onCheckedChange={setNotifications}
                title="Execution notifications"
              />
              <Preference
                checked={quietHours}
                description="Pause non-urgent alerts overnight."
                icon={Clock3}
                onCheckedChange={setQuietHours}
                title="Quiet hours"
              />
              <button
                className="flex w-full items-center justify-between rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/50"
                onClick={() => router.push("/calendar")}
                type="button"
              >
                <span className="flex items-center gap-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Bot className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">
                      Open agent calendar
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Review durable jobs and reminders
                    </span>
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </CardContent>
          </Card>
        </section>

        <Card className="border-border/70 bg-card/70">
          <CardHeader className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Identity details</CardTitle>
                <CardDescription>
                  Used in agent handoffs and scheduled summaries.
                </CardDescription>
              </div>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                  <Check className="size-3.5" /> Saved
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-[1fr_auto] sm:p-6 sm:pt-0">
            <div className="space-y-2">
              <label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="display-name"
              >
                Display name
              </label>
              <Input
                id="display-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="How should Etles address you?"
                value={name}
              />
            </div>
            <Button className="self-end" onClick={saveName}>
              Save changes
            </Button>
            <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
              <Detail icon={Hash} label="User ID" value={user?.id || "N/A"} />
              <Detail
                icon={Shield}
                label="Authentication"
                value={isGuest ? "Anonymous storage" : "Credentials"}
              />
              <Detail
                icon={Mail}
                label="Contact"
                value={user?.email || "Not set"}
              />
            </div>
          </CardContent>
        </Card>
        <BotIntegrationsPanel />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Zap;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
      <Icon className="mb-3 size-4 text-primary" />
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
function Preference({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
      </span>
      <button
        aria-label={title}
        aria-pressed={checked}
        className={
          checked
            ? "relative h-6 w-10 shrink-0 rounded-full bg-primary transition-colors"
            : "relative h-6 w-10 shrink-0 rounded-full bg-muted transition-colors"
        }
        onClick={() => onCheckedChange(!checked)}
        type="button"
      >
        <span
          className={
            checked
              ? "absolute right-1 top-1 size-4 rounded-full bg-primary-foreground"
              : "absolute left-1 top-1 size-4 rounded-full bg-muted-foreground"
          }
        />
      </button>
    </div>
  );
}
function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 p-3">
      <Icon className="mb-2 size-4 text-muted-foreground" />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}
