// One floater stack per combatant (owner, 2026-11-05). Every floater over a combatant (damage, heal, Block,
// status words, callouts) goes through the same sequencer:
//   1. SEQUENCED  floaters spawn one at a time; the next starts `staggerMs` after the previous one spawned.
//                 A floater queued meanwhile waits its turn. Two never spawn on one frame.
//   2. A COLUMN   every floater spawns at the same anchor; when a new one spawns the earlier visible ones are
//                 already above it, so the list scrolls upward. `slot` is how many visible floaters are newer.
//   3. A CAP      at most `maxVisible` show at once: the oldest fades early, and no queued floater is dropped.
// This module is the pure model (no DOM, no globals): the clock and the timers are injected, so a test drives
// it with a fake clock. ui/fx.js owns the DOM, the lift in px, the reduced-motion path and the lifetimes.
import { uiConfig } from '../config/generated/ui.js';

export const FLOATER_STACK = Object.freeze({ ...uiConfig.presentation.floaterStack.sizing, ...uiConfig.presentation.floaterStack.motion });

/**
 * @param {object} o
 * @param {() => number} o.now             the clock, in ms
 * @param {(fn: Function, ms: number) => any} o.setTimer
 * @param {(handle: any) => void} o.clearTimer
 * @param {() => number} o.staggerMs       ms between two spawns (read on every spawn: it follows the combat speed)
 * @param {(item: object) => number} o.maxVisible  how many may show at once (read on every spawn, for the item about to show)
 * @param {(item: object, entry: object) => any} o.show   spawn one floater; the return value is kept on the entry
 * @param {(item: object) => boolean} [o.alive]            false when the combatant is gone: every waiting floater is dropped
 * @param {(entry: object) => void} [o.fadeEarly]         the cap is exceeded: start this entry's early exit
 * @param {(entries: object[]) => void} [o.layout]        a floater spawned: re-lift the visible ones by `entry.slot`
 * @param {number} [o.maxQueued]      more than this many waiting shrinks the stagger to `staggerMinMs` so the backlog drains
 * @param {() => number} [o.staggerMinMs]  the shrunk stagger (read on every spawn)
 *
 * A pushed item with `immediate: true` (a damage number) never waits: it spawns at once at the bottom of the
 * column, takes the next slot, and restarts the stagger clock for whatever is still waiting.
 */
export function createFloaterStack({ now, setTimer, clearTimer, staggerMs, maxVisible, show, fadeEarly = () => {}, layout = () => {}, alive = () => true, maxQueued = Infinity, staggerMinMs = () => 1 }) {
  let seq = 0;
  let visible = [];
  let pending = [];
  let lastSpawn = -Infinity;
  let timer = null;

  const baseGap = () => Math.max(1, Number(staggerMs()) || 1);
  const gap = () => (pending.length > maxQueued ? Math.min(baseGap(), Math.max(1, Number(staggerMinMs()) || 1)) : baseGap());
  // Words carry a `rank`; among the waiting words the higher rank goes first (ties keep arrival order). Items
  // without a rank (numbers) never move, and the ranked items only trade places with each other.
  function order() {
    const at = [];
    pending.forEach((item, i) => { if (item.rank != null) at.push(i); });
    const sorted = at.map((i) => pending[i]).sort((a, b) => b.rank - a.rank || a.arrival - b.arrival);
    at.forEach((i, k) => { pending[i] = sorted[k]; });
  }
  function relayout() {
    visible.forEach((entry, i) => { entry.slot = visible.length - 1 - i; });
    layout(visible);
  }
  function spawn(item = pending.shift()) {
    const t = now();
    lastSpawn = t;
    const limit = Math.max(1, Math.floor(maxVisible(item)) || 1);
    // Make room: the oldest leaves early (it is already the highest in the column). The new one is the extra.
    const evicted = [];
    while (visible.length >= limit) { const old = visible.shift(); old.leaving = true; evicted.push(old); fadeEarly(old); }
    const entry = { item, spawnedAt: t, expiresAt: t + Math.max(0, Number(item.lifeMs) || 0), slot: 0, leaving: false, handle: null };
    visible.push(entry);
    relayout();
    // An evicted floater is still on screen for its fade: it stays the highest in the column, lifted with the rest.
    if (evicted.length) {
      evicted.forEach((old, i) => { old.slot = visible.length + evicted.length - 1 - i; });
      layout(evicted);
    }
    entry.handle = show(item, entry);
    if (entry.expiresAt > t) {
      entry.timer = setTimer(() => {
        const at = visible.indexOf(entry);
        if (at >= 0) { visible.splice(at, 1); relayout(); }
      }, entry.expiresAt - t);
    }
    return entry;
  }
  // Called with no argument by a timer (the wait is over: spawn, so a mocked or stalled clock cannot starve the
  // queue), and with `false` by push, which waits out the stagger first when the last spawn is too recent.
  function pump(fromTimer = true) {
    timer = null;
    if (!pending.length) return null;
    // A floater that waited may find its combatant gone; one pushed this instant spawns whatever the host says.
    if (fromTimer) { pending = pending.filter((item) => alive(item)); if (!pending.length) return null; }
    if (!fromTimer) {
      const wait = lastSpawn + gap() - now();
      if (wait > 0) { timer = setTimer(pump, wait); return null; }
    }
    const entry = spawn();
    if (pending.length) timer = setTimer(pump, gap());
    return entry;
  }
  return {
    get visible() { return visible.slice(); },
    get waiting() { return pending.slice(); },
    /** Queue a floater. Returns its entry when it spawned at once, else null (it waits its turn). */
    push(item) {
      if (item.immediate) {
        const entry = spawn({ arrival: seq++, ...item });
        // The stagger restarts from this spawn for the floaters still waiting.
        if (timer !== null) { clearTimer(timer); timer = null; }
        if (pending.length) timer = setTimer(pump, gap());
        return entry;
      }
      pending.push({ arrival: seq++, ...item });
      order();
      if (timer !== null) {
        // The backlog just passed the cap: the wait already armed shortens to the shrunk stagger.
        if (pending.length === maxQueued + 1) { clearTimer(timer); timer = setTimer(pump, Math.max(0, lastSpawn + gap() - now())); }
        return null;
      }
      return pump(false);
    },
    /** True when a waiting or visible floater matches. */
    has(pred) { return pending.some(pred) || visible.some((entry) => pred(entry.item)); },
    /** Drop the matching waiting floaters, and the visible ones too with { visible: true } (they stop counting toward the cap). */
    drop(pred, { visible: inView = false } = {}) {
      pending = pending.filter((item) => !pred(item));
      if (inView) {
        for (const entry of visible) if (pred(entry.item) && entry.timer != null) clearTimer(entry.timer);
        visible = visible.filter((entry) => !pred(entry.item));
        relayout();
      }
    },
    /** Drop the waiting floaters; the visible ones keep their lifetime (a click-skip). */
    dropWaiting() { pending = []; if (timer !== null) { clearTimer(timer); timer = null; } },
    /** Drop everything (the combatant went away). */
    clear() {
      pending = [];
      if (timer !== null) { clearTimer(timer); timer = null; }
      for (const entry of visible) if (entry.timer != null) clearTimer(entry.timer);
      visible = [];
    },
  };
}
/** Column position of a floater: y grows downward, so a higher slot is a smaller y. `step` is line height + gap. */
export function columnTop(baseTop, slot, step) {
  return baseTop - slot * step;
}
