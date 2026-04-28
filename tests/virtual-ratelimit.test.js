import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { calcVirtualRateLimit } from '../src/admin/virtual-ratelimit.js';

let dir;
test.before(async () => { dir = await mkdtemp(join(tmpdir(), 'hub-vrl-')); });
test.after(async () => { await rm(dir, { recursive: true }); });

async function writeUsageJsonl(accountId, records) {
  const logDir = join(dir, accountId);
  await mkdir(logDir, { recursive: true });
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  await writeFile(join(logDir, 'usage.jsonl'), lines);
}

// 固定窗口语义下的时间戳辅助：
//   inBucket()  → 当前 5h 桶 + 当前周内的安全时间戳（NOW - 1s 兜底到桶起点）
//   before5h() → 上一个 5h 桶（同一周内）→ 7d 计入但 5h 不计入
//   beforeWeek() → 当前周起点之前 → 两个窗口都不计入
const FIVE_H = 5 * 3600_000;
const NOW_REF = Date.now();
const BUCKET_START_REF = Math.floor(NOW_REF / FIVE_H) * FIVE_H;
const dRef = new Date(NOW_REF);
const daysSinceMondayRef = (dRef.getUTCDay() + 6) % 7;
const WEEK_START_REF = Date.UTC(dRef.getUTCFullYear(), dRef.getUTCMonth(), dRef.getUTCDate() - daysSinceMondayRef);

function inBucket() {
  // 总是在当前 5h 桶内（bucket_start + 60s，给桶刚开始的边缘情况留余量）
  return BUCKET_START_REF + 60_000;
}
function before5h() {
  // 上一个 5h 桶内：先确保不早于本周起点（边缘 case：周一 00:00 UTC）
  return Math.max(BUCKET_START_REF - 60_000, WEEK_START_REF + 60_000);
}
function beforeWeek() {
  return WEEK_START_REF - 60_000;
}

function next5hReset() {
  const now = Date.now();
  return Math.ceil(now / (5 * 3600_000)) * (5 * 3600_000);
}

function nextMondayReset() {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMonday);
}

test('weighted utilization with different tiers', async () => {
  const accountId = 'acc_weight';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 1000, out: 500, tier: 'opus' },    // 1500 * 4.0 = 6000
    { ts: inBucket(), in: 1000, out: 500, tier: 'sonnet' },  // 1500 * 2.0 = 3000
    { ts: inBucket(), in: 1000, out: 500, tier: 'haiku' },   // 1500 * 1.0 = 1500
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  const limit5h = 2_500_000;

  assert.equal(rl.window5h.utilization, (6000 + 3000 + 1500) / limit5h);
  assert.equal(rl.window5h.status, 'allowed');
});

test('falls back to sonnet when tier is missing', async () => {
  const accountId = 'acc_fallback';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 1000, out: 500 },  // no tier → sonnet (2.0)
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  const limit5h = 2_500_000;
  assert.equal(rl.window5h.utilization, (1500 * 2.0) / limit5h);
});

test('5h window filters correctly', async () => {
  const accountId = 'acc_5h';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(),   in: 1000, out: 500, tier: 'haiku' },  // within 5h → included
    { ts: before5h(),   in: 1000, out: 500, tier: 'haiku' },  // outside 5h, in week → excluded from 5h, included in 7d
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  const limit5h = 2_500_000;
  assert.equal(rl.window5h.utilization, (1500 * 1.0) / limit5h);
});

test('7d window includes records up to 7 days', async () => {
  const accountId = 'acc_7d';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(),   in: 1000, out: 500, tier: 'haiku' },  // within current week → included in 7d
    { ts: beforeWeek(), in: 1000, out: 500, tier: 'haiku' },  // before week start → excluded
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  const limit7d = 20_000_000;
  assert.equal(rl.weekly.utilization, (1500 * 1.0) / limit7d);
});

test('status is blocked when utilization >= 1.0', async () => {
  const accountId = 'acc_blocked';
  // Write enough tokens to exceed the limit
  // PRO limit: 500K weighted. Need 500K / 1.0 = 500K tokens as haiku
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 500_000, out: 0, tier: 'haiku' },
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'pro', dir);
  assert.equal(rl.window5h.status, 'blocked');
  assert.equal(rl.window5h.utilization, 1.0);
});

