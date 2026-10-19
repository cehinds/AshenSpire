// src/ui/components/cardOptionGrid.js — card choices as a grid of uniform tiles.
//
// One look for every picker whose options are cards (the reaction picker, the discard and
// card-pile choosers, a card's stance choice): a tile per option holding the card name, a
// one-line effect ("Def 7 · Return 4") and small cost chips. Every tile is the same size.
// A number the live preview raised wears `.val.up` (green), a lowered one `.val.down`
// (red); both come from the card-face classes, so the colourblind-safe tokens apply. The
// direction is also exposed as `data-dir`. Tiles are buttons: Tab and the arrow keys move
// between them, Enter and Space pick.

import { el, optionGrid } from '../kit/index.js';
import { t } from '../strings.js';

const ARROWS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function effectLine(summary) {
  const line = summary.line || [];
  if (!line.length) return el('span', { class: 'co-effect co-effect-text', text: summary.text || '' });
  const node = el('span', { class: 'co-effect' });
  line.forEach((part, index) => {
    if (index) node.append(el('span', { class: 'co-sep', text: ' · ' }));
    const item = el('span', { class: 'co-part', 'data-dir': part.dir || 'none' });
    if (part.before) item.append(el('span', { text: part.before }));
    item.append(el('span', { class: `val${part.dir ? ` ${part.dir}` : ''}`, text: String(part.value) }));
    // Direction is not colour alone: a visible arrow, and the words for a screen reader.
    if (part.dir) {
      item.append(el('span', { class: 'co-arrow', 'aria-hidden': 'true', text: part.dir === 'up' ? '\u25b2' : '\u25bc' }));
      item.append(el('span', { class: 'co-sr', text: ` ${t(`cardOption.dir.${part.dir}`)}` }));
    }
    if (part.after) item.append(el('span', { text: part.after }));
    node.append(item);
  });
  return node;
}

/**
 * cardOptionGrid(summaries, { onSelect, selectedId, idAttr, disabledIds }) -> the grid element.
 * `summaries` are summarizeCardOption results: { id, name, line, costs, text? }. `idAttr` is the
 * data attribute that carries each tile's id (the caller's existing hook, e.g. data-reaction-option).
 */
export function cardOptionGrid(summaries, { onSelect = null, selectedId = null, idAttr = 'data-card-option', disabledIds = null } = {}) {
  const tiles = summaries.map(summary => {
    const disabled = Boolean(disabledIds?.has?.(summary.id) || summary.disabled);
    const costs = (summary.costs || []).length
      ? el('span', { class: 'co-costs' }, summary.costs.map(cost => el('span', { class: 'co-chip', text: String(cost) })))
      : null;
    const tile = el('button', { type: 'button', class: `card-option${summary.className ? ` ${summary.className}` : ''}`, [idAttr]: summary.id, 'data-focusable': 'true',
      'aria-pressed': String(summary.id === selectedId), ...(summary.attrs || {}) },
    [el('span', { class: 'co-name', text: summary.name }), effectLine(summary), costs]);
    if (disabled) { tile.disabled = true; tile.setAttribute('aria-disabled', 'true'); }
    tile.addEventListener('click', () => { if (!tile.disabled) onSelect?.(summary.id, tile); });
    return tile;
  });
  const grid = optionGrid(tiles, { class: 'card-option-grid', role: 'group' });
  grid.addEventListener('keydown', event => {
    const step = ARROWS[event.key];
    if (!step) return;
    const live = tiles.filter(tile => !tile.disabled);
    const at = live.indexOf(event.target?.closest?.('.card-option') ?? event.target);
    if (at < 0) return;
    event.preventDefault?.();
    live[(at + step + live.length) % live.length].focus?.({ preventScroll: true });
  });
  return grid;
}

/**
 * markCardOptions(grid, idAttr, ids, { ordered }) -> sets aria-pressed for every tile whose id is
 * in `ids` (an array, in pick order). Ordered choices also show the pick position on the tile.
 */
export function markCardOptions(grid, idAttr, ids, { ordered = false } = {}) {
  for (const tile of grid.querySelectorAll(`[${idAttr}]`)) {
    const position = ids.indexOf(tile.getAttribute(idAttr));
    tile.setAttribute('aria-pressed', String(position >= 0));
    tile.querySelector?.('.co-order')?.remove?.();
    if (ordered && position >= 0) tile.insertBefore?.(el('span', { class: 'co-order', text: String(position + 1) }), tile.firstChild);
  }
}
