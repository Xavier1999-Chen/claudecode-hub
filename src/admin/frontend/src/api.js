// API layer.
// Dev (VITE_MOCK !== 'false') → mock data for UI iteration.
// Prod / real backend → calls go to Express backend, authenticated with Supabase JWT.

import {
  mockAccounts,
  mockTerminals,
  mockUsageRecords,
  mockPrevRecords,
} from './mock/data.js'
import { supabase } from './supabase.js'

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK !== 'false'

// ── State for mock mutations ─────────────────────────────────────────────────
let _accounts = [...mockAccounts]
let _terminals = [...mockTerminals]

function delay(ms = 120) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Authenticated fetch ─────────────────────────────────────────────────────
// Attaches the current Supabase session JWT to every /api/* request.
async function apiFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { ...(opts.headers ?? {}) }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { ...opts, headers })
  if (res.status === 401) {
    // Token invalid/expired — sign out so the login page appears
    await supabase.auth.signOut()
  }
  return res
}

async function apiJson(path, opts) {
  const res = await apiFetch(path, opts)
  return res.json()
}

// ── Auth (real Supabase) ─────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateAuthError(error.message))
  return data.session
}

export async function signUp(email, password) {
  // emailRedirectTo = current origin's /auth/confirm so the email link lands on
  // our own intermediate confirmation page (see GitHub #6). The Supabase email
  // template MUST be customised to match — the default `{{ .ConfirmationURL }}`
  // points straight at Supabase's auto-consume verify endpoint, which QQ Mail
  // and similar scanners pre-fetch and invalidate.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  })
  if (error) throw new Error(translateAuthError(error.message))
  return data
}

// Called from ConfirmEmailPage when the user clicks "verify" on the
// intermediate page. Uses verifyOtp with the token_hash from the URL —
// works cross-device (no PKCE verifier needed) and only fires on real
// user interaction, so prefetchers cannot trigger it.
export async function confirmEmail({ tokenHash, type }) {
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  })
  if (error) throw new Error(translateAuthError(error.message))
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function resendVerification(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
  })
  if (error) throw new Error(translateAuthError(error.message))
}

function translateAuthError(msg) {
  if (/Invalid login credentials/i.test(msg)) return '邮箱或密码错误'
  if (/Email not confirmed/i.test(msg)) return '邮箱尚未验证，请查收验证邮件'
  if (/already registered/i.test(msg)) return '该邮箱已注册'
  if (/Password should be at least/i.test(msg)) return '密码至少需要 6 位'
  if (/rate limit/i.test(msg)) return '操作过于频繁，请稍后再试'
  if (/Token has expired or is invalid|otp_expired|invalid.*token/i.test(msg)) {
    return '验证链接已失效，请回到登录页用注册邮箱登录后重发验证邮件'
  }
  return msg
}

// ── Accounts ─────────────────────────────────────────────────────────────────
export async function getAccounts() {
  if (USE_MOCK) { await delay(); return JSON.parse(JSON.stringify(_accounts)) }
  return apiJson('/api/accounts')
}

export async function forceOnline(id) {
  if (USE_MOCK) {
    await delay()
    const acc = _accounts.find(a => a.id === id)
    if (acc) { acc.status = 'idle'; acc.cooldownUntil = null }
    return JSON.parse(JSON.stringify(acc))
  }
  return apiJson(`/api/accounts/${id}/force-online`, { method: 'POST' })
}

export async function forceOffline(id) {
  if (USE_MOCK) {
    await delay()
    const acc = _accounts.find(a => a.id === id)
    if (acc) acc.status = 'exhausted'
    return JSON.parse(JSON.stringify(acc))
  }
  return apiJson(`/api/accounts/${id}/force-offline`, { method: 'POST' })
}

export async function deleteAccount(id) {
  if (USE_MOCK) {
    await delay()
    _accounts = _accounts.filter(a => a.id !== id)
    return { ok: true }
  }
  return apiJson(`/api/accounts/${id}`, { method: 'DELETE' })
}

