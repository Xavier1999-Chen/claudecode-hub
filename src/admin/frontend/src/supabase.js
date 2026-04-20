import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — auth will not work')
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
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
