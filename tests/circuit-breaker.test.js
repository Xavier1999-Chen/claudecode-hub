import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CircuitBreaker } from '../src/proxy/circuit-breaker.js';

test('starts closed — canRequest() is true', () => {
  const cb = new CircuitBreaker({ threshold: 3, timeout: 5000 });
  assert.ok(cb.canRequest());
});

test('opens after threshold failures', () => {
  const cb = new CircuitBreaker({ threshold: 2, timeout: 60000 });
  cb.recordFailure();
  assert.ok(cb.canRequest(), 'still closed after 1 failure');
  cb.recordFailure();
  assert.ok(!cb.canRequest(), 'open after 2 failures');
});

test('half-open after timeout, closes on success', () => {
  const cb = new CircuitBreaker({ threshold: 1, timeout: 10 });
  cb.recordFailure();
  assert.ok(!cb.canRequest(), 'open');
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.ok(cb.canRequest(), 'half-open after timeout');
      cb.recordSuccess();
      assert.ok(cb.canRequest(), 'closed after success');
      resolve();
    }, 20);
  });
});

test('re-opens on failure in half-open state', () => {
  const cb = new CircuitBreaker({ threshold: 1, timeout: 10 });
  cb.recordFailure();
  return new Promise((resolve) => {
    setTimeout(() => {
      cb.canRequest(); // transitions to half-open
      cb.recordFailure(); // back to open
      assert.ok(!cb.canRequest(), 'open again');
      resolve();
    }, 20);
  });
});

test('forceClose() resets to closed', () => {
  const cb = new CircuitBreaker({ threshold: 1, timeout: 60000 });
  cb.recordFailure();
  assert.ok(!cb.canRequest());
  cb.forceClose();
  assert.ok(cb.canRequest());
});

test('onOpen callback fires when state transitions to OPEN', () => {
  let openCount = 0;
  const cb = new CircuitBreaker({
    threshold: 2,
    timeout: 60000,
    onOpen: () => { openCount++; },
  });
  cb.recordFailure();
  assert.equal(openCount, 0, 'not open yet at 1 failure');
  cb.recordFailure(); // threshold reached, opens
  assert.equal(openCount, 1, 'callback fired on open');
});

test('onOpen does NOT fire when already OPEN (no duplicate)', () => {
  let openCount = 0;
  const cb = new CircuitBreaker({
    threshold: 1,
    timeout: 60000,
    onOpen: () => { openCount++; },
  });
  cb.recordFailure(); // opens
  assert.equal(openCount, 1);
  cb.recordFailure(); // already OPEN, no transition
  assert.equal(openCount, 1, 'no duplicate callback');
});

test('onOpen fires when half-open probe fails (re-open)', async () => {
  let openCount = 0;
  const cb = new CircuitBreaker({
    threshold: 1,
    timeout: 10,
    onOpen: () => { openCount++; },
  });
  cb.recordFailure(); // 1st open
  assert.equal(openCount, 1);
  await new Promise(r => setTimeout(r, 20));
  cb.canRequest(); // half-open
  cb.recordFailure(); // re-opens
  assert.equal(openCount, 2, 'callback fires on re-open from half-open');
});

test('onOpen is not required — works without it', () => {
  const cb = new CircuitBreaker({ threshold: 1, timeout: 60000 });
  cb.recordFailure(); // should not throw
  assert.ok(!cb.canRequest());
});
