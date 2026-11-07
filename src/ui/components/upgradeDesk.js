// The upgrade desk: the card upgrade picker and the Smith's item upgrade picker, built on the deck
// editor's own frame (owner, 2026-11-02: "use a similar UI used for the deck editor for the card
// upgrade and weapon upgrade"). It is the deck editor's Reading Desk with one list: the same veil,
// panel, head, `.deck-editor-panes` grid, `.deck-editor-item` / `.deck-editor-main` rows and the
// `.deck-editor-foot` footer, styled by the deck editor's CSS (styles/ui.css, "THE DECK EDITOR").
// This module draws shape only: the host (cardUpgradeModal.js, smithUpgradeModal.js) owns every fact,
// every row and the confirmation modal a chosen row opens.
//
// ONE SCREEN, ONE MODAL (owner, 2026-11-04). The desk is the list. Tapping a row opens that row's upgrade
// confirmation modal straight away; there is no detail view and no Back button inside the desk.
import { el, button } from '../kit/index.js';
import { modalFooter } from './modalShell.js';

/** A row's art in the editor's own `.deck-editor-art` slot (the host's ArtWell: its painted asset, or its glyph). */
export function deskArt(node) {
  return el('span', { class: 'deck-editor-art upgrade-desk-art', 'aria-hidden': 'true' }, node);
}

/**
 * One list row, the editor's tile: `.deck-editor-item` holding a `.deck-editor-main` (art, heading, rule
 * line, side facts). The row element carries the host's own classes and data (`className`, `attrs`)
 * so what already reads those hooks keeps working. It is a div, not a button, when `tag` says so: a
 * row may hold its own inspection control.
 */
export function deskRow({ tag = 'div', className = '', attrs = {}, art, name, badges = [], meta = null, side = [], disabled = false } = {}) {
  const main = el(tag, {
    class: `deck-editor-main ${className}`.trim(), ...attrs,
    dataset: { illustrated: art ? 'true' : 'false', ...(attrs.dataset || {}) },
  }, [
    art,
    el('span', { class: 'deck-editor-heading' }, [el('span', { class: 'deck-editor-name', text: name }), ...badges.filter(Boolean)]),
    meta,
    el('span', { class: 'deck-editor-costs upgrade-desk-side' }, side.filter(Boolean)),
  ].filter(Boolean));
  if (tag === 'button') main.type = 'button';
  const item = el('div', { class: `deck-editor-item deck-editor-tile${disabled ? ' spent' : ''}`, role: 'presentation' }, main);
  return { item, main };
}

/**
 * mountUpgradeDesk(host, options) → the desk's parts.
 *
 * The desk is the LIST and nothing else (owner, 2026-11-04): a compact head (the title with the purse under it,
 * a 44px close), the rows, and a footer whose one button leaves. Choosing a row does not open a detail view
 * inside the desk; the host opens the confirmation modal for that row (see `reviewRow` in the hosts), which is
 * the one place the upgrade is read and confirmed. `confirmBtn` is the control that modal is armed on; it is
 * not in the page.
 *
 * `title` / `titleId`: the heading. `listLabel`: the list's accessible name. `backLabel`: the footer's way out.
 */
export function mountUpgradeDesk(host, { title, titleId, listLabel, backLabel, kind = 'upgrade' }) {
  const veil = el('div', { class: 'modal-veil deck-editor-veil upgrade-desk-veil smith-modal-veil' });
  const panel = el('section', {
    class: `deck-editor deck-editor-reading-desk upgrade-desk upgrade-desk-${kind}`, role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': titleId, tabindex: '-1', // The deck editor's phone rule shows one pane by this attribute; the desk has the one, the list.
    dataset: { wireframe: 'W1i', upgradeDesk: kind, mobileView: 'collection' },
  });
  veil.appendChild(panel);

  const purse = el('p', { class: 'deck-editor-counter smith-header-stones', role: 'status', 'aria-live': 'polite' });
  const closeBtn = el('button', { type: 'button', class: 'modal-close upgrade-desk-close', 'aria-label': backLabel, text: '×' });
  const head = el('header', { class: 'deck-editor-head upgrade-desk-head' }, [
    el('div', { class: 'upgrade-desk-headtext' }, [el('h2', { id: titleId, class: 'deck-editor-title', text: title }), purse]), closeBtn,
  ]);

  const list = el('div', { class: 'deck-editor-list', role: 'listbox', 'aria-label': listLabel });
  const pane = el('section', { class: 'deck-editor-pane active', dataset: { pane: 'collection' }, 'aria-label': listLabel }, list);
  const panes = el('div', { class: 'deck-editor-panes', dataset: { active: 'collection' } }, pane);

  const backBtn = button({ label: backLabel, role: 'exit', className: 'deck-editor-cancel smith-back' });
  const confirmBtn = button({ label: '', weight: 'primary', className: 'deck-editor-done smith-confirm' });
  const foot = modalFooter({ secondary: [backBtn], className: 'deck-editor-foot smith-modal-footer', size: 'medium' });
  panel.append(head, panes, el('div', { class: 'deck-editor-footer' }, foot));
  host.appendChild(veil);

  /** Arrow keys walk the rows, as the editor's list does under the focus cursor. */
  list.addEventListener('keydown', (event) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    const rows = [...list.querySelectorAll('.deck-editor-main')];
    const at = rows.indexOf(event.target);
    if (at < 0) return;
    event.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, at + step))]?.focus?.({ preventScroll: true });
  });

  return {
    veil, panel, head, purse, closeBtn, list, backBtn, confirmBtn,
    /** Replace the list's rows (each a `deskRow().item`). */
    setRows(items) { list.replaceChildren(...items); },
  };
}
