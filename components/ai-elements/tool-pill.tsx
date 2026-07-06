"use client";

import { useEffect, useState, isValidElement } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Confirmation,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from "./confirmation";
import { ToolInput, ToolOutput } from "../elements/tool";

// Global cache for toolkits to avoid repeated API requests across messages
let globalToolkitsPromise: Promise<any[]> | null = null;
let globalToolkitsCache: any[] | null = null;

function getToolkits(): Promise<any[]> {
  if (globalToolkitsCache) {
    return Promise.resolve(globalToolkitsCache);
  }
  if (globalToolkitsPromise) {
    return globalToolkitsPromise;
  }
  globalToolkitsPromise = fetch("/api/connections")
    .then((res) => {
      if (!res.ok) {
        console.warn("Failed to fetch toolkits: API responded with status", res.status);
        return { toolkits: [] };
      }
      return res.json();
    })
    .then((data) => {
      globalToolkitsCache = data.toolkits || [];
      return globalToolkitsCache!;
    })
    .catch((err) => {
      console.error("Error fetching toolkits for pill logos:", err);
      return [];
    });
  return globalToolkitsPromise;
}

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
    return { appSlug: "weather", appLabel: "weather", actionName: "get_weather" };
  }

  // 2. Chart Rendering
  if (lowerRaw === "renderchart") {
    return { appSlug: "chart", appLabel: "chart", actionName: "render" };
  }

  // 3. Document Editing & suggestions (using Google Docs style icon)
  if (lowerRaw === "createdocument") {
    return { appSlug: "google-docs", appLabel: "document", actionName: "create" };
  }
  if (lowerRaw === "updatedocument") {
    return { appSlug: "google-docs", appLabel: "document", actionName: "update" };
  }
  if (lowerRaw === "editdocument") {
    return { appSlug: "google-docs", appLabel: "document", actionName: "edit" };
  }
  if (lowerRaw === "requestsuggestions") {
    return { appSlug: "google-docs", appLabel: "document", actionName: "suggest" };
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
    return { appSlug: "google-calendar", appLabel: "morning briefing", actionName: "set" };
  }

  // 13. Knowledge Graph
  if (lowerRaw === "upsertknowledgeentity") {
    return { appSlug: "database", appLabel: "knowledge graph", actionName: "upsert_entity" };
  }
  if (lowerRaw === "addknowledgerelation") {
    return { appSlug: "database", appLabel: "knowledge graph", actionName: "add_relation" };
  }
  if (lowerRaw === "getknowledgeentity") {
    return { appSlug: "database", appLabel: "knowledge graph", actionName: "get_entity" };
  }
  if (lowerRaw === "searchknowledgegraph") {
    return { appSlug: "database", appLabel: "knowledge graph", actionName: "search" };
  }
  if (lowerRaw === "deleteknowledgeentity") {
    return { appSlug: "database", appLabel: "knowledge graph", actionName: "delete_entity" };
  }
  if (lowerRaw === "deleteknowledgerelation") {
    return { appSlug: "database", appLabel: "knowledge graph", actionName: "delete_relation" };
  }

  // 14. Goals
  if (lowerRaw === "addgoal") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "add" };
  }
  if (lowerRaw === "updategoal") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "update" };
  }
  if (lowerRaw === "loggoalprogress") {
    return { appSlug: "todoist", appLabel: "goals", actionName: "log_progress" };
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
    return { appSlug: "todoist", appLabel: "planner", actionName: "update_task" };
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

  // 17. Twilio & WhatsApp
  if (lowerRaw.startsWith("twiliowhatsapp")) {
    const action = raw.slice(14);
    const parsedAction = action
      ? action.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_+/, "")
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
      ? action.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_+/, "")
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
      : raw.replace(/(sandbox|files|infiles|link|process|diagnostics)/g, "_$1").toLowerCase().replace(/^_+/, "");
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
      ? action.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_+/, "")
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
      ? action.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_+/, "")
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
      ? action.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_+/, "")
      : "execute";
    return {
      appSlug: "aws", // cloud host logo fallback
      appLabel: "oracle cloud",
      actionName: parsedAction || "execute",
    };
  }

  // Handle Composio meta-tools
  if (lowerRaw === "composio_search_tools") {
    return { appSlug: "composio", appLabel: "composio", actionName: "search_tools" };
  }
  if (lowerRaw === "composio_multi_execute_tool") {
    return { appSlug: "composio", appLabel: "composio", actionName: "execute_actions" };
  }
  if (lowerRaw === "composio_manage_connections") {
    return { appSlug: "composio", appLabel: "composio", actionName: "manage_connections" };
  }
  if (lowerRaw === "composio_initiate_connection") {
    return { appSlug: "composio", appLabel: "composio", actionName: "connect_account" };
  }
  if (lowerRaw === "composio_get_connection_status") {
    return { appSlug: "composio", appLabel: "composio", actionName: "check_connection" };
  }

  // Extract by underscores (Composio integrations or custom tools)
  const underscoreIndex = raw.indexOf("_");
  if (underscoreIndex !== -1) {
    const prefix = raw.slice(0, underscoreIndex);
    const action = raw.slice(underscoreIndex + 1);
    
    let finalSlug = prefix.toLowerCase();
    let finalLabel = prefix.toLowerCase();
    
    if (finalSlug === "composio" && action) {
      // Find the second underscore or get the first word after composio__
      const normalizedAction = action.replace(/^_+/, "");
      const nextUnderscore = normalizedAction.indexOf("_");
      if (nextUnderscore !== -1) {
        const actualApp = normalizedAction.slice(0, nextUnderscore);
        finalSlug = actualApp.toLowerCase();
        finalLabel = actualApp.toLowerCase();
      } else {
        finalSlug = normalizedAction.toLowerCase();
        finalLabel = normalizedAction.toLowerCase();
      }
    }

    return {
      appSlug: finalSlug,
      appLabel: finalLabel,
      actionName: action.toLowerCase(),
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
      if (output.length < 60) return output;
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
        if (message.length < 60) return message;
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
        if (val.length < 50) return val;
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

  if (state === "input-streaming") return "Thinking...";
  if (state === "output-available") return "Completed";
  return "Running...";
}

interface ToolPillProps {
  type: string;
  state: string;
  input?: any;
  output?: any;
  rawError?: string;
  isConsecutive?: boolean;
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
  const [resolvedAppLabel, setAppLabel] = useState<string | null>(null);

  const { appSlug, appLabel, actionName } = parseToolNameDetails(type);

  useEffect(() => {
    let active = true;
    getToolkits().then((toolkits) => {
      if (!active) return;
      // Search for matches in the fetched toolkits
      const match = toolkits.find(
        (t) =>
          t.slug.toLowerCase() === appSlug.toLowerCase() ||
          t.name.toLowerCase() === appSlug.toLowerCase()
      );
      if (match) {
        if (match.logo) {
          setLogoUrl(match.logo);
        }
        if (match.name) {
          setAppLabel(match.name.toLowerCase());
        }
      }
    });
    return () => {
      active = false;
    };
  }, [appSlug]);

  const displayAppLabel = resolvedAppLabel || appLabel.toLowerCase();
  const summaryText = getToolPreviewText(type, input, output, state);

  // Logo lookup: Use fetched URL, local public SVG, or API fallback
  const finalLogoSrc = logoUrl || `/logos/${appSlug}.svg`;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-xs hover:shadow-md transition-all duration-200 select-none group w-fit max-w-full text-left text-xs cursor-pointer",
        {
          "border-zinc-200/50 bg-white/60 dark:border-zinc-800/40 dark:bg-zinc-950/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40":
            state !== "output-error" && state !== "approval-requested",
          "border-red-500/20 bg-red-50/20 dark:border-red-950/40 dark:bg-red-950/15 hover:bg-red-50/35 dark:hover:bg-red-950/25":
            state === "output-error",
          "border-yellow-500/20 bg-yellow-50/25 dark:border-yellow-950/40 dark:bg-yellow-950/15 hover:bg-yellow-50/35 dark:hover:bg-yellow-950/25":
            state === "approval-requested",
        }
      )}
    >
      <img
        src={finalLogoSrc}
        alt={displayAppLabel}
        className="size-3.5 object-contain rounded-[3px] shrink-0 dark:invert"
        onError={(e) => {
          // If fallback local SVG fails, default to generic API icon
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/logos/api.svg";
        }}
      />
      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate capitalize">
        {displayAppLabel}
      </span>
      <span className="text-zinc-400/60 dark:text-zinc-600/60 font-medium">·</span>
      <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold lowercase">
        {actionName}
      </span>
      <span className="text-zinc-400/60 dark:text-zinc-600/60 font-medium">·</span>
      <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] md:max-w-[300px]">
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
  type: string;
  state: string;
  part: any;
  rawError?: string;
  redirectUrl?: string;
  isConsecutiveTool?: boolean;
  approvalId?: string;
  addToolApprovalResponse: any;
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
        defaultOpen={state === "approval-requested" || state === "output-error"}
        className="w-full"
      >
        <CollapsibleTrigger asChild>
          <div>
            <ToolPill
              type={type}
              state={state}
              input={part.input}
              output={part.output}
              rawError={rawError}
              isConsecutive={isConsecutiveTool}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-2 text-xs transition-all duration-200">
          {"input" in part && !!part.input && <ToolInput input={part.input} />}

          {isAwaitingApproval && (
            <Confirmation
              className="mx-3 mb-3"
              state={state as any}
              approval={{ id: approvalId! }}
            >
              <ConfirmationRequest>
                <ConfirmationTitle>
                  Approve execution of {type.replace(/^tool-/, "")}?
                </ConfirmationTitle>
                <ConfirmationActions>
                  <ConfirmationAction
                    variant="outline"
                    onClick={() => {
                      addToolApprovalResponse({
                        id: approvalId,
                        approved: false,
                      });
                    }}
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
