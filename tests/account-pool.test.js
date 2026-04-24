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
      makeAccount('acc_low', { utilization: 0.8 }),
      makeAccount('acc_high', { utilization: 0.2 }),
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

test('markUnauthorized sets status=exhausted and plan=free in memory', async () => {
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
  assert.equal(pool.getAccount('acc_1').plan, 'free');
  assert.equal(pool.getAccount('acc_2').status, 'idle'); // other account untouched
  assert.equal(pool.getAccount('acc_2').plan, 'pro');
});

test('markUnauthorized for unknown id is a no-op (does not throw)', async () => {
  const pool = new AccountPool({ accounts: [makeAccount('acc_1')], terminals: [] });
  await pool.markUnauthorized('acc_nonexistent');
  assert.equal(pool.getAccount('acc_1').status, 'idle');
});

test('auto mode distributes terminals across accounts when utilization is equal', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_1', { utilization: 0 }),
      makeAccount('acc_2', { utilization: 0 }),
      makeAccount('acc_3', { utilization: 0 }),
    ],
    terminals: [],
  });
  pool.setTerminals([
    makeTerminal('sk-1', 'auto', 'acc_1'),
    makeTerminal('sk-2', 'auto', 'acc_1'),
  ]);
  const acc = pool.selectAccount(makeTerminal('sk-new', 'auto', null));
  assert.notEqual(acc.id, 'acc_1', 'should pick an account with fewer terminals');
});

test('auto mode prefers fewer terminals over lower utilization', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_busy', { utilization: 0.1 }),
      makeAccount('acc_free', { utilization: 0.3 }),
    ],
    terminals: [],
  });
  pool.setTerminals([
    makeTerminal('sk-1', 'auto', 'acc_busy'),
    makeTerminal('sk-2', 'auto', 'acc_busy'),
    makeTerminal('sk-3', 'auto', 'acc_busy'),
  ]);
  const acc = pool.selectAccount(makeTerminal('sk-new', 'auto', null));
  assert.equal(acc.id, 'acc_free');
});

test('auto mode uses weekly utilization as tiebreaker', () => {
  const pool = new AccountPool({
    accounts: [
      makeAccount('acc_wk_high', { utilization: 0.5, weeklyUtilization: 0.8 }),
      makeAccount('acc_wk_low', { utilization: 0.5, weeklyUtilization: 0.2 }),
    ],
    terminals: [],
  });
  pool.setTerminals([]);
  const acc = pool.selectAccount(makeTerminal('sk-new', 'auto', null));
  assert.equal(acc.id, 'acc_wk_low');
});

test('updateRateLimit updates account in memory', () => {
  const acc = makeAccount('acc_1');
  const resetEpoch = Math.floor((Date.now() + 3600000) / 1000);
  const pool = new AccountPool({ accounts: [acc], terminals: [] });
  pool.updateRateLimit('acc_1', {
    'anthropic-ratelimit-unified-5h-utilization': '0.3',
    'anthropic-ratelimit-unified-5h-reset': String(resetEpoch),
    'anthropic-ratelimit-unified-5h-status': 'allowed',
  });
  const updated = pool.getAccount('acc_1');
  assert.equal(updated.rateLimit.window5h.utilization, 0.3);
  assert.equal(updated.rateLimit.window5h.status, 'allowed');
});

// ── Issue #42: Single-writer callbacks ─────────────────────────────────

test('ensureFreshToken calls onCredentialsRefreshed instead of writing to disk', async () => {
  const newCreds = { accessToken: 'new-tok', refreshToken: 'new-ref', expiresAt: Date.now() + 3600000, scopes: ['user:inference'] };

  const writtenAccounts = [];
  const refreshedCall = { called: false, accountId: null, credentials: null };
  const mockStore = {
    readAccounts: async () => [],
    writeAccounts: async (data) => { writtenAccounts.push(data); },
  };

  const expiredAcc = makeAccount('acc_1', {});
  expiredAcc.credentials.expiresAt = Date.now() - 1000;

  const pool = new AccountPool({
    accounts: [expiredAcc],
    terminals: [],
    configStore: mockStore,
    refreshToken: async () => ({ credentials: newCreds }),
    onCredentialsRefreshed: (accountId, credentials) => {
      refreshedCall.called = true;
      refreshedCall.accountId = accountId;
      refreshedCall.credentials = credentials;
    },
  });

  const result = await pool.ensureFreshToken(expiredAcc);

  assert.equal(refreshedCall.called, true, 'onCredentialsRefreshed should be called');
  assert.equal(refreshedCall.accountId, 'acc_1');
  assert.equal(refreshedCall.credentials.accessToken, 'new-tok');
  assert.equal(writtenAccounts.length, 0, 'writeAccounts must NOT be called');
  assert.equal(result.credentials.accessToken, 'new-tok', 'in-memory credentials still updated');
});

test('markUnauthorized calls onAccountExhausted instead of writing to disk', async () => {
  const writtenAccounts = [];
  const exhaustedCall = { called: false, accountId: null };
  const mockStore = {
    readAccounts: async () => [],
    writeAccounts: async (data) => { writtenAccounts.push(data); },
  };

  const pool = new AccountPool({
    accounts: [makeAccount('acc_1'), makeAccount('acc_2')],
    terminals: [],
    configStore: mockStore,
    onAccountExhausted: (accountId) => {
      exhaustedCall.called = true;
      exhaustedCall.accountId = accountId;
    },
  });

  await pool.markUnauthorized('acc_1');

  assert.equal(exhaustedCall.called, true, 'onAccountExhausted should be called');
  assert.equal(exhaustedCall.accountId, 'acc_1');
  assert.equal(writtenAccounts.length, 0, 'writeAccounts must NOT be called');
  // In-memory state still updated (proxy routing needs this immediately)
  assert.equal(pool.getAccount('acc_1').status, 'exhausted');
  assert.equal(pool.getAccount('acc_1').plan, 'free');
  assert.equal(pool.getAccount('acc_2').status, 'idle');
});

test('ensureFreshToken works without onCredentialsRefreshed callback', async () => {
  const mockStore = {
    readAccounts: async () => [],
    writeAccounts: async () => {},
  };

  const expiredAcc = makeAccount('acc_1', {});
  expiredAcc.credentials.expiresAt = Date.now() - 1000;

  const pool = new AccountPool({
    accounts: [expiredAcc],
    terminals: [],
    configStore: mockStore,
    refreshToken: async () => ({
      credentials: { accessToken: 'new-tok', refreshToken: 'ref', expiresAt: Date.now() + 3600000 },
    }),
    // onCredentialsRefreshed NOT provided
  });

  const result = await pool.ensureFreshToken(expiredAcc);
  assert.equal(result.credentials.accessToken, 'new-tok');
  // No exception thrown is the test
});

test('markUnauthorized works without onAccountExhausted callback', async () => {
  const mockStore = {
    readAccounts: async () => [],
    writeAccounts: async () => {},
  };

  const pool = new AccountPool({
    accounts: [makeAccount('acc_1')],
    terminals: [],
    configStore: mockStore,
    // onAccountExhausted NOT provided
  });

  await pool.markUnauthorized('acc_1');
  assert.equal(pool.getAccount('acc_1').status, 'exhausted');
  // No exception thrown is the test
});
