'use client'

import { useEffect, useRef, useState } from 'react'
import {
  type Tier,
  TIER_COLORS,
  TIER_THRESHOLDS,
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
   * 'demo' — lock to a tier and animate ratio 0→1→0 in a loop (marketing behaviour).
   */
  mode: 'live' | 'demo'
  usd?: number
  lockedTier?: Tier
  /**
   * Optional shared time source for synchronizing multiple demo gauges
   * onto a single requestAnimationFrame loop. Pass `Date.now()` from a
   * parent's RAF tick. If omitted, each gauge runs its own RAF (fine for
   * 1-2 gauges; for 4+ gauges prefer parent-driven shared tick).
   */
  sharedTime?: number
}

export default function IntensityGauge({
  mode,
  usd,
  lockedTier,
  sharedTime,
}: IntensityGaugeProps) {
  // Live mode: ratio derived from usd
  // Demo mode: ratio derived from time-based oscillation
  const [demoRatio, setDemoRatio] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (mode !== 'demo' || sharedTime !== undefined) return
    // Self-driven RAF when no shared tick is provided.
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = (now - startRef.current) / 1000
      // ~5 second period for a full 0→1→0 swing
      const phase = (Math.sin(elapsed * (Math.PI / 2.5)) + 1) / 2
      setDemoRatio(phase)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [mode, sharedTime])

  useEffect(() => {
    if (mode !== 'demo' || sharedTime === undefined) return
    // Parent-driven shared tick: derive phase from sharedTime ms.
    const phase = (Math.sin((sharedTime / 1000) * (Math.PI / 2.5)) + 1) / 2
    setDemoRatio(phase)
  }, [mode, sharedTime])

  let tier: Tier
  let ratio: number
  if (mode === 'live') {
    const liveProgress = tierProgress(usd ?? 0)
    tier = liveProgress.tier
    ratio = liveProgress.ratio
  } else {
    tier = lockedTier ?? 'light'
    ratio = demoRatio
  }

  const fill = tierFillColor(tier)
  const fillOffset = ARC_LEN * (1 - ratio)
  // Convert ratio→angle, then map to needle's coordinate system
  // (-90° = pointing left at start of arc, +90° = pointing right at end).
  const needleDeg = ratio * 180 - 90

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
        style={{ transition: 'stroke-dashoffset 0.1s linear' }}
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
        style={{ transition: 'transform 0.1s linear' }}
      />
      {/* Hub */}
      <circle cx="110" cy="110" r="6" fill="var(--color-brand-ink)" />
    </svg>
  )
}
