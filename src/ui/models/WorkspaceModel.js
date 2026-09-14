// W1 workspace: the parts every categorized W1 child shares. The frame's
// custom properties come from wireframeUi.workspace, and category navigation
// steps through the rail the same way on every surface. DOM-free.

import { wireframeUi } from '../../content/wireframeUi.js';

export const CATEGORY_KEYS = Object.freeze(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

/** stepCategory(ids, current, key) → the id a navigation key moves to, or null. Wraps. */
export function stepCategory(ids, current, key) {
  const list = [...(ids || [])];
  if (!list.length || !CATEGORY_KEYS.includes(key)) return null;
  const at = Math.max(0, list.indexOf(current));
  if (key === 'Home') return list[0];
  if (key === 'End') return list[list.length - 1];
  const step = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
  return list[(at + step + list.length) % list.length];
}

/** workspaceFrameVars(spec) → the custom properties kit.css reads for a W1 frame. */
export function workspaceFrameVars(spec = wireframeUi.workspace) {
  for (const key of ['frameWidth', 'frameHeight', 'railWidth', 'columnGap', 'rowGap']) {
    if (!(spec[key] > 0 && spec[key] <= 1)) throw new Error(`workspace.${key} must be a fraction in (0, 1]`);
  }
  if (!(spec.railMinRem > 0 && spec.railMaxRem >= spec.railMinRem)) throw new Error('workspace rail bounds are inverted');
  return Object.freeze({
    '--w1-frame-w': String(spec.frameWidth),
    '--w1-frame-h': String(spec.frameHeight),
    '--w1-rail': String(spec.railWidth),
    '--w1-rail-min': `${spec.railMinRem}rem`,
    '--w1-rail-max': `${spec.railMaxRem}rem`,
    '--w1-col-gap': String(spec.columnGap),
    '--w1-row-gap': String(spec.rowGap),
  });
}
