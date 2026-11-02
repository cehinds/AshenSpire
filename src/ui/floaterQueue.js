// Non-damage floater queue (owner, 2026-11-02): status applied, Block gained, Heal, guarded and
// similar floaters over one combatant wait in a FIFO list and show at most MAX_VISIBLE at a time.
// A finished floater frees its lane and the next waiting one takes it. Damage numbers are not
// queued: they keep spawning at once (ui/fx.js floatNum). This module is the pure model; fx.js
// owns the DOM and the lane lift (the vertical offset between visible floaters).
export const FLOATER_QUEUE_MAX = 3;

// A damage number: HP loss, proc burst, crit, big-hit tiers, "Defeated" (dmg heavy).
const DAMAGE_CLASS = /(^|\s)(dmg|burst|crit|pct\d+|heavy)(\s|$)/;
export function isDamageFloater(cls = '') {
  return DAMAGE_CLASS.test(String(cls));
}

export function createFloaterQueue(max = FLOATER_QUEUE_MAX) {
  const visible = [];
  const waiting = [];
  const queue = {
    // Writable: the screen lowers it to the lanes that fit above a combatant's HUD.
    max,
    get visible() { return visible.slice(); },
    get waiting() { return waiting.slice(); },
    /** Add an item. Returns it when it may show now, or null when it waits behind a full set. */
    push(item) {
      if (visible.length < queue.max) { visible.push(item); return item; }
      waiting.push(item);
      return null;
    },
    /** An item finished. Returns the next waiting item, now visible, or null. */
    release(item) {
      const at = visible.indexOf(item);
      if (at < 0) return null;
      visible.splice(at, 1);
      if (!waiting.length || visible.length >= queue.max) return null;
      const next = waiting.shift();
      visible.push(next);
      return next;
    },
    /** Drop the waiting items; visible ones keep their lifetime (a click-skip). */
    dropWaiting() { waiting.length = 0; },
    /** Drop everything (the anchor went away). */
    clear() { visible.length = 0; waiting.length = 0; },
  };
  return queue;
}
