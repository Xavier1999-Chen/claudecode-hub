/**
 * Pure math for the intensity gauge.
 * Ported from admin's src/admin/frontend/src/usage-intensity.js — same
 * tier thresholds, same color ramp, same needle math. Kept in TypeScript
 * for marketing-side type safety.
 *
 * If admin's version is later refactored, sync this file or extract to
 * a shared package.
 */

// Cumulative per-cycle USD boundaries for the four intensity tiers.
// light < $20 ≤ medium < $150 ≤ heavy < $900 ≤ xheavy
export const TIER_THRESHOLDS = {
  light: 20,
  medium: 150,
  heavy: 900,
} as const

export type Tier = 'light' | 'medium' | 'heavy' | 'xheavy'

export const TIER_COLORS: Record<Tier, string> = {
  light: '#FDDCCC',
  medium: '#F5A570',
  heavy: '#E87040',
  xheavy: '#C0532A',
}

/** User-facing tier label (Chinese). */
export const TIER_LABELS: Record<Tier, string> = {
  light: '轻度',
  medium: '中度',
  heavy: '重度',
  xheavy: '超重度',
}

/** Bucket a cumulative USD value into one of the four intensity tiers. */
export function intensityLevel(usd: number): Tier {
  if (usd < TIER_THRESHOLDS.light) return 'light'
  if (usd < TIER_THRESHOLDS.medium) return 'medium'
  if (usd < TIER_THRESHOLDS.heavy) return 'heavy'
  return 'xheavy'
}

/**
 * Progress WITHIN the current tier (not global 0-900 progress).
 * Each tier sweeps the half-circle independently — pointer "resets"
 * when crossing a tier, and arc fill colour deepens.
 */
export function tierProgress(usd: number): { tier: Tier; ratio: number } {
  if (usd < TIER_THRESHOLDS.light) {
    return { tier: 'light', ratio: Math.max(0, usd) / TIER_THRESHOLDS.light }
  }
  if (usd < TIER_THRESHOLDS.medium) {
    return {
      tier: 'medium',
      ratio:
        (usd - TIER_THRESHOLDS.light) /
        (TIER_THRESHOLDS.medium - TIER_THRESHOLDS.light),
    }
  }
  if (usd < TIER_THRESHOLDS.heavy) {
    return {
      tier: 'heavy',
      ratio:
        (usd - TIER_THRESHOLDS.medium) /
        (TIER_THRESHOLDS.heavy - TIER_THRESHOLDS.medium),
    }
  }
  return { tier: 'xheavy', ratio: 1 }
}

/** Needle angle in degrees, 0° (left) → 180° (right), within current tier. */
export function needleAngle(usd: number): number {
  return tierProgress(usd).ratio * 180
}

/** Arc fill colour for the current tier. */
export function tierFillColor(tier: Tier): string {
  return TIER_COLORS[tier] ?? TIER_COLORS.light
}
