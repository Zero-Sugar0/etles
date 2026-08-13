"use client";

import { ChevronDown, ExternalLink, RefreshCw, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  findToolkit,
  formatActionDescriptor,
  preloadToolkitLogos,
  resolveToolkitLogoSrc,
  resolveToolkitSlug,
  splitComposioToolName,
  type ToolkitInfo,
} from "@/lib/toolkit-logos";
import { cn } from "@/lib/utils";
import { ToolInput, ToolOutput } from "../elements/tool";
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "./confirmation";

export { preloadToolkitLogos } from "@/lib/toolkit-logos";

// Parse tool type to extract slug, friendly app name, and action name
export function parseToolNameDetails(type: string): {
  appSlug: string;
  appLabel: string;
  actionName: string;
} {
  const raw = type.replace(/^tool-/, "");
  const lowerRaw = raw.toLowerCase();

  // 1. Weather
  if (lowerRaw === "getweather") {
    return {
      appSlug: "weather",
      appLabel: "weather",
      actionName: "get_weather",
    };
  }

  // 2. Chart Rendering
  if (lowerRaw === "renderchart") {
    return { appSlug: "chart", appLabel: "chart", actionName: "render" };
  }

  // 3. Document Editing & suggestions (using Google Docs style icon)
  if (lowerRaw === "createdocument") {
    return {
      appSlug: "google-docs",
      appLabel: "document",
      actionName: "create",
    };
  }
  if (lowerRaw === "updatedocument") {
    return {
      appSlug: "google-docs",
      appLabel: "document",
      actionName: "update",
    };
  }
  if (lowerRaw === "editdocument") {
    return { appSlug: "google-docs", appLabel: "document", actionName: "edit" };
  }
  if (lowerRaw === "requestsuggestions") {
    return {
      appSlug: "google-docs",
      appLabel: "document",
      actionName: "suggest",
    };
  }

  // 4. Scratchpad (using Notion style icon)
  if (lowerRaw === "readscratchpad") {
    return { appSlug: "notion", appLabel: "scratchpad", actionName: "read" };
  }
  if (lowerRaw === "writescratchpad") {
    return { appSlug: "notion", appLabel: "scratchpad", actionName: "write" };
  }
  if (lowerRaw === "clearscratchpad") {
    return { appSlug: "notion", appLabel: "scratchpad", actionName: "clear" };
  }

  // 5. Generative Media
  if (lowerRaw === "generateimage") {
    return { appSlug: "image", appLabel: "AI Image", actionName: "generate" };
  }
  if (lowerRaw === "generatevideo") {
    return { appSlug: "image", appLabel: "AI Video", actionName: "generate" };
  }

  // 6. Memory Tools (database.svg)
  if (lowerRaw === "savememory") {
    return { appSlug: "database", appLabel: "memory", actionName: "save" };
  }
  if (lowerRaw === "recallmemory") {
    return { appSlug: "database", appLabel: "memory", actionName: "recall" };
  }
  if (lowerRaw === "updatememory") {
    return { appSlug: "database", appLabel: "memory", actionName: "update" };
  }
  if (lowerRaw === "deletememory") {
    return { appSlug: "database", appLabel: "memory", actionName: "delete" };
  }
  if (lowerRaw === "searchpastconversations") {
    return { appSlug: "database", appLabel: "history", actionName: "search" };
  }

  // 7. Scheduling (clock/calendar)
  if (lowerRaw === "setreminder") {
    return { appSlug: "clock", appLabel: "reminder", actionName: "set" };
  }
  if (lowerRaw === "setcronjob") {
    return { appSlug: "calendar", appLabel: "cron job", actionName: "set" };
  }
  if (lowerRaw === "listschedules") {
    return { appSlug: "calendar", appLabel: "schedules", actionName: "list" };
  }
  if (lowerRaw === "deleteschedule") {
    return { appSlug: "calendar", appLabel: "schedule", actionName: "delete" };
  }

  // 8. Triggers (zapier)
  if (lowerRaw === "setuptrigger") {
    return { appSlug: "zapier", appLabel: "trigger", actionName: "setup" };
  }
  if (lowerRaw === "listactivetriggers") {
    return { appSlug: "zapier", appLabel: "triggers", actionName: "list" };
  }
  if (lowerRaw === "removetrigger") {
    return { appSlug: "zapier", appLabel: "trigger", actionName: "remove" };
  }

  // 9. Sub-agents (mcp.svg)
  if (lowerRaw === "delegatetosubagent") {
    return { appSlug: "mcp", appLabel: "subagent", actionName: "delegate" };
  }
  if (lowerRaw === "getsubagentresult") {
    return { appSlug: "mcp", appLabel: "subagent", actionName: "get_result" };
  }
  if (lowerRaw === "listsubagents") {
    return { appSlug: "mcp", appLabel: "subagents", actionName: "list" };
  }

  // 10. Missions
  if (lowerRaw === "launchmission") {
    return { appSlug: "daytona", appLabel: "mission", actionName: "launch" };
  }
  if (lowerRaw === "getmissionstatus") {
    return { appSlug: "daytona", appLabel: "mission", actionName: "status" };
  }

  // 11. Approvals
  if (lowerRaw === "queueapproval") {
    return { appSlug: "todoist", appLabel: "approval", actionName: "queue" };
  }

  // 12. Proactive Actions
  if (lowerRaw === "activateheartbeat") {
    return { appSlug: "clock", appLabel: "heartbeat", actionName: "activate" };
  }
  if (lowerRaw === "getagentsystemstatus") {
    return { appSlug: "clock", appLabel: "agent status", actionName: "get" };
  }
  if (lowerRaw === "setmorningbriefingtime") {
    return {
      appSlug: "google-calendar",
      appLabel: "morning briefing",
      actionName: "set",
    };
  }

  // 13. Knowledge Graph
  if (lowerRaw === "upsertknowledgeentity") {
    return {
      appSlug: "database",
      appLabel: "knowledge graph",
      actionName: "upsert_entity",
    };
  }
  if (lowerRaw === "addknowledgerelation") {
    return {
      appSlug: "database",
      appLabel: "knowledge graph",
      actionName: "add_relation",
    };
  }
  if (lowerRaw === "getknowledgeentity") {
    return {
      appSlug: "database",
      appLabel: "knowledge graph",
      actionName: "get_entity",
    };
  }
  if (lowerRaw === "searchknowledgegraph") {
    return {
      appSlug: "database",
      appLabel: "knowledge graph",
      actionName: "search",
    };
  }
  if (lowerRaw === "deleteknowledgeentity") {
    return {
      appSlug: "database",
      appLabel: "knowledge graph",
      actionName: "delete_entity",
    };
  }
  if (lowerRaw === "deleteknowledgerelation") {
    return {
      appSlug: "database",
      appLabel: "knowledge graph",
      actionName: "delete_relation",
    };
  }

  // 14. Goals
  if (lowerRaw === "addgoal") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "add" };
  }
  if (lowerRaw === "updategoal") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "update" };
  }
  if (lowerRaw === "loggoalprogress") {
    return {
      appSlug: "todoist",
      appLabel: "goals",
      actionName: "log_progress",
    };
  }
  if (lowerRaw === "listgoals") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "list" };
  }
  if (lowerRaw === "deletegoal") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "delete" };
  }

  // 14b. Planner & Checklists
  if (lowerRaw === "createplan") {
    return { appSlug: "todoist", appLabel: "planner", actionName: "create" };
  }
  if (lowerRaw === "addplantask") {
    return { appSlug: "todoist", appLabel: "planner", actionName: "add_task" };
  }
  if (lowerRaw === "updateplantask") {
    return {
      appSlug: "todoist",
      appLabel: "planner",
      actionName: "update_task",
    };
  }
  if (lowerRaw === "listplans") {
    return { appSlug: "todoist", appLabel: "planner", actionName: "list" };
  }
  if (lowerRaw === "deleteplan") {
    return { appSlug: "todoist", appLabel: "planner", actionName: "delete" };
  }

  // 15. Tavily Search
  if (lowerRaw.startsWith("tavily")) {
    const action = lowerRaw.slice(6);
    return {
      appSlug: "tavily",
      appLabel: "tavily",
      actionName: action ? action : "search",
    };
  }

  // 16. Wiki
  if (lowerRaw === "wikiquery") {
    return { appSlug: "wikipedia", appLabel: "wiki", actionName: "query" };
  }
  if (lowerRaw === "wikiingest") {
    return { appSlug: "wikipedia", appLabel: "wiki", actionName: "ingest" };
  }

  // 16. Agent Skills (.agents/skills)
  if (lowerRaw === "readagentskill") {
    return { appSlug: "mcp", appLabel: "agent skills", actionName: "read" };
  }
  if (lowerRaw === "readdepartmentmemory") {
    return {
      appSlug: "database",
      appLabel: "department",
      actionName: "recall",
    };
  }
  if (lowerRaw === "writedepartmentmemory") {
    return { appSlug: "database", appLabel: "department", actionName: "share" };
  }

  // 17. Twilio & WhatsApp
  if (lowerRaw.startsWith("twiliowhatsapp")) {
    const action = raw.slice(14);
    const parsedAction = action
      ? action
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase()
          .replace(/^_+/, "")
      : "execute";
    return {
      appSlug: "whatsapp",
      appLabel: "WhatsApp",
      actionName: parsedAction || "execute",
    };
  }
  if (lowerRaw.startsWith("twilio") && !lowerRaw.startsWith("twiliowhatsapp")) {
    const action = raw.slice(6);
    const parsedAction = action
      ? action
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase()
          .replace(/^_+/, "")
      : "execute";
    return {
      appSlug: "twilio",
      appLabel: "Twilio",
      actionName: parsedAction || "execute",
    };
  }

  // 18. Daytona Sandbox Tools
  const daytonaToolsList = [
    "createsandbox",
    "listsandboxes",
    "deletesandbox",
    "executecommand",
    "runcode",
    "listfiles",
    "readfile",
    "writefile",
    "createdirectory",
    "searchfiles",
    "replaceinfiles",
    "gitclone",
    "gitstatus",
    "gitcommit",
    "gitpush",
    "gitpull",
    "gitbranch",
    "getpreviewlink",
    "runbackgroundprocess",
    "lspdiagnostics",
    "archivesandbox",
  ];
  if (daytonaToolsList.includes(lowerRaw)) {
    const hasCaps = /[A-Z]/.test(raw);
    const parsedAction = hasCaps
      ? raw.replace(/([A-Z])/g, "_$1").toLowerCase()
      : raw
          .replace(/(sandbox|files|infiles|link|process|diagnostics)/g, "_$1")
          .toLowerCase()
          .replace(/^_+/, "");
    return {
      appSlug: "daytona",
      appLabel: "daytona",
      actionName: parsedAction || raw,
    };
  }

  // 19. Sandbox Status / Run tools starting with 'sandbox'
  if (lowerRaw.startsWith("sandbox")) {
    const action = raw.slice(7);
    const parsedAction = action
      ? action
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase()
          .replace(/^_+/, "")
      : "execute";
    return {
      appSlug: "daytona",
      appLabel: "sandbox",
      actionName: parsedAction || "execute",
    };
  }

  // 20. Daytona Browser Tools
  if (lowerRaw.startsWith("browser")) {
    const action = raw.slice(7);
    const parsedAction = action
      ? action
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase()
          .replace(/^_+/, "")
      : "execute";
    return {
      appSlug: "brave",
      appLabel: "browser",
      actionName: parsedAction || "execute",
    };
  }

  // 21. Oracle Tools
  if (lowerRaw.startsWith("oracle")) {
    const action = raw.slice(6);
    const parsedAction = action
      ? action
          .replace(/([A-Z])/g, "_$1")
          .toLowerCase()
          .replace(/^_+/, "")
      : "execute";
    return {
      appSlug: "aws", // cloud host logo fallback
      appLabel: "oracle cloud",
      actionName: parsedAction || "execute",
    };
  }

  // Handle Composio meta-tools
  if (lowerRaw === "composio_search_tools") {
    return {
      appSlug: "composio",
      appLabel: "composio",
      actionName: "search_tools",
    };
  }
  if (lowerRaw === "composio_multi_execute_tool") {
    return {
      appSlug: "composio",
      appLabel: "composio",
      actionName: "execute_actions",
    };
  }
  if (lowerRaw === "composio_manage_connections") {
    return {
      appSlug: "composio",
      appLabel: "composio",
      actionName: "manage_connections",
    };
  }
  if (lowerRaw === "composio_initiate_connection") {
    return {
      appSlug: "composio",
      appLabel: "composio",
      actionName: "connect_account",
    };
  }
  if (lowerRaw === "composio_get_connection_status") {
    return {
      appSlug: "composio",
      appLabel: "composio",
      actionName: "check_connection",
    };
  }

  // Extract by underscores (Composio integrations: GMAIL_SEND_EMAIL, GOOGLE_CALENDAR_LIST_EVENTS)
  const underscoreIndex = raw.indexOf("_");
  if (underscoreIndex !== -1) {
    const parsed = splitComposioToolName(raw);
    const parts = raw.replace(/^composio_/i, "").split("_");
    const appSlug = parsed?.appSlug ?? resolveToolkitSlug(parts[0] ?? raw);
    const actionName =
      parsed?.actionName ??
      (parts.slice(1).join("_").toLowerCase() || "execute");

    return {
      appSlug,
      appLabel: appSlug,
      actionName,
    };
  }

  // Extract by hyphens
  const hyphenIndex = raw.indexOf("-");
  if (hyphenIndex !== -1) {
    const prefix = raw.slice(0, hyphenIndex);
    const action = raw.slice(hyphenIndex + 1);
    return {
      appSlug: prefix.toLowerCase(),
      appLabel: prefix.toLowerCase(),
      actionName: action.toLowerCase(),
    };
  }

  return {
    appSlug: raw.toLowerCase(),
    appLabel: raw.toLowerCase(),
    actionName: "execute",
  };
}

function getFirstStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = getFirstStringValue(item);
      if (found) {
        return found;
      }
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferredKeys = [
      "tool_slug",
      "toolSlug",
      "toolName",
      "tool",
      "toolkit",
      "toolkitSlug",
      "app",
      "appSlug",
      "slug",
    ];
    for (const key of preferredKeys) {
      const found = getFirstStringValue(obj[key]);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function getComposioToolDetailsFromPayload(
  input: unknown,
  output: unknown
): ReturnType<typeof parseToolNameDetails> | null {
  const candidate = getFirstStringValue(input) ?? getFirstStringValue(output);
  if (!candidate) {
    return null;
  }

  const parsed = splitComposioToolName(candidate);
  if (parsed) {
    return {
      appSlug: parsed.appSlug,
      appLabel: parsed.appSlug,
      actionName: parsed.actionName,
    };
  }

  const resolved = resolveToolkitSlug(candidate);
  if (resolved !== candidate.toLowerCase()) {
    return {
      appSlug: resolved,
      appLabel: resolved,
      actionName: "execute",
    };
  }

  return null;
}

// Generate smart preview summary text from input/output payloads
export function getToolPreviewText(
  type: string,
  input: any,
  output: any,
  state: string
): string {
  if (state === "output-error") {
    return "Failed with error";
  }
  if (state === "output-denied") {
    return "Denied by user";
  }
  if (state === "approval-requested") {
    return "Awaiting approval";
  }

  // Check output first if available
  if (output) {
    if (typeof output === "string") {
      if (output.length < 60) {
        return output;
      }
      return output.slice(0, 57) + "...";
    }
    if (typeof output === "object") {
      const data = output.data || output;
      const message =
        output.message ||
        data.message ||
        output.summary ||
        data.summary ||
        output.text ||
        data.text;
      if (typeof message === "string") {
        if (message.length < 60) {
          return message;
        }
        return message.slice(0, 57) + "...";
      }
    }
  }

  // Fallback to input parameters
  if (input && typeof input === "object") {
    const candidates = [
      "title",
      "name",
      "subject",
      "text",
      "query",
      "body",
      "content",
      "message",
      "pageId",
      "id",
      "slug",
    ];
    for (const key of candidates) {
      if (typeof input[key] === "string" && input[key].trim()) {
        const val = input[key].trim();
        if (val.length < 50) {
          return val;
        }
        return val.slice(0, 47) + "...";
      }
    }

    const keys = Object.keys(input);
    if (keys.length > 0) {
      const firstKey = keys[0];
      const val = input[firstKey];
      if (typeof val === "string" || typeof val === "number") {
        return `${firstKey}: ${val}`;
      }
    }
  }

  if (state === "input-streaming") {
    return "Thinking...";
  }
  if (state === "output-available") {
    return "Completed";
  }
  return "Running...";
}

interface ToolPillProps {
  input?: any;
  isConsecutive?: boolean;
  output?: any;
  rawError?: string;
  state: string;
  type: string;
}

export function ToolPill({
  type,
  state,
  input,
  output,
  rawError,
  isConsecutive,
}: ToolPillProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [resolvedAppLabel, setAppLabel] = useState<string | null>(null);

  const parsedDetails = parseToolNameDetails(type);
  const payloadDetails =
    parsedDetails.appSlug === "composio"
      ? getComposioToolDetailsFromPayload(input, output)
      : null;
  const { appSlug, appLabel, actionName } = payloadDetails ?? parsedDetails;

  useEffect(() => {
    let active = true;
    setLogoFailed(false);
    setLogoUrl(null);
    preloadToolkitLogos().then((toolkits: ToolkitInfo[]) => {
      if (!active) {
        return;
      }
      const match = findToolkit(toolkits, appSlug);
      if (match?.logo) {
        setLogoUrl(match.logo);
      }
      if (match?.name) {
        setAppLabel(match.name);
      }
    });
    return () => {
      active = false;
    };
  }, [appSlug]);

  const displayAppLabel = resolvedAppLabel || appLabel;
  const friendlyAction = formatActionDescriptor(actionName);
  const summaryText = getToolPreviewText(type, input, output, state);

  const finalLogoSrc = logoUrl || resolveToolkitLogoSrc(appSlug);

  return (
    <div
      className={cn(
        "inline-flex min-w-0 max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-xs transition-colors duration-200 select-none group w-fit cursor-pointer",
        {
          "hover:bg-muted/50":
            state !== "output-error" && state !== "approval-requested",
          "text-destructive hover:bg-destructive/10": state === "output-error",
          "text-yellow-600 hover:bg-yellow-500/10":
            state === "approval-requested",
        }
      )}
    >
      {finalLogoSrc && !logoFailed ? (
        <img
          alt={displayAppLabel}
          className="size-3.5 object-contain rounded-[3px] shrink-0"
          onError={() => setLogoFailed(true)}
          src={finalLogoSrc}
        />
      ) : (
        <Wrench
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      )}
      <span className="min-w-0 max-w-[7rem] truncate font-semibold text-zinc-800 capitalize dark:text-zinc-200 sm:max-w-[10rem]">
        {displayAppLabel}
      </span>
      <span className="text-zinc-400/60 dark:text-zinc-600/60 font-medium">
        ·
      </span>
      <span className="max-w-[8rem] truncate text-[11px] font-medium lowercase text-zinc-600 dark:text-zinc-400 sm:max-w-none">
        {friendlyAction}
      </span>
      <span className="text-zinc-400/60 dark:text-zinc-600/60 font-medium">
        ·
      </span>
      <span className="min-w-0 max-w-[8rem] truncate text-zinc-500 dark:text-zinc-400 sm:max-w-[200px] md:max-w-[300px]">
        {summaryText}
      </span>

      {state === "input-streaming" ? (
        <RefreshCw className="size-3 text-zinc-400 shrink-0 animate-spin ml-1" />
      ) : (
        <ChevronDown className="size-3 text-zinc-400 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 ml-1" />
      )}
    </div>
  );
}

interface ExpandableToolPillProps {
  actualToolCallId: string;
  addToolApprovalResponse: any;
  approvalId?: string;
  isConsecutiveTool?: boolean;
  part: any;
  rawError?: string;
  redirectUrl?: string;
  state: string;
  type: string;
}

export function ExpandableToolPill({
  actualToolCallId,
  type,
  state,
  part,
  rawError,
  redirectUrl,
  isConsecutiveTool,
  approvalId,
  addToolApprovalResponse,
}: ExpandableToolPillProps) {
  const isAwaitingApproval = state === "approval-requested" && approvalId;

  return (
    <div
      className={cn("w-full max-w-[550px] mb-2", {
        "-mt-1": isConsecutiveTool,
      })}
      key={actualToolCallId}
    >
      <Collapsible
        className="w-full"
        defaultOpen={state === "approval-requested" || state === "output-error"}
      >
        <CollapsibleTrigger asChild>
          <div>
            <ToolPill
              input={part.input}
              isConsecutive={isConsecutiveTool}
              output={part.output}
              rawError={rawError}
              state={state}
              type={type}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 p-2 text-xs transition-all duration-200">
          {"input" in part && !!part.input && <ToolInput input={part.input} />}

          {isAwaitingApproval && (
            <Confirmation
              approval={{ id: approvalId! }}
              className="mx-3 mb-3"
              state={state as any}
            >
              <ConfirmationRequest>
                <ConfirmationTitle>
                  Approve execution of {type.replace(/^tool-/, "")}?
                </ConfirmationTitle>
                <ConfirmationActions>
                  <ConfirmationAction
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                      });
                    }}
                    variant="outline"
                  >
                    Deny
                  </ConfirmationAction>
                  <ConfirmationAction
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: true,
                      });
                    }}
                  >
                    Allow
                  </ConfirmationAction>
                </ConfirmationActions>
              </ConfirmationRequest>
            </Confirmation>
          )}

          {"output" in part && !!part.output && (
            <>
              {redirectUrl && (
                <div className="px-3 pb-3">
                  <Button asChild className="w-full gap-2" size="sm">
                    <Link href={redirectUrl} target="_blank">
                      <ExternalLink className="size-4" />
                      Connect Account
                    </Link>
                  </Button>
                </div>
              )}
              <ToolOutput errorText={rawError} output={part.output as any} />
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
