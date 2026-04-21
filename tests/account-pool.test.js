import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountPool } from '../src/proxy/account-pool.js';

function makeAccount(id, opts = {}) {
  return {
    id,
    email: `${id}@example.com`,
    plan: 'pro',
    credentials: { accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 3600000, scopes: ['user:inference'] },
    status: opts.status ?? 'idle',
    cooldownUntil: opts.cooldownUntil ?? null,
    rateLimit: {
      window5h: {
        used: opts.used5h ?? 0,
        limit: 100000,
        resetAt: opts.w5hResetAt ?? (Date.now() + 3600000),
        utilization: opts.utilization,
        status: opts.w5hStatus ?? 'allowed',
      },
      weekly: {
        resetAt: opts.weeklyResetAt ?? (Date.now() + 86400000),
        utilization: opts.weeklyUtilization,
        status: opts.weeklyStatus ?? 'allowed',
      },
      weeklyTokens: { used: 0, limit: 1000000, resetAt: Date.now() + 86400000 },
    },
    addedAt: opts.addedAt ?? Date.now(),
  };
}

function makeTerminal(id, mode, accountId) {
  return { id, name: 'test', mode, accountId, createdAt: Date.now(), lastUsedAt: null };
}

test('manual mode returns the pinned account', () => {
  const pool = new AccountPool({
    accounts: [makeAccount('acc_1')],
    terminals: [makeTerminal('sk-hub-1', 'manual', 'acc_1')],
  });
  const acc = pool.selectAccount(makeTerminal('sk-hub-1', 'manual', 'acc_1'));
  assert.equal(acc.id, 'acc_1');
});

test('manual mode throws 503 if circuit breaker is open', () => {
  const pool = new AccountPool({
    accounts: [makeAccount('acc_1')],
    terminals: [],
  });
  pool.getCircuitBreaker('acc_1').recordFailure();
  pool.getCircuitBreaker('acc_1').recordFailure();
  pool.getCircuitBreaker('acc_1').recordFailure();
  assert.throws(
    () => pool.selectAccount(makeTerminal('sk-1', 'manual', 'acc_1')),
    { message: /503/ }
  );
});

test('auto mode picks account with most 5h tokens remaining', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_low', { used5h: 80000 }),
      makeAccount('acc_high', { used5h: 20000 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', null));
  assert.equal(acc.id, 'acc_high');
});

test('auto mode throws 503 when all accounts exhausted', () => {
  const pool = new AccountPool({
    accounts: [makeAccount('acc_1', { status: 'exhausted' })],
    terminals: [],
  });
  assert.throws(
    () => pool.selectAccount(makeTerminal('sk-1', 'auto', null)),
    { message: /503/ }
  );
});

test('auto mode skips cooling preferred account (utilization >= 1.0) even when sticky', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_cool', { utilization: 1.0, w5hResetAt: Date.now() + 1800000 }),
      makeAccount('acc_warm', { utilization: 0.2 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', 'acc_cool'));
  assert.equal(acc.id, 'acc_warm');
});

test('auto mode skips account whose window5h.status is "blocked"', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_blocked', { w5hStatus: 'blocked', w5hResetAt: Date.now() + 1800000 }),
      makeAccount('acc_warm', { utilization: 0.3 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', null));
  assert.equal(acc.id, 'acc_warm');
});

test('auto mode treats a cooling account as warm once resetAt has passed (self-heal)', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_past', { utilization: 1.0, w5hResetAt: Date.now() - 60000 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', null));
  assert.equal(acc.id, 'acc_past');
});

test('auto mode falls back to soonest-resetAt cooling account when every account is cooling', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_later', { utilization: 1.0, w5hResetAt: Date.now() + 3600000 }),
      makeAccount('acc_sooner', { utilization: 1.0, w5hResetAt: Date.now() + 600000 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', null));
  assert.equal(acc.id, 'acc_sooner');
});

test('auto mode skips account whose weekly utilization is at capacity', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_wk_cool', { weeklyUtilization: 1.0, weeklyResetAt: Date.now() + 86400000 }),
      makeAccount('acc_warm', { utilization: 0.1 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', 'acc_wk_cool'));
  assert.equal(acc.id, 'acc_warm');
});

test('auto mode skips account whose weekly.status is "blocked"', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_wk_blocked', { weeklyStatus: 'blocked', weeklyResetAt: Date.now() + 86400000 }),
      makeAccount('acc_warm', { utilization: 0.2 }),
    ],
    terminals: [],
  });
  const acc = pool.selectAccount(makeTerminal('sk-1', 'auto', null));
  assert.equal(acc.id, 'acc_warm');
});

test('selectFallback prefers a warm account over a cooling one', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_cool', { utilization: 1.0, w5hResetAt: Date.now() + 1800000 }),
      makeAccount('acc_warm', { utilization: 0.1 }),
    ],
    terminals: [],
  });
  const fallback = pool.selectFallback(new Set());
  assert.equal(fallback?.id, 'acc_warm');
});

test('markUnauthorized sets account status to exhausted in memory', async () => {
  const mockStore = {
    readAccounts: async () => [],   // disk has no match → write path silent no-op
    writeAccounts: async () => {},
  };
  const pool = new AccountPool({
    accounts: [makeAccount('acc_1'), makeAccount('acc_2')],
    terminals: [],
    configStore: mockStore,
  });
  await pool.markUnauthorized('acc_1');
  assert.equal(pool.getAccount('acc_1').status, 'exhausted');
  assert.equal(pool.getAccount('acc_2').status, 'idle'); // other account untouched
});

test('markUnauthorized for unknown id is a no-op (does not throw)', async () => {
  const pool = new AccountPool({ accounts: [makeAccount('acc_1')], terminals: [] });
  await pool.markUnauthorized('acc_nonexistent');
  assert.equal(pool.getAccount('acc_1').status, 'idle');
});

test('updateRateLimit updates account in memory', () => {
  const acc = makeAccount('acc_1');
  const pool = new AccountPool({ accounts: [acc], terminals: [] });
  pool.updateRateLimit('acc_1', {
    'x-ratelimit-tokens-limit': '100000',
    'x-ratelimit-tokens-remaining': '70000',
    'x-ratelimit-tokens-reset': new Date(Date.now() + 3600000).toISOString(),
  });
  const updated = pool.getAccount('acc_1');
  assert.equal(updated.rateLimit.window5h.used, 30000);
});
