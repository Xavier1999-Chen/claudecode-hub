import { adminLinks } from '@/lib/links'

interface HeroProps {
  isAuthed: boolean
}

/**
 * Hero region: oversized serif heading + subtitle + dual CTA.
 * Anthropic-inspired: cream background, big breathing room, no images.
 *
 * - Primary CTA "免费注册" hidden when isAuthed (logged-in users skip the funnel).
 * - Secondary CTA "看看怎么用" anchor jumps to #personas (always shown).
 */
export default function Hero({ isAuthed }: HeroProps) {
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
          {!isAuthed && (
            <a
              href={adminLinks.register}
              className="rounded-full bg-brand-orange px-7 py-3.5 text-base font-medium text-white shadow-sm transition-all hover:bg-brand-orange-deep hover:shadow-md"
              aria-label="免费注册"
            >
              免费注册
            </a>
          )}
          <a
            href="#personas"
            className="rounded-full border border-brand-ink/15 bg-transparent px-7 py-3.5 text-base font-medium text-brand-ink transition-colors hover:border-brand-ink/40"
            aria-label="看看怎么用"
          >
            看看怎么用 →
          </a>
        </div>
      </div>
    </section>
  )
}
