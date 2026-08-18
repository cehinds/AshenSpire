import { esc } from './tooltip.js';
import { assetUrl } from '../assetmap.js';
import { placeAnchored, viewportLocalBox } from '../fx.js';
import { focusElement } from '../input.js';

let activeFlaskActionMenu = null;

/**
 * The one lifecycle owner for the contextual flask menu. Competing surfaces
 * call this before they mount; repeated calls are deliberately harmless.
 */
export function closeFlaskActionMenu({ cancelled = true, restoreFocus = false } = {}) {
  if (!activeFlaskActionMenu) return false;
  activeFlaskActionMenu.close({ cancelled, restoreFocus });
  return true;
}

/** One data-owned identity fragment; every surface may add its own surrounding copy. */
export function flaskIdentityHtml(def, { showName = true, className = '' } = {}) {
  const art = def.artAsset
    ? `<img class="flask-art-image" src="${esc(assetUrl(def.artAsset))}" alt="">`
    : `<span class="flask-art-glyph">${esc(def.icon)}</span>`;
  return `<span class="flask-identity ${esc(className)}" data-flask-art="${esc(def.artKey)}" style="--flask-tint:${esc(def.tint)}" aria-label="${esc(def.name)}">`
    + `<span class="flask-art" aria-hidden="true">${art}</span>`
    + (showName ? `<span class="flask-name">${esc(def.name)}</span>` : '')
    + '</span>';
}

export function flaskPresentation(def, options = {}) {
  const el = document.createElement(options.tag || 'span');
  el.className = options.hostClass || '';
  el.innerHTML = flaskIdentityHtml(def, options);
  return el;
}

/**
 * Shared flask action menu. The caller supplies the plan and owns mutations;
 * selection and inspection are inert here.
 *
 * IT IS PLACED UNDER THE SLOT THE PLAYER TAPPED, SINCE 2026-08-17. Before that
 * this docstring said "placement-independent" and the menu was UNPLACED:
 * `.flask-action-menu` had no rule in any stylesheet, so the root below was
 * `position: static`, appended last to `.combat` / `.mapscreen`, and it rendered
 * as a full-width strip on the bottom edge — 567 local px below its own control
 * at 1200x730, 726.9 at 390x844, its Inspect row 39% buried under the DRAW pile.
 * Constantine reported it; Bjorn photographed it and corrected the wording;
 * Sunna placed it. The before/after numbers and the reason `under` beat `beside`
 * are in `.flask-action-menu`'s block in styles/ui.css — the placement's costs
 * are a design record and they live with the design, not in two files.
 *
 * WHY THE WORDING MATTERED, kept because the lesson outlives the defect: gating
 * d705b66 this docstring was cited as evidence that the menu wants no anchored
 * placement, and Marina's relay that it DOES want one was scored wrong on the
 * strength of it. NO SEARCH FOR PLACEMENT CODE CAN FIND A SURFACE WHOSE DEFECT
 * IS THAT IT PLACES NOTHING. The artifact wins over the comment about it. — Bjorn
 *
 * The check is tools/placement.mjs P5, at both shapes, through the real tap.
 */
