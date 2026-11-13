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
  floaterLifeMs: 2400,
  floaterMinLifeMs: 400,   // the floor at the highest speed multiplier
  floaterInstantMs: 480,   // the Instant pace keeps the classic short number
  floaterFadeFraction: 1 / 3,
  // Callout words (STAGGERED, EVADED, action words): life at combat speed 1, divided by the Combat speed
  // only (like the numbers), never by the Fast/Slow animation pace (owner, 2026-10-31).
  calloutLifeMs: 1400,
  calloutMinLifeMs: 700,
  calloutInstantMs: 500,   // the Instant pace keeps the classic short word
  // Sprite frame rates (owner, 2026-11-02: "Sprite Animation is too fast and looks twitchy"). Base rates at
  // Combat speed 1 and the default 550 ms Animation step (authored reference 390 ms); the hold per frame is 1000 / fps, divided by the
  // Combat speed once and scaled by the step duration setting (against the authored 390 ms reference), then clamped below. Every action frame is held
  // for the same time, so a swing steps evenly. Instant and Reduced motion hold nothing.
  spriteActionFps: 9,      // attack, defend, cast, enemy actions: 111 ms a frame at x1, 89 ms at the default x1.25
  spriteIdleFps: 7,        // a looping idle (6-8 fps). No sprite idle loop ships today; idleFrameMs() is its clock
  frameHoldMinMs: 75,      // fastest a frame may go at any speed: 13.3 fps (was 40 ms = 25 fps at high speed)
  frameHoldMaxMs: 160,     // slowest: 6.3 fps at the lowest Combat speed
  reaverRunHoldShare: 0.6, // the 60-step Reaver painting changes image 18 times; each change holds this share of the floor
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

// One presentation-only multiplier for the entire ordered action. The classic
// pace remains a compatibility choice, with ×1 preserving its relative scale.
import { ACTION_PACING, AUTOMATION_DEFAULTS, resolveCombatAutomation } from '../model/autoCombatPolicy.js';
import { FLOATER_STACK } from './floaterStack.js';
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
// The floater life at the shipped default Combat speed. floaterStack.json's stagger numbers are intervals at this
// life (owner, 2026-11-06: 750 ms between floaters as the player sees them by default), so they scale from it.
function defaultFloaterLifeMs() {
  return Math.round(Math.max(COMBAT_TIMING.floaterMinLifeMs, COMBAT_TIMING.floaterLifeMs / AUTOMATION_DEFAULTS.combatSpeed));
}
// The wait between two floaters spawning over one combatant, in ms (owner, 2026-11-05; content/config floaterStack.json).
// It follows the floater life, so it scales with the Combat speed multiplier and shortens on Instant exactly as
// the life does, never below 1 ms. At the default speed it is the JSON number itself.
export function floaterStaggerMs({ enemy = false } = {}) {
  const base = enemy ? combatPacing.enemyFloaterIntervalMs : FLOATER_STACK.floaterStaggerMs;
  return Math.max(1, Math.round(base * floaterLifeMs() / defaultFloaterLifeMs()));
}
// The shrunk wait used while more than floaterMaxQueued floaters are waiting over one combatant, so the backlog
// drains and never falls behind the next action. It scales with the floater life like the full stagger.
export function floaterStaggerMinMs({ enemy = false } = {}) {
  return Math.max(1, Math.min(floaterStaggerMs({ enemy }), Math.round(FLOATER_STACK.floaterStaggerMinMs * floaterLifeMs() / defaultFloaterLifeMs())));
}
// How long a callout word stays on screen, in ms. Presentation only: no beat waits on it.
export function calloutLifeMs() {
  if (getAnimSpeed() === 'instant') return COMBAT_TIMING.calloutInstantMs;
  return Math.round(Math.max(COMBAT_TIMING.calloutMinLifeMs, COMBAT_TIMING.calloutLifeMs / combatPacing.speed));
}
// The time one sprite frame is shown, in ms (0 on Instant and Reduced motion). The rate comes from
// COMBAT_TIMING.spriteActionFps; the Combat speed divides it once and the Animation step duration scales it.
function holdFor(fps, reduced, animationMs = combatPacing.animationMs) {
  if (reduced || !ANIM_SPEEDS[getAnimSpeed()]) return 0;
  const hold = 1000 / fps * (animationMs / ACTION_PACING.animationStepDurationMs) / combatPacing.speed;
  return Math.round(Math.min(COMBAT_TIMING.frameHoldMaxMs, Math.max(COMBAT_TIMING.frameHoldMinMs, hold)));
}
export function frameHoldMs({ reduced = false, enemy = false } = {}) { return holdFor(COMBAT_TIMING.spriteActionFps, reduced, enemy ? enemyAnimationMs() : undefined); }
// An enemy's Animation step: its attack length setting (750 ms by default) maps onto the player's default step the
// way the shipped default pairs them, so the default enemy animation equals the default player animation.
function enemyAnimationMs() {
  return combatPacing.enemyAttackMs / ACTION_PACING.enemyAttackDefaultMs * ACTION_PACING.animationStepDefaultMs;
}
// The same for a looping idle (slower than an action).
export function idleFrameMs({ reduced = false } = {}) { return holdFor(COMBAT_TIMING.spriteIdleFps, reduced); }
// The sprite services' timing object: every entry scaled, then the lunge and the reaction (the two a single
// frame is shown for) lifted to the frame hold, so a recoil or hurt pose is never a flicker.
function spriteSpeedFor(pace, spriteScale, minFrameMs) {
  const speed = Object.fromEntries(Object.entries(pace).map(([key, value]) => [key, value * spriteScale]));
  if (minFrameMs > 0) for (const key of ['lungeMs', 'reactionMs']) speed[key] = Math.max(speed[key], minFrameMs);
  return { ...speed, minFrameMs };
}
// The reaction gap scale clamped to [0,1]; anything that is not a number counts as 1 (no shortening).
export function clampGapScale(raw) {
  const value = raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}
