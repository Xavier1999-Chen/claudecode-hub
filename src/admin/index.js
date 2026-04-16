import express from 'express';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { configStore } from '../shared/config.js';
import { generateName } from '../shared/names.js';
import { createLoginSession, importCredentials, startTmuxLogin, submitAuthCode, waitForCredentials } from './oauth-login.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ADMIN_PORT ?? 3182;
const app = express();
app.use(express.json());

// Serve dashboard
app.get('/', async (_req, res) => {
  const html = await readFile(join(__dirname, 'dashboard.html'), 'utf8');
  res.send(html);
});

// ── Accounts ─────────────────────────────────────────────────────────────

app.get('/api/accounts', async (_req, res) => {
  const accounts = await configStore.readAccounts();
  // Never send credentials to frontend
  res.json(accounts.map(sanitiseAccount));
});

app.post('/api/accounts/:id/refresh-token', async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  try {
    const { refreshToken } = await import('../proxy/token-manager.js');
    const update = await refreshToken(acc);
    Object.assign(acc.credentials, update.credentials);
    await configStore.writeAccounts(accounts);
    res.json(sanitiseAccount(acc));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/accounts/:id/force-online', async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  acc.status = 'idle';
  acc.cooldownUntil = null;
  await configStore.writeAccounts(accounts);
  res.json(sanitiseAccount(acc));
});

app.post('/api/accounts/:id/force-offline', async (req, res) => {
  const accounts = await configStore.readAccounts();
  const acc = accounts.find(a => a.id === req.params.id);
  if (!acc) return res.status(404).json({ error: 'not_found' });
  acc.status = 'exhausted';
  await configStore.writeAccounts(accounts);
  // Force-offline: only reassign auto-mode terminals
  await reassignTerminals(req.params.id, accounts.filter(a => a.id !== req.params.id), ['auto']);
  res.json(sanitiseAccount(acc));
});

app.delete('/api/accounts/:id', async (req, res) => {
  let accounts = await configStore.readAccounts();
  const remaining = accounts.filter(a => a.id !== req.params.id);
  // Delete: reassign ALL terminals (both auto and manual)
  await reassignTerminals(req.params.id, remaining, null);
  await configStore.writeAccounts(remaining);
  res.json({ ok: true });
});

// ── Terminals ────────────────────────────────────────────────────────────

app.get('/api/terminals', async (_req, res) => {
  res.json(await configStore.readTerminals());
});

app.post('/api/terminals', async (req, res) => {
  const terminals = await configStore.readTerminals();
  const names = terminals.map(t => t.name);
  const name = req.body.name?.trim() || generateName(names);
  const terminal = {
    id: `sk-hub-${randomBytes(12).toString('hex')}`,
    name,
    mode: req.body.mode ?? 'auto',
    accountId: req.body.accountId ?? null,
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
  if (req.body.name !== undefined) t.name = req.body.name;
  if (req.body.mode !== undefined) t.mode = req.body.mode;
  if (req.body.accountId !== undefined) t.accountId = req.body.accountId;
  await configStore.writeTerminals(terminals);
  res.json(t);
});

app.delete('/api/terminals/:id', async (req, res) => {
  let terminals = await configStore.readTerminals();
  terminals = terminals.filter(t => t.id !== req.params.id);
  await configStore.writeTerminals(terminals);
  res.json({ ok: true });
});

// ── Usage ─────────────────────────────────────────────────────────────────

app.get('/api/usage', async (req, res) => {
  const { range = '7d', group = 'account' } = req.query;
  try {
    const data = await aggregateUsage(range, group);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OAuth ─────────────────────────────────────────────────────────────────

// Map of sessionId → { configDir, tmuxSession }
const oauthSessions = new Map();

// Step 1: start tmux claude login, return authorization URL
app.post('/api/oauth/start', async (_req, res) => {
  try {
    const { sessionId, configDir, tmuxSession, authUrl } = await startTmuxLogin();
    oauthSessions.set(sessionId, { configDir, tmuxSession });
    res.json({ sessionId, authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Step 2: user pastes the authentication code
app.post('/api/oauth/submit-code/:sessionId', async (req, res) => {
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
app.post('/api/oauth/import/:sessionId', async (req, res) => {
  const session = oauthSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });

  try {
    const account = await waitForCredentials(session.configDir, session.tmuxSession);
    oauthSessions.delete(req.params.sessionId); // only delete on success
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
app.post('/api/oauth/start-manual', (_req, res) => {
  const { sessionId, configDir, loginCmd } = createLoginSession();
  oauthSessions.set(sessionId, { configDir, tmuxSession: null });
  res.json({ sessionId, loginCmd });
});

app.post('/api/oauth/import-manual/:sessionId', async (req, res) => {
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

function sanitiseAccount(acc) {
  const { credentials, ...rest } = acc;
  return {
    ...rest,
    hasCredentials: !!credentials?.accessToken,
    tokenExpiresAt: credentials?.expiresAt,
  };
}

async function aggregateUsage(range, group) {
  const projectRoot = fileURLToPath(new URL('../../..', import.meta.url));
  const logsDir = join(projectRoot, 'logs');

  const now = Date.now();
  const rangeMs = range === 'today'
    ? now - new Date().setHours(0, 0, 0, 0)
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
      const text = await readFile(logPath, 'utf8');
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

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[admin] listening on http://127.0.0.1:${PORT}`);
});
