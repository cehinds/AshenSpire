// src/ui/haptics.js — vibration on card play, damage taken and turn start
// (FINISH wave 13).
//
// `haptic` is the seam, shaped like ui/sfx.js but separate from it: a call
// site that MEANS one of the moments in content/haptics.js calls
// haptic.play(id). It is not fed from sfx ids, because a sound id is shared by
// moments that should not buzz (equipment swaps play the `cardPlay` sound).
// main.js assigns `haptic.sink = createHaptics(...)`; with no sink the seam is
// silent (tests, tools). The `haptics` setting is read on every cue, so
// turning it off in Settings stops the next buzz with no reload.
import { HAPTIC_PATTERNS, HAPTICS_DEFAULT_ON, HAPTIC_BATCH_GAP_MS, HAPTIC_BATCH_MAX_MS } from '../content/haptics.js';

export const haptic = {
  sink: null,
  recent: [], // last ids asked for (bounded), for verification
  play(id) {
    this.recent.push(id);
    if (this.recent.length > 32) this.recent.shift();
    if (this.sink) this.sink(id);
  },
};

/** hapticsEnabled(settings) → is the sparse `haptics` setting on? */
export function hapticsEnabled(settings = {}) {
  const value = settings?.haptics;
  return typeof value === 'boolean' ? value : HAPTICS_DEFAULT_ON;
}

/**
 * joinPatterns(patterns, { gap, max }) → one vibrate pattern playing each in
 * order, `gap` ms apart. A pattern that ends on a pause (even length) already
 * carries its own gap. Stops adding patterns once the total would pass `max`
 * (the first is always kept).
 */
export function joinPatterns(patterns, { gap = HAPTIC_BATCH_GAP_MS, max = HAPTIC_BATCH_MAX_MS } = {}) {
  const out = [];
  let total = 0;
  for (const p of patterns) {
    const sep = out.length && out.length % 2 === 1 ? [gap] : [];
    const add = [...sep, ...p];
    const ms = add.reduce((n, v) => n + v, 0);
    if (out.length && total + ms > max) break;
    out.push(...add);
    total += ms;
  }
  return out;
}

/**
 * createHaptics({ getSettings, patterns?, schedule? }) → cue(id) → true when
 * a vibration was queued. Silent (false) when the setting is off, the id has
 * no pattern, or the device has no `navigator.vibrate` (desktop browsers, iOS
 * Safari). Cues in one tick are flushed together as one joined pattern.
 */
export function createHaptics({ getSettings = () => ({}), patterns = HAPTIC_PATTERNS, schedule = queueMicrotask } = {}) {
  let queued = [];
  const flush = () => {
    const batch = queued;
    queued = [];
    const nav = globalThis.navigator;
    if (!batch.length || !nav || typeof nav.vibrate !== 'function') return;
    try { nav.vibrate(joinPatterns(batch)); } catch { /* a refused vibrate is silence */ }
  };
  return function cue(id) {
    if (!hapticsEnabled(getSettings())) return false;
    if (!Object.prototype.hasOwnProperty.call(patterns, id)) return false;
    const nav = globalThis.navigator;
    if (!nav || typeof nav.vibrate !== 'function') return false;
    if (!queued.length) schedule(flush);
    queued.push(patterns[id]);
    return true;
  };
}
