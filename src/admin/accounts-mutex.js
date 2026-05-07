/**
 * Serialises read-modify-write operations on accounts.json across
 * admin's concurrent async writers (HTTP handlers + timers + proxy event
 * endpoints). Without this, two handlers can both readAccounts() against
 * the same on-disk snapshot, then both writeAccounts() — losing one of
 * the updates. Issue #62 documents the OAuth refresh_token loss case.
 *
 * Style mirrors src/proxy/rate-queue.js: a single Promise chain that
 * absorbs failures so the queue keeps running, while still propagating
 * errors back to the original caller.
 */
export class AccountsMutex {
  #chain = Promise.resolve();

  /**
   * Run fn() while holding the mutex. Other callers wait until fn() resolves
   * (or rejects). Returns whatever fn() resolves to; rejects with whatever
   * fn() throws.
   * @template T
   * @param {() => Promise<T> | T} fn
   * @returns {Promise<T>}
   */
  runExclusive(fn) {
    const next = this.#chain.then(fn);
    this.#chain = next.catch(() => {});
    return next;
  }
}

/** Single mutex instance shared across all admin write paths. */
export const accountsMutex = new AccountsMutex();
