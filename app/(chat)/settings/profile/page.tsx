"use client";

import {
  ArrowLeft,
  Bell,
  Bot,
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Mail,
  Shield,
  Activity,
  Building2,
  Trash2,
  User as UserIcon,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [credentials, setCredentials] = useState<Array<{ id: string; provider: string; keyName: string; valueHint: string; updatedAt?: string }>>([]);
  const [credentialProvider, setCredentialProvider] = useState("ai-gateway");
  const [credentialKey, setCredentialKey] = useState("AI_GATEWAY_API_KEY");
  const [credentialValue, setCredentialValue] = useState("");
  const [credentialStatus, setCredentialStatus] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ workspace: { id: string; name: string; slug: string }; membership: { role: string } }>>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState("");
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ membership: { id: string; userId: string; role: string }; user: { id: string; email: string; firstName?: string | null; lastName?: string | null } }>>([]);
  const [memberEmail, setMemberEmail] = useState("");

  useEffect(() => {
    void fetch("/api/user/profile").then(async (response) => {
      if (response.ok) setCredentials((await response.json()).credentials ?? []);
    });
    void fetch("/api/workspaces").then(async (response) => {
      if (response.ok) setWorkspaces(await response.json());
    });
  }, []);

  async function createWorkspace() {
    if (!workspaceName.trim()) return;
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    const data = await response.json();
    if (!response.ok) {
      setWorkspaceStatus(data.error ?? "Could not create workspace");
      return;
    }
    setWorkspaceName("");
    setWorkspaceStatus("Workspace created");
    setWorkspaces((current) => [...current, { workspace: data, membership: { role: "owner" } }]);
  }

  async function selectWorkspace(id: string) {
    const response = await fetch(`/api/workspaces/${id}/select`, { method: "POST" });
    if (!response.ok) {
      setWorkspaceStatus("Could not select workspace");
      return;
    }
    setActiveWorkspaceId(id);
    const membersResponse = await fetch(`/api/workspaces/${id}/members`);
    if (membersResponse.ok) setMembers(await membersResponse.json());
    setWorkspaceStatus("Workspace selected");
  }

  async function addMember() {
    if (!activeWorkspaceId || !memberEmail.trim()) return;
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: memberEmail.trim(), role: "member" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setWorkspaceStatus(data.error ?? "Could not add member");
      return;
    }
    setMemberEmail("");
    setMembers((current) => [...current.filter((item) => item.membership.userId !== data.userId), { membership: data, user: { id: data.userId, email: memberEmail.trim() } }]);
    setWorkspaceStatus("Member added");
  }

  async function removeMember(userId: string) {
    if (!activeWorkspaceId) return;
    const response = await fetch(`/api/workspaces/${activeWorkspaceId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      const data = await response.json();
      setWorkspaceStatus(data.error ?? "Could not remove member");
      return;
    }
    setMembers((current) => current.filter((item) => item.user.id !== userId));
    setWorkspaceStatus("Member removed");
  }

  async function saveCredential() {
    if (!credentialValue.trim()) return;
    const response = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: credentialProvider, keyName: credentialKey, value: credentialValue }),
    });
    const data = await response.json();
    if (!response.ok) {
      setCredentialStatus(data.error ?? "Could not save credential");
      return;
    }
    setCredentialValue("");
    setCredentialStatus("Encrypted and saved");
    const updated = await fetch("/api/user/profile");
    if (updated.ok) setCredentials((await updated.json()).credentials ?? []);
  }

  async function removeCredential(id: string) {
    await fetch(`/api/user/profile?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setCredentials((current) => current.filter((credential) => credential.id !== id));
    setRevealedSecrets((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  async function revealCredential(id: string) {
    const response = await fetch("/api/user/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revealCredential", id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setCredentialStatus(data.error ?? "Could not reveal credential");
      return null;
    }
    setRevealedSecrets((current) => ({ ...current, [id]: data.value }));
    return data.value as string;
  }
  async function copyCredential(id: string) {
    const value = revealedSecrets[id] ?? (await revealCredential(id));
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedSecret(id);
    window.setTimeout(() => setCopiedSecret((current) => current === id ? null : current), 1600);
  }
  async function toggleSecretVisibility(show: boolean) {
    if (show) {
      const values = await Promise.all(
        credentials.map(async (credential) => [credential.id, await revealCredential(credential.id)] as const)
      );
      const revealed = values.reduce<Record<string, string>>((result, [id, value]) => {
        if (value) result[id] = value;
        return result;
      }, {});
      setRevealedSecrets((current) => ({
        ...current,
        ...revealed,
      }));
    }
    setShowSecrets(show);
  }
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
                    sizes="(min-width: 640px) 112px, 96px"
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
              <Metric icon={Activity} label="Signals" value="1.2k" />
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

        <Tabs className="w-full" defaultValue="profile">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border/70 bg-card/70 p-1 sm:grid-cols-4">
            <TabsTrigger className="gap-2 py-2.5" value="profile"><UserIcon className="size-4" /> Profile</TabsTrigger>
            <TabsTrigger className="gap-2 py-2.5" value="integrations"><Bot className="size-4" /> Integrations</TabsTrigger>
            <TabsTrigger className="gap-2 py-2.5" value="secrets"><KeyRound className="size-4" /> Secrets</TabsTrigger>
            <TabsTrigger className="gap-2 py-2.5" value="workspace"><Building2 className="size-4" /> Workspace</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
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
          </TabsContent>
          <TabsContent value="integrations">
            <BotIntegrationsPanel />
          </TabsContent>
          <TabsContent value="secrets">
        <Card className="border-border/70 bg-card/70">
          <CardHeader className="border-b border-border/70 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4 text-primary" /> Secrets</CardTitle>
                <CardDescription className="mt-1 max-w-2xl">Encrypted profile keys are used only when the matching deployment environment key is unavailable.</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {showSecrets ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                <span>{showSecrets ? "Values visible" : "Values masked"}</span>
                <Switch aria-label="Toggle secret visibility" checked={showSecrets} onCheckedChange={(checked) => void toggleSecretVisibility(checked)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="rounded-lg border border-border/70 bg-background">
              <div className="border-b border-border/70 px-4 py-3 text-sm font-medium">Add a secret</div>
              <div className="grid gap-3 p-4 sm:grid-cols-[9rem_1fr_1fr_auto]">
                <select aria-label="Secret provider" className="h-10 rounded-md border border-input bg-background px-3 text-sm" onChange={(event) => setCredentialProvider(event.target.value)} value={credentialProvider}>
                  {["ai-gateway", "composio", "upstash", "daytona", "oracle", "e2b"].map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                </select>
                <Input aria-label="Secret key name" onChange={(event) => setCredentialKey(event.target.value)} placeholder="Credential name" value={credentialKey} />
                <Input aria-label="Secret value" autoComplete="off" onChange={(event) => setCredentialValue(event.target.value)} placeholder="Long credential value" type="password" value={credentialValue} />
                <Button disabled={!credentialValue.trim()} onClick={saveCredential}><KeyRound className="size-4" /> Save</Button>
              </div>
              {credentialStatus && <p className="px-4 pb-4 text-xs text-muted-foreground">{credentialStatus}</p>}
            </div>
            <div className="overflow-hidden rounded-lg border border-border/70 bg-background">
              <div className="border-b border-border/70 px-4 py-3 text-sm font-medium">Saved secrets</div>
              {credentials.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No profile secrets saved yet.</p> : <div className="divide-y divide-border">
                {credentials.map((credential) => {
                  const revealed = revealedSecrets[credential.id];
                  const displayValue = showSecrets && revealed ? revealed : "••••••••••••••••";
                  return <div className="flex flex-wrap items-center gap-3 px-4 py-3" key={credential.id}>
                    <div className="min-w-0 flex-1"><p className="truncate font-mono text-sm font-medium">{credential.keyName}</p><p className="text-xs text-muted-foreground">{credential.provider}</p></div>
                    <code className="max-w-full truncate font-mono text-xs text-muted-foreground sm:max-w-[18rem]">{displayValue}</code>
                    <div className="flex items-center gap-1">
                      <Button aria-label={revealed ? `Hide ${credential.keyName}` : `Reveal ${credential.keyName}`} onClick={() => revealed ? setRevealedSecrets((current) => { const next = { ...current }; delete next[credential.id]; return next; }) : void revealCredential(credential.id)} size="icon" variant="ghost">{revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
                      <Button aria-label={`Copy ${credential.keyName}`} onClick={() => void copyCredential(credential.id)} size="icon" variant="ghost">{copiedSecret === credential.id ? <CheckCheck className="size-4 text-emerald-400" /> : <Copy className="size-4" />}</Button>
                      <Button aria-label={`Remove ${credential.keyName}`} onClick={() => void removeCredential(credential.id)} size="icon" variant="ghost"><Trash2 className="size-4 text-muted-foreground" /></Button>
                    </div>
                  </div>;
                })}
              </div>}
            </div>
          </CardContent>
        </Card>
          </TabsContent>
          <TabsContent value="workspace">
            <Card className="border-border/70 bg-card/70">
              <CardHeader className="p-5 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base"><Building2 className="size-4 text-primary" /> Workspaces</CardTitle>
                <CardDescription>Separate team members, missions, and operating context by workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Input aria-label="Workspace name" onChange={(event) => setWorkspaceName(event.target.value)} placeholder="New workspace name" value={workspaceName} />
                  <Button disabled={!workspaceName.trim()} onClick={() => void createWorkspace()}><Building2 className="size-4" /> Create workspace</Button>
                </div>
                {workspaceStatus && <p className="text-xs text-muted-foreground">{workspaceStatus}</p>}
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border/70">
                  {workspaces.map(({ workspace, membership }) => (
                    <div className="flex flex-wrap items-center gap-3 p-4" key={workspace.id}>
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{workspace.name}</p><p className="text-xs text-muted-foreground">{membership.role} · {workspace.slug}</p></div>
                      <Button onClick={() => void selectWorkspace(workspace.id)} size="sm" variant="outline">Use workspace</Button>
                    </div>
                  ))}
                </div>
                {activeWorkspaceId && (
                  <div className="space-y-3 rounded-lg border border-border/70 p-4">
                    <div><p className="text-sm font-medium">Team members</p><p className="text-xs text-muted-foreground">Add people who already have an Etles account.</p></div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Input aria-label="Member email" onChange={(event) => setMemberEmail(event.target.value)} placeholder="member@example.com" value={memberEmail} />
                      <Button disabled={!memberEmail.trim()} onClick={() => void addMember()} size="sm">Add member</Button>
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border/70">
                      {members.map(({ membership, user: member }) => <div className="flex items-center gap-3 p-3" key={membership.id}><div className="min-w-0 flex-1"><p className="truncate text-sm">{member.firstName || member.lastName ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() : member.email}</p><p className="text-xs text-muted-foreground">{member.email} · {membership.role}</p></div>{membership.role !== "owner" && <Button aria-label={`Remove ${member.email}`} onClick={() => void removeMember(member.id)} size="icon" variant="ghost"><Trash2 className="size-4" /></Button>}</div>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
