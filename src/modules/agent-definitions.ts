import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface SubAgentDefinition {
  slug: string;
  name: string;
  description: string;
  systemPrompt: string;
  toolkits: string[];
}

const MAIN_AGENT: SubAgentDefinition = {
  slug: 'main_agent',
  name: 'Main Agent',
  description:
    'Primary Etles orchestrator that routes requests, coordinates sub-agents, and manages tools, memory, and session context.',
  systemPrompt:
    'You are Etles Main Agent — the primary controller for this workspace. Understand the user goal, choose the right specialist sub-agents, coordinate tool use, and return clear actionable results. Delegate when a specialist is better suited; synthesize when multiple agents contribute.',
  toolkits: [
    'gmail',
    'slack',
    'notion',
    'github',
    'linear',
    'googlecalendar',
    'googledrive',
    'hubspot',
    'salesforce',
  ],
};

type RegistryModule = { registryAgents: SubAgentDefinition[] };

function loadRegistryAgents(): SubAgentDefinition[] {
  const modules: RegistryModule[] = [
    require('../../lib/agent/registry/department-leads.ts'),
    require('../../lib/agent/registry/core.ts'),
    require('../../lib/agent/registry/finance-legal.ts'),
    require('../../lib/agent/registry/marketing-growth.ts'),
    require('../../lib/agent/registry/dev-ops-qa.ts'),
    require('../../lib/agent/registry/creative-design.ts'),
    require('../../lib/agent/registry/support-services.ts'),
    require('../../lib/agent/registry/hr-people.ts'),
    require('../../lib/agent/registry/product-strategy.ts'),
    require('../../lib/agent/registry/security-compliance.ts'),
  ];

  return modules.flatMap((module) => module.registryAgents);
}

const REGISTRY_AGENTS = loadRegistryAgents();

export const SUBAGENT_DEFINITIONS: SubAgentDefinition[] = [
  MAIN_AGENT,
  ...REGISTRY_AGENTS,
];

export function getSubAgentBySlug(slug: string): SubAgentDefinition | undefined {
  return SUBAGENT_DEFINITIONS.find((agent) => agent.slug === slug);
}

export function getAllAgentSlugs(): string[] {
  return SUBAGENT_DEFINITIONS.map((agent) => agent.slug);
}
