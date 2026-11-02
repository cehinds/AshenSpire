import { logicalViewport, VIEW_PRESETS } from './viewViewport.js';

// The height combatant sizes are a share of. The large viewport (100lvh) is the
// height with the mobile URL bar retracted, so it does not move as the bar
// slides in and out; a probe element reads it in the same physical pixels as
// the battlefield. A selected view preset (desktop, mobile ...) answers with
// its own height scaled like the rest of the game. Anything the browser cannot
// answer falls back to the layout viewport.
let probe = null;
export function stableViewportHeight(win = globalThis.window) {
  const doc = win?.document;
  const preset = doc?.documentElement?.dataset?.viewPreset;
  if (!doc) return 0;
  try {
    if (!probe || !probe.isConnected) {
      probe = doc.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100lvh;visibility:hidden;pointer-events:none;zoom:1';
      doc.documentElement.append(probe);
    }
    const lvh = probe.getBoundingClientRect().height;
    if (!VIEW_PRESETS[preset] && lvh > 0) return lvh;
  } catch { /* fall through to the layout viewport */ }
  return Math.max(win.innerHeight || 0, logicalViewport(win).height || 0);
}

// A phone in portrait takes the smaller body share (config: bodyHeightFraction).
export function portraitPhoneViewport(narrow, win = globalThis.window) {
  return Boolean(narrow) && (win?.innerWidth ?? 0) <= (win?.innerHeight ?? 0);
}
