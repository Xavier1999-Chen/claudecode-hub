import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  intensityLevel,
  tierProgress,
  needleAngle,
  tierFillColor,
  currentCycle,
  aggregateDailyByTerminal,
  cellBucket,
  TIER_COLORS,
  CYCLE_MS,
} from '../src/admin/frontend/src/usage-intensity.js';

// ── intensityLevel ────────────────────────────────────────────────────────

test('intensityLevel: $0 → light', () => {
  assert.equal(intensityLevel(0), 'light');
});
test('intensityLevel: $19.99 → light', () => {
  assert.equal(intensityLevel(19.99), 'light');
});
test('intensityLevel: $20 → medium (boundary)', () => {
  assert.equal(intensityLevel(20), 'medium');
});
test('intensityLevel: $149.99 → medium', () => {
  assert.equal(intensityLevel(149.99), 'medium');
});
test('intensityLevel: $150 → heavy (boundary)', () => {
  assert.equal(intensityLevel(150), 'heavy');
});
test('intensityLevel: $899.99 → heavy', () => {
  assert.equal(intensityLevel(899.99), 'heavy');
});
test('intensityLevel: $900 → xheavy (boundary)', () => {
  assert.equal(intensityLevel(900), 'xheavy');
});
test('intensityLevel: $5000 → xheavy', () => {
  assert.equal(intensityLevel(5000), 'xheavy');
});

// ── tierProgress — resets at every boundary ──────────────────────────────

test('tierProgress: $0 → light 0', () => {
  const p = tierProgress(0);
  assert.equal(p.tier, 'light');
  assert.equal(p.ratio, 0);
});
test('tierProgress: $10 → light 0.5', () => {
  const p = tierProgress(10);
  assert.equal(p.tier, 'light');
  assert.equal(p.ratio, 0.5);
});
test('tierProgress: $20 → medium 0 (reset on boundary)', () => {
  const p = tierProgress(20);
  assert.equal(p.tier, 'medium');
  assert.equal(p.ratio, 0);
});
test('tierProgress: $85 → medium 0.5', () => {
  const p = tierProgress(85);
  assert.equal(p.tier, 'medium');
  assert.equal(p.ratio, 0.5);
});
test('tierProgress: $150 → heavy 0 (reset)', () => {
  const p = tierProgress(150);
  assert.equal(p.tier, 'heavy');
  assert.equal(p.ratio, 0);
});
test('tierProgress: $525 → heavy 0.5', () => {
  const p = tierProgress(525);
  assert.equal(p.tier, 'heavy');
  assert.equal(p.ratio, 0.5);
});
test('tierProgress: $900 → xheavy 1 (clamped, no upper bound)', () => {
  const p = tierProgress(900);
  assert.equal(p.tier, 'xheavy');
  assert.equal(p.ratio, 1);
});
test('tierProgress: $10000 → xheavy 1 (still clamped)', () => {
  const p = tierProgress(10000);
  assert.equal(p.tier, 'xheavy');
  assert.equal(p.ratio, 1);
});

// ── needleAngle — each tier sweeps 0-180° independently ─────────────────

test('needleAngle: $0 → 0°', () => {
  assert.equal(needleAngle(0), 0);
});
test('needleAngle: $10 (mid-light) → 90°', () => {
  assert.equal(needleAngle(10), 90);
});
test('needleAngle: $19.99 → ~179.9° (near end of tier)', () => {
  assert.ok(needleAngle(19.99) > 179);
  assert.ok(needleAngle(19.99) < 180);
});
test('needleAngle: $20 → 0° (reset into medium)', () => {
  assert.equal(needleAngle(20), 0);
});
test('needleAngle: $85 → 90° (mid-medium)', () => {
  assert.equal(needleAngle(85), 90);
});
test('needleAngle: $150 → 0° (reset into heavy)', () => {
  assert.equal(needleAngle(150), 0);
});
test('needleAngle: $900 → 180° (pinned at end in xheavy)', () => {
  assert.equal(needleAngle(900), 180);
});
test('needleAngle: $5000 → 180° (still pinned)', () => {
  assert.equal(needleAngle(5000), 180);
});

// ── tierFillColor ────────────────────────────────────────────────────────

test('tierFillColor returns tier-specific hex', () => {
  assert.equal(tierFillColor('light'), TIER_COLORS.light);
  assert.equal(tierFillColor('medium'), TIER_COLORS.medium);
  assert.equal(tierFillColor('heavy'), TIER_COLORS.heavy);
  assert.equal(tierFillColor('xheavy'), TIER_COLORS.xheavy);
});

