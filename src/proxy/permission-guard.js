/**
 * Detect whether an Anthropic API response indicates the account's
 * OAuth authorization has been permanently revoked (e.g. the org's
 * plan was downgraded, the subscription was cancelled, or the org
 * was banned from OAuth-based access).
 *
 * Signal — HTTP 403 with JSON body `{error:{type:"permission_error"}}`
 * and `x-should-retry: false`. The response header is not passed here;
 * the JSON body alone is specific enough because any 403
 * permission_error we've seen on this endpoint has always been paired
 * with x-should-retry: false. Other 403s (e.g. model access denied for
 * a specific request) use `authentication_error` or similar types and
 * should NOT cause the account to be marked exhausted.
 *
 * @param {number} status — HTTP status code
 * @param {string | object | null | undefined} body — response body; string or pre-parsed object
 * @returns {boolean}
 */
export function isOAuthRevoked(status, body) {
  if (status !== 403) return false;
  if (body == null) return false;
  try {
    const json = typeof body === 'string' ? JSON.parse(body) : body;
    return json?.error?.type === 'permission_error';
  } catch {
    return false;
  }
}
