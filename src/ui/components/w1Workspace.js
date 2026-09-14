// W1 workspace pieces shared by W1f Compendium and W1g Profile.
//
// `workspaceFrame(node)` puts the W1 frame shares (wireframeUi.workspace) on a
// door as custom properties; kit.css sizes the frame, the rail and the pane's
// two slots from them.
//
// `categoryNav(...)` is the category navigation. Wide hosts get the kit's
// vertical rail. Compact hosts get the same navigation above the pane as one
// selector, `[Category ▾]`, which opens the same rail as a list under it:
// rule 11 forbids horizontal category tabs and accordions.
//
// KEYS AND THE PAD ARE input.js's. Its capture-phase router moves the one
// cursor (`.gp-focus`) with the arrows and the d-pad and presses what it is on
// with Enter / A, so a category is reached the way every other control is: move
// onto it, press it. This file never answers an arrow itself (a second
// navigator fought the router and the next Enter pressed whatever the router
// had moved to). It adds Home / End, which the router leaves alone, and Escape
// to close the compact list; every focus it moves goes through focusElement so
// the cursor and DOM focus stay on the same control. Rail items keep
// `role=tab` and `aria-selected` for tools and readers.

import { el, rail } from '../kit/index.js';
import { focusElement } from '../input.js';
import { stepCategory, workspaceFrameVars } from '../models/WorkspaceModel.js';

export function workspaceFrame(node) {
  node.classList.add('w1-workspace');
  for (const [prop, value] of Object.entries(workspaceFrameVars())) node.style.setProperty(prop, value);
  return node;
}

/** land(control) — put the unified cursor and DOM focus on one control. */
export function land(control) {
  if (!control) return;
  focusElement(control);
  if (document.activeElement !== control) control.focus({ preventScroll: true });
}

/**
 * categoryNav({ items, ariaLabel, choose }) → { node, sync(summary), start() }
 * `items` are kit railItems carrying `data-member`; `choose(id)` switches the
 * pane. `sync(summary)` rewrites the compact selector's face after a switch;
 * `start()` is the control a screen should open on.
 */
export function categoryNav({ items, ariaLabel, choose }) {
  const ids = () => items.map((item) => item.dataset.member);
  const list = rail(items, { 'aria-label': ariaLabel, class: 'w1-rail' });
  const face = el('span', { class: 'w1-nav-face' });
  const toggle = el('button', {
    type: 'button', class: 'as-btn w1-nav-toggle', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': ariaLabel,
  }, [face, el('span', { class: 'w1-nav-caret', 'aria-hidden': 'true', text: '▾' })]);
  const node = el('div', { class: 'w1-nav' }, [toggle, list]);
  const compact = () => toggle.getClientRects().length > 0;
  const selected = () => items.find((item) => item.getAttribute('aria-selected') === 'true') || items[0];
  // Escape closes the open list and nothing else. A door listens for Escape on
  // `document` in the capture phase (modalShell bindModalDismiss) and would
  // close the whole workspace, so while the list is open this listens one step
  // earlier, on `window`, and only for as long as the list is open.
  const onEscape = (event) => {
    if (event.key !== 'Escape' || node.dataset.open !== 'true') return;
    if (!node.isConnected) { window.removeEventListener('keydown', onEscape, true); return; }
    event.preventDefault(); event.stopImmediatePropagation();
    close(true);
  };
  const setOpen = (open) => {
    node.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) window.addEventListener('keydown', onEscape, true);
    else window.removeEventListener('keydown', onEscape, true);
  };
  setOpen(false);
  const close = (refocus) => { setOpen(false); if (refocus) land(toggle); };

  toggle.addEventListener('click', () => {
    const open = node.dataset.open !== 'true';
    setOpen(open);
    if (open) land(selected());
  });
  for (const item of items) {
    item.addEventListener('click', () => {
      choose(item.dataset.member);
      if (compact()) close(true);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Home' && event.key !== 'End') return;
      const next = stepCategory(ids(), item.dataset.member, event.key);
      event.preventDefault(); event.stopPropagation();
      // Wide: the rail is the selection, so Home / End select. Compact: the
      // list is open under the selector and Enter picks, so they only move.
      if (!compact()) choose(next);
      land(items.find((candidate) => candidate.dataset.member === next));
    });
  }
  // The compact list closes when the pad's cursor leaves it, or when DOM focus
  // does (Tab, a click elsewhere); each is judged on its own, because the two
  // are allowed to stand in different places.
  for (const control of [toggle, ...items]) control.addEventListener('gpblur', () => setTimeout(() => {
    const cursor = document.querySelector('.gp-focus');
    if (node.dataset.open === 'true' && !(cursor && node.contains(cursor))) setOpen(false);
  }, 0));
  node.addEventListener('focusout', (event) => {
    if (node.dataset.open === 'true' && !(event.relatedTarget && node.contains(event.relatedTarget))) setOpen(false);
  });

  const sync = (summary) => { face.textContent = summary; };
  const start = () => (compact() ? toggle : selected());
  return { node, sync, start };
}

/** markCurrent(items, id) — the rail's selected state, in the kit's words. */
export function markCurrent(items, id) {
  for (const item of items) {
    const on = item.dataset.member === id;
    item.classList.toggle('on', on);
    item.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
  }
}
