import express from 'express';
import { watch } from 'node:fs';
import { AccountPool } from './account-pool.js';
import { forwardRequest } from './forwarder.js';
import { configStore } from '../shared/config.js';

const PORT = process.env.PROXY_PORT ?? 3180;
const app = express();

// Capture raw body for forwarding without re-serialising
app.use((req, _res, next) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    req.rawBody = chunks.length ? Buffer.concat(chunks) : undefined;
    next();
  });
});

const pool = new AccountPool();
let terminals = [];

async function loadConfig() {
  await pool.load();
  terminals = await configStore.readTerminals();
  // Hot-reload terminals on file change (after initial load)
  try {
    watch(configStore.terminalsPath, { persistent: false }, async () => {
      terminals = await configStore.readTerminals().catch(() => terminals);
    });
  } catch { /* terminals.json not yet created */ }
  // Polling fallback for WSL2 where fs.watch is unreliable
  setInterval(async () => {
    terminals = await configStore.readTerminals().catch(() => terminals);
  }, 5000).unref();
}

// ── Internal API (called by admin, not by Claude Code clients) ───────────
app.post('/_internal/sync-terminals', async (_req, res) => {
  try {
    await configStore.writeTerminals(terminals);
    res.json({ ok: true, count: terminals.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Proxy endpoint ───────────────────────────────────────────────────────

app.use(async (req, res) => {
  // 1. Validate Bearer token (supports both Authorization: Bearer and x-api-key)
  const auth = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7)
    : (req.headers['x-api-key'] ?? null);
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const terminal = terminals.find(t => t.id === token);
  if (!terminal) {
    console.log(`[proxy] invalid_token: ${token?.slice(0, 20)}… (${terminals.length} terminals loaded)`);
    return res.status(401).json({ error: 'invalid_token' });
  }

  // 2. Select account
  let account;
  try {
    account = pool.selectAccount(terminal);
  } catch (err) {
    const status = err.message.startsWith('503') ? 503 : 500;
    return res.status(status).json({ error: 'no_account_available' });
  }

  // 3. Ensure fresh token
  try {
    account = await pool.ensureFreshToken(account);
  } catch (err) {
    return res.status(502).json({ error: 'token_refresh_failed', message: err.message });
  }

  console.log(`[proxy] ${req.method} ${req.url} terminal=${terminal.name} account=${account.email ?? account.id} token=${account.credentials?.accessToken?.slice(0, 20)}…`);

  // 4. Update terminal lastUsedAt + accountId (fire-and-forget)
  // Re-find from current terminals array: 5s polling may have replaced the reference
  const liveT = terminals.find(t => t.id === terminal.id) ?? terminal;
  liveT.lastUsedAt = Date.now();
  // For auto-mode: keep accountId in sync with the actually selected account
  if (liveT.mode === 'auto' && liveT.accountId !== account.id) {
    liveT.accountId = account.id;
  }
  configStore.writeTerminals(terminals).catch(() => {});

  // 5. Forward — onFallback updates terminal accountId when proxy switches accounts
  function onFallback(newAccount) {
    // Must re-find: 5s polling may have replaced the terminals array since request started
    const t = terminals.find(t => t.id === terminal.id);
    if (t) {
      t.accountId = newAccount.id;
      configStore.writeTerminals(terminals).catch(() => {});
    }
    console.log(`[proxy] terminal ${terminal.name} reassigned to ${newAccount.email ?? newAccount.id}`);
  }

  const rq = pool.getRateQueue(account.id);
  rq.enqueue(() => forwardRequest(req, res, account, terminal.id, pool, new Set(), onFallback)).catch(() => {
    if (!res.headersSent) res.status(500).json({ error: 'forward_failed' });
  });
});

loadConfig().then(async () => {
  // Write in-memory state to disk on startup so admin always has current data
  await configStore.writeTerminals(terminals).catch(() => {});
  app.listen(PORT, () => console.log(`[proxy] listening on :${PORT}`));
}).catch(err => {
  console.error('[proxy] failed to start:', err);
  process.exit(1);
});
