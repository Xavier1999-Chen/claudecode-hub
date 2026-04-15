import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createUsageTapper } from './usage-tracker.js';

const UPSTREAM = 'https://api.anthropic.com';

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy
               || process.env.HTTP_PROXY  || process.env.http_proxy;
const proxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

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
export async function forwardRequest(req, res, account, terminalId, pool) {
  // Build upstream headers
  const upHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) upHeaders[k] = v;
  }
  upHeaders['authorization'] = `Bearer ${account.credentials.accessToken}`;
  upHeaders['anthropic-beta'] = addOAuthBeta(upHeaders['anthropic-beta']);
  if (!upHeaders['anthropic-version']) upHeaders['anthropic-version'] = '2023-06-01';

  const url = UPSTREAM + req.url;

  let upRes;
  try {
    upRes = await fetch(url, {
      method: req.method,
      headers: upHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.rawBody : undefined,
      ...(proxyAgent && { agent: proxyAgent }),
    });
  } catch (err) {
    pool.getCircuitBreaker(account.id).recordFailure();
    res.status(502).json({ error: 'upstream_error', message: err.message });
    return;
  }

  // Handle rate limiting
  if (upRes.status === 429) {
    const retryAfter = parseInt(upRes.headers.get('retry-after') ?? '0', 10);
    pool.getCircuitBreaker(account.id).recordFailure();
    if (retryAfter > 0 && retryAfter < 60) {
      pool.getRateQueue(account.id).delay(retryAfter * 1000 + 200);
    }
    res.status(429).json({ error: 'rate_limited', retryAfter });
    return;
  }

  if (upRes.status === 529) {
    pool.getCircuitBreaker(account.id).recordFailure();
    res.status(529).json({ error: 'overloaded' });
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
    const body = await upRes.buffer();
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
    return body.model ?? 'claude-sonnet-4-6';
  } catch {
    return 'claude-sonnet-4-6';
  }
}
