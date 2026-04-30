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
 * 适用人群区：scroll-pinned scrubbed scrollytelling（PRD §3.1.4）
 *
 * 交互模型：
 *   - section pin 在视口（外层 height = N×100vh，内层 sticky h-screen）
 *   - 鼠标滚轮直接驱动当前画像的强度计指针 0→1（scrub）
 *   - 一档指针走满 → 当前画像 hard-cut 切到下一档
 *   - 4 档全部走完 → section 自然解除 pin，向下滚到 Pricing
 *   - 反向滚动同样可逆（指针回退、画像反向切换）
 *
 * 核心实现：
 *   - useScroll 拿到 section 内部 scroll progress（0..1）
 *   - 每个 persona 占一个均匀 slot：[i/N, (i+1)/N]
 *   - slide opacity 在 slot 边界 hard-cut（1 内 / 0 外）
 *   - gauge ratio 通过 useTransform 把 scrollYProgress 映射到 [0, 1]
 *     —— 直接传 MotionValue 给 IntensityGauge，需求即所见
 */

interface Persona {
  tier: Tier
  title: string
  description: string
  hook: string
  monthlyFee: string
}

const PERSONAS: Persona[] = [
  {
    tier: 'light',
    title: '轻度尝鲜者',
    description: '偶尔跑个脚本、查个错，一个月用不了几次。',
    hook: '订阅 Pro 太浪费，按量又怕开销不可控 —— 这一档就解决你的犹豫。',
    monthlyFee: '¥20',
  },
  {
    tier: 'medium',
    title: '中度日常者',
    description: 'Claude Code 是日常工具，每周用、赶项目时密集用。',
    hook: '和 Pro 订阅同价位，但用量真实可见。',
    monthlyFee: '¥150',
  },
  {
    tier: 'heavy',
    title: '重度刚需者',
    description: 'Claude Code 是吃饭工具，每天高频用、长 session 多。',
    hook: '比 Max 订阅便宜，且能力相当 + 免封号风险。',
    monthlyFee: '¥900',
  },
  {
    tier: 'xheavy',
    title: '超重度专家',
    description: '整天泡在 Claude Code 里，多终端并发。',
    hook: '封顶定价让你成本可控，不用担心月底惊吓账单。',
    monthlyFee: '¥1500',
  },
]

export default function PersonaCards() {
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
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
        四档使用强度对应四种典型用户。继续向下滚动 —— 滚轮直接控制仪表盘指针，
        当前档走满后会自动切换到下一档。
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

function PersonaSlide({
  persona,
  idx,
  total,
  scrollYProgress,
}: PersonaSlideProps) {
  const start = idx / total
  const end = (idx + 1) / total

  // Hard-cut visibility: 1 within slot, 0 outside. No crossfade — at the
  // boundary the next persona appears the instant the previous one's gauge
  // hits 1.0. (Aligns with user spec: "一档满了就切下一档".)
  const opacity = useTransform(scrollYProgress, p =>
    p >= start && p <= end ? 1 : 0
  )

  // Gauge ratio: linear scrub from 0 (slot start) to 1 (slot end).
  // useTransform clamps by default, so before slot ratio=0, after slot ratio=1.
  const gaugeRatio = useTransform(scrollYProgress, [start, end], [0, 1])

  return (
    <motion.div
      className="absolute inset-0"
      style={{ opacity, pointerEvents: 'none' }}
    >
      <article className="grid h-full grid-cols-1 items-center gap-12 md:grid-cols-2">
        {/* Gauge (left) — needle scrubbed by scroll */}
        <div className="mx-auto w-full max-w-md">
          <IntensityGauge
            mode="scrub"
            lockedTier={persona.tier}
            ratio={gaugeRatio}
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
    </motion.div>
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
        {activeIndex + 1} / {total} · 滚轮控制指针 · 走满自动切下一档
      </p>
    </div>
  )
}
