import { esc } from './tooltip.js';
import { assetUrl } from '../assetmap.js';
import { openModal } from './modalShell.js';
import { placeAnchored, viewportLocalBox } from '../fx.js';
import { focusElement, matchAction, actionLabel } from '../input.js';

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
 * WHAT A FLASK SAYS ABOUT ITSELF, ONCE. Six surfaces were each hand-typing the
 * same two sentences — `map.js` twice, `combat.js` twice, `coop.js` twice —
 * with the charge line spelled `${current} charge${current === 1 ? '' : 's'}
 * remaining.` at two of them and simply omitted at the other four. So the same
 * flask described itself differently depending on which HUD you were looking
 * at, and the plural agreement was a copy that only two of the six could get
 * wrong. This returns the LINES, as text; every caller escapes and joins them
 * with the separator its own surface wants.
 *
 * `charges` is `null` when the surface does not track charges (a utility flask
 * has none), and a number when it does — including 0, which is a sentence the
 * player needs, so the test is `Number.isFinite` and not truthiness.
 *
 * An unresolved `{token}` renders WITH its braces here, deliberately: card.js's
 * relicText() block has the reason — a visible brace is a bug report and a bare
 * key is a sentence that looks fine and lies. Flask templates carry no tokens
 * today (src/content/flasks.js); the day one does, it reports itself.
 */
export function flaskDetailLines(def, { charges = null } = {}) {
  const lines = [];
  const effect = String(def?.textTemplate || '').trim();
  if (effect) lines.push(effect);
  if (Number.isFinite(charges)) lines.push(`${charges} charge${charges === 1 ? '' : 's'} remaining.`);
  return lines;
}

/**
 * The tooltip form of the same lines. Returns HTML and escapes its own
 * content — the six call sites this replaces each escaped by hand, and the
 * charge count at two of them was interpolated UNESCAPED because it "is a
 * number", which is true of the value and not of the type the caller had.
 */
export function flaskTooltipHtml(def, { charges = null, hint = '' } = {}) {
  const body = flaskDetailLines(def, { charges }).map(esc).join('<br>');
  return `<div class="tt-title">${esc(def?.name || '')}</div>${body}`
    + (hint ? `${body ? '<br>' : ''}<i>${esc(hint)}</i>` : '');
}

/**
 * openFlaskInspectModal({ def, charges }) — INSPECT IS A DOOR NOW, NOT A FOLD.
 *
 * It used to un-hide a paragraph inside the 280 px action menu, which made
 * Inspect the row that changed the size of the thing you were pointing at and
 * gave the player a second, smaller copy of a sentence the menu can simply
 * show. The menu now carries the sentence from the start (Constantine,
 * 2026-09-03: "I like this to be the default look for the flask instead of
 * having to click inspect"), so Inspect is free to be what its label always
 * promised: a bigger surface with the art at a size worth looking at.
 *
 * The chrome is the shell's (modalShell.js) — one close glyph in the corner
 * every other modal keeps it in, one way forward in the footer, and ONE
 * Escape/veil-click/focus-return implementation. A seventh hand-rolled
 * dismissal was the alternative and is the thing that file exists to prevent.
 */
export function openFlaskInspectModal({ def, charges = null, opener = document.activeElement } = {}) {
  if (!def) throw new Error('openFlaskInspectModal requires a flask definition');
  const lines = flaskDetailLines(def, { charges });

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'flask-inspect-done';
  done.dataset.focusable = 'true';
  done.textContent = 'Close';

  const shell = openModal({
    size: 'md',
    className: 'flask-inspect-modal',
    eyebrow: 'Flask',
    title: def.name,
    bodyClassName: 'flask-inspect-body',
    body: (host) => {
      host.innerHTML = flaskIdentityHtml(def, { showName: false, className: 'flask-inspect-art' })
        + `<div class="flask-inspect-lines">${lines.map((line) => `<p>${esc(line)}</p>`).join('')}</div>`;
    },
    primary: done,
    footSize: 'short',
    opener,
  });
  done.addEventListener('click', shell.close);
  return Object.freeze({ root: shell.veil, close: shell.close });
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
export function mountFlaskActionMenu(anchor, { def, plan, charges = null, useActionId = null, onAction, onCancel, wireAction } = {}) {
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
  // THE DESCRIPTION IS THE DEFAULT, NOT A REWARD FOR FINDING A ROW. This block
  // was `hidden` until the player clicked Inspect, so the menu's whole job on
  // first paint was to name a flask the player had just pointed at and could
  // already see. The sentence a tooltip has always shown on hover is the
  // sentence the menu opens with now, charge count included where the surface
  // knows it, and Inspect opens a real modal instead (openFlaskInspectModal).
  const detail = flaskDetailLines(def, { charges });
  root.innerHTML = `<strong>${esc(def.name)}</strong>`
    + (detail.length ? `<div class="flask-action-detail">${detail.map(esc).join('<br>')}</div>` : '');
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
    // The panel's height is CONTENT — the description is authored in a table
    // (src/content/flasks.js) and a designer may make it long. Cap it at the
    // room below the slot so a long flask text scrolls inside the panel instead
    // of hanging its last row off the screen.
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
    // THE KEYCAP IS DERIVED, NEVER TYPED. `actionLabel` reads the live binding
    // and the connected device, so a rebind moves the glyph with the key and a
    // pad shows its own button — the same rule the HUD's flask shortcuts obey.
    // Only rows that HAVE a binding get one: `inspect` is one key for every
    // inspectable thing, and `use` is per-slot, so its id is handed in by the
    // surface that knows which slot this flask sits in.
    const boundAction = row.id === 'inspect' ? 'inspect' : (row.id === 'use' ? useActionId : null);
    if (boundAction) {
      const cap = document.createElement('span');
      cap.className = 'flask-action-key';
      cap.textContent = actionLabel(boundAction);
      button.appendChild(cap);
    }
    if (!row.enabled) {
      button.dataset.unavailableReason = row.reason;
      button.title = row.reason;
    }
    const invoke = () => {
      if (!row.enabled) return;
      if (row.id === 'inspect') {
        // Inspect is the one row that leaves this menu WITHOUT reporting an
        // action: it is reading, not committing, so `onAction` stays unrung and
        // every caller's mutation path is untouched. Close first, then open —
        // the modal takes focus, and it must not be handed back to a slot that
        // is about to lose its menu underneath it. `restoreFocus: false` for
        // the same reason; the modal's own dismissal returns focus to `anchor`.
        close({ cancelled: false, restoreFocus: false });
        openFlaskInspectModal({ def, charges, opener: anchor });
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
    // ONE BINDING, ASKED THE WAY EVERY OTHER SURFACE ASKS IT. `matchAction` is
    // the same question combat asks for End Turn, so a rebound Inspect works
    // here for free and this file never learns which key it is.
    if (matchAction(ev, 'inspect')) {
      const inspectRow = buttons.find((candidate) => candidate.dataset.flaskAction === 'inspect');
      if (inspectRow && inspectRow.getAttribute('aria-disabled') === 'false') {
        ev.preventDefault();
        ev.stopPropagation();
        inspectRow.click();
        return;
      }
    }
    if (ev.key === 'Escape' || ev.key === 'Backspace') {
      ev.preventDefault();
      // The child owns Cancel. Do not let the same physical key continue to
      // the parent radial after focus has been restored into it.
      ev.stopPropagation();
      close({ cancelled: true, restoreFocus: true });
    }
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
