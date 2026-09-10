// Rendering quality is independent of combat rules and saved motion choices.
export function resolvePerformanceMode(settings = {}, coarse = false) {
  const mode = settings.performanceMode;
  return mode === 'lite' || (mode !== 'full' && coarse) ? 'lite' : 'full';
}

export function liteRendering() {
  return typeof document !== 'undefined' && document.documentElement?.dataset.performance === 'lite';
}

export function resolveCombatPacing(settings = {}, quality = 'full') {
  return ['slow', 'normal', 'fast', 'instant'].includes(settings.animSpeed)
    ? settings.animSpeed : quality === 'lite' ? 'fast' : 'normal';
}
