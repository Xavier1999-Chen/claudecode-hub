export class RateQueue {
  #tail = Promise.resolve();

  /**
   * Schedule a task. Returns a Promise that resolves/rejects with the task result.
   * @param {() => Promise<any>} fn
   */
  enqueue(fn) {
    let resolve, reject;
    const outer = new Promise((res, rej) => { resolve = res; reject = rej; });
    this.#tail = this.#tail.then(() => fn()).then(resolve, reject);
    return outer;
  }

  /**
   * Insert a delay (ms) before the next enqueued task executes.
   * @param {number} ms
   */
  delay(ms) {
    this.#tail = this.#tail.then(() => new Promise(r => setTimeout(r, ms)));
  }
}
