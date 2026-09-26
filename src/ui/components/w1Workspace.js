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
import { resolveWorkspaceSpec } from '../models/WireframeChoiceModel.js';
import { activeWireframeChoice } from '../wireframeChoices.js';
import { wireframeUi } from '../../content/wireframeUi.js';

// A SURFACE'S OWN SHARES, KEPT WITH THE SURFACE. W1i (the Smith) and W1j/W1k
// (the stable) paint the generic frame and then override three of its
// properties with their own (SmithWorkspaceModel: the item column is 44 of 90,
// not a category rail's 21.6). `restampWorkspaceFrames` re-paints the frame
// when the player changes the Workspace frame choice, and re-painting only the
// generic half would leave those doors wearing a rail they never asked for —
// measured as exactly that regression in review. So the override is recorded
// against the node and re-applied with it. A WeakMap rather than an attribute:
// these are CSS custom properties, and a copy of them in the DOM would be a
// second home for numbers SmithWorkspaceModel owns.
const OVERRIDES = new WeakMap();

/**
 * workspaceFrame(node, extra) → the node, wearing the W1 frame.
 *
 * `extra` is a surface's own custom properties, applied after the frame's and
 * remembered, so a later restamp reproduces the same node. Passing nothing
 * keeps whatever that node was last given.
 */
export function workspaceFrame(node, extra = null) {
  node.classList.add('w1-workspace');
  // The drawn shares, then the player's answer about them (Settings → Advanced
  // → Wireframes → Menus). `auto` hands workspaceFrameVars the same spec it
  // reads for itself, so the frame is unchanged until something else is chosen.
  const spec = resolveWorkspaceSpec(wireframeUi.workspace, activeWireframeChoice('wireframeMenuFrame'));
  for (const [prop, value] of Object.entries(workspaceFrameVars(spec))) node.style.setProperty(prop, value);
  if (extra) OVERRIDES.set(node, extra);
  const own = OVERRIDES.get(node);
  if (own) for (const [prop, value] of Object.entries(own)) node.style.setProperty(prop, value);
  return node;
}

/**
 * restampWorkspaceFrames(doc) → how many open workspaces took the new shares.
 *
 * The frame is seven custom properties, so a changed answer is re-paintable
 * without rebuilding a door — and the Smith or the stable can be open behind
 * the Settings window while the answer changes.
 */
export function restampWorkspaceFrames(doc = typeof document === 'undefined' ? null : document) {
  let restamped = 0;
  for (const node of doc?.querySelectorAll('.w1-workspace') || []) { workspaceFrame(node); restamped += 1; }
  return restamped;
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
