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

// Test and probe hook (tools/perf-probe.mjs): counts how often a UI pass runs. A no-op unless the probe
// installed `window.__perfCounts`, so shipped play pays one property read.
export function perfCount(name) {
  const counts = globalThis.__perfCounts;
  if (counts) counts[name] = (counts[name] || 0) + 1;
}
