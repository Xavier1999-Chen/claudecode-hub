'use client'

import { adminLinks } from '@/lib/links'

interface HeroProps {
  isAuthed: boolean
}

/**
 * Hero region: oversized serif heading + subtitle + dual CTA.
 * Anthropic-inspired: cream background, big breathing room, no images.
 *
 * Primary CTA toggles by auth state:
 *   - 未登录：「免费注册」→ /register（funnel 入口）
 *   - 已登录：「开始使用」→ admin console（直接进产品）
 *
 * Hero 始终保留主 CTA，避免登录态下整片留白；导航 / 底部 CTA 仍按 PRD
 * 隐藏注册路径。次级 CTA「看看怎么用」无关登录态，永远展示。
 *
 * 「看看怎么用」用 instant scroll 跳到 #personas，避免 smooth-scroll
 * 越过 hero 触发 scrollytelling 区域的 scrubbing（与 MarketingNav 同理）。
 */
function jumpToAnchor(e: React.MouseEvent<HTMLAnchorElement>, hash: string) {
  e.preventDefault()
  const targetId = hash.replace(/^#/, '')
  const target = document.getElementById(targetId)
  if (!target) return
  const navHeight = 64
  const top = target.getBoundingClientRect().top + window.scrollY - navHeight
  window.scrollTo({ top, behavior: 'instant' })
  history.replaceState(null, '', hash)
}

export default function Hero({ isAuthed }: HeroProps) {
  const primaryHref = isAuthed ? adminLinks.console : adminLinks.register
  const primaryLabel = isAuthed ? '开始使用' : '免费注册'

  return (
    <section className="px-8 pt-24 pb-32 md:pt-32 md:pb-40">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-serif text-5xl leading-[1.1] tracking-tight text-brand-ink md:text-7xl">
          共享账号池，
          <br />
          让 Claude Code{' '}
          <span className="italic text-brand-orange-deep">既好用又划算</span>。
        </h1>

        <p className="mt-10 max-w-2xl text-lg leading-relaxed text-brand-ink/70 md:text-xl">
          Pro/Max 共享账号池 · 阶梯月结 · 免封号 · 先用后付。
        </p>

        <div className="mt-14 flex flex-wrap items-center gap-4">
          <a
            href={primaryHref}
            className="rounded-full bg-brand-orange px-7 py-3.5 text-base font-medium text-white shadow-sm transition-all hover:bg-brand-orange-deep hover:shadow-md"
            aria-label={primaryLabel}
          >
            {primaryLabel}
          </a>
          <a
            href="#personas"
            onClick={e => jumpToAnchor(e, '#personas')}
            className="rounded-full border border-brand-ink/15 bg-transparent px-7 py-3.5 text-base font-medium text-brand-ink transition-colors hover:border-brand-ink/40"
            aria-label="看看怎么用"
          >
            看看怎么用
          </a>
        </div>
      </div>
    </section>
  )
}
