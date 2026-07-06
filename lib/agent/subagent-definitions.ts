/**
//lib/agent/subagent-definitions.ts
 * 41 sub-agent definitions refactored into modular domain-specific files.
 * Each agent has: slug, name, description, system prompt, and Composio toolkit hints.
 */

import { registryAgents as coreAgents } from "./registry/core";
import { registryAgents as financeLegalAgents } from "./registry/finance-legal";
import { registryAgents as marketingGrowthAgents } from "./registry/marketing-growth";
import { registryAgents as devOpsQaAgents } from "./registry/dev-ops-qa";
import { registryAgents as creativeDesignAgents } from "./registry/creative-design";
import { registryAgents as supportServicesAgents } from "./registry/support-services";
import { registryAgents as hrPeopleAgents } from "./registry/hr-people";
import { registryAgents as productStrategyAgents } from "./registry/product-strategy";
import { registryAgents as securityComplianceAgents } from "./registry/security-compliance";


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
  | "documentation_writer";

export interface SubAgentDefinition {
  slug: AgentSlug;
  name: string;
  description: string;
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
  inbox_operator: ["intercom", "zendesk", "front", "microsoftteams", "discord", "twilio"],
  sdr: ["apollo", "hunter", "clearbit", "zoominfo", "outreach", "salesloft"],
  chief_of_staff: ["microsoftteams", "calendly", "todoist", "trello", "confluence"],
  project_manager: ["trello", "monday", "basecamp", "confluence", "microsoftteams"],
  social_media: ["instagram", "facebook", "youtube", "tiktok", "buffer", "hootsuite"],
  hiring: ["greenhouse", "lever", "workable", "ashby", "bamboohr", "calendly"],
  finance: ["plaid", "brex", "ramp", "expensify", "netsuite", "freshbooks"],
  competitive_intel: ["crunchbase", "semrush", "similarweb", "googleanalytics", "reddit", "youtube"],
  customer_success: ["intercom", "zendesk", "freshdesk", "helpscout", "stripe", "chargebee"],
  personal_admin: ["todoist", "trello", "calendly", "uber", "airbnb", "expensify"],
  incident_response: ["pagerduty", "opsgenie", "statuspage", "cloudflare", "aws", "gcp", "azure"],
  stripe_churn: ["chargebee", "recurly", "intercom", "zendesk", "posthog", "segment"],
  code_review: ["snyk", "sonarqube", "bitbucket", "circleci", "githubactions", "sentry"],
  cloud_cost: ["datadog", "grafana", "pagerduty", "snowflake", "bigquery", "postgres"],
  product_analytics: ["posthog", "heap", "looker", "metabase", "bigquery", "snowflake"],
  contractor_payment: ["deel", "remote", "gusto", "bamboohr", "expensify", "docusign"],
  legal_operator: ["hellosign", "dropbox", "box", "clio", "ironclad", "googleforms"],
  brand_monitor: ["reddit", "youtube", "instagram", "facebook", "googleanalytics", "semrush"],
  revenue_forecasting: ["looker", "metabase", "bigquery", "snowflake", "chargebee", "recurly"],
  docs_keeper: ["confluence", "dropbox", "box", "webflow", "github", "gitlab"],
  investor_relations: ["docsend", "dropbox", "box", "crunchbase", "pitchbook", "mailchimp"],
  product_hunt_launcher: ["producthunt", "reddit", "discord", "mailchimp", "buffer", "youtube"],
  growth_hacker: ["googleads", "facebookads", "linkedinads", "semrush", "ahrefs", "webflow"],
  community_manager: ["discord", "telegram", "reddit", "microsoftteams", "intercom", "zendesk"],
  demo_closer: ["zoom", "googlemeet", "microsoftteams", "loom", "salesforce", "stripe"],
  onboarding_specialist: ["intercom", "zendesk", "calendly", "googleforms", "typeform", "loom"],
  sandbox_specialist: ["e2b", "replit", "github", "gitlab", "vercel", "netlify"],
  browser_operator: ["browser_use", "daytona_browser", "tavily", "apify", "firecrawl"],
  cinematic_director: ["youtube", "vimeo", "dropbox", "box", "figma", "canva"],
  visual_designer: ["figma", "canva", "webflow", "framer", "dropbox", "box"],
  task_coordinator: ["microsoftteams", "todoist", "trello", "confluence", "zapier"],
  data_engineer: ["postgres", "mysql", "snowflake", "bigquery", "mongodb", "supabase"],
  security_operator: ["snyk", "sonarqube", "cloudflare", "aws", "gcp", "azure"],
  customer_researcher: ["intercom", "zendesk", "typeform", "googleforms", "posthog", "amplitude"],
  ecommerce_operator: ["shopify", "woocommerce", "stripe", "paypal", "klaviyo", "mailchimp"],
  ads_manager: ["googleads", "facebookads", "linkedinads", "tiktok", "googleanalytics", "semrush"],
  event_planner: ["eventbrite", "zoom", "googlemeet", "microsoftteams", "mailchimp", "typeform"],
  procurement_operator: ["quickbooks", "xero", "netsuite", "ramp", "brex", "docusign"],
  qa_tester: ["github", "gitlab", "linear", "jira", "sentry", "browser_use"],
  knowledge_librarian: ["confluence", "dropbox", "box", "airtable", "webflow", "github"],
  travel_concierge: ["airbnb", "uber", "googlemaps", "expensify", "tripadvisor", "googlecalendar"],
  employee_engagement: ["slack", "microsoftteams", "googlecalendar", "typeform"],
  performance_tracker: ["jira", "linear", "github", "notion", "googlesheets"],
  onboarding_buddy: ["gmail", "slack", "bamboohr", "googledrive", "calendly", "notion"],
  product_strategist: ["notion", "confluence", "jira", "linear", "googledocs", "googlesheets"],
  ux_researcher: ["posthog", "figma", "notion", "googlesheets", "googledrive"],
  pricing_optimizer: ["stripe", "chargebee", "looker", "metabase", "googlesheets", "semrush"],
  compliance_officer: ["aws", "gcp", "azure", "github", "jira", "slack", "notion"],
  privacy_guardian: ["postgres", "mysql", "mongodb", "bigquery", "zendesk", "intercom", "notion"],
  ai_model_operator: ["datadog", "grafana", "sentry", "googlesheets", "slack", "notion"],
  tax_treasury: ["quickbooks", "xero", "netsuite", "stripe", "deel", "ramp", "brex", "googlesheets"],
  documentation_writer: ["intercom", "zendesk", "helpscout", "notion", "confluence", "slack", "gmail"],
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
];

export const SUBAGENT_DEFINITIONS: SubAgentDefinition[] =
  BASE_SUBAGENT_DEFINITIONS.map(enrichToolkits);

export function getSubAgentBySlug(slug: string): SubAgentDefinition | undefined {
  return SUBAGENT_DEFINITIONS.find((a) => a.slug === slug);
}

export function getAllAgentSlugs(): AgentSlug[] {
  return SUBAGENT_DEFINITIONS.map((a) => a.slug);
}
