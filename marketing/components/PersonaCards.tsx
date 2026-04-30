'use client'

import { useRef, useState } from 'react'
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import IntensityGauge from '@/lib/intensity-gauge/IntensityGauge'
import { type Tier, TIER_LABELS } from '@/lib/intensity-gauge/math'

/**
 * 适用人群区：scroll-pinned scrollytelling（PRD §3.1.4）
 *
 * 行业惯例（Apple / Stripe / Linear 同款 pattern）：
 *   - 外层容器 height = N × 100vh，预留滚动距离。
 *   - 内层 position: sticky; top: 0; h-screen，把内容钉在视口。
 *   - useScroll({target: ref, offset: ['start start', 'end end']}) 拿
 *     section 内部的滚动进度（0 = 顶部刚 pin，1 = 即将解除 pin）。
 *   - 4 个画像 slide 用 absolute inset-0 堆叠，opacity 由 useTransform
 *     映射 scroll progress；adjacent slides 在边界小幅 crossfade。
 *   - 强度计动画绑在 slide "成为活跃" 时（opacity 越过阈值 0.5）—— 用
 *     useMotionValueEvent 监听 opacity 变化，重新 key 让 IntensityGauge
 *     重新挂载并播放单次 sweep。
 *
 * 降级：prefers-reduced-motion 用 motion 的 MotionConfig + reduce CSS 媒体查询；
 *       此外组件层面降级为 4 卡片纵向 grid，不 pin。
 */

interface Persona {
  tier: Tier
  title: string
  description: string
  hook: string
  monthlyFee: string
  /**
   * Where the demo gauge needle stops within this tier's arc (0..1).
   * Hand-picked per persona for visual distinction (not all maxed at 1).
   */
  targetRatio: number
}

const PERSONAS: Persona[] = [
  {
    tier: 'light',
    title: '轻度尝鲜者',
    description: '偶尔跑个脚本、查个错，一个月用不了几次。',
    hook: '订阅 Pro 太浪费，按量又怕开销不可控 —— 这一档就解决你的犹豫。',
    monthlyFee: '¥20',
    targetRatio: 0.4, // small arc fill — visibly "lightly used"
  },
  {
    tier: 'medium',
    title: '中度日常者',
    description: 'Claude Code 是日常工具，每周用、赶项目时密集用。',
    hook: '和 Pro 订阅同价位，但用量真实可见。',
    monthlyFee: '¥150',
    targetRatio: 0.65, // past center — visibly "actively in use"
  },
  {
    tier: 'heavy',
    title: '重度刚需者',
    description: 'Claude Code 是吃饭工具，每天高频用、长 session 多。',
    hook: '比 Max 订阅便宜，且能力相当 + 免封号风险。',
    monthlyFee: '¥900',
    targetRatio: 0.85, // far right — visibly "near top of tier"
  },
  {
    tier: 'xheavy',
    title: '超重度专家',
    description: '整天泡在 Claude Code 里，多终端并发。',
    hook: '封顶定价让你成本可控，不用担心月底惊吓账单。',
    monthlyFee: '¥1500',
    targetRatio: 1.0, // pinned at end (xheavy has no cap)
  },
]