// ── currentCycle ─────────────────────────────────────────────────────────

test('currentCycle: now == anchor → index 0', () => {
  const now = new Date('2026-04-23T10:00:00Z').getTime();
  const c = currentCycle('2026-04-23T10:00:00Z', now);
  assert.equal(c.index, 0);
  assert.equal(c.start, now);
  assert.equal(c.end, now + CYCLE_MS);
});
test('currentCycle: 45 days after anchor → index 1', () => {
  const anchor = new Date('2026-01-01T00:00:00Z').getTime();
  const now = anchor + 45 * 86400000;
  const c = currentCycle(anchor, now);
  assert.equal(c.index, 1);
  assert.equal(c.start, anchor + CYCLE_MS);
  assert.equal(c.end, anchor + 2 * CYCLE_MS);
});
test('currentCycle: exactly 30 days → index 1 (end-of-cycle 0 is start-of-cycle 1)', () => {
  const anchor = new Date('2026-01-01T00:00:00Z').getTime();
  const now = anchor + CYCLE_MS;
  const c = currentCycle(anchor, now);
  assert.equal(c.index, 1);
});
test('currentCycle: now before anchor → index 0, clamped', () => {
  const anchor = new Date('2026-04-23T10:00:00Z').getTime();
  const now = anchor - 86400000;
  const c = currentCycle(anchor, now);
  assert.equal(c.index, 0);
});

// ── aggregateDailyByTerminal ─────────────────────────────────────────────

test('aggregateDailyByTerminal: groups by terminal + day, sums usd', () => {
  const d1 = new Date('2026-04-22T03:00:00').getTime();
  const d1b = new Date('2026-04-22T21:00:00').getTime();
  const d2 = new Date('2026-04-23T10:00:00').getTime();
  const records = [
    { ts: d1,  terminalId: 't1', usd: 1.5 },
    { ts: d1b, terminalId: 't1', usd: 2.5 },  // same day → sums with d1
    { ts: d2,  terminalId: 't1', usd: 0.7 },  // different day
    { ts: d1,  terminalId: 't2', usd: 10 },   // different terminal
  ];
  const out = aggregateDailyByTerminal(records, 0);
  assert.equal(out.t1['2026-04-22'], 4.0);
  assert.equal(out.t1['2026-04-23'], 0.7);
  assert.equal(out.t2['2026-04-22'], 10);
});

test('aggregateDailyByTerminal: filters by sinceTs', () => {
  const old = new Date('2026-01-01T00:00:00').getTime();
  const recent = new Date('2026-04-23T00:00:00').getTime();
  const records = [
    { ts: old, terminalId: 't1', usd: 99 },
    { ts: recent, terminalId: 't1', usd: 3 },
  ];
  const out = aggregateDailyByTerminal(records, new Date('2026-04-01').getTime());
  assert.equal(out.t1['2026-04-23'], 3);
  assert.equal(Object.keys(out.t1).length, 1);
});

test('aggregateDailyByTerminal: empty input → empty result', () => {
  assert.deepEqual(aggregateDailyByTerminal([], 0), {});
});

test('aggregateDailyByTerminal: skips malformed records', () => {
  const records = [null, { foo: 'bar' }, { ts: 'not-a-number', terminalId: 't1', usd: 5 }];
  assert.deepEqual(aggregateDailyByTerminal(records, 0), {});
});

// ── cellBucket ───────────────────────────────────────────────────────────

test('cellBucket: $0 → empty', () => assert.equal(cellBucket(0), 'empty'));
test('cellBucket: $0.5 → low',  () => assert.equal(cellBucket(0.5), 'low'));
test('cellBucket: $1 → mid (boundary)', () => assert.equal(cellBucket(1), 'mid'));
test('cellBucket: $4.99 → mid', () => assert.equal(cellBucket(4.99), 'mid'));
test('cellBucket: $5 → high (boundary)', () => assert.equal(cellBucket(5), 'high'));
test('cellBucket: $29.99 → high', () => assert.equal(cellBucket(29.99), 'high'));
test('cellBucket: $30 → xhigh (boundary)', () => assert.equal(cellBucket(30), 'xhigh'));
test('cellBucket: $500 → xhigh', () => assert.equal(cellBucket(500), 'xhigh'));
