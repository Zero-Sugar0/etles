import { SUBAGENT_DEFINITIONS } from './agent-definitions';
import { setMemory, loadMemory } from './memory';

export interface StreamEvent {
  type: 'token' | 'tool_start' | 'tool_stdout' | 'tool_end' | 'subagent_start' | 'subagent_end' | 'memory_update' | 'done';
  data?: unknown;
}

export function* runAgentSimulation(
  prompt: string,
  activeAgentSlug: string,
  loadedSkills: string[]
): Generator<StreamEvent, void, unknown> {
  const agent = SUBAGENT_DEFINITIONS.find(a => a.slug === activeAgentSlug) || SUBAGENT_DEFINITIONS[0];

  // Token: intro
  yield { type: 'token', data: `[Agent ${agent.name}] Processing your request: "${prompt}"...\n\n` };

  // Decide what to do based on input
  const lowercasePrompt = prompt.toLowerCase();

  if (lowercasePrompt.includes('test') || lowercasePrompt.includes('shell')) {
    // Simulate shell tool execution
    yield {
      type: 'tool_start',
      data: { name: 'shell_execute', icon: '🐚', input: { command: 'pnpm test', timeout: 5000 } }
    };

    // Stream stdout
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
      data: { name: 'shell_execute', status: 'completed', output: '3 tests passed successfully in 3.6s.' }
    };

    yield { type: 'token', data: '\nAll shell tests have completed successfully! Let me summarize findings.' };
  } else if (lowercasePrompt.includes('edit') || lowercasePrompt.includes('file') || lowercasePrompt.includes('code')) {
    // Simulate file editing tool with unified diff
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
      data: '\nI have successfully edited the config file to change the service port from 3000 to 8080. Here is the visual diff:\n\n' +
            '\x1b[31m- const PORT = 3000;\x1b[0m\n' +
            '\x1b[32m+ const PORT = 8080;\x1b[0m\n'
    };
  } else if (lowercasePrompt.includes('sub') || lowercasePrompt.includes('delegate') || lowercasePrompt.includes('spawn')) {
    // Simulate sub-agent recursion
    yield {
      type: 'token',
      data: 'Delegating code analysis to specialized sub-agents.\n'
    };

    // Subagent 1: qa_tester
    yield {
      type: 'subagent_start',
      data: { id: 'sa-1', name: 'QA Tester', role: 'Perform unit-test validations', status: 'running', depth: 1 }
    };

    yield { type: 'token', data: ' - Spawning sub-agent [QA Tester] to inspect environment...\n' };

    // Subagent 2: code_review inside qa_tester
    yield {
      type: 'subagent_start',
      data: { id: 'sa-2', name: 'Code Reviewer', role: 'Security & style audits', status: 'running', depth: 2 }
    };
    yield { type: 'token', data: '   - Spawning sub-agent [Code Reviewer] inside QA Tester...\n' };

    yield {
      type: 'subagent_end',
      data: { id: 'sa-2', name: 'Code Reviewer', status: 'completed', output: 'Codebase meets enterprise standard.' }
    };
    yield { type: 'token', data: '   - [Code Reviewer] completed.\n' };

    yield {
      type: 'subagent_end',
      data: { id: 'sa-1', name: 'QA Tester', status: 'completed', output: 'All unit test templates look healthy.' }
    };
    yield { type: 'token', data: ' - [QA Tester] completed.\n' };

    yield { type: 'token', data: '\nBoth sub-agents finished successfully. The code is secure and tested!' };
  } else if (lowercasePrompt.includes('remember') || lowercasePrompt.includes('save') || lowercasePrompt.includes('memory')) {
    // Simulate memory write
    const oldMemory = { ...loadMemory() };
    const key = 'user_preferred_timezone';
    const val = 'EST';
    setMemory(key, val, 'string');
    const newMemory = { ...loadMemory() };

    yield {
      type: 'memory_update',
      data: { oldMemory, newMemory }
    };

    yield {
      type: 'token',
      data: `\nI have successfully saved your preferred timezone to long-term memory:\n- **${key}**: ${val}\n`
    };
  } else {
    // Standard conversational reply
    const responses = [
      'I am Etles autonomous controller, active and ready.\n\n',
      'Based on my current configuration, I have access to the following resources:\n',
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

  yield { type: 'done' };
}
