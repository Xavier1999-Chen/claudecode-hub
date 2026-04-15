import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We'll pass configDir to the factory to support testing with temp dirs
import { createConfigStore } from '../src/shared/config.js';

let dir;
test.before(async () => { dir = await mkdtemp(join(tmpdir(), 'hub-')); });
test.after(async () => { await rm(dir, { recursive: true }); });

test('readAccounts returns [] when file missing', async () => {
  const store = createConfigStore(dir);
  assert.deepEqual(await store.readAccounts(), []);
});

test('writeAccounts then readAccounts round-trips data', async () => {
  const store = createConfigStore(dir);
  const acc = [{ id: 'acc_1', email: 'a@b.com' }];
  await store.writeAccounts(acc);
  assert.deepEqual(await store.readAccounts(), acc);
});

test('readTerminals returns [] when file missing', async () => {
  const store = createConfigStore(join(tmpdir(), 'nonexistent-hub-' + Date.now()));
  assert.deepEqual(await store.readTerminals(), []);
});

test('writeTerminals then readTerminals round-trips data', async () => {
  const store = createConfigStore(dir);
  const terms = [{ id: 'sk-hub-abc', name: 'brave-koala' }];
  await store.writeTerminals(terms);
  assert.deepEqual(await store.readTerminals(), terms);
});
