// Shared presentation pace without effect, audio or DOM initialization.
// reactionMs: under the 'sequential' beat order, how long the defender's
// reaction (hurt pose, flash, evade, block, stagger wobble) shows before its
// numbers and bars update. stanceLeadMs: the wait after an attacker that is
// out of its stance is returned to it, before its swing starts.
export const ANIM_SPEEDS = {
  slow: { beatMs: 420, stepMs: 105, lungeMs: 255, impactCapMs: 317, reactionMs: 315, stanceLeadMs: 175 },
  normal: { beatMs: 240, stepMs: 68, lungeMs: 195, impactCapMs: 186, reactionMs: 180, stanceLeadMs: 100 },
  fast: { beatMs: 108, stepMs: 34, lungeMs: 121, impactCapMs: 108, reactionMs: 81, stanceLeadMs: 45 },
  instant: null,
};

// Fixed combat waits and fractions, named in one place. Values that scale with
// the setting stay in ANIM_SPEEDS; these do not change with the setting.
export const COMBAT_TIMING = Object.freeze({
  instantStepMs: 80,       // stagger of animateEvents (Instant pace or reduced motion)
  turnBannerFloorMs: 156,  // shortest hold for a turn-banner beat
  windupFraction: 0.55,    // share of a lunge before impact when no authored clip sets it
  castGlyphMs: 450,        // life of a non-attack actor's cast glyph
  watchdogBaseMs: 2000,    // fixed slack added to a timeline's watchdog budget
  fightEndDelayMs: 210,    // pause between the last hit and the spoils screen
});

// The wait a timeline holds after a turn-banner beat. The banner's own display
// time is set from this same value (ui/fx.js), so it is gone when the next beat starts.
export function turnBannerHoldMs(speed) {
  return Math.max(COMBAT_TIMING.turnBannerFloorMs, speed.beatMs);
}

let animSpeed = 'normal';
export function setAnimSpeed(v) {
  animSpeed = ANIM_SPEEDS[v] === undefined ? 'normal' : v;
}
export function getAnimSpeed() {
  return animSpeed;
}

// The order an attack beat plays in (owner, 2026-10-11).
//   'sequential' (default): attacker in stance → attack → back to stance →
//     the defender's reaction → its numbers → the bars.
//   'impact': the reaction and numbers fire at the swing's impact frame and
//     the bars update after the swing settles (the order before 2026-10-11).
// Counter beats and non-attack beats always play in 'impact' order.
export const BEAT_ORDERS = Object.freeze(['sequential', 'impact']);
let beatOrder = 'sequential';
export function setBeatOrder(v) {
  beatOrder = BEAT_ORDERS.includes(v) ? v : 'sequential';
}
export function getBeatOrder() {
  return beatOrder;
}
