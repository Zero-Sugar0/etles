import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent');
const SKILLS_FILE = path.join(CONFIG_DIR, 'skills.json');

export interface Skill {
  name: string;
  slug: string;
  category: string;
  slots: number;
  description: string;
  tools: string[];
  dependencies: string[];
}

export const AVAILABLE_SKILLS: Skill[] = [
  {
    name: 'GitHub Copilot Sync',
    slug: 'github_copilot',
    category: 'Developer',
    slots: 2,
    description: 'Enables advanced GitHub repository interactions, code quality analysis via Snyk, and automated PR reviews.',
    tools: ['github', 'snyk', 'code_review'],
    dependencies: ['git-cli', 'node-env'],
  },
  {
    name: 'CRM Sales Sync',
    slug: 'crm_sync',
    category: 'Sales & SDR',
    slots: 1,
    description: 'Integrates lead scoring, HubSpot activity streaming, and Salesforce contact matching automatically.',
    tools: ['hubspot', 'salesforce', 'apollo'],
    dependencies: ['crm-token'],
  },
  {
    name: 'Task Automator',
    slug: 'task_automator',
    category: 'Productivity',
    slots: 1,
    description: 'Automates task creation, backlog grooming, and progress sync across Jira, Linear, and Asana.',
    tools: ['jira', 'linear', 'asana', 'clickup'],
    dependencies: [],
  },
  {
    name: 'Social Media Scheduler',
    slug: 'social_scheduler',
    category: 'Marketing',
    slots: 1,
    description: 'Drafts, optimizes, schedules, and monitors performance for multiple brand social channels.',
    tools: ['instagram', 'facebook', 'buffer', 'hootsuite'],
    dependencies: ['buffer-token'],
  },
  {
    name: 'Data Pipeline Specialist',
    slug: 'data_pipeline',
    category: 'Data Engineering',
    slots: 2,
    description: 'Manages SQL data extraction, snowflake warehousing, and live pipeline monitoring.',
    tools: ['postgres', 'snowflake', 'bigquery', 'data_engineer'],
    dependencies: ['db-creds', 'gcp-sa-key'],
  }
];

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getLoadedSkills(): string[] {
  if (fs.existsSync(SKILLS_FILE)) {
    try {
      const content = fs.readFileSync(SKILLS_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }
  return [];
}

export function saveLoadedSkills(loaded: string[]): void {
  ensureConfigDir();
  fs.writeFileSync(SKILLS_FILE, JSON.stringify(loaded, null, 2), 'utf8');
}

export function loadSkill(slug: string): { success: boolean; error?: string } {
  const skill = AVAILABLE_SKILLS.find(s => s.slug === slug);
  if (!skill) {
    return { success: false, error: `Skill "${slug}" not found.` };
  }

  const loaded = getLoadedSkills();
  if (loaded.includes(slug)) {
    return { success: false, error: `Skill "${skill.name}" is already loaded.` };
  }

  // Calculate slots
  const currentSlots = loaded.reduce((acc, currentSlug) => {
    const s = AVAILABLE_SKILLS.find(x => x.slug === currentSlug);
    return acc + (s ? s.slots : 0);
  }, 0);

  const MAX_SLOTS = 4;
  if (currentSlots + skill.slots > MAX_SLOTS) {
    return { success: false, error: `Not enough skill slots available. Loading this skill requires ${skill.slots} slot(s), but only ${MAX_SLOTS - currentSlots} is/are available (max ${MAX_SLOTS}).` };
  }

  loaded.push(slug);
  saveLoadedSkills(loaded);
  return { success: true };
}

export function unloadSkill(slug: string): { success: boolean; error?: string } {
  const loaded = getLoadedSkills();
  if (!loaded.includes(slug)) {
    return { success: false, error: `Skill "${slug}" is not currently loaded.` };
  }

  const updated = loaded.filter(s => s !== slug);
  saveLoadedSkills(updated);
  return { success: true };
}
