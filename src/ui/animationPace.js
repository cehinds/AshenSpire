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
  // Damage / heal / guard numbers (ui/fx.js floatNum). Total life at combat speed 1: two thirds held
  // (1100 ms, long enough to read on a phone) then the last third fades. Scales with the Combat speed
  // multiplier only, NOT with the Fast/Slow animation pace, so a phone's Auto-Fast pace does not
  // shrink the number below readability (owner, 2026-10-31).
  floaterLifeMs: 1650,
  floaterMinLifeMs: 400,   // the floor at the highest speed multiplier
  floaterInstantMs: 480,   // the Instant pace keeps the classic short number
  floaterFadeFraction: 1 / 3,
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

// One presentation-only multiplier for the entire ordered action. The classic
// pace remains a compatibility choice, with ×1 preserving its relative scale.
import { ACTION_PACING, resolveCombatAutomation } from '../model/autoCombatPolicy.js';
// The speed multiplier in force: the manual one, or the auto-combat one while
// auto-combat is on (owner, D11, 2026-10-18). The gap between stages is the
// player's "Pause between steps" row (combatStepPause, ms).
function resolvePacing(settings = {}) {
  const base = resolveCombatAutomation(settings);
  return { ...base, speed: base.enabled ? base.autoSpeed : base.speed, gapMs: base.delayMs };
}
let combatPacing = resolvePacing();
export function setCombatPacing(settings = {}) { combatPacing = resolvePacing(settings); }
// How long a damage/heal/guard number stays on screen, in ms. Reduced motion keeps the same life (it only
// drops the bounce), so a number is never unreadable for lack of motion.
export function floaterLifeMs() {
  if (getAnimSpeed() === 'instant') return COMBAT_TIMING.floaterInstantMs;
  return Math.round(Math.max(COMBAT_TIMING.floaterMinLifeMs, COMBAT_TIMING.floaterLifeMs / combatPacing.speed));
}
export function actionPacing({ reduced = false } = {}) {
  const pace = ANIM_SPEEDS[getAnimSpeed()];
  const scale = !pace || reduced ? 0 : (pace.beatMs / ANIM_SPEEDS.normal.beatMs) / combatPacing.speed;
  const scaled = value => Math.max(0, Number(value) || 0) * scale;
  const spriteScale = scale / ACTION_PACING.spritePlaybackRate
    * combatPacing.animationMs / ACTION_PACING.animationStepDurationMs;
  const gapMs = scaled(combatPacing.gapMs);
  // D11: the actor's action, its animation, the result word, the sprite
  // reaction, the damage, the reset, then the next item, with one gap at each
  // boundary. The action word fires with the action itself, so intentMs is 0.
  return {
    gapMs, intentMs: 0, wordMs: gapMs, afterSpriteMs: gapMs, resultMs: gapMs, reactionMs: gapMs, damageMs: gapMs, resetMs: gapMs,
    stepMs: scaled(pace?.stepMs || 0), bannerMs: scaled(pace ? turnBannerHoldMs(pace) : 0),
    // Animation services consume the same lunge/cap duration object as before.
    spriteSpeed: Object.fromEntries(Object.entries(pace || ANIM_SPEEDS.normal).map(([key, value]) => [key, value * spriteScale])),
    scale,
  };
}