test('resetAt values are correct', async () => {
  const accountId = 'acc_reset';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 100, out: 50, tier: 'haiku' },
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  assert.equal(rl.window5h.resetAt, next5hReset());
  assert.equal(rl.weekly.resetAt, nextMondayReset());
});

test('handles missing usage.jsonl gracefully', async () => {
  const accountId = 'acc_missing';
  // Do not create usage.jsonl
  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  assert.equal(rl.window5h.utilization, 0);
  assert.equal(rl.window5h.status, 'allowed');
  assert.equal(rl.weekly.utilization, 0);
  assert.equal(rl.weekly.status, 'allowed');
});

test('incremental read does not reprocess old records', async () => {
  const accountId = 'acc_incremental';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 100, out: 50, tier: 'haiku' },
  ]);

  // First call
  const rl1 = await calcVirtualRateLimit(accountId, 'max', dir);
  const util1 = rl1.window5h.utilization;

  // Second call without new data → same result
  const rl2 = await calcVirtualRateLimit(accountId, 'max', dir);
  const util2 = rl2.window5h.utilization;

  assert.equal(util1, util2);
});

test('full re-read when file is truncated', async () => {
  const accountId = 'acc_truncated';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 100, out: 50, tier: 'haiku' },
  ]);

  // First call
  await calcVirtualRateLimit(accountId, 'max', dir);

  // Truncate file (smaller content)
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 50, out: 25, tier: 'haiku' },
  ]);

  // Second call should detect truncation and re-read
  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  const limit5h = 2_500_000;
  assert.equal(rl.window5h.utilization, (75 * 1.0) / limit5h);
});

test('different plans have different limits', async () => {
  const accountId = 'acc_plan';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 500_000, out: 0, tier: 'haiku' },
  ]);

  const rlPro = await calcVirtualRateLimit(accountId, 'pro', dir);
  const rlMax = await calcVirtualRateLimit(accountId, 'max', dir);
  const rlMax20x = await calcVirtualRateLimit(accountId, 'max_20x', dir);

  // Same tokens, different limits → different utilization
  assert.equal(rlPro.window5h.utilization, 500_000 / 500_000);     // 1.0 (blocked)
  assert.equal(rlMax.window5h.utilization, 500_000 / 2_500_000);   // 0.2
  assert.equal(rlMax20x.window5h.utilization, 500_000 / 12_500_000); // 0.04
});

test('concurrent calcs do not double-count records (race condition)', async () => {
  const accountId = 'acc_race';
  await writeUsageJsonl(accountId, [
    { ts: inBucket(), in: 100_000, out: 50_000, tier: 'sonnet' }, // 150k * 2.0 = 300k weighted
  ]);

  // 触发 10 个并发调用，模拟 probeAllRelays + 手动 sync + sync-usage-all 同时打过来
  const results = await Promise.all(
    Array.from({ length: 10 }, () => calcVirtualRateLimit(accountId, 'max', dir))
  );

  // 全部应得到一致的 0.12（300k / 2.5M），任何一次出现 >0.12 即说明有重复累加
  for (const rl of results) {
    assert.equal(rl.window5h.utilization, 300_000 / 2_500_000);
  }
});

test('fixed window: records before last 5h boundary are excluded (post-reset)', async () => {
  // 关键回归：用户报的"时间到了用量没重置"。before5h() 在上一个 5h 桶内，
  // 固定窗口语义下应当不计入当前 5h 利用率。
  const accountId = 'acc_post_reset';
  await writeUsageJsonl(accountId, [
    { ts: before5h(), in: 1_000_000, out: 0, tier: 'opus' }, // 4M weighted, 上一桶
  ]);

  const rl = await calcVirtualRateLimit(accountId, 'max', dir);
  assert.equal(rl.window5h.utilization, 0);
  assert.equal(rl.window5h.status, 'allowed');
  // 7d 应仍包含（同一周内）
  assert.ok(rl.weekly.utilization > 0);
});
