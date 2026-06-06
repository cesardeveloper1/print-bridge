/** Cola serial de promesas (sustituye p-queue; compatible con pkg). */
export class SerialPrintQueue {
  private tail: Promise<void> = Promise.resolve();
  private _pending = 0;

  get pendingCount(): number {
    return this._pending;
  }

  add<T>(fn: () => Promise<T>): Promise<T> {
    this._pending++;
    const run = this.tail.then(fn);
    this.tail = run.then(
      () => { this._pending--; },
      () => { this._pending--; },
    );
    return run;
  }
}
