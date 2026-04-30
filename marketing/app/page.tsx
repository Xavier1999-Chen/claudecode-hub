import { getCurrentUser } from '@/lib/supabase'
import MarketingNav from '@/components/MarketingNav'
import Hero from '@/components/Hero'
import FeatureCards from '@/components/FeatureCards'
import PersonaCards from '@/components/PersonaCards'
import Pricing from '@/components/Pricing'
import BottomCTA from '@/components/BottomCTA'
import MarketingFooter from '@/components/MarketingFooter'

/**
 * 营销首页 (Server Component)
 *
 * 流程：
 *   1. Server-side detect Supabase session via cookies (lib/supabase.ts)
 *   2. Pass `isAuthed` to client components that need it
 *      (MarketingNav / Hero / BottomCTA — these branch on login state)
 *   3. Static sections (FeatureCards / PersonaCards / Pricing / Footer)
 *      don't need the session — render unchanged for everyone.
 *
 * 为什么不用 MDX 直接渲染整页？
 *   - Hero / BottomCTA 需要 dynamic isAuthed prop，MDX 静态内容传递不便。
 *   - MDX 基础设施仍保留（next.config.mjs + mdx-components.tsx），
 *     未来静态页面（隐私政策、博客）可以用 .mdx 写。
 *   - 当前营销首页结构稳定，内容修改主要在各 section 组件文件。
 */
export default async function MarketingHomePage() {
  const user = await getCurrentUser()
  const isAuthed = user !== null

  return (
    <>
      <MarketingNav isAuthed={isAuthed} />
      <main>
        <Hero isAuthed={isAuthed} />
        <FeatureCards />
        <PersonaCards />
        <Pricing />
        <BottomCTA isAuthed={isAuthed} />
      </main>
      <MarketingFooter />
    </>
  )
}
