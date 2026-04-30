import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

interface CookieToSet {
  name: string
  value: string
  options: CookieOptions
}

/**
 * Server-side Supabase client for marketing site.
 * Used in app/page.tsx (Server Component) to detect login state
 * and decide whether Nav shows 「登录」 or 「控制台」.
 *
 * The client is read-only by design — the marketing site never
 * signs users in or out; that's handled by the admin app at /login /register.
 *
 * Required env vars (in marketing/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Optional env var (production multi-subdomain deployment):
 *   NEXT_PUBLIC_COOKIE_DOMAIN — set to e.g. ".tertax.cn" so cookies are
 *     readable across subdomains (admin on console.tertax.cn writes,
 *     marketing on hub.tertax.cn reads). Leave unset for local dev.
 *
 * If env vars are missing (e.g. local dev without Supabase configured),
 * we return null instead of throwing — the page still renders with
 * isAuthed=false, which is the correct anonymous-visitor experience.
 */
async function createMarketingSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN
  if (!url || !anonKey) return null

  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookieOptions: cookieDomain ? { domain: cookieDomain } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        // Marketing site never writes auth cookies — silently ignore.
        // (Auth flow lives in admin app; we only read session here.)
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Read-only context (Server Components) — ignore.
        }
      },
    },
  })
}

/**
 * Returns the current Supabase user, or null if not signed in
 * (or if Supabase env vars are unset).
 * Safe in Server Components (uses Next.js cookies()).
 */
export async function getCurrentUser() {
  const supabase = await createMarketingSupabaseClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}
