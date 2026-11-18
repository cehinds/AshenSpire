// @ts-check
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
import { cardArtLayersHtml, bindCardComponentFailures } from '../cardArtLayers.js';
import { effectLine } from './cardOptionGrid.js';
import { MarkSelected, RovingList } from '../selection.js';

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
    // A cutout that fails to load fires the base image's error (hidden and marked by hideOnError).
    const base = well.querySelector?.('img');
    if (base && well.querySelectorAll) bindCardComponentFailures(well, base);
  }
  return well;
}

/**
 * optionRowList(rows, { idAttr, onSelect, selectedId }) -> the list element.
 * `rows`: { id, name, line?, html?, text?, costs?, artAsset?, artGlyph?, chip?, count? (a "×N" chip for identical options shown once), disabled?, className?, detail? }
 * (a summarizeCardOption result plus the art and chip the caller adds). `detail` is a node drawn directly UNDER its
 * row (the before -> after card faces of an upgrade): the row gets aria-expanded and the node a full-width cell.
 * `columns` forces the column count (1 keeps a long list a single column, so a detail sits under its own row).
 * @type {import('../contracts.js').PickerRender}
 */
export function optionRowList(rows, { onSelect = null, selectedId = null, idAttr = 'data-option', columns: forcedColumns = null } = {}) {
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
    if (row.detail) item.setAttribute('aria-expanded', 'true');
    if (row.disabled) { item.disabled = true; item.setAttribute('aria-disabled', 'true'); }
    item.addEventListener('click', () => { if (!item.disabled) onSelect?.(row.id, item); });
    return item;
  });
  const columns = forcedColumns || optionColumns(rows.length);
  const cells = items.flatMap((item, index) => (rows[index].detail ? [item, el('div', { class: 'option-row-detail', role: 'region', [`${idAttr}-detail`]: rows[index].id }, rows[index].detail)] : [item]));
  const list = el('div', { class: 'option-row-list', role: 'group', 'data-columns': String(columns) }, cells);
  list.style?.setProperty?.('--option-columns', String(columns));
  RovingList(list, { items: () => items.filter(item => !item.disabled), columns });
  return list;
}

/**
 * markOptionRows(list, idAttr, ids) -> sets aria-pressed on every row whose id is in `ids`.
 * @type {import('../contracts.js').PickerMark}
 */
export function markOptionRows(list, idAttr, ids) {
  MarkSelected(list.querySelectorAll(`[${idAttr}]`), item => ids.includes(item.getAttribute(idAttr)), { className: null });
}