export function mountFlaskActionMenu(anchor, { def, plan, onAction, onCancel, wireAction } = {}) {
  if (!anchor || !def || !plan) throw new Error('mountFlaskActionMenu requires anchor, def, and plan');
  // The same flask is a toggle, not a close-then-immediately-reopen sequence.
  if (activeFlaskActionMenu?.anchor === anchor) {
    closeFlaskActionMenu({ cancelled: true, restoreFocus: true });
    return null;
  }
  // One menu at a time, and close through its lifecycle so its window-level
  // controller Cancel listener cannot survive after the DOM has gone.
  closeFlaskActionMenu({ cancelled: true, restoreFocus: false });
  const root = document.createElement('div');
  root.className = 'flask-action-menu';
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', `${def.name} actions`);
  root.innerHTML = `<strong>${esc(def.name)}</strong>`
    + `<div class="flask-action-detail" hidden>${esc(def.textTemplate || '')}</div>`;
  const buttons = [];
  let closed = false;
  let disconnectObserver = null;
  // THE SCREEN MARGIN HAS ONE HOME IN THIS FILE AND IT IS PASSED, NOT ASSUMED.
  // placeAnchored uses `pad` for the fit test AND for the bound; the cap below
  // needs the same number for the room under the slot, so it is handed over
  // explicitly rather than matched against the default by hand. (quicknav.js
  // writes the doubled literal `8` next to a call that does not pass `pad` —
  // that pairing works today and nothing checks it. Named, not touched.)
  const PAD = 4;
  // UNDER THE SLOT, AND ONLY UNDER IT — the intent is named HERE, never guessed
  // in fx.js. `align: 'start'` puts the panel's left edge on the slot's, so the
  // corner nearest the finger is the one that does not move. No `clear`: 'under'
  // has a single candidate, so a group preference would be inert, and a
  // preference that cannot change an answer is a comment pretending to be code.
  const place = () => {
    const view = viewportLocalBox();
    const at = placeAnchored(root, anchor, { intent: 'under', align: 'start', view, pad: PAD });
    // The panel's height is CONTENT — Inspect un-hides a description a designer
    // authors in a table. Cap it at the room below the slot so a long flask text
    // scrolls inside the panel instead of hanging its last row off the screen.
    root.style.maxHeight = `${Math.max(0, view.height - at.top - PAD * 2)}px`;
  };
  const close = ({ cancelled = false, restoreFocus = false } = {}) => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onGlobalCancel);
    document.removeEventListener('click', onDocumentClick, true);
    disconnectObserver?.disconnect();
    disconnectObserver = null;
    root.remove();
    if (activeFlaskActionMenu?.root === root) activeFlaskActionMenu = null;
    if (cancelled && onCancel) onCancel();
    if (restoreFocus && anchor.isConnected && typeof anchor.focus === 'function') {
      anchor.focus();
      focusElement(anchor);
    }
  };
  const onDocumentClick = (ev) => {
    const target = ev.target;
    if (root.contains(target) || anchor === target || anchor.contains(target)) return;
    close({ cancelled: true, restoreFocus: false });
  };
  // Gamepad Cancel is a synthesized Escape dispatched on window by input.js,
  // not on the focused button. Root bubbling covers physical keyboard Escape;
  // this mounted listener is the parity seam for pad B / Back.
  const onGlobalCancel = (ev) => {
    if (ev.key !== 'Escape' && ev.key !== 'Backspace') return;
    ev.preventDefault();
    close({ cancelled: true, restoreFocus: true });
  };
  for (const row of plan.actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'flask-action';
    button.dataset.flaskAction = row.id;
    button.dataset.focusable = 'true';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-disabled', String(!row.enabled));
    button.textContent = row.label;
    if (!row.enabled) {
      button.dataset.unavailableReason = row.reason;
      button.title = row.reason;
    }
    const invoke = () => {
      if (!row.enabled) return;
      if (row.id === 'inspect') {
        root.querySelector('.flask-action-detail').hidden = false;
        // THE PANEL JUST GREW, AND PLACEMENT IS A ONE-SHOT. Re-run it: the
        // top-left corner is pinned to the slot so nothing jumps under the
        // finger, but the bound and the cap are recomputed against the taller
        // box. Without this the expanded menu is placed as the collapsed one.
        place();
        return;
      }
      if (onAction) onAction(row.id);
      close();
    };
    const wired = wireAction ? wireAction(row, button, invoke) : false;
    if (!wired) button.addEventListener('click', invoke);
    root.appendChild(button);
    buttons.push(button);
  }
  const move = (delta) => {
    const at = Math.max(0, buttons.indexOf(document.activeElement));
    const next = buttons[(at + delta + buttons.length) % buttons.length];
    next.focus();
    focusElement(next);
  };
  root.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' || ev.key === 'Backspace') { ev.preventDefault(); close({ cancelled: true, restoreFocus: true }); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); move(1); }
    else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); move(-1); }
    else if (ev.key === 'Home') {
      ev.preventDefault();
      const first = buttons[0];
      first?.focus();
      focusElement(first);
    } else if (ev.key === 'End') {
      ev.preventDefault();
      const last = buttons.at(-1);
      last?.focus();
      focusElement(last);
    }
  });
  window.addEventListener('keydown', onGlobalCancel);
  document.addEventListener('click', onDocumentClick, true);
  (anchor.closest('.combat,.mapscreen') || document.body).appendChild(root);
  if (typeof MutationObserver !== 'undefined') {
    disconnectObserver = new MutationObserver(() => {
      if (!root.isConnected || !anchor.isConnected) close();
    });
    disconnectObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  place();
  const first = buttons.find((button) => button.getAttribute('aria-disabled') === 'false') || buttons[0];
  first?.focus();
  focusElement(first);
  activeFlaskActionMenu = Object.freeze({ anchor, root, buttons: Object.freeze(buttons), close });
  return activeFlaskActionMenu;
}
