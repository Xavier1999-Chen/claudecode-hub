const CLOSED = 'closed';
const OPEN = 'open';
const HALF_OPEN = 'half-open';

export class CircuitBreaker {
  #state = CLOSED;
  #failures = 0;
  #openedAt = null;
  #threshold;
  #timeout;
  #onOpen;

  constructor({ threshold = 3, timeout = 60000, onOpen = null } = {}) {
    this.#threshold = threshold;
    this.#timeout = timeout;
    this.#onOpen = onOpen;
  }

  canRequest() {
    if (this.#state === CLOSED) return true;
    if (this.#state === OPEN) {
      if (Date.now() - this.#openedAt >= this.#timeout) {
        this.#state = HALF_OPEN;
        return true;
      }
      return false;
    }
    // HALF_OPEN — allow one probe
    return true;
  }

  recordSuccess() {
    this.#state = CLOSED;
    this.#failures = 0;
    this.#openedAt = null;
  }

  recordFailure() {
    this.#failures++;
    if (this.#state === HALF_OPEN || this.#failures >= this.#threshold) {
      const wasAlreadyOpen = this.#state === OPEN;
      this.#state = OPEN;
      this.#openedAt = Date.now();
      this.#failures = 0;
      if (!wasAlreadyOpen && this.#onOpen) this.#onOpen();
    }
  }

  forceClose() {
    this.#state = CLOSED;
    this.#failures = 0;
    this.#openedAt = null;
  }

  get state() { return this.#state; }
}
