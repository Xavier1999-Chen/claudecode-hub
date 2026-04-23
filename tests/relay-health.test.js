import { test } from 'node:test';
import assert from 'node:assert/strict';

import { syncRelayHealth, listRelayModels, pickProbeModel } from '../src/admin/relay-health.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRelay(overrides = {}) {
  return {
    id: 'acc_relay_test',
    type: 'relay',
    nickname: 'test-relay',
    baseUrl: 'https://relay.example.com',
    credentials: { apiKey: 'sk-test-key' },
    modelMap: {},
    status: 'idle',
    probeModel: null,
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

// ── pickProbeModel ───────────────────────────────────────────────────────

test('pickProbeModel: probeModel takes highest priority', () => {
  const acc = makeRelay({ probeModel: 'claude-opus-4-5-20251101', modelMap: { opus: 'claude-opus-4-7' } });
  assert.equal(pickProbeModel(acc), 'claude-opus-4-5-20251101');
});

test('pickProbeModel: falls back to modelMap.opus when probeModel is null', () => {
  const acc = makeRelay({ probeModel: null, modelMap: { opus: 'claude-opus-4-7' } });
  assert.equal(pickProbeModel(acc), 'claude-opus-4-7');
});

test('pickProbeModel: returns null when both are unset', () => {
  const acc = makeRelay({ probeModel: null, modelMap: {} });
  assert.equal(pickProbeModel(acc), null);
});

test('pickProbeModel: empty-string probeModel treated as unset', () => {
  const acc = makeRelay({ probeModel: '', modelMap: { opus: 'claude-opus-4-7' } });
  assert.equal(pickProbeModel(acc), 'claude-opus-4-7');
});

// ── listRelayModels ──────────────────────────────────────────────────────

test('listRelayModels: claude models first, then others', async () => {
  const acc = makeRelay();
  const fetch = mockFetch([{
    status: 200,
    json: { data: [
      { id: 'gpt-4o-mini' },
      { id: 'claude-opus-4-7' },
      { id: 'glm-5.1' },
      { id: 'claude-sonnet-4-6' },
      { id: 'claude-haiku-4-5-20251001' },
    ]},
  }]);
  const models = await listRelayModels(acc, fetch);
  assert.deepEqual(models, ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'gpt-4o-mini', 'glm-5.1']);
});

test('listRelayModels: sends correct url and headers', async () => {
  const acc = makeRelay({ baseUrl: 'https://my-relay.com/api' });
  const fetch = mockFetch([{ status: 200, json: { data: [] } }]);
  await listRelayModels(acc, fetch);
  assert.equal(fetch.calls[0].url, 'https://my-relay.com/api/v1/models');
  assert.equal(fetch.calls[0].opts.headers['x-api-key'], 'sk-test-key');
});

test('listRelayModels: returns empty array on network error', async () => {
  const acc = makeRelay();
  const fetch = mockFetch([{ throw: new Error('ECONNREFUSED') }]);
  const models = await listRelayModels(acc, fetch);
  assert.deepEqual(models, []);
});

test('listRelayModels: handles flat array response', async () => {
  const acc = makeRelay();
  const fetch = mockFetch([{ status: 200, json: [{ id: 'claude-opus-4-7' }, { id: 'gemini-pro' }] }]);
  const models = await listRelayModels(acc, fetch);
  assert.deepEqual(models, ['claude-opus-4-7', 'gemini-pro']);
});

// ── syncRelayHealth ──────────────────────────────────────────────────────

test('syncRelayHealth: online when probe returns 200', async () => {
  const acc = makeRelay({ probeModel: 'claude-opus-4-7' });
  const fetch = mockFetch([{ status: 200, json: { content: [{ text: 'hi' }] } }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health.status, 'online');
  assert.equal(acc.health.model, 'claude-opus-4-7');
  assert.ok(acc.health.latencyMs >= 0);
  assert.equal(acc.health.error, null);
});

test('syncRelayHealth: uses modelMap.opus when probeModel is null', async () => {
  const acc = makeRelay({ probeModel: null, modelMap: { opus: 'claude-opus-4-5-20251101' } });
  const fetch = mockFetch([{ status: 200, json: {} }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health.status, 'online');
  assert.equal(acc.health.model, 'claude-opus-4-5-20251101');
});

test('syncRelayHealth: skips probe when no model configured', async () => {
  const acc = makeRelay({ probeModel: null, modelMap: {} });
  const fetch = mockFetch([{ throw: new Error('should not be called') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health, undefined);
  assert.equal(fetch.calls.length, 0);
});

test('syncRelayHealth: offline on HTTP error', async () => {
  const acc = makeRelay({ probeModel: 'claude-opus-4-7' });
  const fetch = mockFetch([{ status: 503, text: 'Service Unavailable' }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health.status, 'offline');
  assert.ok(acc.health.error.includes('503'));
});

test('syncRelayHealth: offline on network error', async () => {
  const acc = makeRelay({ probeModel: 'claude-opus-4-7' });
  const fetch = mockFetch([{ throw: new Error('ECONNREFUSED') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health.status, 'offline');
  assert.equal(acc.health.error, 'ECONNREFUSED');
});

test('syncRelayHealth: offline on timeout', async () => {
  const acc = makeRelay({ probeModel: 'claude-opus-4-7' });
  const fetch = mockFetch([{ throw: new DOMException('timed out', 'AbortError') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health.status, 'offline');
  assert.equal(acc.health.error, 'timeout');
});

test('syncRelayHealth: skips non-relay accounts', async () => {
  const acc = { type: 'oauth', id: 'acc_oauth' };
  const fetch = mockFetch([{ throw: new Error('no') }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health, undefined);
});

test('syncRelayHealth: offline on 401', async () => {
  const acc = makeRelay({ probeModel: 'claude-opus-4-7' });
  const fetch = mockFetch([{ status: 401, text: 'Unauthorized' }]);
  await syncRelayHealth(acc, fetch);
  assert.equal(acc.health.status, 'offline');
  assert.ok(acc.health.error.includes('401'));
});
