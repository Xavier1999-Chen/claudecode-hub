/**
 * Detect whether an Anthropic API response indicates the account's
 * OAuth authorization has been permanently revoked (e.g. the org's
 * plan was downgraded, the subscription was cancelled, or the org
 * was banned from OAuth-based access).
 *
 * Signals:
 * - HTTP 403 with JSON body `{error:{type:"permission_error"}}`
 * - HTTP 400 with `invalid_request_error` and permanent-ban message
 * - `x-should-retry: false` response header (catch-all)
 *
 * @param {number} status — HTTP status code
 * @param {string | object | null | undefined} body — response body; string or pre-parsed object
 * @param {object} [headers] — response headers (optional, for x-should-retry check)
 * @returns {boolean}
 */
export function isOAuthRevoked(status, body, headers) {
  if (body == null) return false;

  // 403 + permission_error (primary signal for OAuth revocation)
  if (status === 403) {
    try {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      if (json?.error?.type === 'permission_error') return true;
    } catch { return false; }
  }

  // 400 + invalid_request_error with permanent-ban message
  // (e.g. "This organization has been disabled.")
  if (status === 400) {
    try {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      if (json?.error?.type === 'invalid_request_error') {
        const msg = (json.error.message ?? '').toLowerCase();
        if (/disabled|banned|revoked|suspended/.test(msg)) return true;
      }
    } catch { /* not JSON */ }
  }

  // x-should-retry: false is Anthropic's generic signal for non-retriable errors
  if (headers != null && headers['x-should-retry'] === 'false') return true;

  return false;
}
