import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent');
const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');

export interface SessionTool {
  name: string;
  status: string;
  input: Record<string, unknown>;
}

export interface SessionSubAgent {
  id: string;
  name: string;
  role: string;
  status: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  agentSlug?: string;
  subAgents?: SessionSubAgent[];
  memoryDiff?: {
    written: { key: string; value: string }[];
    updated: { key: string; oldValue: string; newValue: string }[];
    deleted: { key: string; value: string }[];
  };
  tools?: SessionTool[];
}

export interface ChatSession {
  id: string;
  title: string;
  agentSlug: string;
  createdAt: string;
  messages: Message[];
}

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

export function listSessions(): ChatSession[] {
  ensureSessionsDir();
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    const sessions: ChatSession[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8');
          sessions.push(JSON.parse(content));
        } catch (e) {
          // Skip corrupt file
        }
      }
    }
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    return [];
  }
}

export function getSession(id: string): ChatSession | null {
  ensureSessionsDir();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function saveSession(session: ChatSession): void {
  ensureSessionsDir();
  const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8');
}

export function deleteSession(id: string): boolean {
  ensureSessionsDir();
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

export function exportSession(session: ChatSession, format: 'md' | 'json' | 'txt'): string {
  if (format === 'json') {
    return JSON.stringify(session, null, 2);
  }

  if (format === 'md') {
    let md = `# Session: ${session.title}\n`;
    md += `**Session ID:** ${session.id}\n`;
    md += `**Default Agent:** ${session.agentSlug}\n`;
    md += `**Created At:** ${session.createdAt}\n\n`;
    md += `---\n\n`;

    for (const msg of session.messages) {
      const roleName = msg.role === 'user' ? 'User' : msg.agentSlug ? `Agent (${msg.agentSlug})` : 'Assistant';
      md += `### ${roleName}\n`;
      md += `${msg.content}\n\n`;
      if (msg.tools && msg.tools.length > 0) {
        md += `#### Tools Invoked:\n`;
        for (const t of msg.tools) {
          md += `- **${t.name}**: ${t.status} (Input: ${JSON.stringify(t.input)})\n`;
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }
    return md;
  }

  // txt format
  let txt = `Session: ${session.title}\n`;
  txt += `Session ID: ${session.id}\n`;
  txt += `Agent: ${session.agentSlug}\n`;
  txt += `Created: ${session.createdAt}\n`;
  txt += `========================================\n\n`;

  for (const msg of session.messages) {
    const roleName = msg.role === 'user' ? 'User' : msg.agentSlug ? `Agent (${msg.agentSlug})` : 'Assistant';
    txt += `[${msg.createdAt}] ${roleName}:\n`;
    txt += `${msg.content}\n`;
    txt += `----------------------------------------\n\n`;
  }
  return txt;
}
