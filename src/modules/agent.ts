import { SUBAGENT_DEFINITIONS } from './agent-definitions';
import { setMemory, loadMemory, type MemoryEntry } from './memory';
import { getConfig } from './config';

interface BaseStreamEvent<T extends string, D> {
  type: T;
  data: D;
}

export type StreamEvent =
  | BaseStreamEvent<'token', string>
  | BaseStreamEvent<'tool_start', { name: string; icon: string; input: Record<string, unknown> }>
  | BaseStreamEvent<'tool_stdout', string>
  | BaseStreamEvent<'tool_end', { name: string; status: 'running' | 'completed' | 'failed'; output?: string }>
  | BaseStreamEvent<'subagent_start', { id: string; name: string; role: string; status: 'running' | 'completed' | 'failed'; depth: number }>
  | BaseStreamEvent<'subagent_end', { id: string; name: string; status: 'running' | 'completed' | 'failed'; output?: string }>
  | BaseStreamEvent<'memory_update', { oldMemory: Record<string, MemoryEntry>; newMemory: Record<string, MemoryEntry> }>
  | BaseStreamEvent<'done', null>;

function getToolIcon(name: string): string {
  const commonIcons: Record<string, string> = {
    // Local CLI tools
    memory_set: '💾',
    shell_execute: '🐚',
    file_edit: '📝',
    browser_search: '🌐',
    send_whatsapp: '💬',

    // Real server tools
    getWeather: '🌤️',
    generateImage: '🖼️',
    generateVideo: '🎥',
    renderChart: '📊',
    createDocument: '📄',
    updateDocument: '🔄',
    editDocument: '✍️',
    saveMemory: '💾',
    recallMemory: '🧠',
    searchPastConversations: '🔍',
    updateMemory: '✏️',
    deleteMemory: '🗑️',
    setReminder: '⏰',
    setCronJob: '🗓️',
    listSchedules: '📅',
    deleteSchedule: '❌',
    setupTrigger: '⚡',
    listActiveTriggers: '🔌',
    removeTrigger: '📴',
    spawnChildAgent: '🤖',
    waitForChildAgents: '⏳',
    delegateToSubAgent: '👥',
    launchMission: '🚀',
    getMissionStatus: '📈',
    activateHeartbeat: '💓',
    getAgentSystemStatus: 'ℹ️',
    executeCommand: '🐚',
    runCode: '💻',
    listFiles: '📁',
    readFile: '📖',
    writeFile: '💾',
    createDirectory: '📁',
    searchFiles: '🔍',
    replaceInFiles: '✏️',
    gitClone: '📥',
    gitStatus: '📊',
    gitCommit: '💾',
    gitPush: '📤',
    gitPull: '📥',
    browserSetup: '🌐',
    browserNavigate: '🧭',
    browserInteract: '🖱️',
    browserExtract: '📋',
    browserScreenshot: '📸',
  };

  return commonIcons[name] || '🔧';
}

