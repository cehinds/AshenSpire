// src/ui/components/optionRowList.js — card choices as a vertical list of full-width rows.
//
// The row look of the card-upgrade picker (cardUpgradeModal.js): art well, name, a status line, a
// trailing chip. Same contract as cardOptionGrid: `idAttr` carries each row's id, a click calls
// `onSelect(id, row)`, `markOptionRows(list, idAttr, ids)` sets aria-pressed. A row is a button, so
// Tab, Enter and Space work; ArrowUp/ArrowDown (and Left/Right) move focus between rows.
// Not carried over from cardOptionGrid: `disabledIds` (use `row.disabled`), `attrs` and `ordered`.

import { el, artWell } from '../kit/index.js';
import { assetUrl } from '../assetmap.js';
import { hideOnError } from '../artFallback.js';
import { cardCutoutUrl } from '../layeredCardArt.js';
import { cardArtLayersHtml } from '../cardArtLayers.js';
import { effectLine } from './cardOptionGrid.js';

const ARROWS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
const VERTICAL = new Set(['ArrowDown', 'ArrowUp']);
const COLUMN_LIST_MAX = 3;

/** optionColumns(count) -> columns of the list: one column up to 3 options, then ceil(sqrt(count)). */
export function optionColumns(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return n <= COLUMN_LIST_MAX ? 1 : Math.ceil(Math.sqrt(n));
}

// No art (no artAsset and no artGlyph): no art cell at all, the text takes the width.
function rowArt(row) {
  if (!row.artAsset && !row.artGlyph) return null;
  // A Simple-art composition (row.artComposition, from playingCardArt) paints its background as the
  // image and the illustration as layers over it, as the card face does.
  const composed = row.artComposition?.componentArt;
  const well = row.artAsset
    ? artWell({ src: composed ? cardCutoutUrl(row.artAsset) : assetUrl(row.artAsset), alt: '', small: true, attrs: { class: 'option-row-art' } })
    : artWell({ glyph: row.artGlyph, small: true, attrs: { class: 'option-row-art' } });
  hideOnError(well.querySelector?.('img'));
  if (row.artComposition) {
    well.style && Object.assign(well.style, { position: 'relative', isolation: 'isolate' });
    well.insertAdjacentHTML?.('beforeend', cardArtLayersHtml(row.artComposition));
    // A cutout that fails to load must not leave broken-image marks: drop the layers, like the card face.
    for (const image of well.querySelectorAll?.('[data-card-art-component]') || []) {
      image.addEventListener('error', () => well.querySelectorAll('[data-card-art-layers]').forEach(node => node.remove()), { once: true });
    }
  }
  return well;
}

/**
 * optionRowList(rows, { idAttr, onSelect, selectedId }) -> the list element.
 * `rows`: { id, name, line?, html?, text?, costs?, artAsset?, artGlyph?, chip?, count? (a "×N" chip for identical options shown once), disabled?, className? }
 * (a summarizeCardOption result plus the art and chip the caller adds).
 */
export function optionRowList(rows, { onSelect = null, selectedId = null, idAttr = 'data-option' } = {}) {
  const items = rows.map(row => {
    const costs = (row.costs || []).length
      ? el('span', { class: 'co-costs' }, row.costs.map(cost => el('span', { class: 'co-chip', text: String(cost) })))
      : null;
    const item = el('button', {
      type: 'button', class: `as-railitem option-row${row.className ? ` ${row.className}` : ''}`, [idAttr]: row.id,
      'data-focusable': 'true', 'aria-pressed': String(row.id === selectedId),
    }, [
      rowArt(row),
      el('span', { class: 'option-row-text' }, [
        el('strong', { class: 'option-row-name', text: row.name }),
        el('span', { class: 'option-row-status' }, [costs, effectLine(row)]),
      ]),
      row.count ? el('span', { class: 'option-row-chip option-row-count', text: row.count }) : null,
      row.chip ? el('span', { class: 'option-row-chip', text: row.chip }) : null,
    ]);
    if (row.disabled) { item.disabled = true; item.setAttribute('aria-disabled', 'true'); }
    item.addEventListener('click', () => { if (!item.disabled) onSelect?.(row.id, item); });
    return item;
  });
  const columns = optionColumns(rows.length);
  const list = el('div', { class: 'option-row-list', role: 'group', 'data-columns': String(columns) }, items);
  list.style?.setProperty?.('--option-columns', String(columns));
  list.addEventListener('keydown', event => {
    const dir = ARROWS[event.key];
    if (!dir) return;
    // Grid mode (DOM order is row-major): Up/Down move a whole row of tiles, Left/Right one tile.
    const step = dir * (columns > 1 && VERTICAL.has(event.key) ? columns : 1);
    const live = items.filter(item => !item.disabled);
    const at = live.indexOf(event.target?.closest?.('.option-row') ?? event.target);
    if (at < 0) return;
    event.preventDefault?.();
    const next = live[(((at + step) % live.length) + live.length) % live.length];
    next.focus?.({ preventScroll: true });
    next.scrollIntoView?.({ block: 'nearest' });
  });
  return list;
}

/** markOptionRows(list, idAttr, ids) -> sets aria-pressed on every row whose id is in `ids`. */
export function markOptionRows(list, idAttr, ids) {
  for (const item of list.querySelectorAll(`[${idAttr}]`)) item.setAttribute('aria-pressed', String(ids.includes(item.getAttribute(idAttr))));
}
