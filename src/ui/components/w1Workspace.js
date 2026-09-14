// W1 workspace pieces shared by W1f Compendium and W1g Profile.
//
// `workspaceFrame(node)` puts the W1 frame shares (wireframeUi.workspace) on a
// door as custom properties; kit.css sizes the frame, the rail and the pane's
// two slots from them.
//
// The category navigation itself is the kit's (kit/categoryNav.js): a vertical
// rail on wide hosts, one `[Category ▾]` selector above the pane on compact
// ones, the same component every categorized W1 surface uses.

import { landControl } from '../kit/index.js';
import { workspaceFrameVars } from '../models/WorkspaceModel.js';

export function workspaceFrame(node) {
  node.classList.add('w1-workspace');
  for (const [prop, value] of Object.entries(workspaceFrameVars())) node.style.setProperty(prop, value);
  return node;
}

/** land(control) — put the unified cursor and DOM focus on one control. */
export const land = landControl;

/** markCurrent(items, id) — the rail's selected state, in the kit's words. */
export function markCurrent(items, id) {
  for (const item of items) {
    const on = item.dataset.member === id;
    item.classList.toggle('on', on);
    item.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
  }
}
