// src/ui/components/quicknav.js — the ☰ quick-nav dropdown (EldenSpire#34).
//
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
// It is a LAUNCHER: every row calls a handler that already exists — the screen's
// ⚒/? buttons, openOverlay({initialTab}), the pile modals, onSave, onQuit. It
// holds no navigation state at all, so `selectTab` in overlay.js stays the single
// decider. The day a row knows something selectTab does not, this stopped being a
// quick way into the menu and became a second menu.
//
// Rows come from the MENU table in uiContent.js — the same table the overlay's
// tab strip is built from (Law 1). This file knows how to DRAW a list and where
// to put it; it does not know what is in the list.
//
// LAW 3, CLAUSE 6 — the bumper answer, written out per context, because a
// context-specific control that leaves one context undefined is a defect found by
// the player's thumb:
//
//   dropdown open, overlay closed (map / combat)
//       A vertical list is not a tab set. The list takes the FOCUS CURSOR
//       (D-pad / stick + Confirm) — it is a `.modal-veil`, so input.js's
//       scopeRoot() scopes the cursor to it with no new code. LB/RB keep their
//       global bindings (Relics / Stats); either one opens the overlay, and
//       openOverlay() closes this list on the way, so the bumpers never act on
//       two surfaces at once.
//   dropdown open, overlay open (mirror / switcher)
//       Same list, same cursor. The bumpers belong to the TAB SET behind it and
//       keep cycling it — including while the strip is folded into a switcher
//       (Law 3 clause 1a: the law binds the set, not the widget).
//   dropdown closed
//       Nothing here; the bumpers stay with the tabs.
//
// LAW 2 — one coordinate space. The panel is `position: fixed`, so the viewport
// is its containing block, and every number below is converted to LOCAL px ONCE,
// through fx.js, before anything is compared or written. The anchor clamp is not
// decoration: the combat topbar WRAPS on a phone and puts ☰ at the LEFT edge
// (measured: `combat-menu @ 18,49` at 390×844), so "hang it off the top-right"
// would have put the list off-screen on exactly the shape it is for.

import { anchorLocalBox, viewportLocalBox, clampBox, VIEWPORT_ORIGIN } from '../fx.js';
import { attachTooltip, esc, hideTooltip } from './tooltip.js';
import { menuRows } from '../uiContent.js';
import { isEngaged, focusFirst } from '../input.js';

// The experiment's own state, set from applyDisplaySettings (main.js) the same
// way input.js is handed its bindings — so screens never have to thread `meta`
// down just to ask which variant is running.
let mode = 'off'; // 'off' | 'mirror' | 'switcher'
let fixedEnds = true;

/** setQuickNav({ mode, fixedEnds }) — called by applyDisplaySettings. */
export function setQuickNav(opts) {
  if (opts.mode != null) mode = ['mirror', 'switcher'].includes(opts.mode) ? opts.mode : 'off';
  if (opts.fixedEnds != null) fixedEnds = !!opts.fixedEnds;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.quicknav = mode;
    if (mode === 'off') closeQuickNav();
  }
}

/** 'off' | 'mirror' | 'switcher' — what the player is currently testing. */
export function quickNavMode() {
  return mode;
}

/** True when the overlay's tab strip should fold into one switcher button.
 *  The NARROW test is `data-layout`, which autoLayout() already owns — this
 *  variant must not become a second decider of what "narrow" means (Law 2). */
export function quickNavFolds() {
  return mode === 'switcher' && typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-layout') === 'narrow';
}

const MODE_NAMES = { mirror: 'Mirror', switcher: 'Switcher' };

let openVeil = null;
let escHandler = null;

