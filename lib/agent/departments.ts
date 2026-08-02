/**
 * Department groupings for sub-agent collaboration and shared memory.
 */

export type AgentDepartment =
  | "operations_it"
  | "sales"
  | "marketing"
  | "engineering"
  | "finance"
  | "customer_service"
  | "hr_people"
  | "growth_analytics"
  | "research_strategy"
  | "security"
  | "legal_compliance"
  | "content_creative"
  | "general";

const AGENT_DEPARTMENT_MAP: Record<string, AgentDepartment> = {
  inbox_operator: "operations_it",
  chief_of_staff: "operations_it",
  project_manager: "operations_it",
  personal_admin: "operations_it",
  task_coordinator: "operations_it",
  event_planner: "operations_it",
  travel_concierge: "operations_it",
  onboarding_specialist: "operations_it",
  international_ops: "operations_it",
  launch_readiness: "operations_it",
  knowledge_architect: "operations_it",
  operations_lead: "operations_it",

  sdr: "sales",
  demo_closer: "sales",
  competitive_intel: "sales",
  investor_relations: "sales",
  revenue_forecasting: "sales",
  deal_desk: "sales",
  revops_control_tower: "sales",
  partner_ecosystem: "sales",
  sales_lead: "sales",

  social_media: "marketing",
  growth_hacker: "marketing",
  brand_monitor: "marketing",
  ads_manager: "marketing",
  product_hunt_launcher: "marketing",
  community_manager: "marketing",
  marketing_lead: "marketing",

  code_review: "engineering",
  sandbox_specialist: "engineering",
  browser_operator: "engineering",
  data_engineer: "engineering",
  qa_tester: "engineering",
  incident_response: "engineering",
  cloud_cost: "engineering",
  ai_model_operator: "engineering",
  engineering_lead: "engineering",

  finance: "finance",
  contractor_payment: "finance",
  stripe_churn: "finance",
  tax_treasury: "finance",
  procurement_operator: "finance",
  pricing_optimizer: "finance",
  pricing_packaging: "finance",
  finance_lead: "finance",

  customer_success: "customer_service",
  customer_researcher: "customer_service",
  documentation_writer: "customer_service",
  knowledge_librarian: "customer_service",
  docs_keeper: "customer_service",
  executive_comms: "customer_service",
  customer_voice_intelligence: "customer_service",
  customer_service_lead: "customer_service",

  hiring: "hr_people",
  onboarding_buddy: "hr_people",
  employee_engagement: "hr_people",
  performance_tracker: "hr_people",
  hr_people_lead: "hr_people",

  product_analytics: "growth_analytics",
  people_analytics: "growth_analytics",
  growth_analytics_lead: "growth_analytics",

  product_strategist: "research_strategy",
  ux_researcher: "research_strategy",
  strategy_ops: "research_strategy",
  research_strategy_lead: "research_strategy",

  legal_operator: "legal_compliance",
  compliance_officer: "legal_compliance",
  privacy_guardian: "legal_compliance",
  vendor_risk: "legal_compliance",
  legal_compliance_lead: "legal_compliance",

  security_operator: "security",
  security_lead: "security",

  cinematic_director: "content_creative",
  visual_designer: "content_creative",
  ecommerce_operator: "content_creative",
  content_ops: "content_creative",
  content_creative_lead: "content_creative",
};

const DEPARTMENT_LEAD_SLUGS: Record<AgentDepartment, string | undefined> = {
  operations_it: "operations_lead",
  sales: "sales_lead",
  marketing: "marketing_lead",
  engineering: "engineering_lead",
  finance: "finance_lead",
  customer_service: "customer_service_lead",
  hr_people: "hr_people_lead",
  growth_analytics: "growth_analytics_lead",
  research_strategy: "research_strategy_lead",
  security: "security_lead",
  legal_compliance: "legal_compliance_lead",
  content_creative: "content_creative_lead",
  general: undefined,
};

export function getAgentDepartment(agentSlug: string): AgentDepartment {
  return AGENT_DEPARTMENT_MAP[agentSlug] ?? "general";
}

export function getDepartmentLeadSlug(department: AgentDepartment): string | undefined {
  return DEPARTMENT_LEAD_SLUGS[department];
}

export function getDepartmentLabel(department: AgentDepartment): string {
  switch (department) {
    case "operations_it":
      return "Operations & IT";
    case "customer_service":
      return "Customer Service";
    case "hr_people":
      return "HR & People";
    case "growth_analytics":
      return "Growth & Analytics";
    case "research_strategy":
      return "Research & Strategy";
    case "legal_compliance":
      return "Legal & Compliance";
    case "content_creative":
      return "Content & Creative";
    default:
      return department.charAt(0).toUpperCase() + department.slice(1);
  }
}
