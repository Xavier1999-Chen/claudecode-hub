import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const TIER_WEIGHT = {
  opus: 4.0,
  sonnet: 2.0,
  haiku: 1.0,
  image: 3.0,
};

const LIMITS = {
  pro: { window5h: 500_000, weekly: 5_000_000 },
  max: { window5h: 2_500_000, weekly: 20_000_000 },
  max_20x: { window5h: 12_500_000, weekly: 100_000_000 },
};

// 内存缓存：accountId → { lastOffset, records }
const cache = new Map();

// 按 accountId 串行化的 promise 队列。
// 防止 probeAllRelays / 手动 sync / /api/sync-usage-all 并发调用导致：
//   两个 caller 拿到相同的 lastOffset → 都从同一 offset 读取 → 各自把同一批
//   新记录 push 进 state.records → 利用率被翻倍。
const queues = new Map();

export async function calcVirtualRateLimit(accountId, plan, logsDir) {
  const prev = queues.get(accountId) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => doCalc(accountId, plan, logsDir));
  queues.set(accountId, next);
  try {
    return await next;
  } finally {
    // 仅在本次仍是队尾时清理，避免覆盖后续排队的 promise
    if (queues.get(accountId) === next) queues.delete(accountId);
  }
}

async function doCalc(accountId, plan, logsDir) {
  const logPath = join(logsDir, accountId, 'usage.jsonl');
  let state = cache.get(accountId);
  if (!state) {
    state = { lastOffset: 0, records: [] };
    cache.set(accountId, state);
  }

  const stats = await stat(logPath).catch(() => null);
  if (!stats) {
    return makeEmptyRateLimit(plan);
  }

  // 文件被截断/重建 → 全量重读
  if (stats.size < state.lastOffset) {
    state.lastOffset = 0;
    state.records = [];
  }

  // 增量读取新增记录
  if (stats.size > state.lastOffset) {
    const newRecords = await readLinesFromOffset(logPath, state.lastOffset);
    for (const r of newRecords) {
      if (r && typeof r.ts === 'number') {
        state.records.push(r);
      }
    }
    state.lastOffset = stats.size;
  }

  // 清理 7 天外记录（7d 窗口最长）
  const now = Date.now();
  const cutoff = now - 7 * 86400_000;
  state.records = state.records.filter(r => r.ts >= cutoff);

  // 加权累加
  let weighted5h = 0;
  let weighted7d = 0;
  const fiveHAgo = now - 5 * 3600_000;

  for (const r of state.records) {
    const w = TIER_WEIGHT[r.tier] ?? TIER_WEIGHT.sonnet;
    const tokens = Math.max(0, r.in ?? 0) + Math.max(0, r.out ?? 0);
    const weighted = tokens * w;
    if (r.ts >= fiveHAgo) weighted5h += weighted;
    weighted7d += weighted;
  }

  return makeRateLimit(weighted5h, weighted7d, plan, now);
}

async function readLinesFromOffset(filePath, offset) {
  const stream = createReadStream(filePath, { start: offset });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  const records = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // 跳过损坏行
    }
  }
  return records;
}

function makeRateLimit(weighted5h, weighted7d, plan, now = Date.now()) {
  const limit = LIMITS[plan] ?? LIMITS.max;

  const HOUR = 3600_000;
  const reset5h = Math.ceil(now / (5 * HOUR)) * (5 * HOUR);

  const d = new Date(now);
  const day = d.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const reset7d = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + daysUntilMonday);

  const util5h = weighted5h / limit.window5h;
  const util7d = weighted7d / limit.weekly;

  return {
    window5h: {
      utilization: util5h,
      resetAt: reset5h,
      status: util5h >= 1.0 ? 'blocked' : 'allowed',
    },
    weekly: {
      utilization: util7d,
      resetAt: reset7d,
      status: util7d >= 1.0 ? 'blocked' : 'allowed',
    },
  };
}

function makeEmptyRateLimit(plan) {
  return makeRateLimit(0, 0, plan);
}
