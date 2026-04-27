import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncRelayHealth, pickProbeModel } from '../src/admin/relay-health.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeAggregated(overrides = {}) {
  return {
    id: 'acc_agg_test',
    type: 'aggregated',
    nickname: 'Test Agg',
    providers: overrides.providers ?? [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: null },
      { name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api', credentials: { apiKey: 'sk-glm' }, probeModel: null },
    ],
    routing: overrides.routing ?? {
      opus: { providerIndex: 0, model: 'deepseek-v4-pro' },
      sonnet: { providerIndex: 0, model: 'deepseek-v4-pro' },
      haiku: { providerIndex: 0, model: 'deepseek-v4-flash' },
      image: { providerIndex: 1, model: 'glm-5v-turbo' },
    },
    status: 'idle',
    ...overrides,
  };
}

function mockFetch(responses) {
  let idx = 0;
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const r = responses[idx++] ?? responses[responses.length - 1];
    if (r.throw) throw r.throw;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.json ?? {},
      text: async () => r.text ?? '',
      headers: new Map(Object.entries(r.headers ?? {})),
    };
  };
  fn.calls = calls;
  return fn;
}

// ── pickProbeModel for aggregated providers ───────────────────────────────

function pickAggregatedProbeModel(provider, routing) {
  if (provider.probeModel) return provider.probeModel;
  for (const tier of ['opus', 'sonnet', 'haiku', 'image']) {
    const route = routing?.[tier];
    if (route && route.providerIndex != null && route.model) {
      // provider index matching is done by caller
      return route.model;
    }
  }
  return null;
}

// ── syncRelayHealth for aggregated accounts ───────────────────────────────

test('syncRelayHealth: probes each provider of an aggregated account', async () => {
  const acc = makeAggregated({
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: 'deepseek-v4-pro' },
      { name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api', credentials: { apiKey: 'sk-glm' }, probeModel: 'glm-5v-turbo' },
    ],
  });
  const fetch = mockFetch([
    { status: 200, json: { content: [{ text: 'hi' }] } },
    { status: 200, json: { content: [{ text: 'hello' }] } },
  ]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.providers[0].health.status, 'online');
  assert.equal(acc.providers[0].health.model, 'deepseek-v4-pro');
  assert.equal(acc.providers[1].health.status, 'online');
  assert.equal(acc.providers[1].health.model, 'glm-5v-turbo');
  assert.equal(fetch.calls.length, 2);
});

test('syncRelayHealth: uses routing model when probeModel is null', async () => {
  const acc = makeAggregated({
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: null },
    ],
    routing: {
      opus: { providerIndex: 0, model: 'deepseek-v4-pro' },
    },
  });
  const fetch = mockFetch([{ status: 200, json: {} }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.providers[0].health.status, 'online');
  assert.equal(acc.providers[0].health.model, 'deepseek-v4-pro');
});

test('syncRelayHealth: skips providers with no probeModel and no routing model', async () => {
  const acc = makeAggregated({
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: null },
    ],
    routing: {},
  });
  const fetch = mockFetch([{ throw: new Error('should not be called') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.providers[0].health, undefined);
  assert.equal(fetch.calls.length, 0);
});

test('syncRelayHealth: marks individual provider offline on HTTP error', async () => {
  const acc = makeAggregated({
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: 'deepseek-v4-pro' },
      { name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api', credentials: { apiKey: 'sk-glm' }, probeModel: 'glm-5v-turbo' },
    ],
  });
  const fetch = mockFetch([
    { status: 503, text: 'Service Unavailable' },
    { status: 200, json: {} },
  ]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.providers[0].health.status, 'offline');
  assert.ok(acc.providers[0].health.error.includes('503'));
  assert.equal(acc.providers[1].health.status, 'online');
});

test('syncRelayHealth: marks individual provider offline on network error', async () => {
  const acc = makeAggregated({
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: 'deepseek-v4-pro' },
    ],
  });
  const fetch = mockFetch([{ throw: new Error('ECONNREFUSED') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.providers[0].health.status, 'offline');
  assert.equal(acc.providers[0].health.error, 'ECONNREFUSED');
});

test('syncRelayHealth: sends correct url and headers per provider', async () => {
  const acc = makeAggregated({
    providers: [
      { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', credentials: { apiKey: 'sk-ds' }, probeModel: 'deepseek-v4-pro' },
    ],
  });
  const fetch = mockFetch([{ status: 200, json: {} }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(fetch.calls[0].url, 'https://api.deepseek.com/v1/messages');
  assert.equal(fetch.calls[0].opts.headers['x-api-key'], 'sk-ds');
});

test('syncRelayHealth: skips aggregated account with no providers', async () => {
  const acc = makeAggregated({ providers: [] });
  const fetch = mockFetch([{ throw: new Error('no') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(fetch.calls.length, 0);
});