export async function renameAccount(id, nickname) {
  if (USE_MOCK) {
    await delay()
    const acc = _accounts.find(a => a.id === id)
    if (acc) acc.nickname = nickname
    return JSON.parse(JSON.stringify(acc))
  }
  return apiJson(`/api/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ nickname }),
  })
}

export async function refreshAccountToken(id) {
  if (USE_MOCK) {
    await delay(600)
    const acc = _accounts.find(a => a.id === id)
    if (acc) acc.tokenExpiresAt = Date.now() + 3600000
    return JSON.parse(JSON.stringify(acc))
  }
  return apiJson(`/api/accounts/${id}/refresh-token`, { method: 'POST' })
}

export async function addRelayAccount({ nickname, baseUrl, apiKey, modelMap }) {
  if (USE_MOCK) {
    await delay(400)
    const newAcc = {
      id: 'acc_relay' + Date.now(),
      type: 'relay',
      nickname,
      baseUrl,
      modelMap: modelMap ?? {},
      status: 'idle',
      hasCredentials: true,
      addedAt: Date.now(),
    }
    _accounts.push(newAcc)
    return JSON.parse(JSON.stringify(newAcc))
  }
  return apiJson('/api/accounts/relay', {
    method: 'POST',
    body: JSON.stringify({ nickname, baseUrl, apiKey, modelMap }),
  })
}

export async function syncAccountUsage(id) {
  if (USE_MOCK) {
    await delay(400)
    const acc = _accounts.find(a => a.id === id)
    if (acc) {
      acc.rateLimit = {
        window5h: { utilization: Math.random() * 0.6, resetAt: Date.now() + 18000000, status: 'allowed' },
        weekly: { utilization: Math.random() * 0.4, resetAt: Date.now() + 6 * 86400000, status: 'allowed' },
      }
    }
    return JSON.parse(JSON.stringify(acc))
  }
  return apiJson(`/api/accounts/${id}/sync-usage`, { method: 'POST' })
}

// ── Terminals ─────────────────────────────────────────────────────────────────
export async function getTerminals() {
  if (USE_MOCK) { await delay(); return JSON.parse(JSON.stringify(_terminals)) }
  return apiJson('/api/terminals')
}

export async function createTerminal(body) {
  if (USE_MOCK) {
    await delay()
    const id = 'sk-hub-' + Math.random().toString(36).slice(2).padEnd(24, '0')
    const t = {
      id,
      name: body.name || 'new-terminal',
      mode: body.mode ?? 'auto',
      accountId: body.accountId ?? null,
      createdAt: Date.now(),
      lastUsedAt: null,
    }
    _terminals.push(t)
    return JSON.parse(JSON.stringify(t))
  }
  return apiJson('/api/terminals', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateTerminal(id, body) {
  if (USE_MOCK) {
    await delay()
    const t = _terminals.find(t => t.id === id)
    if (!t) throw new Error('not_found')
    Object.assign(t, body)
    return JSON.parse(JSON.stringify(t))
  }
  return apiJson(`/api/terminals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteTerminal(id) {
  if (USE_MOCK) {
    await delay()
    _terminals = _terminals.filter(t => t.id !== id)
    return { ok: true }
  }
  return apiJson(`/api/terminals/${id}`, { method: 'DELETE' })
}

// ── Usage ─────────────────────────────────────────────────────────────────────
export async function getUsage(range = '7d', group = 'account') {
  if (USE_MOCK) {
    await delay(200)
    const now = Date.now()
    const rangeMs = range === 'today'
      ? now - new Date().setHours(0, 0, 0, 0)
      : range === '30d' ? 30 * 86400000 : 7 * 86400000
    const since = now - rangeMs
    const prevSince = since - rangeMs
    return {
      records: mockUsageRecords.filter(r => r.ts >= since),
      prevRecords: mockPrevRecords.filter(r => r.ts >= prevSince && r.ts < since),
      range,
      group,
    }
  }
  return apiJson(`/api/usage?range=${range}&group=${group}`)
}

export async function syncAllUsage() {
  if (USE_MOCK) {
    await delay(800)
    _accounts = _accounts.map(acc => ({
      ...acc,
      rateLimit: {
        window5h: { utilization: Math.random() * 0.6, resetAt: Date.now() + 18000000, status: 'allowed' },
        weekly: { utilization: Math.random() * 0.4, resetAt: Date.now() + 6 * 86400000, status: 'allowed' },
      },
    }))
    return JSON.parse(JSON.stringify(_accounts))
  }
  return apiJson('/api/sync-usage-all', { method: 'POST' })
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
export async function oauthStart() {
  if (USE_MOCK) {
    await delay(800)
    return {
      sessionId: 'mock-session-' + Date.now(),
      authUrl: 'https://claude.ai/oauth/authorize?mock=true&client_id=mock',
    }
  }
  return apiJson('/api/oauth/start', { method: 'POST' })
}

export async function oauthSubmitCode(sessionId, code) {
  if (USE_MOCK) {
    await delay(400)
    if (code === 'fail') throw new Error('invalid_code')
    return { ok: true }
  }
  return apiJson(`/api/oauth/submit-code/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export async function oauthImport(sessionId) {
  if (USE_MOCK) {
    await delay(1500)
    const newAcc = {
      id: 'acc_new' + Date.now(),
      email: 'newuser@example.com',
      plan: 'pro',
      status: 'idle',
      hasCredentials: true,
      tokenExpiresAt: Date.now() + 3600000,
      cooldownUntil: null,
      addedAt: Date.now(),
      rateLimit: {
        window5h: { used: 0, limit: 100000, resetAt: Date.now() + 18000000 },
        weeklyTokens: { used: 0, limit: 1000000, resetAt: Date.now() + 6 * 86400000 },
      },
    }
    _accounts.push(newAcc)
    return { account: newAcc }
  }
  return apiJson(`/api/oauth/import/${sessionId}`, { method: 'POST' })
}
