import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface AppConfig {
  defaultAgent: string;
  defaultModel: string;
  debug: boolean;
  stream: boolean;
  latencySimulated: number;
}

const DEFAULT_CONFIG: AppConfig = {
  defaultAgent: 'chief_of_staff',
  defaultModel: 'gemini-3.5-pro',
  debug: false,
  stream: true,
  latencySimulated: 42,
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfig(): AppConfig {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

export function setConfigKey<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  const current = getConfig();
  current[key] = value;
  saveConfig(current);
}

export function resetConfig(): void {
  saveConfig(DEFAULT_CONFIG);
}
