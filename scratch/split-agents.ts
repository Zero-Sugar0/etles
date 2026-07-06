import fs from "fs";
import path from "path";
// Import from the built subagent definitions (requires tsx execution)
import { SUBAGENT_DEFINITIONS } from "../lib/agent/subagent-definitions";

const registryDir = path.join(process.cwd(), "lib", "agent", "registry");
if (!fs.existsSync(registryDir)) {
  fs.mkdirSync(registryDir, { recursive: true });
}

// Slugs mapping to domain-specific files
const domainMapping: Record<string, string[]> = {
  "core.ts": [
    "inbox_operator",
    "sdr",
    "chief_of_staff",
    "project_manager",
    "personal_admin",
    "task_coordinator",
    "onboarding_specialist"
  ],
  "finance-legal.ts": [
    "finance",
    "contractor_payment",
    "legal_operator",
    "revenue_forecasting",
    "procurement_operator",
    "investor_relations",
    "stripe_churn"
  ],
  "marketing-growth.ts": [
    "social_media",
    "brand_monitor",
    "product_hunt_launcher",
    "growth_hacker",
    "community_manager",
    "ads_manager",
    "event_planner",
    "competitive_intel"
  ],
  "dev-ops-qa.ts": [
    "code_review",
    "cloud_cost",
    "product_analytics",
    "sandbox_specialist",
    "browser_operator",
    "data_engineer",
    "security_operator",
    "qa_tester",
    "incident_response"
  ],
  "creative-design.ts": [
    "cinematic_director",
    "visual_designer"
  ],
  "support-services.ts": [
    "customer_success",
    "demo_closer",
    "customer_researcher",
    "knowledge_librarian",
    "travel_concierge",
    "ecommerce_operator",
    "docs_keeper"
  ]
};

// Check if any agent is missing a domain and place in core.ts as fallback
const processedSlugs = new Set<string>();
for (const file in domainMapping) {
  for (const slug of domainMapping[file]) {
    processedSlugs.add(slug);
  }
}

for (const agent of SUBAGENT_DEFINITIONS) {
  if (!processedSlugs.has(agent.slug)) {
    console.log(`Unassigned slug [${agent.slug}] defaulting to core.ts`);
    domainMapping["core.ts"].push(agent.slug);
  }
}

// Split the agents and write files
for (const [filename, slugs] of Object.entries(domainMapping)) {
  const fileAgents = SUBAGENT_DEFINITIONS.filter(a => slugs.includes(a.slug));
  if (fileAgents.length === 0) continue;

  const content = `import type { SubAgentDefinition } from "../subagent-definitions";

export const registryAgents: SubAgentDefinition[] = ${JSON.stringify(fileAgents, null, 2)};
`;

  const destPath = path.join(registryDir, filename);
  fs.writeFileSync(destPath, content, "utf-8");
  console.log(`Wrote ${fileAgents.length} agents to: ${destPath}`);
}

console.log("Splitting process finished successfully!");
