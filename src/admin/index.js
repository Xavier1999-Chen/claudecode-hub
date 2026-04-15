import express from 'express';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { configStore } from '../shared/config.js';
import { generateName } from '../shared/names.js';
import { startOAuthFlow } from './oauth-login.js';

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
  res.json(sanitiseAccount(acc));
});

app.delete('/api/accounts/:id', async (req, res) => {
  let accounts = await configStore.readAccounts();
  accounts = accounts.filter(a => a.id !== req.params.id);
  await configStore.writeAccounts(accounts);
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

// Map of sessionId → { status, promise, account?, error? }
const oauthSessions = new Map();

app.post('/api/oauth/start', (_req, res) => {
  const { getUrl, promise } = startOAuthFlow();
  // Wait a tick for server.listen() to assign port
  setTimeout(() => {
    const url = getUrl();
    const sessionId = randomBytes(8).toString('hex');
    oauthSessions.set(sessionId, { status: 'pending', promise });
    promise.then(async (account) => {
      const accounts = await configStore.readAccounts();
      accounts.push(account);
      await configStore.writeAccounts(accounts);
      oauthSessions.set(sessionId, { status: 'done', account: sanitiseAccount(account) });
    }).catch((err) => {
      oauthSessions.set(sessionId, { status: 'error', error: err.message });
    });
    res.json({ url, sessionId });
  }, 50);
});

app.get('/api/oauth/status/:sessionId', (req, res) => {
  const session = oauthSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json(session);
  if (session.status !== 'pending') oauthSessions.delete(req.params.sessionId);
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

  let accountDirs = [];
  try { accountDirs = await readdir(logsDir); } catch { return buildEmptyResult(); }

  const records = [];
  for (const accId of accountDirs) {
    const logPath = j(logsDir, accId, 'usage.jsonl');
    try {
      const text = await readFile(logPath, 'utf8');
      for (const line of text.trim().split('\n')) {
        if (!line) continue;
        try {
          const r = JSON.parse(line);
          if (r.ts >= since) records.push(r);
        } catch { /* skip malformed */ }
      }
    } catch { /* no log yet */ }
  }

  return { records, range, group };
}

function buildEmptyResult() {
  return { records: [], range: '7d', group: 'account' };
}

// ─────────────────────────────────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[admin] listening on http://127.0.0.1:${PORT}`);
});
