import {
  type AgentDepartment,
  getAgentDepartment,
  getDepartmentLeadSlug,
} from "./departments";
import type { AgentSlug, SubAgentDefinition } from "./subagent-definitions";

export type AgentRiskLevel = "low" | "medium" | "high" | "critical";

export type AgentApprovalMode =
  | "none"
  | "external_write"
  | "financial_or_legal"
  | "lead_review"
  | "user_approval";

export type AgentToolPack =
  | "a2a"
  | "browser"
  | "cloud"
  | "composio"
  | "database"
  | "department_memory"
  | "goals"
  | "knowledge_graph"
  | "legal"
  | "media_generation"
  | "memory"
  | "missions"
  | "planner"
  | "sandbox"
  | "schedules"
  | "scratchpad"
  | "search"
  | "twilio"
  | "wiki";

export type AgentOutputField =
  | "summary"
  | "actionsTaken"
  | "evidence"
  | "assumptions"
  | "risks"
  | "needsApproval"
  | "nextSteps"
  | "leadReview";

export interface AgentManifest {
  allowedComposioToolkits: string[];
  allowedToolPacks: AgentToolPack[];
  approvalMode: AgentApprovalMode;
  department: AgentDepartment;
  departmentLeadSlug?: string;
  escalationTriggers: string[];
  memoryPolicy: {
    canReadUserMemory: boolean;
    canWriteUserMemory: boolean;
    canWriteDepartmentMemory: boolean;
    retention: "ephemeral" | "department" | "user";
  };
  outputFields: AgentOutputField[];
  riskLevel: AgentRiskLevel;
  slug: AgentSlug;
  successCriteria: string[];
}

const CORE_OUTPUT_FIELDS: AgentOutputField[] = [
  "summary",
  "actionsTaken",
  "evidence",
  "assumptions",
  "risks",
  "needsApproval",
  "nextSteps",
  "leadReview",
];

const COMMON_TOOL_PACKS: AgentToolPack[] = [
  "a2a",
  "department_memory",
  "goals",
  "knowledge_graph",
  "memory",
  "planner",
  "scratchpad",
  "search",
  "wiki",
];

const DEPARTMENT_TOOLKITS: Record<AgentDepartment, string[]> = {
  executive_ops: [
    "gmail",
    "outlook",
    "slack",
    "googlecalendar",
    "notion",
    "asana",
    "linear",
  ],
  sales: [
    "apollo",
    "hubspot",
    "salesforce",
    "pipedrive",
    "gmail",
    "outlook",
    "slack",
    "googlecalendar",
  ],
  marketing: [
    "buffer",
    "hootsuite",
    "mailchimp",
    "semrush",
    "ahrefs",
    "instagram",
    "facebook",
    "linkedin",
  ],
  engineering: [
    "github",
    "gitlab",
    "linear",
    "jira",
    "sentry",
    "vercel",
    "cloudflare",
  ],
  product: ["notion", "figma", "linear", "jira", "posthog", "amplitude"],
  finance: [
    "stripe",
    "quickbooks",
    "xero",
    "plaid",
    "ramp",
    "brex",
    "googlesheets",
  ],
  customer_service: [
    "intercom",
    "zendesk",
    "freshdesk",
    "helpscout",
    "hubspot",
    "slack",
  ],
  hr_people: [
    "greenhouse",
    "lever",
    "ashby",
    "bamboohr",
    "gmail",
    "googlecalendar",
    "slack",
  ],
  growth_analytics: [
    "posthog",
    "amplitude",
    "mixpanel",
    "googleanalytics",
    "segment",
    "bigquery",
    "snowflake",
  ],
  research_strategy: [
    "crunchbase",
    "semrush",
    "similarweb",
    "notion",
    "googlesheets",
  ],
  security: ["snyk", "sonarqube", "cloudflare", "sentry", "datadog", "github"],
  legal_compliance: [
    "docusign",
    "hellosign",
    "box",
    "dropbox",
    "notion",
    "googledrive",
  ],
  content_creative: [
    "figma",
    "canva",
    "youtube",
    "vimeo",
    "buffer",
    "hootsuite",
  ],
  supply_chain_ecommerce: [
    "shopify",
    "woocommerce",
    "shipstation",
    "easyship",
    "shipbob",
    "googlesheets",
  ],
  partnerships_alliances: [
    "hubspot",
    "salesforce",
    "partnerstack",
    "gmail",
    "outlook",
    "docusign",
  ],
  general: ["notion", "slack", "googledrive"],
};

const HIGH_RISK_DEPARTMENTS = new Set<AgentDepartment>([
  "finance",
  "legal_compliance",
  "security",
]);

