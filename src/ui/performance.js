// Rendering quality is independent of combat rules and saved motion choices.
//
// ONE SWITCH (owner, 2026-10-30): the General → Combat "Effects" toggle, default
// OFF. On renders everything (quality 'full'); off is the light, still, fully
// informative game (quality 'lite'). The older Rendering quality row
// (`performanceMode`) folded into it: a profile that had explicitly chosen
// 'full' keeps its animated look as `effects: true`; anything else is off.

/** The fighter-motion sub-options, each default ON, each independent of Effects. */
export const MOTION_KEYS = Object.freeze(['motionAttack', 'motionHit', 'motionIdle', 'motionDefeat']);

/** motionFlags(settings) → { attack, hit, idle, defeat } booleans: true when that fighter motion plays. */
export function motionFlags(settings = {}) {
  return Object.fromEntries(MOTION_KEYS.map(key => [key.slice(6).toLowerCase(),
    key === 'motionIdle' ? resolveMotionIdle(settings) : settings[key] !== false]));
}

/** coarsePointer() → true on a touch-first device. The one matchMedia read, here so tests can stub it. */
export function coarsePointer() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** resolveMotionIdle(settings) → idle motion: an explicit saved boolean wins; else off on touch devices (battery), on elsewhere. */
export function resolveMotionIdle(settings = {}) {
  return typeof settings.motionIdle === 'boolean' ? settings.motionIdle : !coarsePointer();
}

/** effectsEnabled(settings) → true only when the player turned Effects on (or had picked Full quality). */
export function effectsEnabled(settings = {}) {
  if (typeof settings.effects === 'boolean') return settings.effects;
  return settings.performanceMode === 'full';
}

/**
 * migrateEffectsSetting(settings) → true when it changed `settings`. The one-time
 * migration: a saved explicit `performanceMode: 'full'` becomes `effects: true`
 * and the retired key is dropped. Idempotent.
 */
export function migrateEffectsSetting(settings) {
  if (!settings || !Object.hasOwn(settings, 'performanceMode')) return false;
  if (typeof settings.effects !== 'boolean' && settings.performanceMode === 'full') settings.effects = true;
  delete settings.performanceMode;
  return true;
}

// `coarse` is kept so callers need no change; the default is now off everywhere,
// so a touch screen no longer decides anything.
export function resolvePerformanceMode(settings = {}, coarse = false) { // eslint-disable-line no-unused-vars
  return effectsEnabled(settings) ? 'full' : 'lite';
}

export function liteRendering() {
  return typeof document !== 'undefined' && document.documentElement?.dataset.performance === 'lite';
}

/** effectsOff() → true when the Effects switch is off (root `data-effects="off"`, set at boot by main.js; absent in bare test DOMs reads as on). */
export function effectsOff() {
  return typeof document !== 'undefined' && document.documentElement?.dataset.effects === 'off';
}

/** motionOff(kind) → true when that fighter-motion option is off; kind is attack|hit|idle|defeat. */
export function motionOff(kind) {
  return typeof document !== 'undefined' && !!document.body?.classList.contains(`motion-${kind}-off`);
}

export function resolveCombatPacing(settings = {}, quality = 'full') {
  return ['slow', 'normal', 'fast', 'instant'].includes(settings.animSpeed)
    ? settings.animSpeed : quality === 'lite' ? 'fast' : 'normal';
}
