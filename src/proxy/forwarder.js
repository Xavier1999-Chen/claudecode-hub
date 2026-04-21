import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createUsageTapper } from './usage-tracker.js';
import { isOAuthRevoked } from './permission-guard.js';

const UPSTREAM = 'https://api.anthropic.com';
const UPSTREAM_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 2_000;

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
               || process.env.HTTP_PROXY  || process.env.http_proxy;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

// True for transient TCP-level errors worth retrying once (e.g. Clash briefly offline).
// HTTP 4xx/5xx are not thrown by fetch() — they're handled via upRes.status below.
function isRetriableConnectionError(err) {
  const code = err.code ?? err.cause?.code;
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH'].includes(code);
}

// fetch with a 60s hard timeout + one automatic retry on transient connection errors.
async function fetchWithRetry(url, options) {
  async function attempt() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    return await attempt();
  } catch (err) {
    if (isRetriableConnectionError(err)) {
      console.warn(`[fwd] connection error (${err.code ?? err.cause?.code}), retrying in ${RETRY_DELAY_MS}ms…`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return attempt(); // second failure propagates to caller
    }
    throw err;
  }
}

// Headers that must not be forwarded between hops
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
  'host', 'authorization', 'x-api-key', 'content-length',
]);

/**
 * Forward req → Anthropic using account's OAuth token.
 * Pipes SSE or JSON response back to res.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{ credentials: { accessToken: string }, id: string }} account
 * @param {string} terminalId
 * @param {import('./account-pool.js').AccountPool} pool
 */