const CRITICAL_AGENT_SLUGS = new Set<string>([
  "contractor_payment",
  "finance_lead",
  "legal_operator",
  "legal_compliance_lead",
  "privacy_guardian",
  "security_operator",
  "security_lead",
  "soc_analyst",
  "pen_tester",
  "incident_commander",
  "access_manager",
]);

const AGENT_OVERRIDES: Partial<
  Record<
    AgentSlug,
    Partial<
      Pick<
        AgentManifest,
        | "allowedComposioToolkits"
        | "allowedToolPacks"
        | "approvalMode"
        | "riskLevel"
        | "successCriteria"
      >
    >
  >
> = {
  browser_operator: {
    allowedToolPacks: [...COMMON_TOOL_PACKS, "browser", "sandbox"],
    riskLevel: "high",
  },
  code_review: {
    allowedToolPacks: [...COMMON_TOOL_PACKS, "sandbox"],
    riskLevel: "medium",
  },
  finance: {
    approvalMode: "financial_or_legal",
    riskLevel: "high",
  },
  inbox_operator: {
    approvalMode: "external_write",
    riskLevel: "medium",
  },
  sdr: {
    approvalMode: "external_write",
    riskLevel: "medium",
  },
  social_media: {
    approvalMode: "external_write",
    riskLevel: "high",
  },
  task_coordinator: {
    allowedToolPacks: [...COMMON_TOOL_PACKS, "missions", "schedules"],
    approvalMode: "lead_review",
  },
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.toLowerCase()))).sort();
}

function defaultRiskLevel(
  department: AgentDepartment,
  slug: AgentSlug
): AgentRiskLevel {
  if (CRITICAL_AGENT_SLUGS.has(slug)) {
    return "critical";
  }
  if (HIGH_RISK_DEPARTMENTS.has(department)) {
    return "high";
  }
  return "medium";
}

function defaultApprovalMode(
  department: AgentDepartment,
  riskLevel: AgentRiskLevel
): AgentApprovalMode {
  if (department === "finance" || department === "legal_compliance") {
    return "financial_or_legal";
  }
  if (riskLevel === "critical") {
    return "user_approval";
  }
  if (riskLevel === "high") {
    return "lead_review";
  }
  return "external_write";
}

function defaultToolPacks(department: AgentDepartment): AgentToolPack[] {
  const packs: AgentToolPack[] = [...COMMON_TOOL_PACKS, "composio"];
  if (department === "engineering" || department === "security") {
    packs.push("sandbox", "cloud", "database");
  }
  if (department === "legal_compliance") {
    packs.push("legal");
  }
  if (department === "content_creative" || department === "marketing") {
    packs.push("media_generation");
  }
  if (department === "executive_ops") {
    packs.push("schedules", "missions");
  }
  if (department === "customer_service") {
    packs.push("twilio");
  }
  return Array.from(new Set(packs));
}

export function buildAgentManifest(
  definition: SubAgentDefinition
): AgentManifest {
  const department =
    definition.department ?? getAgentDepartment(definition.slug);
  const override = AGENT_OVERRIDES[definition.slug] ?? {};
  const riskLevel =
    override.riskLevel ?? defaultRiskLevel(department, definition.slug);

  return {
    allowedComposioToolkits: unique(
      override.allowedComposioToolkits ??
        DEPARTMENT_TOOLKITS[department] ??
        DEPARTMENT_TOOLKITS.general
    ),
    allowedToolPacks: override.allowedToolPacks ?? defaultToolPacks(department),
    approvalMode:
      override.approvalMode ?? defaultApprovalMode(department, riskLevel),
    department,
    departmentLeadSlug: getDepartmentLeadSlug(department),
    escalationTriggers: [
      "irreversible external action",
      "money movement or pricing commitment",
      "legal, compliance, privacy, or security impact",
      "production infrastructure mutation",
      "uncertain facts with user-visible consequences",
    ],
    memoryPolicy: {
      canReadUserMemory: true,
      canWriteUserMemory: riskLevel !== "critical",
      canWriteDepartmentMemory: true,
      retention: riskLevel === "critical" ? "ephemeral" : "department",
    },
    outputFields: CORE_OUTPUT_FIELDS,
    riskLevel,
    slug: definition.slug,
    successCriteria: override.successCriteria ?? [
      "Complete the requested task or state the blocker precisely.",
      "Use evidence from tools, memory, or cited source material when making factual claims.",
      "State assumptions, risks, and approval needs before any external side effect.",
      "Return one synthesized result, not a raw dump of intermediate work.",
    ],
  };
}

