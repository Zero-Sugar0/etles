import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent');
const MEMORY_FILE = path.join(CONFIG_DIR, 'memory.json');

export interface MemoryEntry {
  key: string;
  value: string;
  type: string;
  updatedAt: string;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadMemory(): Record<string, MemoryEntry> {
  if (fs.existsSync(MEMORY_FILE)) {
    try {
      const content = fs.readFileSync(MEMORY_FILE, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return {};
    }
  }
  return {};
}

export function saveMemory(memory: Record<string, MemoryEntry>): void {
  ensureConfigDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
}

export function listMemory(): MemoryEntry[] {
  const memory = loadMemory();
  return Object.values(memory).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getMemory(key: string): MemoryEntry | null {
  const memory = loadMemory();
  return memory[key] || null;
}

export function setMemory(key: string, value: string, type = 'string'): { entry: MemoryEntry; action: 'write' | 'update' } {
  const memory = loadMemory();
  const exists = !!memory[key];
  const entry: MemoryEntry = {
    key,
    value,
    type,
    updatedAt: new Date().toISOString(),
  };
  memory[key] = entry;
  saveMemory(memory);
  return { entry, action: exists ? 'update' : 'write' };
}

export function deleteMemory(key: string): boolean {
  const memory = loadMemory();
  if (memory[key]) {
    delete memory[key];
    saveMemory(memory);
    return true;
  }
  return false;
}

export function clearMemory(): void {
  saveMemory({});
}

export interface MemoryDiff {
  written: { key: string; value: string }[];
  updated: { key: string; oldValue: string; newValue: string }[];
  deleted: { key: string; value: string }[];
}

export function generateMemoryDiff(oldMemory: Record<string, MemoryEntry>, newMemory: Record<string, MemoryEntry>): MemoryDiff {
  const written: { key: string; value: string }[] = [];
  const updated: { key: string; oldValue: string; newValue: string }[] = [];
  const deleted: { key: string; value: string }[] = [];

  for (const key of Object.keys(newMemory)) {
    if (!oldMemory[key]) {
      written.push({ key, value: newMemory[key].value });
    } else if (oldMemory[key].value !== newMemory[key].value) {
      updated.push({ key, oldValue: oldMemory[key].value, newValue: newMemory[key].value });
    }
  }

  for (const key of Object.keys(oldMemory)) {
    if (!newMemory[key]) {
      deleted.push({ key, value: oldMemory[key].value });
    }
  }

  return { written, updated, deleted };
}
