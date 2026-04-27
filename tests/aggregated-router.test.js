import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasImageContent, resolveAggregatedProvider, rewriteModel } from '../src/proxy/aggregated-router.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeAggregatedAccount(overrides = {}) {
  return {
    id: 'acc_agg_test',
    type: 'aggregated',
    nickname: 'Test Agg',
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' } },
      { name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api', credentials: { apiKey: 'sk-glm' } },
    ],
    routing: {
      opus:   { providerIndex: 0, model: 'deepseek-v4-pro' },
      sonnet: { providerIndex: 0, model: 'deepseek-v4-pro' },
      haiku:  { providerIndex: 0, model: 'deepseek-v4-flash' },
      image:  { providerIndex: 1, model: 'glm-5v-turbo' },
    },
    ...overrides,
  };
}

// ── hasImageContent ───────────────────────────────────────────────────────

test('hasImageContent: detects image in content array', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'look at this' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } },
      ],
    }],
  };
  assert.equal(hasImageContent(body), true);
});

test('hasImageContent: pure text content array returns false', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ],
    }],
  };
  assert.equal(hasImageContent(body), false);
});

test('hasImageContent: string content returns false', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [{ role: 'user', content: 'hello world' }],
  };
  assert.equal(hasImageContent(body), false);
});

test('hasImageContent: no messages returns false', () => {
  const body = { model: 'claude-opus-4-7' };
  assert.equal(hasImageContent(body), false);
});

test('hasImageContent: detects image across multiple messages', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [
      { role: 'user', content: 'hello' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'see this' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'xyz' } },
        ],
      },
    ],
  };
  assert.equal(hasImageContent(body), true);
});

test('hasImageContent: ignores non-standard content shapes', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [{ role: 'user', content: { type: 'image' } }],
  };
  assert.equal(hasImageContent(body), false);
});

// ── resolveAggregatedProvider ─────────────────────────────────────────────

test('resolveAggregatedProvider: opus model routes to opus config', () => {
  const body = { model: 'claude-opus-4-7', messages: [] };
  const acc = makeAggregatedAccount();
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result.baseUrl, 'https://api.deepseek.com');
  assert.equal(result.apiKey, 'sk-ds');
  assert.equal(result.targetModel, 'deepseek-v4-pro');
});

test('resolveAggregatedProvider: sonnet model routes to sonnet config', () => {
  const body = { model: 'claude-sonnet-4-6', messages: [] };
  const acc = makeAggregatedAccount();
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result.baseUrl, 'https://api.deepseek.com');
  assert.equal(result.targetModel, 'deepseek-v4-pro');
});

test('resolveAggregatedProvider: haiku model routes to haiku config', () => {
  const body = { model: 'claude-haiku-4-5-20251001', messages: [] };
  const acc = makeAggregatedAccount();
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result.baseUrl, 'https://api.deepseek.com');
  assert.equal(result.targetModel, 'deepseek-v4-flash');
});

test('resolveAggregatedProvider: image content routes to image config', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'look' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } },
      ],
    }],
  };
  const acc = makeAggregatedAccount();
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result.baseUrl, 'https://open.bigmodel.cn/api');
  assert.equal(result.apiKey, 'sk-glm');
  assert.equal(result.targetModel, 'glm-5v-turbo');
});

test('resolveAggregatedProvider: image falls back to opus when image routing not configured', () => {
  const body = {
    model: 'claude-opus-4-7',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } },
      ],
    }],
  };
  const acc = makeAggregatedAccount({
    routing: {
      opus: { providerIndex: 0, model: 'deepseek-v4-pro' },
      sonnet: { providerIndex: 0, model: 'deepseek-v4-pro' },
      haiku: { providerIndex: 0, model: 'deepseek-v4-flash' },
      // image intentionally omitted
    },
  });
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result.baseUrl, 'https://api.deepseek.com');
  assert.equal(result.targetModel, 'deepseek-v4-pro');
});

test('resolveAggregatedProvider: returns null when model prefix does not match any routing', () => {
  const body = { model: 'gpt-4o-mini', messages: [] };
  const acc = makeAggregatedAccount();
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result, null);
});

test('resolveAggregatedProvider: returns null when providerIndex is out of bounds', () => {
  const body = { model: 'claude-opus-4-7', messages: [] };
  const acc = makeAggregatedAccount({
    routing: {
      opus: { providerIndex: 99, model: 'xxx' },
    },
  });
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result, null);
});

test('resolveAggregatedProvider: returns null when account has no providers', () => {
  const body = { model: 'claude-opus-4-7', messages: [] };
  const acc = makeAggregatedAccount({ providers: [] });
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result, null);
});

test('resolveAggregatedProvider: returns null when routing is empty', () => {
  const body = { model: 'claude-opus-4-7', messages: [] };
  const acc = makeAggregatedAccount({ routing: {} });
  const result = resolveAggregatedProvider(body, acc);
  assert.equal(result, null);
});

// ── rewriteModel ──────────────────────────────────────────────────────────

test('rewriteModel: replaces model name when different', () => {
  const body = Buffer.from(JSON.stringify({ model: 'claude-opus-4-7', messages: [] }));
  const out = rewriteModel(body, 'deepseek-v4-pro');
  assert.equal(JSON.parse(out.toString()).model, 'deepseek-v4-pro');
});

test('rewriteModel: returns original buffer when model already matches', () => {
  const body = Buffer.from(JSON.stringify({ model: 'deepseek-v4-pro', messages: [] }));
  const out = rewriteModel(body, 'deepseek-v4-pro');
  assert.equal(JSON.parse(out.toString()).model, 'deepseek-v4-pro');
});

test('rewriteModel: returns original buffer on invalid JSON', () => {
  const body = Buffer.from('not json');
  const out = rewriteModel(body, 'deepseek-v4-pro');
  assert.equal(out.toString(), 'not json');
});

test('rewriteModel: returns original buffer when model field is missing', () => {
  const body = Buffer.from(JSON.stringify({ messages: [] }));
  const out = rewriteModel(body, 'deepseek-v4-pro');
  const parsed = JSON.parse(out.toString());
  assert.equal(parsed.model, undefined);
});
