import fetch from 'node-fetch';

const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
// Refresh 5 minutes before actual expiry
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Returns true if the account's accessToken should be refreshed now.
 * @param {{ credentials: { expiresAt: number } }} account
 */
export function isExpired(account) {
  return account.credentials.expiresAt - Date.now() < REFRESH_BUFFER_MS;
}

/**
 * Exchanges the refreshToken for a new accessToken.
 * Returns a partial account update: { credentials: { ... } }.
 * @param {{ credentials: { refreshToken: string } }} account
 */
export async function refreshToken(account) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.credentials.refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    credentials: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? account.credentials.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
      scopes: account.credentials.scopes,
    },
  };
}
