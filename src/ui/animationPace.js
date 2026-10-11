// Shared presentation pace without effect, audio or DOM initialization.
export const ANIM_SPEEDS = {
  slow: { beatMs: 420, stepMs: 140, lungeMs: 340, impactCapMs: 420 },
  normal: { beatMs: 240, stepMs: 90, lungeMs: 260, impactCapMs: 240 },
  fast: { beatMs: 108, stepMs: 45, lungeMs: 160, impactCapMs: 140 },
  instant: null,
};

// Fixed combat waits and fractions, named in one place. Values that scale with
// the setting stay in ANIM_SPEEDS; these do not change with the setting.
export const COMBAT_TIMING = Object.freeze({
  instantStepMs: 80,       // stagger of animateEvents (Instant pace or reduced motion)
  turnBannerFloorMs: 260,  // shortest hold for a turn-banner beat
  windupFraction: 0.55,    // share of a lunge before impact when no authored clip sets it
  castGlyphMs: 450,        // life of a non-attack actor's cast glyph
  watchdogBaseMs: 2000,    // fixed slack added to a timeline's watchdog budget
  fightEndDelayMs: 350,    // pause between the last hit and the spoils screen
});

let animSpeed = 'normal';
export function setAnimSpeed(v) {
  animSpeed = ANIM_SPEEDS[v] === undefined ? 'normal' : v;
}
export function getAnimSpeed() {
  return animSpeed;
}
