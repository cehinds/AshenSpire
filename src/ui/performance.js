// Rendering quality is independent of combat rules and saved motion choices.
//
// ONE SWITCH (owner, 2026-10-30): the General → Combat "Effects" toggle, default
// OFF. On renders everything (quality 'full'); off is the light, still, fully
// informative game (quality 'lite'). The older Rendering quality row
// (`performanceMode`) folded into it: a profile that had explicitly chosen
// 'full' keeps its animated look as `effects: true`; anything else is off.

/** The fighter-motion sub-options, each default ON, each independent of Effects. */
export const MOTION_KEYS = Object.freeze(['motionAttack', 'motionHit', 'motionIdle', 'motionDefeat']);

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

/** effectsOff() → true when the Effects switch is off (the root `data-effects` attribute). */
export function effectsOff() {
  return typeof document !== 'undefined' && document.documentElement?.dataset.effects !== 'on';
}

/** motionOff(kind) → true when that fighter-motion option is off; kind is attack|hit|idle|defeat. */
export function motionOff(kind) {
  return typeof document !== 'undefined' && !!document.body?.classList.contains(`motion-${kind}-off`);
}

export function resolveCombatPacing(settings = {}, quality = 'full') {
  return ['slow', 'normal', 'fast', 'instant'].includes(settings.animSpeed)
    ? settings.animSpeed : quality === 'lite' ? 'fast' : 'normal';
}
