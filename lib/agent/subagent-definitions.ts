/**
//lib/agent/subagent-definitions.ts
 * Sub-agent definitions split into modular domain-specific registry files.
 * Each agent has: slug, name, description, system prompt, and Composio toolkit hints.
 */

import type { AgentDepartment } from "./departments";
import { registryAgents as coreAgents } from "./registry/core";
import { registryAgents as creativeDesignAgents } from "./registry/creative-design";
import { registryAgents as departmentLeads } from "./registry/department-leads";
import { registryAgents as devOpsQaAgents } from "./registry/dev-ops-qa";
import { registryAgents as expansionAgents } from "./registry/expansion";
import { registryAgents as financeLegalAgents } from "./registry/finance-legal";
import { registryAgents as hrPeopleAgents } from "./registry/hr-people";
import { registryAgents as marketingGrowthAgents } from "./registry/marketing-growth";
import { registryAgents as productStrategyAgents } from "./registry/product-strategy";
import { registryAgents as securityComplianceAgents } from "./registry/security-compliance";
import { registryAgents as supportServicesAgents } from "./registry/support-services";

export type AgentSlug =
  | "inbox_operator"
  | "sdr"
  | "chief_of_staff"
  | "project_manager"
  | "social_media"
  | "hiring"
  | "finance"
  | "competitive_intel"
  | "customer_success"
  | "personal_admin"
  | "incident_response"
  | "stripe_churn"
  | "code_review"
  | "cloud_cost"
  | "product_analytics"
  | "contractor_payment"
  | "legal_operator"
  | "brand_monitor"
  | "revenue_forecasting"
  | "docs_keeper"
  | "investor_relations"
  | "product_hunt_launcher"
  | "growth_hacker"
  | "community_manager"
  | "demo_closer"
  | "onboarding_specialist"
  | "sandbox_specialist"
  | "browser_operator"
  | "cinematic_director"
  | "visual_designer"
  | "task_coordinator"
  | "data_engineer"
  | "security_operator"
  | "customer_researcher"
  | "ecommerce_operator"
  | "ads_manager"
  | "event_planner"
  | "procurement_operator"
  | "qa_tester"
  | "knowledge_librarian"
  | "travel_concierge"
  | "employee_engagement"
  | "performance_tracker"
  | "onboarding_buddy"
  | "product_strategist"
  | "ux_researcher"
  | "pricing_optimizer"
  | "compliance_officer"
  | "privacy_guardian"
  | "ai_model_operator"
  | "tax_treasury"
  | "documentation_writer"
  | "revops_control_tower"
  | "international_ops"
  | "strategy_ops"
  | "pricing_packaging"
  | "launch_readiness"
  | "knowledge_architect"
  | "partner_ecosystem"
  | "content_ops"
  | "executive_comms"
  | "customer_voice_intelligence"
  | "deal_desk"
  | "people_analytics"
  | "ai_governance"
  | "vendor_risk"
  | "executive_lead"
  | "product_lead"
  | "analytics_lead"
  | "supply_chain_lead"
  | "partnerships_lead"
  | "pr_comms_specialist"
  | "seo_content_strategist"
  | "devops_infra_architect"
  | "fpa_analyst"
  | "ai_governance_officer"
  | "customer_retention_specialist"
  | "compensation_benefits_specialist"
  | "security_lead"
  | "finance_lead"
  | "marketing_lead"
  | "sales_lead"
  | "customer_service_lead"
  | "engineering_lead"
  | "operations_lead"
  | "legal_compliance_lead"
  | "hr_people_lead"
  | "growth_analytics_lead"
  | "content_creative_lead"
  | "research_strategy_lead"
  // ── Supply Chain & E-Commerce ──
  | "logistics_coordinator"
  | "warehouse_operator"
  | "inventory_forecaster"
  | "threepl_manager"
  // ── Partnerships & Alliances ──
  | "channel_manager"
  | "tech_alliances_manager"
  | "co_marketing_specialist"
  // ── Security (additional) ──
  | "soc_analyst"
  | "pen_tester"
  | "incident_commander"
  // ── IT / Internal Ops ──
  | "it_support"
  | "access_manager"
  | "asset_tracker"
  // ── Data / ML ──
  | "ml_engineer"
  | "data_scientist";

