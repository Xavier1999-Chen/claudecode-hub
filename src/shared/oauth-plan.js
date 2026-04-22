/**
 * Normalize Anthropic / Claude OAuth subscription labels to hub account.plan values.
 * @param {unknown} raw
 * @returns {'free' | 'pro' | 'max' | null}
 */
export function normalizePlanTier(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'free' || s === 'free_tier' || s === 'none') return 'free';
  if (s === 'max' || s.includes('max')) return 'max';
  if (s === 'pro' || s.includes('pro') || s === 'team' || s.includes('business')) return 'pro';
  return null;
}

/**
 * Merge subscriptionType from platform.claude.com OAuth token JSON into credentials.
 * @param {Record<string, unknown>} credentials — mutated in place
 * @param {Record<string, unknown>} data — token endpoint JSON body
 */
export function mergeSubscriptionFromOAuthTokenResponse(credentials, data) {
  if (!data || typeof data !== 'object') return;
  const direct =
    data.subscription_type ??
    data.subscriptionType ??
    data.subscription?.type ??
    data.subscription?.tier ??
    data.account?.subscription_type ??
    data.account?.subscriptionType;
  const tier = normalizePlanTier(direct);
  if (tier) credentials.subscriptionType = tier;
}

/**
 * Best-effort: read subscription tier from a JWT-shaped OAuth access token (no verify).
 * @param {string | undefined} accessToken
 * @returns {'free' | 'pro' | 'max' | null}
 */
export function extractPlanFromAccessTokenJwt(accessToken) {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const b = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b.length % 4 ? '='.repeat(4 - (b.length % 4)) : '';
    const json = Buffer.from(b + pad, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    return deepFindSubscriptionTier(payload);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} obj
 * @param {number} depth
 * @returns {'free' | 'pro' | 'max' | null}
 */
function deepFindSubscriptionTier(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return null;
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const t = deepFindSubscriptionTier(el, depth + 1);
      if (t) return t;
    }
    return null;
  }
  for (const [k, v] of Object.entries(obj)) {
    const kl = k.toLowerCase();
    if (
      (kl === 'subscriptiontype' ||
        kl === 'subscription_type' ||
        kl === 'plantier' ||
        kl === 'plan_tier' ||
        kl === 'rate_limittier' ||
        kl === 'claude_subscription') &&
      (typeof v === 'string' || typeof v === 'number')
    ) {
      const tier = normalizePlanTier(v);
      if (tier) return tier;
    }
    if (v && typeof v === 'object') {
      const inner = deepFindSubscriptionTier(v, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

/**
 * Pick plan from GET /api/oauth/profile (or similar) JSON body.
 * @param {unknown} data
 * @returns {'free' | 'pro' | 'max' | null}
 */
export function pickPlanFromAnthropicProfileBody(data) {
  return deepFindSubscriptionTier(data);
}
