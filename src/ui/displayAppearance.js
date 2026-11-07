import { resolveDisplayAppearance } from '../model/displayAppearance.js';

const appearance = resolveDisplayAppearance();
export const displayAppearance = () => appearance;

// Marks the document so the layout CSS keys off the one appearance.
export function applyDisplayAppearance(settings, root = globalThis.document?.documentElement) {
  if (root) root.dataset.displayAppearance = resolveDisplayAppearance(settings);
}
