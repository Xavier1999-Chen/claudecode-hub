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
    return this.#pickAuto();
  }

  getAccount(id) {
    return this.#accounts.find(a => a.id === id);
  }

  getCircuitBreaker(accountId) {
    return this.#ensureCB(accountId);
  }

  getRateQueue(accountId) {
    return this.#ensureRQ(accountId);
  }

  /**
   * Update in-memory rate limit from Anthropic response headers.
   */
  updateRateLimit(accountId, headers) {
    const acc = this.getAccount(accountId);
    if (!acc) return;
    const limit = parseInt(headers['x-ratelimit-tokens-limit'], 10);
    const remaining = parseInt(headers['x-ratelimit-tokens-remaining'], 10);
    const reset = headers['x-ratelimit-tokens-reset'];
    if (!isNaN(limit) && !isNaN(remaining)) {
      acc.rateLimit.window5h.limit = limit;
      acc.rateLimit.window5h.used = limit - remaining;
    }
    if (reset) {
      acc.rateLimit.window5h.resetAt = new Date(reset).getTime();
    }
    // Persist asynchronously (fire-and-forget, failures are non-fatal)
    this.#configStore.writeAccounts(this.#accounts).catch(() => {});
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
  }

  stop() {
    this.#watcher?.close();
  }

  // ── Private ─────────────────────────────────────────────────────────────

  #pickManual(accountId) {
    const acc = this.getAccount(accountId);
    if (!acc) throw new Error('503: account not found');
    const cb = this.#ensureCB(accountId);
    if (!cb.canRequest()) throw new Error('503: account circuit breaker open');
    return acc;
  }

  #pickAuto() {
    const candidates = this.#accounts
      .filter(a => a.status !== 'exhausted' && this.#ensureCB(a.id).canRequest())
      .sort((a, b) => {
        const remA = (a.rateLimit?.window5h?.limit ?? 100000) - (a.rateLimit?.window5h?.used ?? 0);
        const remB = (b.rateLimit?.window5h?.limit ?? 100000) - (b.rateLimit?.window5h?.used ?? 0);
        if (remA !== remB) return remB - remA;
        return a.addedAt - b.addedAt;
      });
    if (candidates.length === 0) throw new Error('503: no available accounts');
    return candidates[0];
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
    try {
      this.#watcher = watch(this.#configStore.accountsPath, { persistent: false }, async () => {
        this.#accounts = await this.#configStore.readAccounts().catch(() => this.#accounts);
      });
    } catch {
      // fs.watch not available in test environments
    }
  }
}