export function buildManifestSystemSection(manifest: AgentManifest): string {
  return `## Production Agent Contract

Risk level: ${manifest.riskLevel}
Approval mode: ${manifest.approvalMode}
Allowed internal tool packs: ${manifest.allowedToolPacks.join(", ")}
Allowed external toolkits: ${manifest.allowedComposioToolkits.join(", ")}
Memory policy: read user memory=${manifest.memoryPolicy.canReadUserMemory}; write user memory=${manifest.memoryPolicy.canWriteUserMemory}; write department memory=${manifest.memoryPolicy.canWriteDepartmentMemory}; retention=${manifest.memoryPolicy.retention}

Success criteria:
${manifest.successCriteria.map((criterion) => `- ${criterion}`).join("\n")}

Escalate or request approval when any of these apply:
${manifest.escalationTriggers.map((trigger) => `- ${trigger}`).join("\n")}

Final response contract:
Include concise sections for ${manifest.outputFields.join(", ")}. If a field is not applicable, say "none" rather than omitting it.`;
}

export function filterComposioToolsForManifest(
  tools: Record<string, unknown>,
  manifest: AgentManifest
): Record<string, unknown> {
  const allowed = new Set(manifest.allowedComposioToolkits);
  const scoped: Record<string, unknown> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    const normalized = name.toLowerCase();
    const compactName = normalized.replace(/[^a-z0-9]/g, "");
    const isAllowed = Array.from(allowed).some((toolkit) => {
      const compactToolkit = toolkit.replace(/[^a-z0-9]/g, "");
      return (
        compactName.startsWith(compactToolkit) ||
        compactName.includes(`${compactToolkit}tool`)
      );
    });
    if (isAllowed) {
      scoped[name] = toolDef;
    }
  }

  return scoped;
}

function toolPackForInternalTool(toolName: string): AgentToolPack | "utility" {
  if (
    [
      "spawnChildAgent",
      "waitForChildAgents",
      "getCollaborationStatus",
    ].includes(toolName)
  ) {
    return "a2a";
  }
  if (toolName.includes("Scratchpad")) {
    return "scratchpad";
  }
  if (["getWeather"].includes(toolName)) {
    return "search";
  }
  if (toolName.includes("DepartmentMemory")) {
    return "department_memory";
  }
  if (toolName.includes("Memory")) {
    return "memory";
  }
  if (toolName.includes("Mission")) {
    return "missions";
  }
  if (
    toolName.includes("Schedule") ||
    toolName.includes("Reminder") ||
    toolName.includes("CronJob")
  ) {
    return "schedules";
  }
  if (toolName.includes("Knowledge")) {
    return "knowledge_graph";
  }
  if (
    toolName.includes("Goal") ||
    ["listGoals", "addGoal", "updateGoal", "deleteGoal"].includes(toolName)
  ) {
    return "goals";
  }
  if (toolName.includes("Plan")) {
    return "planner";
  }
  if (toolName.startsWith("tavily")) {
    return "search";
  }
  if (toolName.startsWith("wiki") || toolName === "readAgentSkill") {
    return "wiki";
  }
  if (
    toolName.startsWith("generateImage") ||
    toolName.startsWith("generateVideo")
  ) {
    return "media_generation";
  }
  if (
    toolName.includes("Sandbox") ||
    [
      "executeCommand",
      "runCode",
      "listFiles",
      "readFile",
      "writeFile",
      "createDirectory",
      "searchFiles",
      "replaceInFiles",
      "gitClone",
      "gitStatus",
      "gitCommit",
      "gitPush",
      "gitPull",
      "gitBranch",
      "getPreviewLink",
      "runBackgroundProcess",
      "lspDiagnostics",
      "archiveSandbox",
    ].includes(toolName)
  ) {
    return "sandbox";
  }
  if (toolName.startsWith("browser")) {
    return "browser";
  }
  if (
    toolName.startsWith("aws") ||
    toolName.startsWith("gcp") ||
    toolName.startsWith("azure")
  ) {
    return "cloud";
  }
  if (
    toolName.startsWith("postgres") ||
    toolName.startsWith("mysql") ||
    toolName.startsWith("mongodb")
  ) {
    return "database";
  }
  if (toolName.includes("Contract") || toolName.startsWith("legal")) {
    return "legal";
  }
  if (toolName.startsWith("twilio")) {
    return "twilio";
  }
  return "utility";
}

export function filterInternalToolsForManifest(
  tools: Record<string, unknown>,
  manifest: AgentManifest
): Record<string, unknown> {
  const allowedPacks = new Set(manifest.allowedToolPacks);
  const scoped: Record<string, unknown> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    const pack = toolPackForInternalTool(name);
    if (pack === "utility" || allowedPacks.has(pack)) {
      scoped[name] = toolDef;
    }
  }

  return scoped;
}
