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
    if (typeof undo !== 'function' || typeof redo !== 'function') return false;
    if (before !== undefined && after !== undefined && same(before, after)) return false;
    const entry = { label: String(label), undo, redo };
    if (this.#groups.length) this.#groups[this.#groups.length - 1].push(entry);
    else this.#record(entry);
    return true;
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
    const entry = this.#past[this.#past.length - 1];
    if (!entry) return null;
    entry.undo();
    this.#past.pop(); this.#future.push(entry);
    this.#notify();
    return entry;
  }

  redo() {
    const entry = this.#future[this.#future.length - 1];
    if (!entry) return null;
    entry.redo();
    this.#future.pop(); this.#past.push(entry);
    this.#notify();
    return entry;
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