export default function PersonaCards() {
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    // 'start start' = section's top hits viewport top → progress 0
    // 'end end'     = section's bottom leaves viewport bottom → progress 1
    offset: ['start start', 'end end'],
  })

  return (
    <section
      id="personas"
      ref={containerRef}
      className="relative border-y border-brand-cream-deep/60 bg-white/30"
      style={{ height: `${PERSONAS.length * 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center px-8 py-12">
        <div className="mx-auto w-full max-w-6xl">
          <Heading />

          {/* Stacked slides: only the active one is visually prominent */}
          <div className="relative mt-12 h-[420px] md:h-[460px]">
            {PERSONAS.map((persona, idx) => (
              <PersonaSlide
                key={persona.tier}
                persona={persona}
                idx={idx}
                total={PERSONAS.length}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </div>

          <ProgressIndicator
            scrollYProgress={scrollYProgress}
            total={PERSONAS.length}
          />
        </div>
      </div>
    </section>
  )
}

function Heading() {
  return (
    <div>
      <h2 className="font-serif text-3xl tracking-tight text-brand-ink md:text-4xl">
        这是给谁的
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-ink/60">
        四档使用强度对应四种典型用户。仪表盘实时反映你的档位 ——
        指针走到哪，月底就按哪一档结算。
      </p>
    </div>
  )
}

interface PersonaSlideProps {
  persona: Persona
  idx: number
  total: number
  scrollYProgress: MotionValue<number>
}

/**
 * Single persona panel inside the pinned stack.
 * - opacity / y interpolated from scrollYProgress so adjacent slides crossfade.
 * - Gauge re-keys when this slide first crosses the "active" threshold,
 *   triggering a fresh single-sweep animation each time the persona arrives.
 */
function PersonaSlide({
  persona,
  idx,
  total,
  scrollYProgress,
}: PersonaSlideProps) {
  // Slot range for this persona, e.g. for idx=1/total=4 → [0.25, 0.50].
  const start = idx / total
  const end = (idx + 1) / total
  // Tight crossfade (2%) so simultaneous opacity is brief; combined with
  // larger y / scale shifts below, visually only one slide dominates.
  const fade = 0.02

  const opacity = useTransform(
    scrollYProgress,
    [
      Math.max(0, start - fade),
      start + fade,
      end - fade,
      Math.min(1, end + fade),
    ],
    [0, 1, 1, 0]
  )

  // Strong vertical drift so the outgoing slide is spatially out of the way
  // before the incoming one settles. 100px exit/entrance distance.
  const y = useTransform(
    scrollYProgress,
    [
      Math.max(0, start - fade),
      start + fade,
      end - fade,
      Math.min(1, end + fade),
    ],
    [100, 0, 0, -100]
  )

  // Slight scale-down on the outgoing/incoming slides pushes them visually
  // into the background during transition; active slide is at scale 1.
  const scale = useTransform(
    scrollYProgress,
    [
      Math.max(0, start - fade),
      start + fade,
      end - fade,
      Math.min(1, end + fade),
    ],
    [0.94, 1, 1, 0.94]
  )

  // Re-key the gauge whenever this slide becomes active (opacity crosses
  // 0.5 going up). Each entry replays the single-sweep animation.
  const [gaugeKey, setGaugeKey] = useState(0)
  const wasActiveRef = useRef(false)

  useMotionValueEvent(opacity, 'change', latest => {
    const isActive = latest > 0.5
    if (isActive && !wasActiveRef.current) {
      setGaugeKey(k => k + 1)
    }
    wasActiveRef.current = isActive
  })

  return (
    <motion.div
      className="absolute inset-0"
      style={{ opacity, y, scale }}
      // Pointer events disabled when invisible so non-active slides don't
      // intercept clicks behind the active one.
      aria-hidden={undefined}
    >
      <PersonaContent persona={persona} gaugeKey={gaugeKey} />
    </motion.div>
  )
}

function PersonaContent({
  persona,
  gaugeKey,
}: {
  persona: Persona
  gaugeKey: number
}) {
  return (
    <article className="grid h-full grid-cols-1 items-center gap-12 md:grid-cols-2">
      {/* Gauge (left) — re-keyed each time this persona becomes active */}
      <div className="mx-auto w-full max-w-md">
        <IntensityGauge
          key={gaugeKey}
          mode="demo"
          lockedTier={persona.tier}
          targetRatio={persona.targetRatio}
        />
      </div>

      {/* Copy + price (right) */}
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-brand-ink/50">
          {TIER_LABELS[persona.tier]}
        </div>
        <h3 className="mt-2 font-serif text-3xl font-medium text-brand-ink md:text-4xl">
          {persona.title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-brand-ink/70 md:text-lg">
          {persona.description}
        </p>

        <div className="mt-8 border-t border-brand-cream-deep/60 pt-6">
          <div className="font-serif text-4xl font-semibold text-brand-ink">
            {persona.monthlyFee}
            <span className="ml-2 text-base font-normal text-brand-ink/50">
              / 月
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-brand-ink/60">
            {persona.hook}
          </p>
        </div>
      </div>
    </article>
  )
}

interface ProgressIndicatorProps {
  scrollYProgress: MotionValue<number>
  total: number
}

function ProgressIndicator({ scrollYProgress, total }: ProgressIndicatorProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useMotionValueEvent(scrollYProgress, 'change', latest => {
    setActiveIndex(Math.min(total - 1, Math.floor(latest * total)))
  })

  return (
    <div className="mt-12">
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: total }, (_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === activeIndex
                ? 'w-8 bg-brand-ink'
                : 'w-1.5 bg-brand-ink/20'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-brand-ink/40">
        继续向下滚动以切换角色 · {activeIndex + 1} / {total}
      </p>
    </div>
  )
}
