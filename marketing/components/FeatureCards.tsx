/**
 * 功能介绍区：4 张静态卡片（PRD §3.1.3）
 *
 * 标题与一句话描述定稿见 PRD：
 * - 共享账号池
 * - 实时使用强度
 * - 阶梯月结
 * - 自动调度免封号
 */

interface Feature {
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    title: '共享账号池',
    description: '多个 Pro/Max 账号任选择，无需自己注册或购买。',
  },
  {
    title: '实时使用强度',
    description: '仪表盘随用随动，永远知道自己处于哪一档。',
  },
  {
    title: '阶梯月结',
    description: '按 30 天周期实测强度结算，4 档透明定价无惊吓。',
  },
  {
    title: '自动调度免封号',
    description: 'hub 后台自动切换账号 + 限流回避，专注写代码不操心账号风险。',
  },
]

export default function FeatureCards() {
  return (
    <section className="px-8 py-24" id="features">
      <div className="mx-auto max-w-7xl">
        <h2 className="font-serif text-3xl tracking-tight text-brand-ink md:text-4xl">
          claudecode-hub 能为您做什么
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(feature => (
            <article
              key={feature.title}
              className="group rounded-2xl border border-brand-cream-deep/60 bg-white/40 p-8 transition-all hover:border-brand-orange/40 hover:bg-white/70"
            >
              <h3 className="font-serif text-xl font-medium text-brand-ink">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-ink/70">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
