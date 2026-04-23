const now = Date.now()
const DAY = 86400000

export const mockAccounts = [
  {
    id: 'acc_aaa111',
    email: 'alice@example.com',
    plan: 'pro',
    status: 'idle',
    hasCredentials: true,
    tokenExpiresAt: now + 3600000,
    cooldownUntil: null,
    addedAt: now - 10 * DAY,
    rateLimit: {
      window5h: { used: 30000, limit: 100000, resetAt: now + 3600000 },
      weeklyTokens: { used: 150000, limit: 1000000, resetAt: now + 5 * DAY },
    },
  },
  {
    id: 'acc_bbb222',
    email: 'bob@example.com',
    plan: 'max',
    status: 'exhausted',
    hasCredentials: true,
    tokenExpiresAt: now + 7200000,
    cooldownUntil: now + 3600000,
    addedAt: now - 20 * DAY,
    rateLimit: {
      window5h: { used: 96000, limit: 100000, resetAt: now + 900000 },
      weeklyTokens: { used: 870000, limit: 1000000, resetAt: now + 3 * DAY },
    },
  },
  {
    id: 'acc_ccc333',
    email: 'carol@example.com',
    plan: 'pro',
    status: 'idle',
    hasCredentials: true,
    tokenExpiresAt: now + 1800000,
    cooldownUntil: null,
    addedAt: now - 5 * DAY,
    rateLimit: {
      window5h: { used: 0, limit: 100000, resetAt: now + 18000000 },
      weeklyTokens: { used: 0, limit: 1000000, resetAt: now + 6 * DAY },
    },
  },
  {
    id: 'acc_relay01',
    type: 'relay',
    nickname: '青云',
    baseUrl: 'https://api.qingyuntop.top',
    hasCredentials: true,
    status: 'idle',
    addedAt: now - 2 * DAY,
    modelMap: { opus: 'claude-opus-4-7' },
    probeModel: null,
    health: {
      status: 'online',
      latencyMs: 234,
      model: 'claude-opus-4-7',
      error: null,
      ttlMs: 42000,
    },
  },
  {
    id: 'acc_relay02',
    type: 'relay',
    nickname: 'ccclub',
    baseUrl: 'https://claude-code.club/api',
    hasCredentials: true,
    status: 'idle',
    addedAt: now - 4 * DAY,
    modelMap: { opus: 'claude-opus-4-6' },
    probeModel: null,
    health: {
      status: 'offline',
      latencyMs: 1834,
      model: 'claude-opus-4-6',
      error: 'HTTP 503: Service temporarily unavailable',
      ttlMs: 12000,
    },
  },
  {
    id: 'acc_relay03',
    type: 'relay',
    nickname: '未配置',
    baseUrl: 'https://api.example.com',
    hasCredentials: true,
    status: 'idle',
    addedAt: now - DAY,
    modelMap: {},
    probeModel: null,
  },
]

export const mockTerminals = [
  {
    id: 'sk-hub-001aaa111bbb222ccc333',
    name: 'brave-koala',
    mode: 'manual',
    accountId: 'acc_aaa111',
    createdAt: now - 3 * DAY,
    lastUsedAt: now - 600000,
  },
  {
    id: 'sk-hub-002ddd444eee555fff666',
    name: 'fuzzy-penguin',
    mode: 'auto',
    accountId: 'acc_ccc333',
    createdAt: now - 7 * DAY,
    lastUsedAt: null,
  },
  {
    id: 'sk-hub-003ggg777hhh888iii999',
    name: 'lazy-otter',
    mode: 'auto',
    accountId: 'acc_bbb222',
    createdAt: now - DAY,
    lastUsedAt: now - 30000,
  },
]

function makeRecords(days = 30) {
  const models = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514']
  const accounts = ['acc_aaa111', 'acc_bbb222', 'acc_ccc333']
  const terminals = ['sk-hub-001aaa111bbb222ccc333', 'sk-hub-002ddd444eee555fff666', 'sk-hub-003ggg777hhh888iii999']
  const costs = { 'claude-sonnet': [3, 15], 'claude-haiku': [0.8, 4], 'claude-opus': [15, 75] }

  const records = []
  for (let d = days - 1; d >= 0; d--) {
    // Use calendar-day boundaries to avoid records leaking into adjacent days
    const dayStart = new Date(now - d * DAY)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = d === 0 ? now : dayStart.getTime() + DAY
    const window = dayEnd - dayStart.getTime()

    const count = 2 + Math.floor(Math.random() * 7)
    for (let i = 0; i < count; i++) {
      const mdl = models[Math.floor(Math.random() * models.length)]
      const accId = accounts[Math.floor(Math.random() * accounts.length)]
      const termId = terminals[Math.floor(Math.random() * terminals.length)]
      const inTok = 500 + Math.floor(Math.random() * 3000)
      const outTok = 100 + Math.floor(Math.random() * 800)
      const prefix = mdl.includes('opus') ? 'claude-opus' : mdl.includes('haiku') ? 'claude-haiku' : 'claude-sonnet'
      const [inRate, outRate] = costs[prefix]
      const usd = (inTok * inRate + outTok * outRate) / 1e6
      records.push({
        ts: dayStart.getTime() + Math.floor(Math.random() * window),
        terminalId: termId,
        accountId: accId,
        mdl,
        in: inTok,
        out: outTok,
        usd,
      })
    }
  }
  return records
}

export const mockUsageRecords = makeRecords(365)

// Previous period records (for trend calculation)
export const mockPrevRecords = makeRecords(365)
