// Env vars loaded via `node --env-file-if-exists=.env` (see package.json / start.sh)
import express from 'express';
import { readFile as readFileAsync, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { configStore } from '../shared/config.js';
import { isExpired, refreshToken } from '../proxy/token-manager.js';
import { generateName } from '../shared/names.js';
import { createLoginSession, importCredentials, startTmuxLogin, submitAuthCode, waitForCredentials } from './oauth-login.js';
import { requireAuth, requireApproved, requireAdmin } from './auth.js';
import { isAccountCooling, reassignCoolingTerminals } from './reassignment.js';
import { isOAuthRevoked } from '../proxy/permission-guard.js';
import { syncRelayHealth, listClaudeModels, RELAY_HEALTH_POLL_MS } from './relay-health.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ADMIN_PORT ?? 3182;
const DIST_DIR = join(__dirname, 'frontend', 'dist');
const app = express();
app.use(express.json());

// In-memory relay health cache. Written by the backend poll timer and by
// syncRateLimit(); read by sanitiseAccount() to merge health into API responses.
const relayHealthCache = new Map(); // accountId → { status, latencyMs, model, error }

// Serve React frontend static files (unauthenticated — SPA shell)
app.use(express.static(DIST_DIR));

// SPA fallback — non-/api/ requests return index.html (also unauthenticated)
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

// All /api/* routes require a valid Supabase session by default.
// requireApproved blocks users who registered but haven't been granted a role yet.
// Individual admin-only routes attach requireAdmin on top.
app.use('/api', requireAuth, requireApproved);

// ── Accounts ─────────────────────────────────────────────────────────────

app.get('/api/accounts', async (_req, res) => {
  const accounts = await configStore.readAccounts();
  // Never send credentials to frontend
  res.json(accounts.map(sanitiseAccount));
});

app.post('/api/accounts/:id/refresh-token', requireAdmin, async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  if (acc.type === 'relay') return res.status(400).json({ error: 'relay_no_refresh' });
  try {
    const { refreshToken } = await import('../proxy/token-manager.js');
    const { fetchMe } = await import('./oauth-login.js');
    const update = await refreshToken(acc);
    Object.assign(acc.credentials, update.credentials);
    // Re-fetch email after token refresh (fixes accounts imported with placeholder email)
    const meData = await fetchMe(acc.credentials.accessToken);
    if (meData.email) acc.email = meData.email;
    // Plan comes from subscriptionType in the refreshed credentials
    if (update.credentials.subscriptionType) acc.plan = update.credentials.subscriptionType;
    // Probe Anthropic API to sync current rate limit usage from response headers
    await syncRateLimit(acc);
    await configStore.writeAccounts(accounts);
    res.json(sanitiseAccount(acc));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/sync-usage', requireAdmin, async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  try {
    const wasExhausted = acc.status === 'exhausted';
    await syncRateLimit(acc);
    await configStore.writeAccounts(accounts);
    if (isAccountCooling(acc)) {
      await reassignCoolingTerminals(acc.id, accounts, ['auto'], configStore);
    } else if (!wasExhausted && acc.status === 'exhausted') {
      // syncRateLimit just flipped status to exhausted (OAuth revoked);
      // move every terminal off this account — manual included, since the
      // account is now permanently unusable.
      await reassignCoolingTerminals(acc.id, accounts, null, configStore);
    }
    res.json(sanitiseAccount(acc));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.patch('/api/accounts/:id', requireAdmin, async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  if (req.body.nickname !== undefined) acc.nickname = req.body.nickname;
  if (req.body.probeModel !== undefined && acc.type === 'relay') {
    const v = req.body.probeModel;
    acc.probeModel = (typeof v === 'string' && v.trim().length > 0) ? v.trim() : null;
  }
  if (req.body.modelMap !== undefined && acc.type === 'relay') {
    const normalisedMap = {};
    if (req.body.modelMap && typeof req.body.modelMap === 'object') {
      for (const tier of ['opus', 'sonnet', 'haiku']) {
        const v = req.body.modelMap[tier];
        if (typeof v === 'string' && v.trim().length > 0) normalisedMap[tier] = v.trim();
      }
    }
    acc.modelMap = normalisedMap;
  }
  await configStore.writeAccounts(accounts);
  res.json(sanitiseAccount(acc));
});

// List available claude models from a relay station's /v1/models endpoint.
app.get('/api/accounts/:id/models', requireAdmin, async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  if (acc.type !== 'relay') return res.status(400).json({ error: 'not_relay' });
  try {
    const models = await listClaudeModels(acc);
    res.json({ models });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/force-online', requireAdmin, async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  acc.status = 'idle';
  acc.cooldownUntil = null;
  await configStore.writeAccounts(accounts);
  res.json(sanitiseAccount(acc));
});

app.post('/api/accounts/:id/force-offline', requireAdmin, async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  acc.status = 'exhausted';
  await configStore.writeAccounts(accounts);
  // Force-offline: only reassign auto-mode terminals
  await reassignTerminals(req.params.id, accounts.filter(a => a.id !== req.params.id), ['auto']);
  res.json(sanitiseAccount(acc));
});

app.delete('/api/accounts/:id', requireAdmin, async (req, res) => {
  let accounts = await configStore.readAccounts();
  const remaining = accounts.filter(a => a.id !== req.params.id);
  // Delete: reassign ALL terminals (both auto and manual)
  await reassignTerminals(req.params.id, remaining, null);
  await configStore.writeAccounts(remaining);
  res.json({ ok: true });
});

// Add a third-party relay-station account (static apiKey + baseUrl).
// Relays serve Claude /v1/messages without OAuth; they're used as a fallback
// tier when all OAuth accounts are cooling/exhausted. Optional per-tier
// modelMap rewrites body.model before forwarding (e.g. opus-4-7 → opus-4-6).
app.post('/api/accounts/relay', requireAdmin, async (req, res) => {
  const { nickname, baseUrl, apiKey, modelMap } = req.body ?? {};
  if (typeof nickname !== 'string' || nickname.trim().length === 0) {
    return res.status(400).json({ error: 'nickname_required' });
  }
  if (typeof baseUrl !== 'string' || !/^https:\/\//i.test(baseUrl)) {
    return res.status(400).json({ error: 'invalid_base_url', message: 'baseUrl must start with https://' });
  }
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return res.status(400).json({ error: 'api_key_required' });
  }
  const normalisedMap = {};
  if (modelMap && typeof modelMap === 'object') {
    for (const tier of ['opus', 'sonnet', 'haiku']) {
      const v = modelMap[tier];
      if (typeof v === 'string' && v.trim().length > 0) normalisedMap[tier] = v.trim();
    }
  }
  const accounts = await configStore.readAccounts();
  const acc = {
    id: `acc_${randomBytes(6).toString('hex')}`,
    type: 'relay',
    nickname: nickname.trim(),
    baseUrl: baseUrl.replace(/\/$/, ''),
    credentials: { apiKey: apiKey.trim() },
    modelMap: normalisedMap,
    status: 'idle',
    addedAt: Date.now(),
  };
  accounts.push(acc);
  await configStore.writeAccounts(accounts);
  res.status(201).json(sanitiseAccount(acc));
});