export interface SubAgentDefinition {
  department?: AgentDepartment;
  departmentLeadSlug?: string;
  description: string;
  name: string;
  slug: AgentSlug;
  systemPrompt: string;
  toolkits: string[];
}

const UNIVERSAL_COMPOSIO_TOOLKITS = [
  "gmail",
  "outlook",
  "slack",
  "googledrive",
  "googlecalendar",
  "googlesheets",
  "notion",
  "airtable",
  "github",
  "linear",
  "jira",
  "asana",
  "clickup",
  "hubspot",
  "salesforce",
  "pipedrive",
  "zapier",
  "webhook",
];

const AGENT_TOOLKIT_EXPANSIONS: Partial<Record<AgentSlug, string[]>> = {
  inbox_operator: [
    "intercom",
    "zendesk",
    "front",
    "microsoftteams",
    "discord",
    "twilio",
  ],
  sdr: ["apollo", "hunter", "clearbit", "zoominfo", "outreach", "salesloft"],
  chief_of_staff: [
    "microsoftteams",
    "calendly",
    "todoist",
    "trello",
    "confluence",
  ],
  project_manager: [
    "trello",
    "monday",
    "basecamp",
    "confluence",
    "microsoftteams",
  ],
  social_media: [
    "instagram",
    "facebook",
    "youtube",
    "tiktok",
    "buffer",
    "hootsuite",
  ],
  hiring: ["greenhouse", "lever", "workable", "ashby", "bamboohr", "calendly"],
  finance: ["plaid", "brex", "ramp", "expensify", "netsuite", "freshbooks"],
  competitive_intel: [
    "crunchbase",
    "semrush",
    "similarweb",
    "googleanalytics",
    "reddit",
    "youtube",
  ],
  customer_success: [
    "intercom",
    "zendesk",
    "freshdesk",
    "helpscout",
    "stripe",
    "chargebee",
  ],
  personal_admin: [
    "todoist",
    "trello",
    "calendly",
    "uber",
    "airbnb",
    "expensify",
  ],
  incident_response: [
    "pagerduty",
    "opsgenie",
    "statuspage",
    "cloudflare",
    "aws",
    "gcp",
    "azure",
  ],
  stripe_churn: [
    "chargebee",
    "recurly",
    "intercom",
    "zendesk",
    "posthog",
    "segment",
  ],
  code_review: [
    "snyk",
    "sonarqube",
    "bitbucket",
    "circleci",
    "githubactions",
    "sentry",
  ],
  cloud_cost: [
    "datadog",
    "grafana",
    "pagerduty",
    "snowflake",
    "bigquery",
    "postgres",
  ],
  product_analytics: [
    "posthog",
    "heap",
    "looker",
    "metabase",
    "bigquery",
    "snowflake",
  ],
  contractor_payment: [
    "deel",
    "remote",
    "gusto",
    "bamboohr",
    "expensify",
    "docusign",
  ],
  legal_operator: [
    "hellosign",
    "dropbox",
    "box",
    "clio",
    "ironclad",
    "googleforms",
  ],
  brand_monitor: [
    "reddit",
    "youtube",
    "instagram",
    "facebook",
    "googleanalytics",
    "semrush",
  ],
  revenue_forecasting: [
    "looker",
    "metabase",
    "bigquery",
    "snowflake",
    "chargebee",
    "recurly",
  ],
  docs_keeper: ["confluence", "dropbox", "box", "webflow", "github", "gitlab"],
  investor_relations: [
    "docsend",
    "dropbox",
    "box",
    "crunchbase",
    "pitchbook",
    "mailchimp",
  ],
  product_hunt_launcher: [
    "producthunt",
    "reddit",
    "discord",
    "mailchimp",
    "buffer",
    "youtube",
  ],
  growth_hacker: [
    "googleads",
    "facebookads",
    "linkedinads",
    "semrush",
    "ahrefs",
    "webflow",
  ],
  community_manager: [
    "discord",
    "telegram",
    "reddit",
    "microsoftteams",
    "intercom",
    "zendesk",
  ],
  demo_closer: [
    "zoom",
    "googlemeet",
    "microsoftteams",
    "loom",
    "salesforce",
    "stripe",
  ],
  onboarding_specialist: [
    "intercom",
    "zendesk",
    "calendly",
    "googleforms",
    "typeform",
    "loom",
  ],
  sandbox_specialist: [
    "e2b",
    "replit",
    "github",
    "gitlab",
    "vercel",
    "netlify",
  ],
  browser_operator: [
    "browser_use",
    "daytona_browser",
    "tavily",
    "apify",
    "firecrawl",
  ],
  cinematic_director: ["youtube", "vimeo", "dropbox", "box", "figma", "canva"],
  visual_designer: ["figma", "canva", "webflow", "framer", "dropbox", "box"],
  task_coordinator: [
    "microsoftteams",
    "todoist",
    "trello",
    "confluence",
    "zapier",
  ],
  data_engineer: [
    "postgres",
    "mysql",
    "snowflake",
    "bigquery",
    "mongodb",
    "supabase",
  ],
  security_operator: ["snyk", "sonarqube", "cloudflare", "aws", "gcp", "azure"],
  customer_researcher: [
    "intercom",
    "zendesk",
    "typeform",
    "googleforms",
    "posthog",
    "amplitude",
  ],
  ecommerce_operator: [
    "shopify",
    "woocommerce",
    "stripe",
    "paypal",
    "klaviyo",
    "mailchimp",
  ],
  ads_manager: [
    "googleads",
    "facebookads",
    "linkedinads",
    "tiktok",
    "googleanalytics",
    "semrush",
  ],
  event_planner: [
    "eventbrite",
    "zoom",
    "googlemeet",
    "microsoftteams",
    "mailchimp",
    "typeform",
  ],
  procurement_operator: [
    "quickbooks",
    "xero",
    "netsuite",
    "ramp",
    "brex",
    "docusign",
  ],
  qa_tester: ["github", "gitlab", "linear", "jira", "sentry", "browser_use"],
  knowledge_librarian: [
    "confluence",
    "dropbox",
    "box",
    "airtable",
    "webflow",
    "github",
  ],
  travel_concierge: [
    "airbnb",
    "uber",
    "googlemaps",
    "expensify",
    "tripadvisor",
    "googlecalendar",
  ],
  employee_engagement: [
    "slack",
    "microsoftteams",
    "googlecalendar",
    "typeform",
  ],
  performance_tracker: ["jira", "linear", "github", "notion", "googlesheets"],
  onboarding_buddy: [
    "gmail",
    "slack",
    "bamboohr",
    "googledrive",
    "calendly",
    "notion",
  ],
  product_strategist: [
    "notion",
    "confluence",
    "jira",
    "linear",
    "googledocs",
    "googlesheets",
  ],
  ux_researcher: ["posthog", "figma", "notion", "googlesheets", "googledrive"],
  pricing_optimizer: [
    "stripe",
    "chargebee",
    "looker",
    "metabase",
    "googlesheets",
    "semrush",
  ],
  compliance_officer: [
    "aws",
    "gcp",
    "azure",
    "github",
    "jira",
    "slack",
    "notion",
  ],
  privacy_guardian: [
    "postgres",
    "mysql",
    "mongodb",
    "bigquery",
    "zendesk",
    "intercom",
    "notion",
  ],
  ai_model_operator: [
    "datadog",
    "grafana",
    "sentry",
    "googlesheets",
    "slack",
    "notion",
  ],
  tax_treasury: [
    "quickbooks",
    "xero",
    "netsuite",
    "stripe",
    "deel",
    "ramp",
    "brex",
    "googlesheets",
  ],
  documentation_writer: [
    "intercom",
    "zendesk",
    "helpscout",
    "notion",
    "confluence",
    "slack",
    "gmail",
  ],
  revops_control_tower: [
    "hubspot",
    "salesforce",
    "stripe",
    "segment",
    "posthog",
    "amplitude",
    "mixpanel",
    "gong",
    "clearbit",
    "zoominfo",
  ],
  international_ops: [
    "hubspot",
    "salesforce",
    "stripe",
    "zendesk",
    "intercom",
    "docusign",
    "googletranslate",
  ],
  strategy_ops: [
    "notion",
    "confluence",
    "jira",
    "linear",
    "googledocs",
    "googlesheets",
    "hubspot",
    "salesforce",
    "docsend",
  ],
  pricing_packaging: [
    "stripe",
    "chargebee",
    "recurly",
    "hubspot",
    "salesforce",
    "amplitude",
    "mixpanel",
    "posthog",
  ],
  launch_readiness: [
    "jira",
    "linear",
    "asana",
    "clickup",
    "notion",
    "figma",
    "airtable",
  ],
  knowledge_architect: [
    "notion",
    "confluence",
    "googledrive",
    "dropbox",
    "box",
    "github",
    "jira",
    "linear",
    "loom",
  ],
  partner_ecosystem: [
    "hubspot",
    "salesforce",
    "partnerstack",
    "zoom",
    "docusign",
    "airtable",
  ],
  content_ops: [
    "notion",
    "figma",
    "canva",
    "youtube",
    "vimeo",
    "buffer",
    "hootsuite",
    "airtable",
  ],
  executive_comms: [
    "gmail",
    "outlook",
    "notion",
    "googledocs",
    "googlesheets",
    "docsend",
    "hubspot",
    "salesforce",
    "stripe",
  ],
  customer_voice_intelligence: [
    "intercom",
    "zendesk",
    "helpscout",
    "posthog",
    "amplitude",
    "mixpanel",
    "hubspot",
    "salesforce",
  ],
  deal_desk: [
    "salesforce",
    "hubspot",
    "stripe",
    "docusign",
    "pandadoc",
    "notion",
    "googlesheets",
  ],
  people_analytics: [
    "slack",
    "microsoftteams",
    "googlesheets",
    "notion",
    "bamboohr",
    "lattice",
    "zoom",
    "loom",
  ],
  ai_governance: [
    "github",
    "gitlab",
    "sentry",
    "datadog",
    "slack",
    "notion",
    "langfuse",
    "weightsandbiases",
  ],
  vendor_risk: [
    "notion",
    "slack",
    "googlesheets",
    "jira",
    "linear",
    "github",
    "docusign",
    "ramp",
    "brex",
  ],
  security_lead: [
    "1password",
    "bitwarden",
    "snyk",
    "cloudflare",
    "aws",
    "gcp",
    "azure",
  ],
  finance_lead: [
    "stripe",
    "quickbooks",
    "xero",
    "googlesheets",
    "plaid",
    "brex",
    "ramp",
  ],
  marketing_lead: [
    "mailchimp",
    "googleads",
    "facebookads",
    "linkedinads",
    "semrush",
    "ahrefs",
    "buffer",
  ],
  sales_lead: ["hubspot", "salesforce", "pipedrive", "calendly", "zoominfo"],
  customer_service_lead: [
    "zendesk",
    "intercom",
    "freshdesk",
    "helpscout",
    "slack",
  ],
  engineering_lead: ["github", "gitlab", "jira", "linear", "vercel", "sentry"],
  operations_lead: [
    "notion",
    "googlecalendar",
    "monday",
    "trello",
    "zapier",
    "jira",
  ],
  legal_compliance_lead: [
    "docusign",
    "hellosign",
    "clio",
    "googleforms",
    "docsend",
  ],
  hr_people_lead: ["greenhouse", "lever", "bamboohr", "lattice"],
  growth_analytics_lead: [
    "amplitude",
    "mixpanel",
    "posthog",
    "googleanalytics",
    "segment",
    "heap",
  ],
  content_creative_lead: [
    "figma",
    "canva",
    "notion",
    "youtube",
    "googleanalytics",
  ],
  research_strategy_lead: [
    "crunchbase",
    "semrush",
    "similarweb",
    "googleanalytics",
    "notion",
  ],
  logistics_coordinator: [
    "shopify",
    "woocommerce",
    "shipstation",
    "easyship",
    "shipbob",
    "googlecalendar",
    "slack",
  ],
  warehouse_operator: [
    "shopify",
    "woocommerce",
    "shipstation",
    "notion",
    "airtable",
    "slack",
  ],
  inventory_forecaster: [
    "googleanalytics",
    "postgres",
    "mysql",
    "bigquery",
    "googlesheets",
    "shopify",
    "woocommerce",
  ],
  threepl_manager: [
    "shipstation",
    "easyship",
    "shippo",
    "slack",
    "notion",
    "googlesheets",
    "stripe",
  ],
  channel_manager: [
    "hubspot",
    "salesforce",
    "pipedrive",
    "partnerstack",
    "zoom",
    "docusign",
    "gmail",
    "outlook",
    "notion",
  ],
  tech_alliances_manager: [
    "github",
    "gitlab",
    "slack",
    "notion",
    "confluence",
    "airtable",
    "googlecalendar",
  ],
  co_marketing_specialist: [
    "buffer",
    "hootsuite",
    "instagram",
    "facebook",
    "linkedin",
    "youtube",
    "notion",
    "googlesheets",
  ],
  soc_analyst: [
    "sentry",
    "datadog",
    "grafana",
    "pagerduty",
    "slack",
    "notion",
    "jira",
    "linear",
  ],
  pen_tester: [
    "github",
    "gitlab",
    "snyk",
    "sonarqube",
    "aws",
    "gcp",
    "azure",
    "jira",
    "linear",
  ],
  incident_commander: [
    "pagerduty",
    "opsgenie",
    "statuspage",
    "slack",
    "notion",
    "jira",
    "confluence",
    "aws",
    "gcp",
    "azure",
  ],
  it_support: [
    "zendesk",
    "intercom",
    "slack",
    "notion",
    "googlesheets",
    "airtable",
  ],
  access_manager: [
    "okta",
    "aws",
    "gcp",
    "azure",
    "notion",
    "googlesheets",
    "slack",
  ],
  asset_tracker: [
    "notion",
    "googlesheets",
    "airtable",
    "ramp",
    "brex",
    "slack",
  ],
  ml_engineer: [
    "github",
    "gitlab",
    "postgres",
    "mysql",
    "mongodb",
    "bigquery",
    "snowflake",
    "googlesheets",
    "sentry",
    "slack",
  ],
  data_scientist: [
    "postgres",
    "mysql",
    "mongodb",
    "bigquery",
    "snowflake",
    "metabase",
    "looker",
    "amplitude",
    "segment",
    "googlesheets",
  ],
};

