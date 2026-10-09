import { resolveDisplayAppearance } from '../model/displayAppearance.js';

let appearance = 'alternative';
const views = new Set();
export const displayAppearance = () => appearance;
export const classicAppearance = () => appearance === 'classic';

export function applyDisplayAppearance(settings, root = globalThis.document?.documentElement) {
  const next = resolveDisplayAppearance(settings);
  const changed = next !== appearance;
  appearance = next;
  if (root) root.dataset.displayAppearance = next;
  return changed;
}

export function onDisplayAppearanceChange(root, redraw) {
  let observer;
  const release = () => { views.delete(view); observer?.disconnect(); };
  const view = { root, redraw, release };
  views.add(view);
  if (root.parentNode && typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver(() => { if (!root.isConnected) release(); });
    observer.observe(root.parentNode, { childList: true });
  }
  return release;
}

// Publish after all display settings are applied; detached screens never redraw.
export function publishDisplayAppearanceChange() {
  for (const view of [...views]) {
    if (!views.has(view)) continue;
    if (!view.root.isConnected) view.release();
    else view.redraw();
  }
}
