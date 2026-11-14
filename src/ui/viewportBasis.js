import { logicalViewport, viewScale, VIEW_PRESETS } from './viewViewport.js';

// The height combatant sizes are a share of. The large viewport (100lvh) is the
// height with the mobile URL bar retracted, so it does not move as the bar
// slides in and out; a probe element reads it in the same physical pixels as
// the battlefield. A selected view preset (desktop, mobile ...) answers with
// its canvas height times the fit scale, so it does not follow the window. Anything the browser cannot
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
  // The consumer sizes in physical px (it measures the field with getBoundingClientRect,
  // then divides by the field's zoom), so a canvas answers its height times the fit scale:
  // the same layout px in every window that shows this canvas.
  if (VIEW_PRESETS[preset]) return (logicalViewport(win).height || 0) * viewScale(win);
  return Math.max(win.innerHeight || 0, logicalViewport(win).height || 0);
}

// A phone in portrait takes the smaller body share (config: bodyHeightFraction). Under a canvas the
// logical viewport decides, not the window: a phone canvas shown in a wide window is still portrait.
export function portraitPhoneViewport(narrow, win = globalThis.window) {
  const { width, height } = logicalViewport(win);
  return Boolean(narrow) && width <= height;
}