// ── Terminals ────────────────────────────────────────────────────────────

// Visible to user: own terminals. Admin sees everything (incl. legacy orphans with no userId).
function visibleTerminals(terminals, user) {
  if (user.role === 'admin') return terminals;
  return terminals.filter(t => t.userId === user.id);
}

function canModifyTerminal(terminal, user) {
  if (user.role === 'admin') return true;
  return terminal.userId === user.id;
}

app.get('/api/terminals', async (req, res) => {
  const terminals = await configStore.readTerminals();
  res.json(visibleTerminals(terminals, req.user));
});

app.post('/api/terminals', async (req, res) => {
  const terminals = await configStore.readTerminals();
  const names = terminals.map(t => t.name);
  const name = req.body.name?.trim() || generateName(names);
  const mode = req.body.mode ?? 'auto';

  // Auto-assign best available account for auto-mode terminals
  let accountId = req.body.accountId ?? null;
  if (mode === 'auto' && !accountId) {
    const accounts = await configStore.readAccounts();
    const available = accounts.filter(a => a.status !== 'exhausted');
    if (available.length) {
      const autoTerminalCount = (accId) =>
        terminals.filter(t => t.mode === 'auto' && t.accountId === accId).length;
      available.sort((a, b) => {
        const tA = autoTerminalCount(a.id);
        const tB = autoTerminalCount(b.id);
        if (tA !== tB) return tA - tB;
        const uA = a.rateLimit?.window5h?.utilization ?? 0;
        const uB = b.rateLimit?.window5h?.utilization ?? 0;
        if (uA !== uB) return uA - uB;
        const wA = a.rateLimit?.weekly?.utilization ?? 0;
        const wB = b.rateLimit?.weekly?.utilization ?? 0;
        if (wA !== wB) return wA - wB;
        return (a.addedAt ?? 0) - (b.addedAt ?? 0);
      });
      accountId = available[0].id;
    }
  }

  const terminal = {
    id: `sk-hub-${randomBytes(12).toString('hex')}`,
    name,
    mode,
    accountId,
    userId: req.user.id,
    userEmail: req.user.email,
    createdAt: Date.now(),
    lastUsedAt: null,
  };
  terminals.push(terminal);
  await configStore.writeTerminals(terminals);
  res.status(201).json(terminal);
});

