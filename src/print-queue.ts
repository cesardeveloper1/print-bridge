/** Cola serial de promesas (sustituye p-queue; compatible con pkg). */
export class SerialPrintQueue {
  private tail: Promise<void> = Promise.resolve();

  add<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
