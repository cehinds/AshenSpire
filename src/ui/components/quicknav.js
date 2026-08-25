// src/ui/components/quicknav.js — the ☰ quick-nav dropdown (EldenSpire#34).
//
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
// It is a LAUNCHER: every row calls a handler that already exists — the screen's
// Armoury views, openOverlay({initialTab}), save/load, and explicit exit paths. It
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

import { viewportLocalBox, placeAnchored } from '../fx.js';
import { hideTooltip } from './tooltip.js';
import { menuRows } from '../uiContent.js';
import { isEngaged, focusFirst } from '../input.js';
import { closeFlaskActionMenu } from './flask.js';
import { quickMenuPanelModel } from '../models/MenuModels.js';
import { renderQuickMenu } from './menuComponents.js';

// The player's presentation choice, set from applyDisplaySettings (main.js) the same
// way input.js is handed its bindings — so screens never have to thread `meta`
// down just to ask which variant is running.
let mode = 'mirror'; // 'off' | 'mirror' | 'switcher'
let fixedEnds = true;

export function resolveQuickNavMode(value) {
  return ['off', 'mirror', 'switcher'].includes(value) ? value : 'mirror';
}

/** setQuickNav({ mode, fixedEnds }) — called by applyDisplaySettings. */
export function setQuickNav(opts) {
  mode = resolveQuickNavMode(opts?.mode);
  if (opts?.fixedEnds != null) fixedEnds = !!opts.fixedEnds;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.quicknav = mode;
    const launchers = document.querySelectorAll('#ov-quicknav, #ov-switch');
    launchers.forEach((button) => { button.hidden = mode === 'off'; });
    if (mode === 'off') closeQuickNav();
    window.dispatchEvent(new CustomEvent('ashenspire:quicknav-mode-change', {
      detail: { mode, folded: quickNavFolds() },
    }));
  }
}

/** 'off' | 'mirror' | 'switcher' — the current quick-menu presentation. */
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

let openVeil = null;
let openAnchor = null;
let escHandler = null;
let fullscreenSync = null;