function uniqueToolkits(toolkits: string[]): string[] {
  return Array.from(new Set(toolkits.map((toolkit) => toolkit.toLowerCase())));
}

function enrichToolkits(agent: SubAgentDefinition): SubAgentDefinition {
  return {
    ...agent,
    toolkits: uniqueToolkits([
      ...agent.toolkits,
      ...UNIVERSAL_COMPOSIO_TOOLKITS,
      ...(AGENT_TOOLKIT_EXPANSIONS[agent.slug] ?? []),
    ]),
  };
}

const BASE_SUBAGENT_DEFINITIONS: SubAgentDefinition[] = [
  ...(coreAgents as any),
  ...(financeLegalAgents as any),
  ...(marketingGrowthAgents as any),
  ...(devOpsQaAgents as any),
  ...(creativeDesignAgents as any),
  ...(supportServicesAgents as any),
  ...(hrPeopleAgents as any),
  ...(productStrategyAgents as any),
  ...(securityComplianceAgents as any),
  ...(departmentLeads as any),
  ...(expansionAgents as any),
];

export const SUBAGENT_DEFINITIONS: SubAgentDefinition[] =
  BASE_SUBAGENT_DEFINITIONS.map(enrichToolkits);

export function getSubAgentBySlug(
  slug: string
): SubAgentDefinition | undefined {
  return SUBAGENT_DEFINITIONS.find((a) => a.slug === slug);
}

export function getAllAgentSlugs(): AgentSlug[] {
  return SUBAGENT_DEFINITIONS.map((a) => a.slug);
}