app.patch('/api/terminals/:id', async (req, res) => {
  const terminals = await configStore.readTerminals();
  const t = terminals.find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (!canModifyTerminal(t, req.user)) return res.status(403).json({ error: 'not_your_terminal' });
  if (req.body.name !== undefined) t.name = req.body.name;
  if (req.body.mode !== undefined) t.mode = req.body.mode;
  if (req.body.accountId !== undefined) t.accountId = req.body.accountId;
  await configStore.writeTerminals(terminals);
  res.json(t);
});

app.delete('/api/terminals/:id', async (req, res) => {
  let terminals = await configStore.readTerminals();
  const t = terminals.find(t => t.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not_found' });
  if (!canModifyTerminal(t, req.user)) return res.status(403).json({ error: 'not_your_terminal' });
  terminals = terminals.filter(t => t.id !== req.params.id);
  await configStore.writeTerminals(terminals);
  res.json({ ok: true });
});

// ── Usage ─────────────────────────────────────────────────────────────────

app.get('/api/usage', async (req, res) => {
  const { range = '7d', group = 'account' } = req.query;
  try {
    const data = await aggregateUsage(range, group);
    // Non-admin users only see their own terminals' usage
    if (req.user.role !== 'admin') {
      const terminals = await configStore.readTerminals();
      const ownTerminalIds = new Set(
        terminals.filter(t => t.userId === req.user.id).map(t => t.id)
      );
      data.records = (data.records ?? []).filter(r => ownTerminalIds.has(r.terminalId));
      data.prevRecords = (data.prevRecords ?? []).filter(r => ownTerminalIds.has(r.terminalId));
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OAuth ─────────────────────────────────────────────────────────────────

// Map of sessionId → { configDir, tmuxSession }
const oauthSessions = new Map();

// Step 1: start tmux claude login, return authorization URL
app.post('/api/oauth/start', requireAdmin, async (_req, res) => {
  try {
    const { sessionId, configDir, tmuxSession, authUrl } = await startTmuxLogin();
    oauthSessions.set(sessionId, { configDir, tmuxSession });
    res.json({ sessionId, authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: user pastes the authentication code
app.post('/api/oauth/submit-code/:sessionId', requireAdmin, async (req, res) => {
  const session = oauthSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'missing_code' });
  try {
    await submitAuthCode(session.tmuxSession, code.trim());
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 3: poll until credentials file appears, then import
app.post('/api/oauth/import/:sessionId', requireAdmin, async (req, res) => {
  const session = oauthSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });

  try {
    const account = await waitForCredentials(session.configDir, session.tmuxSession);
    oauthSessions.delete(req.params.sessionId); // only delete on success
    await syncRateLimit(account);
    const accounts = await configStore.readAccounts();
    accounts.push(account);
    await configStore.writeAccounts(accounts);
    res.json({ account: sanitiseAccount(account) });
  } catch (err) {
    // Keep session in map so the client can retry or diagnose
    res.status(400).json({ error: err.message });
  }
});

// Fallback: manual terminal flow
app.post('/api/oauth/start-manual', requireAdmin, (_req, res) => {
  const { sessionId, configDir, loginCmd } = createLoginSession();
  oauthSessions.set(sessionId, { configDir, tmuxSession: null });
  res.json({ sessionId, loginCmd });
});

app.post('/api/oauth/import-manual/:sessionId', requireAdmin, async (req, res) => {
  const session = oauthSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  oauthSessions.delete(req.params.sessionId);
  try {
    const account = await importCredentials(session.configDir);
    const accounts = await configStore.readAccounts();
    accounts.push(account);
    await configStore.writeAccounts(accounts);
    res.json({ account: sanitiseAccount(account) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Make a minimal probe request to Anthropic to read current rate-limit headers,
 * then update acc.rateLimit in-place. Non-fatal: errors are silently ignored.
 */
async function syncRateLimit(acc) {
  // Relay accounts: probe health instead of reading Anthropic rate-limit headers.
  if (acc.type === 'relay') {
    await syncRelayHealth(acc);
    if (acc.health) {
      acc.health._nextCheckAt = Date.now() + RELAY_HEALTH_POLL_MS;
      relayHealthCache.set(acc.id, acc.health);
    }
    return;
  }
  try {
    if (isExpired(acc)) {
      const update = await refreshToken(acc);
      Object.assign(acc.credentials, update.credentials);
    }
    const fetch = (await import('node-fetch')).default;
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
                  || process.env.HTTP_PROXY  || process.env.http_proxy;
    const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${acc.credentials.accessToken}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: '0' }],
      }),
      ...(agent && { agent }),
    });

    // Detect permanent OAuth revocation — Anthropic returns 403 permission_error
    // when the org's OAuth access has been revoked (plan downgraded, org banned).
    // Mark the account exhausted so UI/selection treats it as permanently offline;
    // the sync-usage endpoints notice the status transition and migrate terminals.
    if (res.status === 403) {
      const body = await res.text();
      if (isOAuthRevoked(res.status, body)) {
        console.warn(`[syncRateLimit] 403 permission_error on ${acc.email ?? acc.id}, marking exhausted`);
        acc.status = 'exhausted';
        acc.plan = 'free';
      }
      return;
    }

    const h5hUtil  = parseFloat(res.headers.get('anthropic-ratelimit-unified-5h-utilization'));
    const h5hReset = parseInt(res.headers.get('anthropic-ratelimit-unified-5h-reset'), 10);
    const h5hStatus = res.headers.get('anthropic-ratelimit-unified-5h-status');
    const h7dUtil  = parseFloat(res.headers.get('anthropic-ratelimit-unified-7d-utilization'));
    const h7dReset = parseInt(res.headers.get('anthropic-ratelimit-unified-7d-reset'), 10);
    const h7dStatus = res.headers.get('anthropic-ratelimit-unified-7d-status');

    if (!isNaN(h5hUtil)) {
      if (!acc.rateLimit) acc.rateLimit = {};
      acc.rateLimit.window5h = {
        utilization: h5hUtil,
        resetAt: isNaN(h5hReset) ? null : h5hReset * 1000,
        status: h5hStatus ?? 'allowed',
      };
    }
    if (!isNaN(h7dUtil)) {
      if (!acc.rateLimit) acc.rateLimit = {};
      acc.rateLimit.weekly = {
        utilization: h7dUtil,
        resetAt: isNaN(h7dReset) ? null : h7dReset * 1000,
        status: h7dStatus ?? 'allowed',
      };
    }
  } catch (err) { console.error('[syncRateLimit] error:', err.message); }
}

function sanitiseAccount(acc) {
  const { credentials, ...rest } = acc;
  if (acc.type === 'relay') {
    const health = relayHealthCache.get(acc.id) ?? null;
    return {
      ...rest,
      hasCredentials: !!credentials?.apiKey,
      health: health
        ? {
            status: health.status,
            latencyMs: health.latencyMs,
            model: health.model,
            error: health.error,
            nextCheckAt: health._nextCheckAt,
          }
        : null,
    };
  }
  return {
    ...rest,
    hasCredentials: !!credentials?.accessToken,
    tokenExpiresAt: credentials?.expiresAt,
  };
}

async function aggregateUsage(range, group) {
  const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
  const logsDir = join(projectRoot, 'logs');

  const now = Date.now();
  const rangeMs = range === 'today'
    ? now - new Date().setHours(0, 0, 0, 0)
    : range === '365d' ? 365 * 86400000
    : range === '30d' ? 30 * 86400000 : 7 * 86400000;
  const since = now - rangeMs;
  const prevSince = since - rangeMs;

  let accountDirs = [];
  try { accountDirs = await readdir(logsDir); } catch { return buildEmptyResult(); }

  const records = [];
  const prevRecords = [];
  for (const accId of accountDirs) {
    const logPath = join(logsDir, accId, 'usage.jsonl');
    try {
      const text = await readFileAsync(logPath, 'utf8');
      for (const line of text.trim().split('\n')) {
        if (!line) continue;
        try {
          const r = JSON.parse(line);
          if (r.ts >= since) records.push(r);
          else if (r.ts >= prevSince) prevRecords.push(r);
        } catch { /* skip malformed */ }
      }
    } catch { /* no log yet */ }
  }

  return { records, prevRecords, range, group };
}

function buildEmptyResult() {
  return { records: [], range: '7d', group: 'account' };
}

// Reassign terminals away from a removed/exhausted account.
// modes: ['auto'] to only reassign auto-mode terminals, null for all modes.
// Picks the best alternative: idle first, then soonest cooldown expiry.
async function reassignTerminals(removedAccountId, availableAccounts, modes) {
  const terminals = await configStore.readTerminals();
  const affected = terminals.filter(t =>
    t.accountId === removedAccountId &&
    (modes === null || modes.includes(t.mode))
  );
  if (!affected.length) return;

  const available = availableAccounts.filter(a => a.status !== 'exhausted');
  const best = available.length
    ? available.sort((a, b) =>
        (a.rateLimit?.window5h?.used ?? 0) - (b.rateLimit?.window5h?.used ?? 0)
      )[0]
    : availableAccounts
        .filter(a => a.cooldownUntil)
        .sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0] ?? null;

  for (const t of affected) {
    t.accountId = best?.id ?? null;
  }
  await configStore.writeTerminals(terminals);
}

// ─────────────────────────────────────────────────────────────────────────

// Probe all accounts on demand (called by frontend adaptive polling)
app.post('/api/sync-usage-all', requireAdmin, async (_req, res) => {
  try {
    const accounts = await configStore.readAccounts();
    const coolingAccs = [];
    const revokedAccs = [];
    for (const acc of accounts) {
      const wasExhausted = acc.status === 'exhausted';
      await syncRateLimit(acc);
      if (isAccountCooling(acc)) coolingAccs.push(acc);
      else if (!wasExhausted && acc.status === 'exhausted') revokedAccs.push(acc);
    }
    await configStore.writeAccounts(accounts);
    for (const acc of coolingAccs) {
      await reassignCoolingTerminals(acc.id, accounts, ['auto'], configStore);
    }
    for (const acc of revokedAccs) {
      await reassignCoolingTerminals(acc.id, accounts, null, configStore);
    }
    res.json(accounts.map(sanitiseAccount));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bind to all interfaces — /api/* is protected by Supabase JWT auth (see auth.js).
// Override with ADMIN_HOST=127.0.0.1 to restrict to localhost only.
const HOST = process.env.ADMIN_HOST ?? '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[admin] listening on http://${HOST}:${PORT}`);
});

// ── Backend relay health poll ────────────────────────────────────────────────
// Runs every 60s regardless of how many users are online. Each cycle probes
// all relay accounts that have a probe model configured and updates the
// relayHealthCache. Frontend just reads the cache via getAccounts.
setInterval(async () => {
  try {
    const accounts = await configStore.readAccounts();
    for (const acc of accounts) {
      if (acc.type !== 'relay') continue;
      await syncRelayHealth(acc);
      if (acc.health) {
        acc.health._nextCheckAt = Date.now() + RELAY_HEALTH_POLL_MS;
        relayHealthCache.set(acc.id, acc.health);
      }
    }
  } catch (err) {
    console.error('[relay-poll] error:', err.message);
  }
}, RELAY_HEALTH_POLL_MS);
