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
      window5h: { used: opts.used5h ?? 0, limit: 100000, resetAt: Date.now() + 3600000 },
      weeklyTokens: { used: 0, limit: 1000000, resetAt: Date.now() + 86400000 },
    },
    addedAt: Date.now(),
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
