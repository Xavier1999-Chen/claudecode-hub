import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isWindowCooling,
  isAccountCooling,
  reassignCoolingTerminals,
} from '../src/admin/reassignment.js';

function makeAccount(id, opts = {}) {
  return {
    id,
    status: opts.status ?? 'idle',
    rateLimit: {
      window5h: {
        utilization: opts.utilization,
        status: opts.w5hStatus ?? 'allowed',
        resetAt: opts.w5hResetAt ?? (Date.now() + 3600000),
      },
      weekly: {
        utilization: opts.weeklyUtilization,
        status: opts.weeklyStatus ?? 'allowed',
        resetAt: opts.weeklyResetAt ?? (Date.now() + 86400000),
      },
    },
  };
}

function makeTerminal(id, mode, accountId) {
  return { id, name: id, mode, accountId };
}

function makeStore(terminals) {
  const state = { terminals: [...terminals] };
  return {
    state,
    readTerminals: async () => state.terminals.map(t => ({ ...t })),
    writeTerminals: async (ts) => { state.terminals = ts.map(t => ({ ...t })); },
  };
}

test('isWindowCooling: status "blocked" is cooling', () => {
  assert.equal(isWindowCooling({ status: 'blocked', resetAt: Date.now() + 1000 }), true);
});

test('isWindowCooling: utilization >= 1.0 with future resetAt is cooling', () => {
  assert.equal(isWindowCooling({ utilization: 1.0, resetAt: Date.now() + 1000 }), true);
  assert.equal(isWindowCooling({ utilization: 1.5, resetAt: Date.now() + 1000 }), true);
});

test('isWindowCooling: utilization >= 1.0 with past resetAt is NOT cooling (self-heal)', () => {
  assert.equal(isWindowCooling({ utilization: 1.0, resetAt: Date.now() - 1000 }), false);
});

test('isWindowCooling: utilization < 1.0 is not cooling', () => {
  assert.equal(isWindowCooling({ utilization: 0.5, resetAt: Date.now() + 1000 }), false);
});

test('isWindowCooling: null/undefined window is not cooling', () => {
  assert.equal(isWindowCooling(null), false);
  assert.equal(isWindowCooling(undefined), false);
});

test('isAccountCooling: window5h cooling triggers account-level cooling', () => {
  const acc = makeAccount('a', { utilization: 1.0 });
  assert.equal(isAccountCooling(acc), true);
});

test('isAccountCooling: weekly cooling triggers account-level cooling', () => {
  const acc = makeAccount('a', { weeklyUtilization: 1.0 });
  assert.equal(isAccountCooling(acc), true);
});

test('isAccountCooling: neither cooling returns false', () => {
  const acc = makeAccount('a', { utilization: 0.2, weeklyUtilization: 0.3 });
  assert.equal(isAccountCooling(acc), false);
});

test('reassignCoolingTerminals: moves auto terminals to the warmest account', async () => {
  const accounts = [
    makeAccount('acc_cool', { utilization: 1.0 }),
    makeAccount('acc_low', { utilization: 0.1 }),
    makeAccount('acc_high', { utilization: 0.6 }),
  ];
  const store = makeStore([
    makeTerminal('t1', 'auto', 'acc_cool'),
    makeTerminal('t2', 'auto', 'acc_cool'),
  ]);
  await reassignCoolingTerminals('acc_cool', accounts, ['auto'], store);
  assert.equal(store.state.terminals[0].accountId, 'acc_low');
  assert.equal(store.state.terminals[1].accountId, 'acc_low');
});

test('reassignCoolingTerminals: leaves manual-mode terminals untouched', async () => {
  const accounts = [
    makeAccount('acc_cool', { utilization: 1.0 }),
    makeAccount('acc_warm', { utilization: 0.1 }),
  ];
  const store = makeStore([
    makeTerminal('t_manual', 'manual', 'acc_cool'),
    makeTerminal('t_auto',   'auto',   'acc_cool'),
  ]);
  await reassignCoolingTerminals('acc_cool', accounts, ['auto'], store);
  assert.equal(store.state.terminals.find(t => t.id === 't_manual').accountId, 'acc_cool');
  assert.equal(store.state.terminals.find(t => t.id === 't_auto').accountId,   'acc_warm');
});

test('reassignCoolingTerminals: leaves terminals in place when no warm account exists', async () => {
  const accounts = [
    makeAccount('acc_cool_a', { utilization: 1.0 }),
    makeAccount('acc_cool_b', { utilization: 1.0 }),
  ];
  const store = makeStore([
    makeTerminal('t_auto', 'auto', 'acc_cool_a'),
  ]);
  await reassignCoolingTerminals('acc_cool_a', accounts, ['auto'], store);
  assert.equal(store.state.terminals[0].accountId, 'acc_cool_a');
});

test('reassignCoolingTerminals: excludes exhausted accounts from candidates', async () => {
  const accounts = [
    makeAccount('acc_cool',   { utilization: 1.0 }),
    makeAccount('acc_dead',   { utilization: 0.1, status: 'exhausted' }),
    makeAccount('acc_warm',   { utilization: 0.3 }),
  ];
  const store = makeStore([
    makeTerminal('t_auto', 'auto', 'acc_cool'),
  ]);
  await reassignCoolingTerminals('acc_cool', accounts, ['auto'], store);
  assert.equal(store.state.terminals[0].accountId, 'acc_warm');
});

test('reassignCoolingTerminals: no-op when no affected terminals', async () => {
  const accounts = [
    makeAccount('acc_cool', { utilization: 1.0 }),
    makeAccount('acc_warm', { utilization: 0.1 }),
  ];
  const store = makeStore([
    makeTerminal('t_auto', 'auto', 'acc_warm'), // not on the cooling account
  ]);
  const before = store.state.terminals[0].accountId;
  await reassignCoolingTerminals('acc_cool', accounts, ['auto'], store);
  assert.equal(store.state.terminals[0].accountId, before);
});
