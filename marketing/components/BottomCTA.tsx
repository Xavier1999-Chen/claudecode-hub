import { adminLinks } from '@/lib/links'

interface BottomCTAProps {
  isAuthed: boolean
}

/**
 * 底部 CTA 区：重申主张 + 注册按钮（PRD §3.1.6）
 *
 * 已登录态完全隐藏（连同主张文案一起；不留尴尬的"再注册一次"提示）。
 * 这意味着登录用户看到的页面在底部直接是 Footer。
 */
export default function BottomCTA({ isAuthed }: BottomCTAProps) {
  if (isAuthed) return null

  return (
    <section
      id="bottom-cta"
      className="bg-brand-ink px-8 py-24 text-brand-cream"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-serif text-3xl leading-tight tracking-tight md:text-5xl">
          先用后付，
          <br />
          按你的真实强度结算。
        </h2>

        <div className="mt-12">
          <a
            href={adminLinks.register}
            className="inline-block rounded-full bg-brand-orange px-9 py-4 text-base font-medium text-white shadow-sm transition-all hover:bg-brand-orange-soft hover:shadow-md"
            aria-label="免费注册"
          >
            免费注册 →
          </a>
        </div>
      </div>
    </section>
  )
}