export function actionPacing({ reduced = false, enemy = false, reaction = false } = {}) {
  const pace = ANIM_SPEEDS[getAnimSpeed()];
  const scale = !pace || reduced ? 0 : (pace.beatMs / ANIM_SPEEDS.normal.beatMs) / combatPacing.speed;
  const scaled = value => Math.max(0, Number(value) || 0) * scale;
  const spriteScale = scale / ACTION_PACING.spritePlaybackRate
    * (enemy ? enemyAnimationMs() : combatPacing.animationMs) / ACTION_PACING.animationStepDurationMs;
  // Playback that follows a reaction answer waits a shorter gap (actionPacing.json reactionGapScale, [0,1]).
  const gapScale = reaction ? clampGapScale(ACTION_PACING.reactionGapScale) : 1;
  const gapMs = scaled(combatPacing.gapMs) * gapScale;
  // Every stage named in actionPacing.json fixedStageMs holds a fixed time: not the gap, the speed or reactionGapScale; 0 on Instant and Reduced motion.
  const fixedMs = key => {
    const raw = ACTION_PACING.fixedStageMs?.[key];
    return Number.isFinite(raw) ? (scale > 0 ? Math.max(0, raw) : 0) : undefined;
  };
  const fixed = Object.fromEntries(Object.keys(ACTION_PACING.fixedStageMs || {})
    .map(key => [key, fixedMs(key)]).filter(([, value]) => value !== undefined));
  // D11: the actor's action, its animation, the result word, the sprite
  // reaction, the damage, the reset, then the next item, with one gap at each
  // boundary. The cost and the action word open the beat; the stance follows the word by one gap (intentMs), then the animation.
  return {
    gapMs, intentMs: gapMs, wordMs: gapMs, afterSpriteMs: gapMs, resultMs: gapMs, reactionMs: gapMs, damageMs: gapMs, resetMs: gapMs,
    ...fixed,
    stepMs: scaled(pace?.stepMs || 0), bannerMs: scaled(pace ? turnBannerHoldMs(pace) : 0),
    // Animation services consume the same lunge/cap duration object as before.
    spriteSpeed: spriteSpeedFor(pace || ANIM_SPEEDS.normal, spriteScale, frameHoldMs({ reduced, enemy })),
    scale,
  };
}

// How long a sprite reaction plays: the same paced sprite speed (frame hold included) the timeline reserves
// the beat with, so playback and reservation never disagree. `stage` is a sprite stage service.
export function reactionPlayMs(stage, kind, { reduced = false, fallbackMs = 280 } = {}) {
  return stage?.reactionTiming?.(kind, actionPacing({ reduced }).spriteSpeed)?.totalMs || fallbackMs;
}
