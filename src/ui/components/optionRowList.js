// src/ui/components/optionRowList.js — card choices as a vertical list of full-width rows.
//
// The row look of the card-upgrade picker (cardUpgradeModal.js): art well, name, a status line, a
// trailing chip. Same contract as cardOptionGrid: `idAttr` carries each row's id, a click calls
// `onSelect(id, row)`, `markOptionRows(list, idAttr, ids)` sets aria-pressed. A row is a button, so
// Tab, Enter and Space work; ArrowUp/ArrowDown (and Left/Right) move focus between rows.

import { el, artWell } from '../kit/index.js';
import { assetUrl } from '../assetmap.js';
import { hideOnError } from '../artFallback.js';
import { effectLine } from './cardOptionGrid.js';

const ARROWS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function rowArt(row) {
  const well = row.artAsset
    ? artWell({ src: assetUrl(row.artAsset), alt: '', small: true, attrs: { class: 'option-row-art' } })
    : artWell({ glyph: row.artGlyph || 'cards', small: true, attrs: { class: 'option-row-art' } });
  hideOnError(well.querySelector?.('img'));
  return well;
}

/**
 * optionRowList(rows, { idAttr, onSelect, selectedId }) -> the list element.
 * `rows`: { id, name, line?, html?, text?, costs?, artAsset?, artGlyph?, chip?, disabled?, className? }
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
      row.chip ? el('span', { class: 'option-row-chip', text: row.chip }) : null,
    ]);
    if (row.disabled) { item.disabled = true; item.setAttribute('aria-disabled', 'true'); }
    item.addEventListener('click', () => { if (!item.disabled) onSelect?.(row.id, item); });
    return item;
  });
  const list = el('div', { class: 'option-row-list', role: 'group' }, items);
  list.addEventListener('keydown', event => {
    const step = ARROWS[event.key];
    if (!step) return;
    const live = items.filter(item => !item.disabled);
    const at = live.indexOf(event.target?.closest?.('.option-row') ?? event.target);
    if (at < 0) return;
    event.preventDefault?.();
    live[(at + step + live.length) % live.length].focus?.({ preventScroll: true });
  });
  return list;
}

/** markOptionRows(list, idAttr, ids) -> sets aria-pressed on every row whose id is in `ids`. */
export function markOptionRows(list, idAttr, ids) {
  for (const item of list.querySelectorAll(`[${idAttr}]`)) item.setAttribute('aria-pressed', String(ids.includes(item.getAttribute(idAttr))));
}
