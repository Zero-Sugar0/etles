/**
 * Department groupings for sub-agent collaboration and shared memory.
 */

export type AgentDepartment =
  | "operations"
  | "sales"
  | "marketing"
  | "engineering"
  | "finance"
  | "support"
  | "hr"
  | "product"
  | "security"
  | "creative"
  | "general";

const AGENT_DEPARTMENT_MAP: Record<string, AgentDepartment> = {
  inbox_operator: "operations",
  chief_of_staff: "operations",
  project_manager: "operations",
  personal_admin: "operations",
  task_coordinator: "operations",
  event_planner: "operations",
  travel_concierge: "operations",

  sdr: "sales",
  demo_closer: "sales",
  competitive_intel: "sales",
  investor_relations: "sales",
  revenue_forecasting: "sales",

  social_media: "marketing",
  growth_hacker: "marketing",
  brand_monitor: "marketing",
  ads_manager: "marketing",
  product_hunt_launcher: "marketing",
  community_manager: "marketing",

  code_review: "engineering",
  sandbox_specialist: "engineering",
  browser_operator: "engineering",
  data_engineer: "engineering",
  qa_tester: "engineering",
  incident_response: "engineering",
  cloud_cost: "engineering",
  ai_model_operator: "engineering",

  finance: "finance",
  contractor_payment: "finance",
  stripe_churn: "finance",
  tax_treasury: "finance",
  procurement_operator: "finance",
  pricing_optimizer: "finance",

  customer_success: "support",
  customer_researcher: "support",
  documentation_writer: "support",
  knowledge_librarian: "support",
  docs_keeper: "support",

  hiring: "hr",
  onboarding_buddy: "hr",
  employee_engagement: "hr",
  performance_tracker: "hr",

  product_analytics: "product",
  product_strategist: "product",
  ux_researcher: "product",
  onboarding_specialist: "general",

  legal_operator: "security",
  compliance_officer: "security",
  privacy_guardian: "security",
  security_operator: "security",

  cinematic_director: "creative",
  visual_designer: "creative",
  ecommerce_operator: "creative",
};

export function getAgentDepartment(agentSlug: string): AgentDepartment {
  return AGENT_DEPARTMENT_MAP[agentSlug] ?? "general";
}

export function getDepartmentLabel(department: AgentDepartment): string {
  return department.charAt(0).toUpperCase() + department.slice(1);
}
