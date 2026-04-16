// In development (VITE_MOCK=true or no real backend), use mock data.
// In production, calls go to the Express backend at the same origin.

import {
  mockAccounts,
  mockTerminals,
  mockUsageRecords,
  mockPrevRecords,
} from './mock/data.js'

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK !== 'false'

// ── State for mock mutations ─────────────────────────────────────────────────
let _accounts = [...mockAccounts]
let _terminals = [...mockTerminals]

function delay(ms = 120) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Accounts ─────────────────────────────────────────────────────────────────
export async function getAccounts() {
  if (USE_MOCK) { await delay(); return JSON.parse(JSON.stringify(_accounts)) }
  return fetch('/api/accounts').then(r => r.json())
}

export async function forceOnline(id) {
  if (USE_MOCK) {
    await delay()
    const acc = _accounts.find(a => a.id === id)
    if (acc) { acc.status = 'idle'; acc.cooldownUntil = null }
    return JSON.parse(JSON.stringify(acc))
  }
  return fetch(`/api/accounts/${id}/force-online`, { method: 'POST' }).then(r => r.json())
}

export async function forceOffline(id) {
  if (USE_MOCK) {
    await delay()
    const acc = _accounts.find(a => a.id === id)
    if (acc) acc.status = 'exhausted'
    return JSON.parse(JSON.stringify(acc))
  }
  return fetch(`/api/accounts/${id}/force-offline`, { method: 'POST' }).then(r => r.json())
}

export async function deleteAccount(id) {
  if (USE_MOCK) {
    await delay()
    _accounts = _accounts.filter(a => a.id !== id)
    return { ok: true }
  }
  return fetch(`/api/accounts/${id}`, { method: 'DELETE' }).then(r => r.json())
}

export async function renameAccount(id, nickname) {
  if (USE_MOCK) {
    await delay()
    const acc = _accounts.find(a => a.id === id)
    if (acc) acc.nickname = nickname
    return JSON.parse(JSON.stringify(acc))
  }
  return fetch(`/api/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  }).then(r => r.json())
}

export async function refreshAccountToken(id) {
  if (USE_MOCK) {
    await delay(600)
    const acc = _accounts.find(a => a.id === id)
    if (acc) acc.tokenExpiresAt = Date.now() + 3600000
    return JSON.parse(JSON.stringify(acc))
  }
  return fetch(`/api/accounts/${id}/refresh-token`, { method: 'POST' }).then(r => r.json())
}

// ── Terminals ─────────────────────────────────────────────────────────────────
export async function getTerminals() {
  if (USE_MOCK) { await delay(); return JSON.parse(JSON.stringify(_terminals)) }
  return fetch('/api/terminals').then(r => r.json())
}

export async function createTerminal(body) {
  if (USE_MOCK) {
    await delay()
    const { randomBytes } = await import('crypto').catch(() => null) || {}
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
  return fetch('/api/terminals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

export async function updateTerminal(id, body) {
  if (USE_MOCK) {
    await delay()
    const t = _terminals.find(t => t.id === id)
    if (!t) throw new Error('not_found')
    Object.assign(t, body)
    return JSON.parse(JSON.stringify(t))
  }
  return fetch(`/api/terminals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

export async function deleteTerminal(id) {
  if (USE_MOCK) {
    await delay()
    _terminals = _terminals.filter(t => t.id !== id)
    return { ok: true }
  }
  return fetch(`/api/terminals/${id}`, { method: 'DELETE' }).then(r => r.json())
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
  return fetch(`/api/usage?range=${range}&group=${group}`).then(r => r.json())
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
  return fetch('/api/oauth/start', { method: 'POST' }).then(r => r.json())
}

export async function oauthSubmitCode(sessionId, code) {
  if (USE_MOCK) {
    await delay(400)
    if (code === 'fail') throw new Error('invalid_code')
    return { ok: true }
  }
  return fetch(`/api/oauth/submit-code/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then(r => r.json())
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
  return fetch(`/api/oauth/import/${sessionId}`, { method: 'POST' }).then(r => r.json())
}
