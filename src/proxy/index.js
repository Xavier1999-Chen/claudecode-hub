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
}

// ── Proxy endpoint ───────────────────────────────────────────────────────

app.use(async (req, res) => {
  // 1. Validate Bearer token
  const auth = req.headers['authorization'] ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const terminal = terminals.find(t => t.id === token);
  if (!terminal) return res.status(401).json({ error: 'invalid_token' });

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

  // 4. Update terminal lastUsedAt (fire-and-forget)
  terminal.lastUsedAt = Date.now();
  configStore.writeTerminals(terminals).catch(() => {});

  // 5. Forward
  const rq = pool.getRateQueue(account.id);
  rq.enqueue(() => forwardRequest(req, res, account, terminal.id, pool)).catch(() => {
    if (!res.headersSent) res.status(500).json({ error: 'forward_failed' });
  });
});

loadConfig().then(() => {
  app.listen(PORT, () => console.log(`[proxy] listening on :${PORT}`));
}).catch(err => {
  console.error('[proxy] failed to start:', err);
  process.exit(1);
});
