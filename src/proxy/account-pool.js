import { watch } from 'node:fs';
import { CircuitBreaker } from './circuit-breaker.js';
import { RateQueue } from './rate-queue.js';
import { isExpired, refreshToken } from './token-manager.js';
import { configStore } from '../shared/config.js';

export class AccountPool {
  #accounts = [];
  #circuitBreakers = new Map(); // accountId → CircuitBreaker
  #rateQueues = new Map();       // accountId → RateQueue
  #configStore;
  #watcher = null;
  #refreshTimer = null;

  /**
   * @param {{ accounts?: object[], terminals?: object[], configStore?: object }} opts
   *   Pass accounts/terminals directly for testing; omit to load from disk.
   */
  constructor(opts = {}) {
    this.#configStore = opts.configStore ?? configStore;
    if (opts.accounts) {
      this.#accounts = opts.accounts;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Select an account for the given terminal.
   * Throws an Error with message containing "503" if no account available.
   */
  selectAccount(terminal) {
    if (terminal.mode === 'manual') {
      return this.#pickManual(terminal.accountId);
    }
    // Pass current accountId so auto-mode stays sticky until the account is unavailable
    return this.#pickAuto(terminal.accountId);
  }

  getAccount(id) {
    return this.#accounts.find(a => a.id === id);
  }

  /**
   * Re-read accounts from disk and merge credentials for a single account.
   * Used to pick up tokens refreshed by the admin process.
   */
  async reloadAccount(id) {
    try {
      const fresh = await this.#configStore.readAccounts();
      const freshAcc = fresh.find(a => a.id === id);
      if (!freshAcc) return;
      const mem = this.#accounts.find(a => a.id === id);
      if (mem) Object.assign(mem.credentials, freshAcc.credentials);
    } catch { /* ignore */ }
  }

  getCircuitBreaker(accountId) {
    return this.#ensureCB(accountId);
  }

  getRateQueue(accountId) {
    return this.#ensureRQ(accountId);
  }

  /**
   * Pick the least-used account excluding the given set of account IDs.
   * Returns null if no alternative is available.
   * @param {Set<string>} excludeIds
   */
  selectFallback(excludeIds) {
    const candidates = this.#accounts
      .filter(a => !excludeIds.has(a.id) && a.status !== 'exhausted' && this.#ensureCB(a.id).canRequest())
      .sort((a, b) => {
        const uA = a.rateLimit?.window5h?.utilization ?? 0;
        const uB = b.rateLimit?.window5h?.utilization ?? 0;
        return uA !== uB ? uA - uB : a.addedAt - b.addedAt;
      });
    return candidates[0] ?? null;
  }

  /**
   * Update in-memory rate limit from Anthropic response headers.
   */
  updateRateLimit(accountId, headers) {
    const acc = this.getAccount(accountId);
    if (!acc) return;

    const h5hUtil  = parseFloat(headers['anthropic-ratelimit-unified-5h-utilization']);
    const h5hReset = parseInt(headers['anthropic-ratelimit-unified-5h-reset'], 10);
    const h5hStatus = headers['anthropic-ratelimit-unified-5h-status'];
    const h7dUtil  = parseFloat(headers['anthropic-ratelimit-unified-7d-utilization']);
    const h7dReset = parseInt(headers['anthropic-ratelimit-unified-7d-reset'], 10);
    const h7dStatus = headers['anthropic-ratelimit-unified-7d-status'];

    if (!isNaN(h5hUtil)) {
      if (!acc.rateLimit) acc.rateLimit = {};
      acc.rateLimit.window5h = {
        utilization: h5hUtil,
        resetAt: isNaN(h5hReset) ? null : h5hReset * 1000,
        status: h5hStatus ?? 'allowed',
      };
    }
    if (!isNaN(h7dUtil)) {
      if (!acc.rateLimit) acc.rateLimit = {};
      acc.rateLimit.weekly = {
        utilization: h7dUtil,
        resetAt: isNaN(h7dReset) ? null : h7dReset * 1000,
        status: h7dStatus ?? 'allowed',
      };
    }

    // Note: rate limit data is intentionally NOT persisted to disk here.
    // Admin probe (syncRateLimit) is the sole writer of rate-limit disk state,
    // preventing flip-flopping between proxy response headers and admin probes.
  }

  /**
   * Ensure accessToken is fresh; refreshes in-place if needed.
   * Returns the (possibly updated) account.
   */
  async ensureFreshToken(account) {
    if (!isExpired(account)) return account;
    const update = await refreshToken(account);
    Object.assign(account.credentials, update.credentials);
    await this.#configStore.writeAccounts(this.#accounts).catch(() => {});
    return account;
  }

  /**
   * Load accounts from disk and start fs.watch for hot-reload.
   */
  async load() {
    this.#accounts = await this.#configStore.readAccounts();
    this.#startWatch();
    this.#startProactiveRefresh();
  }

  stop() {
    this.#watcher?.close();
    clearInterval(this.#refreshTimer);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  #pickManual(accountId) {
    const acc = this.getAccount(accountId);
    if (!acc) throw new Error('503: account not found');
    const cb = this.#ensureCB(accountId);
    if (!cb.canRequest()) throw new Error('503: account circuit breaker open');
    return acc;
  }

  #pickAuto(preferredId = null) {
    const available = this.#accounts
      .filter(a => a.status !== 'exhausted' && this.#ensureCB(a.id).canRequest());
    if (available.length === 0) throw new Error('503: no available accounts');

    // Prefer the current account if it's still available — stay sticky until exhausted.
    // This prevents switching accounts immediately when a terminal enters auto mode.
    if (preferredId) {
      const preferred = available.find(a => a.id === preferredId);
      if (preferred) return preferred;
    }

    // Preferred is unavailable (exhausted / circuit-broken) — pick least loaded
    return available.sort((a, b) => {
      const uA = a.rateLimit?.window5h?.utilization ?? 0;
      const uB = b.rateLimit?.window5h?.utilization ?? 0;
      if (uA !== uB) return uA - uB;
      return a.addedAt - b.addedAt;
    })[0];
  }

  #ensureCB(accountId) {
    if (!this.#circuitBreakers.has(accountId)) {
      this.#circuitBreakers.set(accountId, new CircuitBreaker({ threshold: 3, timeout: 60000 }));
    }
    return this.#circuitBreakers.get(accountId);
  }

  #ensureRQ(accountId) {
    if (!this.#rateQueues.has(accountId)) {
      this.#rateQueues.set(accountId, new RateQueue());
    }
    return this.#rateQueues.get(accountId);
  }

  #startWatch() {
    // Merge helper: sync credentials and account list from disk without overwriting
    // in-memory rate-limit state (which is fresher from actual API response headers).
    const mergeFromDisk = async () => {
      try {
        const fresh = await this.#configStore.readAccounts();
        for (const freshAcc of fresh) {
          const mem = this.#accounts.find(a => a.id === freshAcc.id);
          if (mem) {
            // Only update credentials if they changed (admin refreshed token)
            if (freshAcc.credentials?.accessToken !== mem.credentials?.accessToken) {
              Object.assign(mem.credentials, freshAcc.credentials);
            }
          }
        }
        // Add/remove accounts that were added/deleted via admin
        const freshIds = new Set(fresh.map(a => a.id));
        const memIds = new Set(this.#accounts.map(a => a.id));
        for (const a of fresh) if (!memIds.has(a.id)) this.#accounts.push(a);
        this.#accounts = this.#accounts.filter(a => freshIds.has(a.id));
      } catch { /* ignore */ }
    };

    try {
      // fs.watch fires when admin writes accounts.json — merge credentials only,
      // never do a full replace that would overwrite fresher in-memory rate-limit state.
      this.#watcher = watch(this.#configStore.accountsPath, { persistent: false }, mergeFromDisk);
    } catch {
      // fs.watch not available in test environments
    }
    // Polling fallback for WSL2 where fs.watch is unreliable (inotify limitations).
    setInterval(mergeFromDisk, 15000).unref();
  }

  #startProactiveRefresh() {
    this.#refreshTimer = setInterval(async () => {
      for (const acc of this.#accounts) {
        try { await this.ensureFreshToken(acc); }
        catch (err) { console.error(`[pool] proactive refresh failed: ${acc.email ?? acc.id}:`, err.message); }
      }
    }, 10 * 60 * 1000);
    this.#refreshTimer.unref();
  }
}
