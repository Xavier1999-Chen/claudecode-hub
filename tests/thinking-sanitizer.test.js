import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForeignThinkingBlocks } from '../src/proxy/thinking-sanitizer.js';
import { FOREIGN_SIGNATURE_SENTINEL } from '../src/proxy/sse-signature-rewriter.js';

// Real Anthropic signatures are long base64 strings (usually 200+ chars);
// the constant chosen here just needs to clear the 50-char foreign threshold.
const REAL_SIG = 'EqQBCgIYAhIM1gbcDa9GJwZA2b3hGgxBdjrkzL8jKf0pHqRzMt7nYwUvE0xJyL4'
  + 'iHnKvBpQrSuTwXyZaB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9';

test('no messages array · returns 0, body unchanged', () => {
  const body = { model: 'claude-sonnet-4-6' };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 0);
  assert.deepEqual(body, { model: 'claude-sonnet-4-6' });
});

test('null/undefined body · returns 0', () => {
  assert.equal(sanitizeForeignThinkingBlocks(null), 0);
  assert.equal(sanitizeForeignThinkingBlocks(undefined), 0);
});

test('preserves real Anthropic-signed thinking blocks', () => {
  const body = {
    messages: [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'reasoning…', signature: REAL_SIG },
          { type: 'text', text: 'hello' },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 0);
  assert.equal(body.messages[1].content.length, 2);
  assert.equal(body.messages[1].content[0].type, 'thinking');
});

test('strips block with missing signature field (qingyuntop case)', () => {
  const body = {
    messages: [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'foreign reasoning' },
          { type: 'text', text: 'hello' },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
  assert.equal(body.messages[1].content.length, 1);
  assert.equal(body.messages[1].content[0].type, 'text');
});

test('strips block with empty-string signature', () => {
  const body = {
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '...', signature: '' },
          { type: 'text', text: 'reply' },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
  assert.equal(body.messages[0].content.length, 1);
});

test('strips block with sentinel signature (rewriter-marked, primary detection)', () => {
  // Real-world case: agg/relay provider returned a 4 KB fake signature, the
  // SSE rewriter replaced it with the sentinel before storing in claude code's
  // session JSONL. On replay this block must be stripped no matter how long
  // its original sig was.
  const body = {
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '...', signature: FOREIGN_SIGNATURE_SENTINEL },
          { type: 'text', text: 'reply' },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
  assert.equal(body.messages[0].content.length, 1);
  assert.equal(body.messages[0].content[0].type, 'text');
});

test('strips block with short fake signature (< 50 chars, fallback heuristic)', () => {
  const body = {
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '...', signature: 'fake_proxy_sig' },
          { type: 'text', text: 'reply' },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
});

test('strips block with non-string signature', () => {
  const body = {
    messages: [
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '...', signature: null },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
  // Empty content gets a placeholder so the assistant message stays valid
  assert.equal(body.messages[0].content.length, 1);
  assert.equal(body.messages[0].content[0].type, 'text');
  assert.equal(body.messages[0].content[0].text, '');
});

test('only the thinking-only assistant message gets the empty placeholder', () => {
  const body = {
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: '...', signature: '' }],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
  assert.deepEqual(body.messages[0].content, [{ type: 'text', text: '' }]);
});

test('user messages with content arrays are not touched', () => {
  const body = {
    messages: [
      {
        role: 'user',
        content: [
          // user messages don't have thinking, but content arrays carry tool_result blocks etc.
          { type: 'tool_result', tool_use_id: 'x', content: 'ok' },
        ],
      },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 0);
  assert.equal(body.messages[0].content.length, 1);
});

test('mixed history · only the foreign block in the foreign turn gets stripped', () => {
  const body = {
    messages: [
      { role: 'user', content: 'q1' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'real', signature: REAL_SIG },
          { type: 'text', text: 'a1' },
        ],
      },
      { role: 'user', content: 'q2' },
      {
        // This turn came from an aggregated/relay provider and carries
        // a fake/empty signature
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'foreign', signature: '' },
          { type: 'text', text: 'a2' },
        ],
      },
      { role: 'user', content: 'q3' },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 1);
  // Real-signed turn untouched
  assert.equal(body.messages[1].content.length, 2);
  assert.equal(body.messages[1].content[0].signature, REAL_SIG);
  // Foreign turn lost its thinking block; text remains
  assert.equal(body.messages[3].content.length, 1);
  assert.equal(body.messages[3].content[0].type, 'text');
});

test('string-content assistant messages are skipped (legacy shape)', () => {
  const body = {
    messages: [
      { role: 'assistant', content: 'just a string' },
    ],
  };
  const removed = sanitizeForeignThinkingBlocks(body);
  assert.equal(removed, 0);
  assert.equal(body.messages[0].content, 'just a string');
});