export function closeQuickNav({ restoreFocus = true } = {}) {
  const anchor = openAnchor;
  if (openVeil) {
    openVeil.remove();
    openVeil = null;
    hideTooltip();
  }
  if (anchor) anchor.setAttribute('aria-expanded', 'false');
  openAnchor = null;
  if (escHandler) {
    removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
  if (fullscreenSync) {
    for (const type of ['fullscreenchange', 'webkitfullscreenchange', 'fullscreenerror', 'webkitfullscreenerror']) {
      document.removeEventListener(type, fullscreenSync);
    }
    fullscreenSync = null;
  }
  if (restoreFocus && anchor?.isConnected) {
    queueMicrotask(() => {
      const staysInModal = !!anchor.closest('.modal-veil');
      const replacementModal = document.querySelector('.modal-veil, .armoury-overlay');
      if (anchor.isConnected && (staysInModal || !replacementModal)) anchor.focus();
    });
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

/** Keep destructive/unsaved exits explicit and testable at their launcher. */
export function confirmQuickMenuAction(message, action, confirmFn = globalThis.confirm) {
  return (...args) => {
    // A host with no confirmation surface must fail closed. This keeps a
    // browser shell from turning a missing API into an unconfirmed data loss.
    if (typeof confirmFn !== 'function' || !confirmFn(message)) return 'keep';
    return action(...args);
  };
}

/**
 * openQuickNav(anchorEl, context, { actions, counts, current, hasSave })
 *
 * `actions` maps an `act` id from the MENU table to the handler that already
 * does that thing. An act with no handler is dropped rather than drawn dead.
 * Returns the panel element, or null when there is no anchor/action to show.
 */
export function openQuickNav(anchorEl, context, { actions = {}, controls = {}, counts = {}, current = null, hasSave = true } = {}) {
  if (mode === 'off' || !anchorEl) return null;
  closeFlaskActionMenu({ cancelled: true });
  closeQuickNav({ restoreFocus: false });

  const rows = menuRows(context, { fixedEnds, hasSave, counts, current })
    .filter((r) => typeof actions[r.act] === 'function' || typeof controls[r.act]?.activate === 'function')
    .map((r) => {
      const state = controls[r.act]?.read?.() || {};
      return { ...r, checked: !!state.checked, disabled: !!state.disabled, condition: state.condition || '' };
    });
  if (!rows.length) return null;

  const model = quickMenuPanelModel({
    context,
    mode,
    caption: 'Quick menu',
    rows,
  });
  const { veil, panel } = renderQuickMenu(model, {
    onActivate: async (row, button) => {
      const handler = controls[row.act]?.activate || actions[row.act];
      const result = await handler(row.tab, button);
      if (controls[row.act]) syncControlRows(panel, controls, row.act, result?.announcement || '');
      const inPlace = controls[row.act] ? 'keep' : result;
      if (inPlace !== 'keep') closeQuickNav();
    },
  });
  document.body.appendChild(veil);
  openVeil = veil;
  openAnchor = anchorEl;
  anchorEl.setAttribute('aria-haspopup', 'menu');
  anchorEl.setAttribute('aria-expanded', 'true');
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

  fullscreenSync = () => syncControlRows(panel, controls);
  for (const type of ['fullscreenchange', 'webkitfullscreenchange', 'fullscreenerror', 'webkitfullscreenerror']) {
    document.addEventListener(type, fullscreenSync);
  }

  // Keyboard/pad players land on the list rather than nowhere — the same smart
  // default openOverlay() uses, and the reason the vertical list needs no new
  // input code: it IS the focus scope while it is open.
  if (isEngaged()) setTimeout(() => focusFirst('.qn-row.on') || focusFirst('.qn-row'), 0);

  return panel;
}

function syncControlRows(panel, controls, announcedAct = '', announcement = '') {
  for (const [act, control] of Object.entries(controls)) {
    const button = panel.querySelector(`.qn-row[data-act="${act}"]`);
    if (!button || typeof control.read !== 'function') continue;
    const state = control.read() || {};
    button.setAttribute('aria-checked', String(!!state.checked));
    button.disabled = !!state.disabled;
    button.setAttribute('aria-disabled', String(!!state.disabled));
    const condition = button.querySelector('.qn-condition');
    if (condition) condition.textContent = act === announcedAct && announcement ? announcement : (state.condition || '');
    const visible = button.querySelector('.qn-state');
    if (visible) visible.textContent = state.checked ? 'ON' : 'OFF';
  }
}

// Right-aligned under its button, then bounded regardless — see the header for
// why the bound is not optional on a phone. `keep: Infinity` (placeAnchored's
// default): this is a list of words a player has to read, so all of it stays on
// screen.
//
// THIS FUNCTION USED TO BE THE ARITHMETIC. It was tooltip.js's place() written
// out a second time with two answers changed — one side instead of four, and
// right-aligned instead of sliding — and neither file knew the other existed, so
// a placement fix had two homes to land in and landed in neither. It is now the
// two answers and nothing else: `intent: 'under'` (a dropdown hangs off its
// button; when it does not fit, the bound answers, and that is this caller's
// declared preference, not an oversight) and `align: 'end'` (its right edge on
// the button's). The gap moved with it — `.qn-panel { --place-gap }` in ui.css,
// the same one home #tooltip now reads, instead of `const gap = 6` here.
//
// NO `clear` HERE, ON PURPOSE. The ☰ button's group is the topbar, and a
// dropdown that refused to hang under its own bar would have nowhere left to go.
// A preference is only worth naming where the caller wants it.
function position(anchorEl, panel) {
  const view = viewportLocalBox();
  const at = placeAnchored(panel, anchorEl, { intent: 'under', align: 'end', view });
  // A list taller than the screen scrolls inside itself rather than pinning its
  // tail off the bottom — Save & Quit is the last row and must be reachable.
  panel.style.maxHeight = `${Math.max(0, view.height - at.top - 8)}px`;
}