export function* runAgentSimulation(
  prompt: string,
  activeAgentSlug: string,
  loadedSkills: string[]
): Generator<StreamEvent, void, unknown> {
  const agent = SUBAGENT_DEFINITIONS.find(a => a.slug === activeAgentSlug) || SUBAGENT_DEFINITIONS[0];

  yield { type: 'token', data: `[Simulation Fallback] Processing request: "${prompt}"...\n\n` };

  const lowercasePrompt = prompt.toLowerCase();

  if (lowercasePrompt.includes('test') || lowercasePrompt.includes('shell')) {
    yield {
      type: 'tool_start',
      data: { name: 'shell_execute', icon: '🐚', input: { command: 'pnpm test', timeout: 5000 } }
    };

    const outputs = [
      ' > etles@3.1.8 test\n',
      ' > set PLAYWRIGHT=True && pnpm exec playwright test\n\n',
      ' Running 3 tests using 1 worker\n',
      '  ✓  [chromium] › example.spec.ts:3:1 › has title (1.2s)\n',
      '  ✓  [chromium] › example.spec.ts:10:1 › get started link (1.5s)\n',
      '  ✓  [chromium] › example.spec.ts:18:1 › api integration (900ms)\n\n',
      '  3 passed (3.6s)\n'
    ];

    for (const chunk of outputs) {
      yield { type: 'tool_stdout', data: chunk };
    }

    yield {
      type: 'tool_end',
      data: { name: 'shell_execute', status: 'completed', output: '3 tests passed successfully.' }
    };
  } else if (lowercasePrompt.includes('edit') || lowercasePrompt.includes('file') || lowercasePrompt.includes('code')) {
    yield {
      type: 'tool_start',
      data: {
        name: 'file_edit',
        icon: '📝',
        input: { path: 'src/config.ts', diff: '<<<<<<< SEARCH\nconst PORT = 3000;\n=======\nconst PORT = 8080;\n>>>>>>> REPLACE' }
      }
    };

    yield {
      type: 'tool_end',
      data: {
        name: 'file_edit',
        status: 'completed',
        output: 'Successfully applied unified search-and-replace block to src/config.ts'
      }
    };

    yield {
      type: 'token',
      data: '\nI have successfully edited the config file to change the service port from 3000 to 8080.\n'
    };
  } else {
    const responses = [
      'I am Etles autonomous controller simulation, active and offline.\n\n',
      `- **Active Agent:** ${agent.name} (${agent.slug})\n`,
      `- **System Context:** "${agent.description}"\n`,
      loadedSkills.length > 0
        ? `- **Loaded Skills:** ${loadedSkills.join(', ')}\n`
        : '- **Loaded Skills:** None (Load skills using `/skill load <slug>`)\n',
      '\nYou can type `/help` or use the command palette (Ctrl+K) to discover all capabilities.'
    ];

    for (const chunk of responses) {
      yield { type: 'token', data: chunk };
    }
  }

  yield { type: 'done', data: null };
}

/**
 * Connects to the real Next.js chat streaming route /api/chat.
 * Decodes the Vercel AI SDK Data Stream protocol in real time.
 */
export async function* runRealAgentStream(
  prompt: string,
  chatId: string,
  activeAgentSlug: string,
  activeModel: string,
  authToken: string
): AsyncGenerator<StreamEvent, void, unknown> {
  const messageId = crypto.randomUUID ? crypto.randomUUID() : 'msg_' + Math.random().toString(36).slice(2, 10);

  // Payload routes either to main chat model or specialized sub-agent slug
  const payloadBody = {
    id: chatId,
    message: {
      id: messageId,
      role: 'user',
      parts: [{ type: 'text', text: prompt }]
    },
    selectedChatModel: activeAgentSlug && activeAgentSlug !== 'main_agent' ? activeAgentSlug : activeModel,
    selectedVisibilityType: 'private'
  };

  const config = getConfig();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || (config && (config as any).appUrl) || 'http://localhost:3000')
    .replace(/\/$/, '');
  const apiUrl = `${baseUrl}/api/chat`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      'x-subagent-slug': activeAgentSlug
    },
    body: JSON.stringify(payloadBody)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`HTTP Error ${response.status} when POSTing to ${apiUrl}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body has no readable reader stream.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const code = line.substring(0, colonIdx);
        const payloadRaw = line.substring(colonIdx + 1);

        try {
          const payload = JSON.parse(payloadRaw);

          if (code === '0') {
            // Text delta
            yield { type: 'token', data: payload };
          } else if (code === 'b') {
            // Reasoning delta (thinking block)
            yield { type: 'token', data: `\x1b[33m${payload}\x1b[0m` };
          } else if (code === '9' || code === '2') {
            // Tool call event
            const toolCalls = Array.isArray(payload) ? payload : [payload];
            for (const tc of toolCalls) {
              const toolName = tc.toolName || tc.name || 'tool';
              yield {
                type: 'tool_start',
                data: {
                  name: toolName,
                  icon: getToolIcon(toolName),
                  input: tc.args || tc.input || {}
                }
              };
            }
          } else if (code === 'a' || code === '3') {
            // Tool result event
            const toolName = payload.toolName || payload.name || 'tool';
            yield {
              type: 'tool_end',
              data: {
                name: toolName,
                status: payload.isError ? 'failed' : 'completed',
                output: typeof payload.result === 'object' ? JSON.stringify(payload.result) : String(payload.result || '')
              }
            };
          }
        } catch (err) {
          // Plain text fallback if JSON parsing fails
          if (code === '0') {
            yield { type: 'token', data: payloadRaw };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done', data: null };
}
