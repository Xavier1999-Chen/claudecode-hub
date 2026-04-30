import IntensityGauge from '@/lib/intensity-gauge/IntensityGauge'
import { type Tier, TIER_LABELS } from '@/lib/intensity-gauge/math'

/**
 * 适用人群区：4 个个人用户画像，每个旁边配实时强度计动画（PRD §3.1.4）
 *
 * 用户视角不展示美金阈值，仅展示档位 + 月结金额（人民币）+ 钩子文案。
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
  return (
    <section
      id="personas"
      className="bg-white/30 px-8 py-24 border-y border-brand-cream-deep/60"
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="font-serif text-3xl tracking-tight text-brand-ink md:text-4xl">
          这是给谁的
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-ink/60">
          四档使用强度对应四种典型用户。仪表盘实时反映你的档位 ——
          指针走到哪，月底就按哪一档结算。
        </p>

        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {PERSONAS.map(persona => (
            <article
              key={persona.tier}
              className="rounded-2xl border border-brand-cream-deep/80 bg-brand-cream p-7 transition-shadow hover:shadow-md"
            >
              {/* Mini gauge animation */}
              <div className="mb-5">
                <IntensityGauge mode="demo" lockedTier={persona.tier} />
              </div>

              <div className="text-xs font-medium uppercase tracking-wider text-brand-ink/50">
                {TIER_LABELS[persona.tier]}
              </div>
              <h3 className="mt-1 font-serif text-xl font-medium text-brand-ink">
                {persona.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-ink/70">
                {persona.description}
              </p>

              <div className="mt-6 border-t border-brand-cream-deep/60 pt-4">
                <div className="font-serif text-2xl font-semibold text-brand-ink">
                  {persona.monthlyFee}
                  <span className="ml-1 text-sm font-normal text-brand-ink/50">
                    / 月
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-brand-ink/60">
                  {persona.hook}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
