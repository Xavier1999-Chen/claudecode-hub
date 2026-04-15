import http from 'node:http';
import { randomBytes } from 'node:crypto';
import fetch from 'node-fetch';

const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const ME_URL = 'https://api.anthropic.com/v1/me';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

/**
 * Start an OAuth login flow.
 * Returns { getUrl, promise } where:
 *   - getUrl(): returns the authorization URL (callable after server is listening)
 *   - promise: resolves to a new account object when flow completes,
 *              or rejects after 5 minutes
 */
export function startOAuthFlow() {
  const state = randomBytes(16).toString('hex');
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });

  // Find a free port
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname !== '/callback') {
      res.writeHead(404); res.end(); return;
    }

    const returnedState = u.searchParams.get('state');
    const code = u.searchParams.get('code');
    const error = u.searchParams.get('error');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body><script>window.close()</script><p>授权成功，可以关闭此标签页。</p></body></html>');
    server.close();
    clearTimeout(timeout);

    if (error || returnedState !== state || !code) {
      reject(new Error(`OAuth error: ${error ?? 'state_mismatch'}`));
      return;
    }

    try {
      const account = await exchangeCode(code, `http://localhost:${port}/callback`);
      resolve(account);
    } catch (err) {
      reject(err);
    }
  });

  let port;
  server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
  });

  // Timeout after 5 minutes
  const timeout = setTimeout(() => {
    server.close();
    reject(new Error('OAuth timeout'));
  }, 5 * 60 * 1000);

  // Return a lazy URL (port is assigned by OS after listen)
  const getUrl = () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: `http://localhost:${port}/callback`,
      scope: 'user:inference',
      state,
    });
    return `${AUTHORIZE_URL}?${params}`;
  };

  return { getUrl, promise };
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed ${tokenRes.status}: ${await tokenRes.text()}`);
  }
  const tokenData = await tokenRes.json();

  // Fetch email
  const meRes = await fetch(ME_URL, {
    headers: {
      authorization: `Bearer ${tokenData.access_token}`,
      'anthropic-beta': 'oauth-2025-04-20',
    },
  });
  const meData = meRes.ok ? await meRes.json() : {};

  return {
    id: `acc_${randomBytes(6).toString('hex')}`,
    email: meData.email ?? 'unknown@example.com',
    plan: meData.claude_plan ?? 'pro',
    credentials: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt: Date.now() + (tokenData.expires_in ?? 3600) * 1000,
      scopes: ['user:inference'],
    },
    status: 'idle',
    cooldownUntil: null,
    rateLimit: {
      window5h: { used: 0, limit: 100000, resetAt: Date.now() + 18000000 },
      weeklyTokens: { used: 0, limit: 1000000, resetAt: Date.now() + 604800000 },
    },
    addedAt: Date.now(),
  };
}
