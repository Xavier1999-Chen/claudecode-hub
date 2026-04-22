import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountPool } from '../src/proxy/account-pool.js';
import { applyModelMap } from '../src/proxy/model-map.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeOAuth(id, opts = {}) {
  return {
    id,
    type: 'oauth',
    email: `${id}@example.com`,
    plan: 'pro',
    credentials: {
      accessToken: 'tok',
      refreshToken: 'ref',
      expiresAt: Date.now() + 3600000,
      scopes: ['user:inference'],
    },
    status: opts.status ?? 'idle',
    cooldownUntil: null,
    rateLimit: {
      window5h: {
        utilization: opts.utilization5h ?? 0,
        resetAt: opts.w5hResetAt ?? (Date.now() + 3600000),
        status: opts.w5hStatus ?? 'allowed',
      },
      weekly: {
        utilization: opts.weeklyUtilization ?? 0,
        resetAt: opts.weeklyResetAt ?? (Date.now() + 86400000),
        status: opts.weeklyStatus ?? 'allowed',
      },
    },
    addedAt: opts.addedAt ?? Date.now(),
  };
}

function makeRelay(id, opts = {}) {
  return {
    id,
    type: 'relay',
    nickname: opts.nickname ?? `relay-${id}`,
    baseUrl: opts.baseUrl ?? 'https://api.example-relay.com',
    credentials: { apiKey: opts.apiKey ?? 'sk-relay-test' },
    modelMap: opts.modelMap ?? {},
    status: opts.status ?? 'idle',
    addedAt: opts.addedAt ?? Date.now(),
  };
}

function makeTerminal(id, mode, accountId = null) {
  return { id, name: 'test', mode, accountId, createdAt: Date.now(), lastUsedAt: null };
}

// ── AccountPool: relay selection ──────────────────────────────────────────

