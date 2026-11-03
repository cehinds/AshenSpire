// The upgrade desk: the card upgrade picker and the Smith's item upgrade picker, built on the deck
// editor's own frame (owner, 2026-11-02: "use a similar UI used for the deck editor for the card
// upgrade and weapon upgrade"). It is the deck editor's Reading Desk with one list: the same veil,
// panel, head, `.deck-editor-panes` grid (the preview where the editor's inspector stands, the list
// where its collection stands), `.deck-editor-item` / `.deck-editor-main` rows, `.deck-editor-chip`
// back chip, and the `.deck-editor-foot` footer with a secondary Back on the left and the gold
// primary on the right. All of that is styled by the deck editor's CSS (styles/ui.css, "THE DECK
// EDITOR"), so a change to the editor's look reaches both pickers. This module draws shape only: the
// host (cardUpgradeModal.js, smithUpgradeModal.js) owns every fact, every row and the decision door.
//
// PHONE. The editor shows one pane at a time (`data-mobile-view`): the list, or the opened row's
// preview behind a "Back" chip. This desk follows it: choosing a row opens its preview; Back returns to
// the list; the footer and its primary action stay put.
import { el, button } from '../kit/index.js';
import { modalFooter } from './modalShell.js';
import { matchViewMedia } from '../viewViewport.js';

const PHONE = '(max-width: 1000px)';

const isPhone = () => {
  try { return typeof matchMedia === 'function' && matchViewMedia(PHONE).matches; } catch { return false; }
};

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
 * `title` / `titleId`: the heading. `listLabel`: the list's accessible name. `describedBy`: the id the dialog
 * is described by. `paneId` / `paneLabel`: the preview region's id and name. `backLabel`: the footer's way out.
 * `backToListLabel`: the phone's chip. `dataset`: stamped on the panel. `hasSelection`: opens on the preview
 * when a phone mounts with a row already chosen.
 */
export function mountUpgradeDesk(host, {
  title, titleId, listLabel, describedBy, paneId, paneLabel, backLabel, backToListLabel, kind = 'upgrade', hasSelection = false,
}) {
  const veil = el('div', { class: 'modal-veil deck-editor-veil upgrade-desk-veil smith-modal-veil' });
  const panel = el('section', {
    class: `deck-editor deck-editor-reading-desk upgrade-desk upgrade-desk-${kind}`, role: 'dialog', 'aria-modal': 'true',
    'aria-labelledby': titleId, 'aria-describedby': describedBy, tabindex: '-1', dataset: { wireframe: 'W1i', upgradeDesk: kind },
  });
  veil.appendChild(panel);

  // Head: the editor's title, with the purse where its counter stands.
  const purse = el('p', { class: 'deck-editor-counter smith-header-stones', role: 'status', 'aria-live': 'polite' });
  const closeBtn = el('button', { type: 'button', class: 'modal-close upgrade-desk-close', 'aria-label': backLabel, text: '×' });
  const head = el('header', { class: 'deck-editor-head' }, [
    el('h2', { id: titleId, class: 'deck-editor-title', text: title }), purse, closeBtn,
  ]);

  // The preview: the editor's inspector, a reading area, then the reason line and the primary's room.
  const reading = el('div', { class: 'deck-editor-reading smith-preview-host' });
  const reason = el('p', { class: 'deck-editor-selected-reason as-flavor smith-consequence', id: describedBy });
  const backChip = button({ label: backToListLabel, className: 'deck-editor-chip deck-editor-inspect-back' });
  const inspector = el('section', { class: 'deck-editor-inspector smith-preview-region', id: paneId, 'aria-live': 'polite', 'aria-label': paneLabel }, [
    backChip, reading, el('div', { class: 'deck-editor-selected-actions' }, reason),
  ]);

  // The list: the editor's collection pane.
  const list = el('div', { class: 'deck-editor-list', role: 'listbox', 'aria-label': listLabel });
  const pane = el('section', { class: 'deck-editor-pane active', dataset: { pane: 'collection' }, 'aria-label': listLabel }, list);
  const panes = el('div', { class: 'deck-editor-panes', dataset: { active: 'collection' } }, [inspector, pane]);

  // Footer: the editor's, Back where Cancel stands, the primary where Accept stands.
  const backBtn = button({ label: backLabel, role: 'exit', className: 'deck-editor-cancel smith-back' });
  const confirmBtn = button({ label: '', weight: 'primary', className: 'deck-editor-done smith-confirm' });
  const refusal = el('p', { class: 'deck-editor-refusal', role: 'status', 'aria-live': 'polite', hidden: true });
  const foot = modalFooter({ secondary: [backBtn], primary: confirmBtn, className: 'deck-editor-foot smith-modal-footer', size: 'medium' });
  const footer = el('div', { class: 'deck-editor-footer' }, [refusal, foot]);

  panel.append(head, panes, footer);
  host.appendChild(veil);

  let view = hasSelection && isPhone() ? 'inspect' : 'collection';
  panel.dataset.mobileView = view;

  /** 'collection' (the list) or 'inspect' (the chosen row's preview); only a phone shows one at a time. */
  function setView(next) {
    view = next;
    panel.dataset.mobileView = next;
  }
  /** A chosen row opens its preview on a phone; a cleared choice returns to the list. */
  function follow(selected) { setView(selected ? 'inspect' : 'collection'); }
  backChip.addEventListener('click', () => { setView('collection'); list.querySelector('[aria-selected="true"], .deck-editor-main')?.focus?.({ preventScroll: true }); });

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
    veil, panel, head, purse, closeBtn, reading, reason, inspector, backChip, list, backBtn, confirmBtn, refusal, setView, follow,
    view: () => view,
    /** Replace the list's rows (each a `deskRow().item`). */
    setRows(items) { list.replaceChildren(...items); },
  };
}
