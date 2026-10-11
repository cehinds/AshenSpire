// Shared presentation pace without effect, audio or DOM initialization.
export const ANIM_SPEEDS = {
  slow: { beatMs: 420, stepMs: 105, lungeMs: 255, impactCapMs: 317 },
  normal: { beatMs: 240, stepMs: 68, lungeMs: 195, impactCapMs: 186 },
  fast: { beatMs: 108, stepMs: 34, lungeMs: 121, impactCapMs: 106 },
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

let animSpeed = 'normal';
export function setAnimSpeed(v) {
  animSpeed = ANIM_SPEEDS[v] === undefined ? 'normal' : v;
}
export function getAnimSpeed() {
  return animSpeed;
}