test('relay is NOT selected in auto mode when an OAuth account is available', () => {
  const pool = new AccountPool({
    accounts: [makeOAuth('acc_oauth'), makeRelay('acc_relay')],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto'));
  assert.equal(acc.id, 'acc_oauth');
  assert.equal(acc.type, 'oauth');
});

test('relay IS selected in auto mode when all OAuth accounts are exhausted', () => {
  const pool = new AccountPool({
    accounts: [
      makeOAuth('acc_oauth_a', { status: 'exhausted' }),
      makeOAuth('acc_oauth_b', { status: 'exhausted' }),
      makeRelay('acc_relay'),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto'));
  assert.equal(acc.id, 'acc_relay');
  assert.equal(acc.type, 'relay');
});

test('relay IS selected in auto mode when all OAuth accounts are cooling', () => {
  const now = Date.now();
  const pool = new AccountPool({
    accounts: [
      makeOAuth('acc_oauth', { utilization5h: 1.0, w5hResetAt: now + 60000, w5hStatus: 'blocked' }),
      makeRelay('acc_relay'),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto'));
  assert.equal(acc.id, 'acc_relay');
});

test('among multiple relays, oldest addedAt wins', () => {
  const pool = new AccountPool({
    accounts: [
      makeOAuth('acc_oauth', { status: 'exhausted' }),
      makeRelay('acc_relay_b', { addedAt: 2000 }),
      makeRelay('acc_relay_a', { addedAt: 1000 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto'));
  assert.equal(acc.id, 'acc_relay_a');
});

test('manual mode pins to a relay account when specified', () => {
  const pool = new AccountPool({
    accounts: [makeOAuth('acc_oauth'), makeRelay('acc_relay')],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'manual', 'acc_relay'));
  assert.equal(acc.id, 'acc_relay');
});

test('exhausted relays are not selected', () => {
  const pool = new AccountPool({
    accounts: [
      makeOAuth('acc_oauth', { status: 'exhausted' }),
      makeRelay('acc_relay', { status: 'exhausted' }),
    ],
    terminals: [],
  });
  assert.throws(
    () => pool.selectAccount(makeTerminal('sk-1', 'auto')),
    { message: /503/ },
  );
});

test('selectFallback prefers OAuth, then relay', () => {
  const now = Date.now();
  const pool = new AccountPool({
    accounts: [
      makeOAuth('acc_oauth_a'),
      makeOAuth('acc_oauth_b'),
      makeRelay('acc_relay'),
    ],
    terminals: [],
  });
  // Exclude first oauth: fallback should be second oauth, not relay
  let fb = pool.selectFallback(new Set(['acc_oauth_a']));
  assert.equal(fb.id, 'acc_oauth_b');
  // Exclude both oauth: fallback is the relay
  fb = pool.selectFallback(new Set(['acc_oauth_a', 'acc_oauth_b']));
  assert.equal(fb.id, 'acc_relay');
});

// ── AccountPool: ensureFreshToken ─────────────────────────────────────────

test('ensureFreshToken returns relay account unchanged, without refresh', async () => {
  const relay = makeRelay('acc_relay');
  // Deliberately leave expiresAt undefined — would blow up if token-manager runs
  const pool = new AccountPool({
    accounts: [relay],
    terminals: [],
    configStore: { readAccounts: async () => [], writeAccounts: async () => {} },
  });
  const result = await pool.ensureFreshToken(relay);
  assert.equal(result.id, 'acc_relay');
  assert.equal(result.credentials.apiKey, 'sk-relay-test');
});

// ── applyModelMap ─────────────────────────────────────────────────────────

test('applyModelMap rewrites opus when opus target set', () => {
  const body = Buffer.from(JSON.stringify({ model: 'claude-opus-4-7', messages: [] }));
  const out = applyModelMap(body, { opus: 'claude-opus-4-5-20250929' });
  const parsed = JSON.parse(out.toString());
  assert.equal(parsed.model, 'claude-opus-4-5-20250929');
});

test('applyModelMap rewrites sonnet by prefix match', () => {
  const body = Buffer.from(JSON.stringify({ model: 'claude-sonnet-4-5-20250929', messages: [] }));
  const out = applyModelMap(body, { sonnet: 'claude-sonnet-4-20250514' });
  assert.equal(JSON.parse(out.toString()).model, 'claude-sonnet-4-20250514');
});

test('applyModelMap leaves haiku unchanged if haiku target not set', () => {
  const body = Buffer.from(JSON.stringify({ model: 'claude-haiku-4-5-20251001', messages: [] }));
  const out = applyModelMap(body, { opus: 'x' });
  assert.equal(JSON.parse(out.toString()).model, 'claude-haiku-4-5-20251001');
});

test('applyModelMap leaves body unchanged when modelMap is empty', () => {
  const body = Buffer.from(JSON.stringify({ model: 'claude-opus-4-7' }));
  const out = applyModelMap(body, {});
  assert.equal(JSON.parse(out.toString()).model, 'claude-opus-4-7');
});

test('applyModelMap leaves body unchanged when modelMap is null/undefined', () => {
  const body = Buffer.from(JSON.stringify({ model: 'claude-opus-4-7' }));
  assert.equal(JSON.parse(applyModelMap(body, null).toString()).model, 'claude-opus-4-7');
  assert.equal(JSON.parse(applyModelMap(body, undefined).toString()).model, 'claude-opus-4-7');
});

test('applyModelMap ignores non-claude models', () => {
  const body = Buffer.from(JSON.stringify({ model: 'gpt-4o-mini' }));
  const out = applyModelMap(body, { opus: 'x', sonnet: 'y', haiku: 'z' });
  assert.equal(JSON.parse(out.toString()).model, 'gpt-4o-mini');
});

test('applyModelMap returns original buffer if body is not valid JSON', () => {
  const body = Buffer.from('not json');
  const out = applyModelMap(body, { opus: 'x' });
  assert.equal(out.toString(), 'not json');
});

test('applyModelMap handles missing model field gracefully', () => {
  const body = Buffer.from(JSON.stringify({ messages: [] }));
  const out = applyModelMap(body, { opus: 'x' });
  const parsed = JSON.parse(out.toString());
  assert.equal(parsed.model, undefined);
});
