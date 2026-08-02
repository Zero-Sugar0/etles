import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeComposerText, shouldSubmitAuth } from '../src/utils/composer';
import { SUBAGENT_DEFINITIONS } from '../src/modules/agent-definitions';

test('normalizes pasted multiline content and strips bracketed paste markers', () => {
  const input = '\u001b[200~Hello\nWorld\u001b[201~';

  assert.equal(normalizeComposerText(input), 'Hello\nWorld');
});

test('preserves Windows newlines as single line breaks', () => {
  const input = 'Line 1\r\nLine 2\r\nLine 3';

  assert.equal(normalizeComposerText(input), 'Line 1\nLine 2\nLine 3');
});

test('requires both auth fields before submitting', () => {
  assert.equal(shouldSubmitAuth('guysspend@gmail.com', 'secret123'), true);
  assert.equal(shouldSubmitAuth('', 'secret123'), false);
  assert.equal(shouldSubmitAuth('guysspend@gmail.com', ''), false);
});

test('exposes a main agent entry before specialist agents', () => {
  assert.equal(SUBAGENT_DEFINITIONS[0]?.slug, 'main_agent');
  assert.equal(SUBAGENT_DEFINITIONS[0]?.name, 'Main Agent');
});
