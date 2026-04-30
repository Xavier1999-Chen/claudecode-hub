'use client'

import { useEffect } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from 'motion/react'
import {
  type Tier,
  tierFillColor,
  tierProgress,
} from './math'

// Half-circle arc (matches admin's UsageIntensityView.jsx for visual parity).
const ARC_RADIUS = 90
const ARC_LEN = Math.PI * ARC_RADIUS
const ARC_PATH = `M 20 110 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 200 110`

interface IntensityGaugeProps {
  /**
   * 'live'  — ratio derived from `usd` (admin behaviour).
   * 'scrub' — ratio is externally driven via the `ratio` MotionValue
   *           (e.g. tied to scroll progress on the marketing page).
   *           No internal animation; needle moves only when ratio changes.
   */
  mode: 'live' | 'scrub'
  /** live mode: USD value used to compute tier + ratio. */
  usd?: number
  /** scrub mode: which tier's arc to render (color + label). */
  lockedTier?: Tier
  /** scrub mode: 0..1 motion value driving the needle/fill. */
  ratio?: MotionValue<number>
}

export default function IntensityGauge({
  mode,
  usd,
  lockedTier,
  ratio: externalRatio,
}: IntensityGaugeProps) {
  // Internal motion value used in 'live' mode (synced from usd).
  // In 'scrub' mode this is unused but still allocated to keep hook order stable.
  const internalRatio = useMotionValue(0)

  useEffect(() => {
    if (mode === 'live') {
      internalRatio.set(tierProgress(usd ?? 0).ratio)
    }
  }, [mode, usd, internalRatio])

  const ratio = externalRatio ?? internalRatio
  const tier: Tier =
    mode === 'live' ? tierProgress(usd ?? 0).tier : lockedTier ?? 'light'
  const fill = tierFillColor(tier)

  // Derive SVG-ready motion values from ratio.
  //
  // Needle endpoint geometry (instead of CSS rotate):
  //   - Pivot at (110, 110), length 75px
  //   - At ratio=0   → point left  (toward arc start near (20, 110))
  //   - At ratio=0.5 → point up    (12 o'clock, near (110, 35))
  //   - At ratio=1   → point right (toward arc end near (200, 110))
  //   - Angle (math convention, anti-clockwise from +x): θ = (1 - ratio) × π
  //   - x2 = 110 + 75 cos(θ);  y2 = 110 − 75 sin(θ)  (SVG y-axis is inverted)
  //
  // We compute x2 / y2 as motion values and pass them as SVG attributes —
  // motion subscribes to numeric attribute MotionValues natively, no rotate
  // / transformOrigin / transform-box issues.
  const NEEDLE_LEN = 75
  const dashOffset = useTransform(ratio, r => ARC_LEN * (1 - r))
  const needleX2 = useTransform(
    ratio,
    r => 110 + NEEDLE_LEN * Math.cos((1 - r) * Math.PI)
  )
  const needleY2 = useTransform(
    ratio,
    r => 110 - NEEDLE_LEN * Math.sin((1 - r) * Math.PI)
  )

  return (
    <svg
      viewBox="0 0 220 130"
      className="h-auto w-full"
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
      {/* Tier fill — strokeDashoffset interpolated via motion value */}
      <motion.path
        d={ARC_PATH}
        fill="none"
        stroke={fill}
        strokeWidth="18"
        strokeLinecap="round"
        strokeDasharray={ARC_LEN}
        style={{ strokeDashoffset: dashOffset }}
      />
      {/* Needle — endpoint x2/y2 driven by motion values (no CSS rotate) */}
      <motion.line
        x1="110"
        y1="110"
        x2={needleX2}
        y2={needleY2}
        stroke="var(--color-brand-ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Hub */}
      <circle cx="110" cy="110" r="6" fill="var(--color-brand-ink)" />
    </svg>
  )
}
