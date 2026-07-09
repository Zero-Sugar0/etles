export interface SubAgentDefinition {
  slug: string;
  name: string;
  description: string;
  systemPrompt: string;
  toolkits: string[];
}

export const SUBAGENT_DEFINITIONS: SubAgentDefinition[] = [
  {
    slug: 'chief_of_staff',
    name: 'Chief of Staff',
    description: 'Autonomous executive coordinator managing calendars, email inbox triage, team tasks sync, and meeting scheduling.',
    systemPrompt: 'You are an elite Chief of Staff agent. Your objective is to assist the user by coordinating high-level tasks, prioritizing schedules, and drafting clear executive communication.',
    toolkits: ['gmail', 'googlecalendar', 'slack', 'notion']
  },
  {
    slug: 'project_manager',
    name: 'Project Manager',
    description: 'Tracks backlogs, grooms sprints, updates tickets, and coordinates team tasks across Jira, Linear, or Trello.',
    systemPrompt: 'You are an autonomous Project Manager agent. Your goal is to keep projects on track, organize backlogs, and update tickets.',
    toolkits: ['linear', 'jira', 'trello', 'slack']
  },
  {
    slug: 'sdr',
    name: 'Sales Development Representative (SDR)',
    description: 'Finds leads, scores prospects, customizes outreach messages, and updates HubSpot and Salesforce pipelines.',
    systemPrompt: 'You are a high-performing SDR agent. Your purpose is to identify prospects, write hyper-personalized outbound emails, and maintain CRM accuracy.',
    toolkits: ['hubspot', 'salesforce', 'apollo', 'gmail']
  },
  {
    slug: 'code_review',
    name: 'Code Reviewer',
    description: 'Inspects code quality, performs security scans with Snyk, and drafts PR reviews on GitHub or GitLab.',
    systemPrompt: 'You are a senior Code Reviewer agent. Analyze files for style, security vulnerabilites, performance gaps, and correctness.',
    toolkits: ['github', 'snyk', 'slack']
  },
  {
    slug: 'incident_response',
    name: 'Incident Responder',
    description: 'Monitors alerts, triages outages, and triggers incident reports on PagerDuty or Cloudflare in real time.',
    systemPrompt: 'You are a 24/7 Incident Responder agent. Investigate downtime alerts, check cloud status, and coordinate response channels.',
    toolkits: ['pagerduty', 'cloudflare', 'aws', 'slack']
  },
  {
    slug: 'qa_tester',
    name: 'QA Tester',
    description: 'Performs functional checks, writes unit tests, and validates flows using browser automation.',
    systemPrompt: 'You are an automated QA Tester agent. Draft and execute end-to-end tests, inspect failures, and file issues.',
    toolkits: ['browser_use', 'linear', 'github']
  },
  {
    slug: 'visual_designer',
    name: 'Visual Designer',
    description: 'Generates UI designs, reviews Figma assets, and creates layout elements.',
    systemPrompt: 'You are an expert Visual Designer. Render wireframes, review color spaces, and format gorgeous visual components.',
    toolkits: ['figma', 'canva', 'webflow']
  }
];

export function getSubAgentBySlug(slug: string): SubAgentDefinition | undefined {
  return SUBAGENT_DEFINITIONS.find(a => a.slug === slug);
}

export function getAllAgentSlugs(): string[] {
  return SUBAGENT_DEFINITIONS.map(a => a.slug);
}
