import { createBrowserClient } from '@supabase/ssr'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
 * 公共 API（auth.signIn/signUp/signOut/onAuthStateChange/getUser/getSession）
 * 与 supabase-js 完全一致，不影响调用方代码。
 */
export const supabase = createBrowserClient(url ?? '', anonKey ?? '')

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
