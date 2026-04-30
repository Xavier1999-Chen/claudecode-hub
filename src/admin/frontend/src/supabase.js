import { createBrowserClient } from '@supabase/ssr'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const cookieDomain = import.meta.env.VITE_COOKIE_DOMAIN

if (!url || !anonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — auth will not work')
}

/**
 * Browser-side Supabase client backed by document.cookie storage.
 *
 * 历史：之前用 `@supabase/supabase-js` 的 createClient，session 存进 localStorage
 * （仅当前 origin 可见，端口隔离）。改用 `@supabase/ssr` 的 createBrowserClient
 * 后，session 写到 cookie —— 同 host 的所有端口都可见，让独立部署的 marketing
 * (Next.js, :3183) 与 admin (:3182) 共享登录态（issue #59）。
 *
 * 跨子域共享（生产）：通过 VITE_COOKIE_DOMAIN env var 配置 cookie domain，
 * 例如 `.tertax.cn` 让 admin (console.tertax.cn) 与 marketing (hub.tertax.cn)
 * 共享同一份 session cookie。本地 dev 时 env 为空 → 默认 host-only，仍
 * 在 localhost 不同端口间共享（cookies 不分端口）。
 *
 * 公共 API（auth.signIn/signUp/signOut/onAuthStateChange/getUser/getSession）
 * 与 supabase-js 完全一致，不影响调用方代码。
 */
export const supabase = createBrowserClient(url ?? '', anonKey ?? '', {
  cookieOptions: cookieDomain ? { domain: cookieDomain } : undefined,
})

// role / status lookup — app_metadata is authoritative (not user-editable)
export function getRole(user) {
  return user?.app_metadata?.role ?? null
}

// Returns 'approved' | 'pending' | 'rejected' | null
// Falls back to inferring from role when status claim is absent (legacy users)
export function getStatus(user) {
  const status = user?.app_metadata?.status
  if (status) return status
  return getRole(user) ? 'approved' : 'pending'
}

export function isApproved(user) {
  return getStatus(user) === 'approved'
}
