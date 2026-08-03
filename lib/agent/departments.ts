/**
 * Department groupings for sub-agent collaboration and shared memory.
 * Expanded to 14 core business functions for end-to-end autonomous organization management.
 */

export type AgentDepartment =
  | "executive_ops"
  | "sales"
  | "marketing"
  | "engineering"
  | "product"
  | "finance"
  | "customer_service"
  | "hr_people"
  | "growth_analytics"
  | "research_strategy"
  | "security"
  | "legal_compliance"
  | "content_creative"
  | "supply_chain_ecommerce"
  | "partnerships_alliances"
  | "general";

const AGENT_DEPARTMENT_MAP: Record<string, AgentDepartment> = {
  // Executive & Operations
  chief_of_staff: "executive_ops",
  inbox_operator: "executive_ops",
  project_manager: "executive_ops",
  personal_admin: "executive_ops",
  task_coordinator: "executive_ops",
  event_planner: "executive_ops",
  travel_concierge: "executive_ops",
  onboarding_specialist: "executive_ops",
  international_ops: "executive_ops",
  launch_readiness: "executive_ops",
  knowledge_architect: "executive_ops",
  operations_lead: "executive_ops",
  executive_lead: "executive_ops",

  // Sales & Revenue
  sdr: "sales",
  demo_closer: "sales",
  competitive_intel: "sales",
  investor_relations: "sales",
  revenue_forecasting: "sales",
  deal_desk: "sales",
  revops_control_tower: "sales",
  partner_ecosystem: "sales",
  sales_lead: "sales",

  // Marketing & Growth
  social_media: "marketing",
  growth_hacker: "marketing",
  brand_monitor: "marketing",
  ads_manager: "marketing",
  product_hunt_launcher: "marketing",
  community_manager: "marketing",
  pr_comms_specialist: "marketing",
  seo_content_strategist: "marketing",
  marketing_lead: "marketing",

  // Engineering & Infrastructure
  code_review: "engineering",
  sandbox_specialist: "engineering",
  browser_operator: "engineering",
  data_engineer: "engineering",
  devops_infra_architect: "engineering",
  qa_tester: "engineering",
  incident_response: "engineering",
  cloud_cost: "engineering",
  ai_model_operator: "engineering",
  engineering_lead: "engineering",

  // Product & User Experience
  product_strategist: "product",
  ux_researcher: "product",
  pricing_packaging: "product",
  product_lead: "product",

  // Finance & Accounting
  finance: "finance",
  contractor_payment: "finance",
  stripe_churn: "finance",
  tax_treasury: "finance",
  procurement_operator: "finance",
  pricing_optimizer: "finance",
  fpa_analyst: "finance",
  finance_lead: "finance",

  // Customer Success & CX
  customer_success: "customer_service",
  customer_researcher: "customer_service",
  documentation_writer: "customer_service",
  knowledge_librarian: "customer_service",
  docs_keeper: "customer_service",
  executive_comms: "customer_service",
  customer_voice_intelligence: "customer_service",
  customer_retention_specialist: "customer_service",
  customer_service_lead: "customer_service",

  // HR & People
  hiring: "hr_people",
  onboarding_buddy: "hr_people",
  employee_engagement: "hr_people",
  performance_tracker: "hr_people",
  compensation_benefits_specialist: "hr_people",
  hr_people_lead: "hr_people",

  // Growth & Analytics
  product_analytics: "growth_analytics",
  people_analytics: "growth_analytics",
  analytics_lead: "growth_analytics",
  growth_analytics_lead: "growth_analytics",

  // Research & Strategy
  strategy_ops: "research_strategy",
  research_strategy_lead: "research_strategy",

  // Legal & Compliance
  legal_operator: "legal_compliance",
  compliance_officer: "legal_compliance",
  privacy_guardian: "legal_compliance",
  vendor_risk: "legal_compliance",
  ai_governance_officer: "legal_compliance",
  legal_compliance_lead: "legal_compliance",

  // Security
  security_operator: "security",
  security_lead: "security",

  // Content & Creative
  cinematic_director: "content_creative",
  visual_designer: "content_creative",
  ecommerce_operator: "content_creative",
  content_ops: "content_creative",
  content_creative_lead: "content_creative",

  // Supply Chain & E-commerce
  supply_chain_lead: "supply_chain_ecommerce",

  // Partnerships & Alliances
  partnerships_lead: "partnerships_alliances",
};

const DEPARTMENT_LEAD_SLUGS: Record<AgentDepartment, string | undefined> = {
  executive_ops: "executive_lead",
  sales: "sales_lead",
  marketing: "marketing_lead",
  engineering: "engineering_lead",
  product: "product_lead",
  finance: "finance_lead",
  customer_service: "customer_service_lead",
  hr_people: "hr_people_lead",
  growth_analytics: "analytics_lead",
  research_strategy: "research_strategy_lead",
  security: "security_lead",
  legal_compliance: "legal_compliance_lead",
  content_creative: "content_creative_lead",
  supply_chain_ecommerce: "supply_chain_lead",
  partnerships_alliances: "partnerships_lead",
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
    case "executive_ops":
      return "Executive & Operations";
    case "sales":
      return "Sales & Revenue";
    case "marketing":
      return "Marketing & Brand";
    case "engineering":
      return "Engineering & Infrastructure";
    case "product":
      return "Product & Design";
    case "finance":
      return "Finance & Accounting";
    case "customer_service":
      return "Customer Success & CX";
    case "hr_people":
      return "HR & Talent";
    case "growth_analytics":
      return "Data & Analytics";
    case "research_strategy":
      return "Research & Strategy";
    case "legal_compliance":
      return "Legal & Compliance";
    case "security":
      return "Security & Trust";
    case "content_creative":
      return "Content & Studio";
    case "supply_chain_ecommerce":
      return "Supply Chain & E-Commerce";
    case "partnerships_alliances":
      return "Partnerships & Alliances";
    default:
      return department.charAt(0).toUpperCase() + department.slice(1);
  }
}
