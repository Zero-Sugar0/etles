import fs from 'fs';
import path from 'path';
import os from 'os';

export interface KeytarModule {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

let keytar: KeytarModule | null = null;
try {
  keytar = require('keytar');
} catch (e) {
  // Keytar not available or failed to load, fall back to file storage
}

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

export interface AuthUser {
  name: string;
  email: string;
  role: string;
  workspace: string;
}

export interface CredentialData {
  email?: string;
  apiKey?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: number; // timestamp
  user?: AuthUser;
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export async function getCredentials(): Promise<CredentialData | null> {
  // First try keytar
  if (keytar) {
    try {
      const apiKey = await keytar.getPassword('etles-cli-agent', 'apiKey');
      const token = await keytar.getPassword('etles-cli-agent', 'token');
      const refreshToken = await keytar.getPassword('etles-cli-agent', 'refreshToken');
      const userJSON = await keytar.getPassword('etles-cli-agent', 'user');

      if (apiKey || token) {
        return {
          apiKey: apiKey || undefined,
          token: token || undefined,
          refreshToken: refreshToken || undefined,
          user: userJSON ? JSON.parse(userJSON) : undefined,
        };
      }
    } catch (e) {
      // Ignore keytar failures and fall back to file
    }
  }

  // Fallback to file storage
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      const content = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      const creds: CredentialData = JSON.parse(content);
      return creds;
    } catch (e) {
      return null;
    }
  }

  return null;
}

export async function saveCredentials(creds: CredentialData): Promise<void> {
  ensureConfigDir();

  // Try saving to keytar if available
  if (keytar) {
    try {
      if (creds.apiKey) await keytar.setPassword('etles-cli-agent', 'apiKey', creds.apiKey);
      if (creds.token) await keytar.setPassword('etles-cli-agent', 'token', creds.token);
      if (creds.refreshToken) await keytar.setPassword('etles-cli-agent', 'refreshToken', creds.refreshToken);
      if (creds.user) await keytar.setPassword('etles-cli-agent', 'user', JSON.stringify(creds.user));
    } catch (e) {
      // Fallback below
    }
  }

  // Save to permission-locked fallback
  const content = JSON.stringify(creds, null, 2);
  fs.writeFileSync(CREDENTIALS_FILE, content, { encoding: 'utf8', mode: 0o600 });
  // Ensure permission is strictly 0600
  try {
    fs.chmodSync(CREDENTIALS_FILE, 0o600);
  } catch (e) {
    // Ignore permissions errors on non-POSIX OS
  }
}

export async function deleteCredentials(): Promise<void> {
  if (keytar) {
    try {
      await keytar.deletePassword('etles-cli-agent', 'apiKey');
      await keytar.deletePassword('etles-cli-agent', 'token');
      await keytar.deletePassword('etles-cli-agent', 'refreshToken');
      await keytar.deletePassword('etles-cli-agent', 'user');
    } catch (e) {
      // Ignore
    }
  }

  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      fs.unlinkSync(CREDENTIALS_FILE);
    } catch (e) {
      // Ignore
    }
  }
}

export async function validateCredentials(email?: string, password?: string, apiKey?: string): Promise<{ success: boolean; error?: string; data?: CredentialData }> {
  if (apiKey) {
    if (!apiKey.startsWith('api-key-') && apiKey.length < 20) {
      return { success: false, error: 'Invalid API key format. Must be at least 20 chars.' };
    }
    // Success simulation
    const name = 'Admin User';
    const parsedEmail = 'admin@etles.ai';
    return {
      success: true,
      data: {
        apiKey,
        expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
        user: {
          name,
          email: parsedEmail,
          role: 'Owner',
          workspace: 'Default Workspace',
        }
      }
    };
  }

  if (email && password) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email address format.' };
    }
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    // Success simulation
    const name = email.split('@')[0].toUpperCase();
    return {
      success: true,
      data: {
        email,
        token: 'mock-jwt-token-string',
        refreshToken: 'mock-jwt-refresh-token',
        expiresAt: Date.now() + 1000 * 60 * 60, // 1 hour
        user: {
          name,
          email,
          role: 'Engineer',
          workspace: 'Etles Dev',
        }
      }
    };
  }

  return { success: false, error: 'Either API key or Email + Password is required.' };
}

export async function silentTokenRefresh(currentCreds: CredentialData): Promise<CredentialData> {
  // If the session is within 5 minutes of expiring or already expired, silently refresh it
  if (currentCreds.expiresAt && Date.now() > currentCreds.expiresAt - 1000 * 60 * 5) {
    // Perform silent refresh simulation
    const refreshedCreds: CredentialData = {
      ...currentCreds,
      token: 'mock-jwt-refreshed-token-string',
      expiresAt: Date.now() + 1000 * 60 * 60, // Extend for 1 hour
    };
    await saveCredentials(refreshedCreds);
    return refreshedCreds;
  }
  return currentCreds;
}
