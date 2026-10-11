// workbench/ui/kit/history.mjs — undo/redo for one owner (a module, or any
// editor). One entry per user gesture. The caller applies the change first and
// then push()es how to undo and redo it, so push() never runs the change.
// DOM-free: the same class runs under node --test.

const LIMIT = 200;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class History {
  #past = [];
  #future = [];
  #groups = [];
  #busy = false;
  #listeners = new Set();
  #limit;

  constructor({ limit = LIMIT } = {}) { this.#limit = Math.max(1, Math.floor(limit)); }

  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }

  /**
   * Record a change that has already been applied. Ignored (returns false)
   * when undo/redo are not both functions, or when before and after are given
   * and equal (a no-op drag leaves no step).
   */
  push({ label = 'Change', undo, redo, before, after } = {}) {
    if (this.#busy) return false;
    if (typeof undo !== 'function' || typeof redo !== 'function') return false;
    if (before !== undefined && after !== undefined && same(before, after)) return false;
    const entry = { label: String(label), undo, redo };
    if (this.#groups.length) this.#groups[this.#groups.length - 1].push(entry);
    else this.#record(entry);
    return true;
  }

  /**
   * Record a snapshot change: { label, undo: snapshot, redo: snapshot }, as the
   * grid model returns. apply(snapshot) puts the document back to that state.
   * Equal snapshots are a no-op and leave no step.
   */
  pushChange(change, apply) {
    if (!change || typeof apply !== 'function' || change.undo === undefined || change.redo === undefined) return false;
    return this.push({
      label: change.label,
      before: change.undo,
      after: change.redo,
      undo: () => apply(change.undo),
      redo: () => apply(change.redo),
    });
  }

  /** Run fn; every push made inside it becomes one step (undone and redone together). */
  group(label, fn) {
    this.#groups.push([]);
    let result;
    try { result = fn(); } finally {
      const items = this.#groups.pop();
      if (items.length) {
        const entry = {
          label: String(label),
          undo: () => { for (let i = items.length - 1; i >= 0; i -= 1) items[i].undo(); },
          redo: () => { for (const item of items) item.redo(); },
        };
        if (this.#groups.length) this.#groups[this.#groups.length - 1].push(entry);
        else this.#record(entry);
      }
    }
    return result;
  }

  undo() {
    const entry = this.#past.pop();
    if (!entry) return null;
    this.#run(() => entry.undo(), () => this.#past.push(entry));
    this.#future.push(entry);
    this.#notify();
    return entry;
  }

  redo() {
    const entry = this.#future.pop();
    if (!entry) return null;
    this.#run(() => entry.redo(), () => this.#future.push(entry));
    this.#past.push(entry);
    this.#notify();
    return entry;
  }

  // The stacks are moved before the callback runs, and push() is ignored while
  // it runs, so a callback that records a change cannot corrupt them.
  #run(fn, restore) {
    this.#busy = true;
    try { fn(); } catch (err) { restore(); throw err; } finally { this.#busy = false; }
  }

  /** Timeline, oldest first: applied steps (done true), then undone steps in redo order (done false). */
  list() {
    return [
      ...this.#past.map((e) => ({ label: e.label, done: true })),
      ...this.#future.slice().reverse().map((e) => ({ label: e.label, done: false })),
    ];
  }

  clear() { this.#past = []; this.#future = []; this.#notify(); }

  /** fn(history) is called after each recorded step, undo, redo or clear. Returns an unsubscribe. */
  onChange(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #record(entry) {
    this.#past.push(entry);
    this.#future = [];
    if (this.#past.length > this.#limit) this.#past.shift();
    this.#notify();
  }

  #notify() { for (const fn of [...this.#listeners]) fn(this); }
}
