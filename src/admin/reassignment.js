/**
 * Server-side mirror of the proxy's cooling detection + terminal
 * reassignment helpers. Used by admin sync-usage endpoints and
 * probeAllRelays to proactively move terminals off unusable accounts
 * (cooling OR exhausted), without waiting for the next request to
 * trigger a 429 + fallback on the proxy side.
 *
 * Per user requirement: 终端逃逸应忽略 mode —— manual pin 在不能转发
 * 的账号上没意义，让 admin 主动迁走比让请求失败更友好。callers 应
 * 传 modes=null（全部迁），保留 ['auto'] 仅供历史路径使用。
 */

export function isWindowCooling(w) {
  if (!w) return false;
  if (w.status === 'blocked') return true;
  const atCap = typeof w.utilization === 'number' && w.utilization >= 1.0;
  const withinResetWindow = w.resetAt != null && w.resetAt > Date.now();
  return atCap && withinResetWindow;
}

export function isAccountCooling(acc) {
  return isWindowCooling(acc?.rateLimit?.window5h)
    || isWindowCooling(acc?.rateLimit?.weekly);
}

/**
 * Move terminals off a cooling account onto the warmest alternative.
 *
 * @param {string} coolingAccountId — the account that entered cooldown
 * @param {object[]} accounts — full account list (incl. the cooling one)
 * @param {string[] | null} modes — ['auto'] to touch only auto-mode terminals, null for all
 * @param {{ readTerminals: () => Promise<object[]>, writeTerminals: (t: object[]) => Promise<void> }} configStore_
 *
 * No-op when:
 *   - no terminals match the account + modes filter
 *   - no warm (non-cooling, non-exhausted) alternative exists
 *     — keeping terminals where they are is better than piling them onto
 *     the same "least bad" cooling account; the proxy's fallback tier
 *     handles routing until something frees up.
 */
export async function reassignCoolingTerminals(coolingAccountId, accounts, modes, configStore_) {
  const terminals = await configStore_.readTerminals();
  const affected = terminals.filter(t =>
    t.accountId === coolingAccountId
    && (modes === null || modes.includes(t.mode))
  );
  if (!affected.length) return;

  const others = accounts.filter(a =>
    a.id !== coolingAccountId && a.status !== 'exhausted'
  );
  const warm = others.filter(a => !isAccountCooling(a));
  if (!warm.length) return;

  const best = warm.slice().sort((a, b) => {
    const uA = a.rateLimit?.window5h?.utilization ?? 0;
    const uB = b.rateLimit?.window5h?.utilization ?? 0;
    return uA - uB;
  })[0];

  for (const t of affected) t.accountId = best.id;
  await configStore_.writeTerminals(terminals);
}
