'use client'

import { useEffect, useState } from 'react'
import {
  type Tier,
  needleAngle,
  tierFillColor,
  tierProgress,
} from './math'

// Half-circle arc (matches admin's UsageIntensityView.jsx for visual parity).
const ARC_RADIUS = 90
const ARC_LEN = Math.PI * ARC_RADIUS
const ARC_PATH = `M 20 110 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 200 110`

interface IntensityGaugeProps {
  /**
   * 'live' — render based on actual USD value (admin behaviour).
   * 'demo' — single-sweep animation: ratio 0→targetRatio within the locked tier
   *          on mount, then hold. Re-mount (via React key) to replay.
   */
  mode: 'live' | 'demo'
  usd?: number
  lockedTier?: Tier
  /**
   * Demo-mode only. Where to stop the needle within the locked tier.
   * 0 = arc start, 1 = arc end (full tier). Defaults to 1 (full sweep).
   * Use distinct values per persona so gauges look visually different.
   */
  targetRatio?: number
}

/**
 * Detect prefers-reduced-motion at module load.
 * Returns true on the server (no window) so SSR-rendered HTML is the
 * "static end-state" form; the client effect later flips to animated
 * for users without reduced-motion preference.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function IntensityGauge({
  mode,
  usd,
  lockedTier,
  targetRatio = 1,
}: IntensityGaugeProps) {
  // Demo mode: phase 0 → 1 once, driven by CSS transition (no RAF loop).
  // Initial phase is 0 (start of arc); after mount we set 1, CSS interpolates.
  // SSR + reduced-motion both render at phase=1 directly (no animation flash).
  const [phase, setPhase] = useState(() =>
    mode === 'demo' && !prefersReducedMotion() ? 0 : 1
  )

  useEffect(() => {
    if (mode !== 'demo') return
    if (prefersReducedMotion()) {
      setPhase(1)
      return
    }
    // Defer one frame so the initial 0 paint commits before transitioning to 1.
    const raf = requestAnimationFrame(() => setPhase(1))
    return () => cancelAnimationFrame(raf)
  }, [mode])

  let tier: Tier
  let ratio: number
  if (mode === 'live') {
    const liveProgress = tierProgress(usd ?? 0)
    tier = liveProgress.tier
    ratio = liveProgress.ratio
  } else {
    tier = lockedTier ?? 'light'
    // Sweep from 0 (initial paint) to targetRatio (final position).
    // Clamp targetRatio defensively to [0, 1].
    const clamped = Math.max(0, Math.min(1, targetRatio))
    ratio = phase * clamped
  }

  const fill = tierFillColor(tier)
  const fillOffset = ARC_LEN * (1 - ratio)
  const needleDeg = ratio * 180 - 90

  // Animation tuned for "noticeable arrival, then settled":
  // ~1.4s ease-out so user sees the sweep happen but it doesn't drag.
  const transition = mode === 'demo' ? 'all 1400ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none'

  return (
    <svg
      viewBox="0 0 220 130"
      className="w-full h-auto"
      role="img"
      aria-label={`使用强度仪表盘 (${tier})`}
    >
      {/* Track */}
      <path
        d={ARC_PATH}
        fill="none"
        stroke="#f0ede8"
        strokeWidth="18"
        strokeLinecap="round"
      />
      {/* Tier fill */}
      <path
        d={ARC_PATH}
        fill="none"
        stroke={fill}
        strokeWidth="18"
        strokeLinecap="round"
        strokeDasharray={ARC_LEN}
        strokeDashoffset={fillOffset}
        style={{ transition }}
      />
      {/* Needle */}
      <line
        x1="110"
        y1="110"
        x2="110"
        y2="35"
        stroke="var(--color-brand-ink)"
        strokeWidth="3"
        strokeLinecap="round"
        transform={`rotate(${needleDeg} 110 110)`}
        style={{ transition }}
      />
      {/* Hub */}
      <circle cx="110" cy="110" r="6" fill="var(--color-brand-ink)" />
    </svg>
  )
}