export function closeQuickNav() {
  if (openVeil) {
    openVeil.remove();
    openVeil = null;
    hideTooltip();
  }
  if (escHandler) {
    removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
}

export function quickNavIsOpen() {
  return !!openVeil;
}

/**
 * saveAction(onSave) → the handler for the `save` row.
 *
 * Saves and says so IN PLACE ("Saved · Slot 2"), leaving the list open: the row
 * exists to make saving two taps instead of three, and closing the menu to prove
 * it worked would spend the tap it just saved. Exported because all three
 * contexts need the identical behaviour, and three copies of it is three chances
 * for one of them to quietly navigate away instead.
 */
export function saveAction(onSave) {
  return (_tab, btn) => {
    const slot = onSave();
    const lab = btn.querySelector('.qn-label');
    const was = lab.textContent;
    lab.textContent = slot ? `Saved · Slot ${slot}` : 'Saved';
    setTimeout(() => { lab.textContent = was; }, 1500);
    return 'keep';
  };
}

/**
 * openQuickNav(anchorEl, context, { actions, counts, current, hasSave })
 *
 * `actions` maps an `act` id from the MENU table to the handler that already
 * does that thing. An act with no handler is dropped rather than drawn dead.
 * Returns the panel element (or null when the variant is off).
 */
export function openQuickNav(anchorEl, context, { actions = {}, counts = {}, current = null, hasSave = true } = {}) {
  if (mode === 'off' || !anchorEl) return null;
  closeQuickNav();

  const rows = menuRows(context, { fixedEnds, hasSave, counts, current })
    .filter((r) => typeof actions[r.act] === 'function');
  if (!rows.length) return null;

  const veil = document.createElement('div');
  veil.className = 'modal-veil qn-veil';
  const panel = document.createElement('div');
  panel.className = 'qn-panel';

  // THE CAPTION IS THE POINT OF SHIPPING THIS AT ALL. An experiment that
  // outlives the memory of switching it on becomes a bug report — so the list
  // says, every single time it opens, that it is a test, which variant is
  // running, and where the way back is. It is a header, not a row: Save and
  // Save & Quit are the last two rows, always (his constraint, fixed by hand).
  const cap = document.createElement('div');
  cap.className = 'qn-cap';
  cap.textContent = `TEST · Quick menu: ${MODE_NAMES[mode]} — change or turn off in Settings ▸ Display`;
  panel.appendChild(cap);

  for (const r of rows) {
    if (r.sep) panel.appendChild(Object.assign(document.createElement('div'), { className: 'qn-sep' }));
    const b = document.createElement('button');
    b.className = `qn-row${r.tone ? ` ${r.tone}` : ''}${r.on ? ' on' : ''}`;
    b.dataset.act = r.act;
    if (r.tab) b.dataset.tab = r.tab;
    b.innerHTML = `<span class="qn-ic">${esc(r.icon)}</span><span class="qn-label">${esc(r.label)}</span>`
      + (r.badge ? `<span class="qn-badge">${esc(r.badge)}</span>` : '');
    // Law 3 clause 4: the tooltip fires for hover AND for the pad/keyboard focus
    // cursor. `title=` alone is what the topbar has today, and touch and pad
    // players never see it.
    if (r.tip) attachTooltip(b, () => `<div class="tt-title">${esc(r.label)}</div>${esc(r.tip)}`);
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const fn = actions[r.act];
      // A row that gives feedback in place (Save) keeps the list open and says
      // so; everything else is a navigation and the list has done its job.
      const inPlace = fn(r.tab, b);
      if (inPlace !== 'keep') closeQuickNav();
    });
    panel.appendChild(b);
  }

  veil.appendChild(panel);
  document.body.appendChild(veil);
  openVeil = veil;
  position(anchorEl, panel);

  veil.addEventListener('click', (ev) => {
    if (ev.target === veil) closeQuickNav();
  });
  escHandler = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      closeQuickNav();
    }
  };
  addEventListener('keydown', escHandler, true);

  // Keyboard/pad players land on the list rather than nowhere — the same smart
  // default openOverlay() uses, and the reason the vertical list needs no new
  // input code: it IS the focus scope while it is open.
  if (isEngaged()) setTimeout(() => focusFirst('.qn-row.on') || focusFirst('.qn-row'), 0);

  return panel;
}

// Right-aligned under its button, then bounded regardless — see the header for
// why the bound is not optional on a phone. `keep: Infinity`: this is a list of
// words a player has to read, so all of it stays on screen.
function position(anchorEl, panel) {
  const view = viewportLocalBox();
  const a = anchorLocalBox(VIEWPORT_ORIGIN, anchorEl);
  const b = anchorLocalBox(VIEWPORT_ORIGIN, panel);
  const gap = 6; // local px, and meant to be: a hairline gap is not read text
  const at = clampBox(
    { left: a.left + a.width - b.width, top: a.top + a.height + gap, width: b.width, height: b.height },
    view
  );
  panel.style.left = `${at.left}px`;
  panel.style.top = `${at.top}px`;
  // A list taller than the screen scrolls inside itself rather than pinning its
  // tail off the bottom — Save & Quit is the last row and must be reachable.
  panel.style.maxHeight = `${Math.max(0, view.height - at.top - 8)}px`;
}
