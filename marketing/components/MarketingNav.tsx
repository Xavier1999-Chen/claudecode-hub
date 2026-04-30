'use client'

import Link from 'next/link'
import { adminLinks } from '@/lib/links'

interface MarketingNavProps {
  isAuthed: boolean
}

/**
 * Top navigation bar.
 * - Anchor links jump within the page (定价 / 适用人群 / 注册).
 * - 「注册」anchor only renders when not signed in (登录态 hides registration paths).
 * - Right side toggles between 「登录」(signed-out) and 「控制台」(signed-in).
 *
 * 锚点点击使用 instant scroll（不是 CSS 全局 smooth-scroll），原因：
 * 营销页中段有 scroll-pinned 的"适用人群"区（外层 400vh），smooth-scroll
 * 跨过它会在动画期间触发 4 张角色 scrubbing，看起来"疯狂刷指针"。瞬移
 * 跳过该区段干净利落；自然滚轮仍能正常 scrub。
 */
function jumpToAnchor(e: React.MouseEvent<HTMLAnchorElement>, hash: string) {
  e.preventDefault()
  const targetId = hash.replace(/^#/, '')
  const target = document.getElementById(targetId)
  if (!target) return
  const navHeight = 64 // approximate sticky nav height
  const top = target.getBoundingClientRect().top + window.scrollY - navHeight
  window.scrollTo({ top, behavior: 'instant' })
  // Update URL hash so user can bookmark/share without triggering re-scroll.
  history.replaceState(null, '', hash)
}

export default function MarketingNav({ isAuthed }: MarketingNavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-brand-cream-deep/60 bg-brand-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        {/* Logo */}
        <Link
          href="/"
          className="font-serif text-2xl font-semibold tracking-tight text-brand-ink"
          aria-label="claudecode-hub 首页"
        >
          claudecode-hub
        </Link>

        {/* Anchors */}
        <div className="hidden items-center gap-10 md:flex">
          <a
            href="#pricing"
            onClick={e => jumpToAnchor(e, '#pricing')}
            className="text-sm text-brand-ink/70 transition-colors hover:text-brand-ink"
          >
            定价
          </a>
          <a
            href="#personas"
            onClick={e => jumpToAnchor(e, '#personas')}
            className="text-sm text-brand-ink/70 transition-colors hover:text-brand-ink"
          >
            适用人群
          </a>
          {!isAuthed && (
            <a
              href="#bottom-cta"
              onClick={e => jumpToAnchor(e, '#bottom-cta')}
              className="text-sm text-brand-ink/70 transition-colors hover:text-brand-ink"
            >
              注册
            </a>
          )}
        </div>

        {/* Right CTA: 登录 (signed-out) or 控制台 (signed-in) */}
        <div className="flex items-center gap-3">
          {isAuthed ? (
            <a
              href={adminLinks.console}
              className="rounded-full bg-brand-ink px-5 py-2 text-sm font-medium text-brand-cream transition-opacity hover:opacity-90"
              aria-label="进入控制台"
            >
              控制台
            </a>
          ) : (
            <a
              href={adminLinks.login}
              className="text-sm font-medium text-brand-ink transition-opacity hover:opacity-70"
              aria-label="登录"
            >
              登录
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
