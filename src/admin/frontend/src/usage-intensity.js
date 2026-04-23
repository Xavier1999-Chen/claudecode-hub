/**
 * Pure functions for the usage-intensity view (普通用户 "使用强度" tab).
 * Shared between the React component and Node.js tests — no DOM or React deps.
 *
 * Tunable thresholds live at the top so the UI behaviour can be adjusted
 * without touching rendering code.
 */

// ── Tunable thresholds ──────────────────────────────────────────────────────

// Cumulative per-cycle USD boundaries for the four intensity tiers.
// light  < $20, $20 ≤ medium < $150, $150 ≤ heavy < $900, $900 ≤ xheavy
export const TIER_THRESHOLDS = { light: 20, medium: 150, heavy: 900 }

// Per-day USD boundaries for heatmap cell shading.
// 0 → empty; 0 < v < low → light; low ≤ v < mid → medium; mid ≤ v < high → high; v ≥ high → xhigh
export const CELL_THRESHOLDS = { low: 1, mid: 5, high: 30 }

// Orange ramp for gauge fill and heatmap cells (shared so tiers feel unified).
export const TIER_COLORS = {
  light:  '#FDDCCC',
  medium: '#F5A570',
  heavy:  '#E87040',
  xheavy: '#C0532A',
}

// Heatmap cell colour ramp — reuses tier ramp + a neutral "empty" slot.
export const CELL_COLORS = {
  empty: '#f0ede8',
  low:   TIER_COLORS.light,
  mid:   TIER_COLORS.medium,
  high:  TIER_COLORS.heavy,
  xhigh: TIER_COLORS.xheavy,
}

// One cycle = 30 days.
export const CYCLE_MS = 30 * 86400000

// ── Pure functions ──────────────────────────────────────────────────────────

/** Bucket a cumulative USD value into one of the four intensity tiers. */
export function intensityLevel(usd) {
  if (usd < TIER_THRESHOLDS.light)  return 'light'
  if (usd < TIER_THRESHOLDS.medium) return 'medium'
  if (usd < TIER_THRESHOLDS.heavy)  return 'heavy'
  return 'xheavy'
}

/**
 * Progress WITHIN the current tier (not global 0-900 progress).
 * Returns { tier, ratio } where ratio ∈ [0, 1].
 *
 *   $0   → { light,  0   }
 *   $10  → { light,  0.5 }
 *   $20  → { medium, 0   }   ← pointer "resets" when crossing a tier
 *   $85  → { medium, 0.5 }
 *   $150 → { heavy,  0   }
 *   $900+ → { xheavy, 1 }    ← xheavy has no upper bound, so ratio is pinned to 1
 */
export function tierProgress(usd) {
  if (usd < TIER_THRESHOLDS.light) {
    return { tier: 'light', ratio: Math.max(0, usd) / TIER_THRESHOLDS.light }
  }
  if (usd < TIER_THRESHOLDS.medium) {
    return {
      tier: 'medium',
      ratio: (usd - TIER_THRESHOLDS.light) / (TIER_THRESHOLDS.medium - TIER_THRESHOLDS.light),
    }
  }
  if (usd < TIER_THRESHOLDS.heavy) {
    return {
      tier: 'heavy',
      ratio: (usd - TIER_THRESHOLDS.medium) / (TIER_THRESHOLDS.heavy - TIER_THRESHOLDS.medium),
    }
  }
  return { tier: 'xheavy', ratio: 1 }
}

/**
 * Needle angle in degrees, 0° (left, start of arc) → 180° (right, end of arc),
 * within the current tier. Each tier sweeps the FULL half-circle arc
 * independently — pointer resets to 0° and the arc's fill colour deepens
 * when crossing into the next tier.
 */
export function needleAngle(usd) {
  return tierProgress(usd).ratio * 180
}

/** Arc fill colour for the current tier. */
export function tierFillColor(tier) {
  return TIER_COLORS[tier] ?? TIER_COLORS.light
}

/**
 * Which 30-day cycle is `now` in, relative to the anchor timestamp?
 * Returns { index, start, end } where start ≤ now < end.
 * index = 0 for the very first cycle (containing the anchor).
 *
 * `anchor` accepts either an ISO string or a ms-since-epoch number.
 */
export function currentCycle(anchor, now) {
  const anchorMs = typeof anchor === 'number' ? anchor : new Date(anchor).getTime()
  const delta = Math.max(0, now - anchorMs)
  const index = Math.floor(delta / CYCLE_MS)
  return {
    index,
    start: anchorMs + index * CYCLE_MS,
    end:   anchorMs + (index + 1) * CYCLE_MS,
  }
}

/**
 * Aggregate usage records by terminalId → { 'YYYY-MM-DD': totalUsd }.
 * Records with `ts < sinceTs` are dropped.
 * Day key is computed in local time so the heatmap aligns with the user's
 * calendar, matching how the rest of the UsageTab renders days.
 */
export function aggregateDailyByTerminal(records, sinceTs) {
  const result = {}
  for (const r of records) {
    if (!r || typeof r.ts !== 'number' || r.ts < sinceTs) continue
    const d = new Date(r.ts)
    const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    const tId = r.terminalId ?? '__unknown__'
    if (!result[tId]) result[tId] = {}
    result[tId][day] = (result[tId][day] ?? 0) + (r.usd ?? 0)
  }
  return result
}

/** Classify a single day's USD into a heatmap colour bucket. */
export function cellBucket(usd) {
  if (!usd || usd <= 0) return 'empty'
  if (usd < CELL_THRESHOLDS.low)  return 'low'
  if (usd < CELL_THRESHOLDS.mid)  return 'mid'
  if (usd < CELL_THRESHOLDS.high) return 'high'
  return 'xhigh'
}

function pad2(n) { return String(n).padStart(2, '0') }
