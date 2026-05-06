import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createConfigStore } from '../src/shared/config.js';
import { AccountsMutex } from '../src/admin/accounts-mutex.js';

let dir;
test.before(async () => { dir = await mkdtemp(join(tmpdir(), 'hub-mutex-')); });
test.after(async () => { await rm(dir, { recursive: true }); });

// ── Baseline: demonstrate the race exists when read-modify-write is unwrapped ──
// This is the bug pattern from issue #62: probeAllRelays-style operation with a
// long internal await (network probe) reads an old snapshot, then a concurrent
// report-credentials operation writes a new credential, then probeAllRelays
// completes and overwrites with its stale snapshot — losing the credential update.
test('baseline · concurrent read-modify-write loses updates without mutex', async () => {
  const store = createConfigStore(dir);
  await store.writeAccounts([
    { id: 'a', credentials: { refreshToken: 'RT_v0' } },
    { id: 'b', rateLimit: null },
  ]);

  // Op A: probeAllRelays-like — reads, awaits (simulating relay probe), writes
  const opA = (async () => {
    const accounts = await store.readAccounts();
    await new Promise(r => setTimeout(r, 30)); // simulate network probe
    accounts.find(a => a.id === 'b').rateLimit = { utilization: 0.5 };
    await store.writeAccounts(accounts);
  })();

  // Op B: report-credentials-like — reads after A's read, patches credential, writes
  await new Promise(r => setTimeout(r, 5));
  const opB = (async () => {
    const accounts = await store.readAccounts();
    accounts.find(a => a.id === 'a').credentials.refreshToken = 'RT_v1';
    await store.writeAccounts(accounts);
  })();

  await Promise.all([opA, opB]);

  const final = await store.readAccounts();
  assert.equal(
    final.find(a => a.id === 'a').credentials.refreshToken,
    'RT_v0',
    'unwrapped race: B\'s RT_v1 update is overwritten by A\'s stale snapshot',
  );
});

// ── Fix: AccountsMutex serialises read-modify-write so updates are not lost ──
test('fix · AccountsMutex serialises operations, both updates preserved', async () => {
  const store = createConfigStore(dir);
  await store.writeAccounts([
    { id: 'a', credentials: { refreshToken: 'RT_v0' } },
    { id: 'b', rateLimit: null },
  ]);

  const mutex = new AccountsMutex();

  // Same race scenario but each op is wrapped in mutex.runExclusive
  const opA = mutex.runExclusive(async () => {
    const accounts = await store.readAccounts();
    await new Promise(r => setTimeout(r, 30));
    accounts.find(a => a.id === 'b').rateLimit = { utilization: 0.5 };
    await store.writeAccounts(accounts);
  });

  await new Promise(r => setTimeout(r, 5));
  const opB = mutex.runExclusive(async () => {
    const accounts = await store.readAccounts();
    accounts.find(a => a.id === 'a').credentials.refreshToken = 'RT_v1';
    await store.writeAccounts(accounts);
  });

  await Promise.all([opA, opB]);

  const final = await store.readAccounts();
  assert.equal(
    final.find(a => a.id === 'a').credentials.refreshToken,
    'RT_v1',
    'with mutex: B reads after A completes, RT_v1 persists',
  );
  assert.deepEqual(
    final.find(a => a.id === 'b').rateLimit,
    { utilization: 0.5 },
    'with mutex: A\'s rateLimit update also preserved',
  );
});

// ── runExclusive returns the function's resolved value ──
test('runExclusive returns the value resolved by fn', async () => {
  const mutex = new AccountsMutex();
  const result = await mutex.runExclusive(async () => 42);
  assert.equal(result, 42);
});

// ── runExclusive propagates errors from fn to its caller ──
test('runExclusive rejects when fn throws, chain stays usable', async () => {
  const mutex = new AccountsMutex();

  await assert.rejects(
    () => mutex.runExclusive(async () => { throw new Error('boom'); }),
    /boom/,
  );

  // Chain must remain usable after a rejection
  const result = await mutex.runExclusive(async () => 'still works');
  assert.equal(result, 'still works');
});

// ── Strict serialisation order: 3 concurrent runs execute sequentially ──
test('runExclusive enforces FIFO order across concurrent runners', async () => {
  const mutex = new AccountsMutex();
  const order = [];
  const results = await Promise.all([
    mutex.runExclusive(async () => {
      await new Promise(r => setTimeout(r, 20));
      order.push(1);
      return 1;
    }),
    mutex.runExclusive(async () => {
      await new Promise(r => setTimeout(r, 5));
      order.push(2);
      return 2;
    }),
    mutex.runExclusive(async () => {
      order.push(3);
      return 3;
    }),
  ]);
  assert.deepEqual(order, [1, 2, 3], 'execution order must follow enqueue order');
  assert.deepEqual(results, [1, 2, 3]);
});
