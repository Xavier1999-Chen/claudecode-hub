/**
 * 定价区：4 档强度月结金额（PRD §3.1.5）
 *
 * 用户视角不展示美金阈值，仅展示档位 + 金额 + 30 天周期说明。
 */

interface Tier {
  label: string
  price: string
  description: string
}

const TIERS: Tier[] = [
  { label: '轻度', price: '¥20', description: '偶尔使用，月结无压力' },
  { label: '中度', price: '¥150', description: '日常使用，与 Pro 同价位' },
  { label: '重度', price: '¥900', description: '高频使用，比 Max 便宜' },
  { label: '超重度', price: '¥1500', description: '顶配封顶，账单不超预期' },
]

export default function Pricing() {
  return (
    <section id="pricing" className="px-8 py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-serif text-3xl tracking-tight text-brand-ink md:text-4xl">
          定价
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-brand-ink/60">
          按 30 天为一个周期统一结算 —— 周期内的实测使用强度落在哪一档，
          就按哪一档收。无预付、无锁定。
        </p>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map(tier => (
            <article
              key={tier.label}
              className="rounded-2xl border border-brand-cream-deep/80 bg-white/50 p-7"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-brand-ink/50">
                {tier.label}
              </div>
              <div className="mt-2 font-serif text-4xl font-semibold text-brand-ink">
                {tier.price}
              </div>
              <p className="mt-3 text-sm text-brand-ink/60">
                {tier.description}
              </p>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-brand-ink/50">
          周期从注册时间起算。强度档位由实测累计用量决定 ——
          仪表盘实时可见，月底自动结算。
        </p>
      </div>
    </section>
  )
}