export async function forwardRequest(req, res, account, terminalId, pool, triedIds = new Set(), onFallback = null) {
  // Build upstream headers
  const upHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) upHeaders[k] = v;
  }
  upHeaders['authorization'] = `Bearer ${account.credentials.accessToken}`;
  upHeaders['anthropic-beta'] = addOAuthBeta(upHeaders['anthropic-beta']);
  // Pro accounts don't support 1M context window; strip the flag so Opus works with 200K.
  // Max accounts keep it as-is.
  if (account.plan !== 'max') {
    upHeaders['anthropic-beta'] = upHeaders['anthropic-beta']
      .split(',').filter(b => b.trim() !== 'context-1m-2025-08-07').join(',');
  }
  if (!upHeaders['anthropic-version']) upHeaders['anthropic-version'] = '2023-06-01';

  const url = UPSTREAM + req.url;

  const fetchOpts = {
    method: req.method,
    headers: upHeaders,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.rawBody : undefined,
    compress: false,
    ...(proxyAgent && { agent: proxyAgent }),
  };

  let upRes;
  try {
    upRes = await fetchWithRetry(url, fetchOpts);
  } catch (err) {
    // Don't blame the account for infrastructure failures — no recordFailure().
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'upstream_timeout', message: 'upstream request timed out after 60s' });
    } else {
      res.status(502).json({ error: 'upstream_error', message: err.message });
    }
    return;
  }

  console.log(`[fwd] ${upRes.status} ${upRes.headers.get('content-type')} beta=${upHeaders['anthropic-beta']}`);

  // Handle token expiry: reload from disk first (admin may have refreshed),
  // then fall back to calling the refresh endpoint. Retry once.
  if (upRes.status === 401) {
    console.log(`[fwd] 401 for account ${account.id}, reloading credentials from disk`);
    try {
      await pool.reloadAccount(account.id);
      const reloaded = pool.getAccount(account.id);
      if (reloaded && reloaded.credentials.accessToken !== account.credentials.accessToken) {
        // Disk had a newer token (admin refreshed) — use it directly
        account = reloaded;
      } else {
        // Disk token is same as memory — do a fresh OAuth refresh
        account.credentials.expiresAt = 0;
        account = await pool.ensureFreshToken(account);
      }
      upHeaders['authorization'] = `Bearer ${account.credentials.accessToken}`;
      upRes = await fetchWithRetry(url, fetchOpts);
      console.log(`[fwd] retry after credential reload: ${upRes.status}`);
    } catch (err) {
      console.error(`[fwd] credential reload failed: ${err.message}`);
      res.status(401).json({ error: 'authentication_error', message: err.message });
      return;
    }
  }

  // Permanent authorization failure: OAuth has been revoked at Anthropic (org
  // banned, plan downgraded). x-should-retry: false — don't retry this account.
  // Mark it exhausted so future selections skip it, then fall back silently.
  if (upRes.status === 403) {
    const bodyText = await upRes.text();
    if (isOAuthRevoked(upRes.status, bodyText)) {
      console.warn(`[fwd] 403 permission_error on ${account.email ?? account.id}, marking exhausted and falling back`);
      pool.markUnauthorized(account.id).catch(() => {});
      triedIds.add(account.id);
      const fallback = pool.selectFallback(triedIds);
      if (fallback) {
        onFallback?.(fallback);
        return forwardRequest(req, res, fallback, terminalId, pool, triedIds, onFallback);
      }
      res.status(503).json({ error: 'no_available_accounts', message: 'account unauthorized and no fallback available' });
      return;
    }
    // Non-revocation 403 (e.g. model access denied for a specific request) —
    // forward the already-consumed body through to the client as-is.
    for (const [k, v] of upRes.headers.entries()) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) res.setHeader(k, v);
    }
    res.status(403).end(bodyText);
    return;
  }

  // Handle rate limiting — 429/529 are quota/load signals, not account failures.
  // Try to fall back to another account automatically before giving up.
  if (upRes.status === 429 || upRes.status === 529) {
    const retryAfter = parseInt(upRes.headers.get('retry-after') ?? '0', 10);
    if (retryAfter > 0 && retryAfter < 60) {
      pool.getRateQueue(account.id).delay(retryAfter * 1000 + 200);
    }
    triedIds.add(account.id);
    let fallback = pool.selectFallback(triedIds);
    if (fallback) {
      console.log(`[fwd] ${upRes.status} on ${account.email ?? account.id}, falling back to ${fallback.email ?? fallback.id}`);
      try { fallback = await pool.ensureFreshToken(fallback); } catch { /* use as-is */ }
      onFallback?.(fallback);
      return forwardRequest(req, res, fallback, terminalId, pool, triedIds, onFallback);
    }
    const status = upRes.status === 529 ? 529 : 429;
    res.status(status).json({ error: status === 429 ? 'rate_limited' : 'overloaded', retryAfter });
    return;
  }

  if (upRes.ok) {
    pool.getCircuitBreaker(account.id).recordSuccess();
    // Update rate limit headers
    const headers = Object.fromEntries(upRes.headers.entries());
    pool.updateRateLimit(account.id, headers);
  }

  // Forward response headers
  for (const [k, v] of upRes.headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) {
      res.setHeader(k, v);
    }
  }
  res.status(upRes.status);

  // Detect SSE
  const ct = upRes.headers.get('content-type') ?? '';
  if (ct.includes('text/event-stream')) {
    const model = detectModel(req);
    const tapper = createUsageTapper({ accountId: account.id, terminalId, model });
    upRes.body.pipe(tapper).pipe(res);
    upRes.body.on('error', () => res.end());
  } else {
    const body = Buffer.from(await upRes.arrayBuffer());
    // Try to capture usage from JSON response
    try {
      const json = JSON.parse(body.toString());
      if (json.usage) {
        const model = detectModel(req);
        const { input_tokens: inTok = 0, output_tokens: outTok = 0 } = json.usage;
        // Write via tapper helper directly
        const tapper = createUsageTapper({ accountId: account.id, terminalId, model });
        const fakeEvent = JSON.stringify({
          type: 'message_delta',
          usage: { input_tokens: inTok, output_tokens: outTok },
        });
        tapper.end(`data: ${fakeEvent}\n\n`);
        tapper.resume(); // drain
      }
    } catch { /* not JSON */ }
    res.end(body);
  }
}

function addOAuthBeta(existing) {
  const beta = 'oauth-2025-04-20';
  if (!existing) return beta;
  if (existing.includes(beta)) return existing;
  return `${existing},${beta}`;
}

function detectModel(req) {
  try {
    const body = JSON.parse(req.rawBody?.toString() ?? '{}');
    return body.model ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
