import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateQueue } from '../src/proxy/rate-queue.js';

test('executes task immediately when queue is empty', async () => {
  const rq = new RateQueue();
  let called = false;
  await rq.enqueue(() => { called = true; return Promise.resolve('ok'); });
  assert.ok(called);
});

test('serialises two tasks — second waits for first', async () => {
  const rq = new RateQueue();
  const order = [];
  const p1 = rq.enqueue(async () => {
    await new Promise(r => setTimeout(r, 10));
    order.push(1);
  });
  const p2 = rq.enqueue(async () => { order.push(2); });
  await Promise.all([p1, p2]);
  assert.deepEqual(order, [1, 2]);
});

test('delay(ms) inserts a pause before the next task', async () => {
  const rq = new RateQueue();
  const start = Date.now();
  rq.delay(30);
  await rq.enqueue(() => Promise.resolve());
  assert.ok(Date.now() - start >= 25, 'should have waited ~30ms');
});

test('enqueue rejects if task throws', async () => {
  const rq = new RateQueue();
  await assert.rejects(
    () => rq.enqueue(() => Promise.reject(new Error('boom'))),
    /boom/
  );
});
