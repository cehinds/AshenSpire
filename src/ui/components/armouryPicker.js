// src/ui/components/armouryPicker.js — the Armoury's equip picker, extracted from
// mountEquipment (screens/equipment.js) so it can be built and tested alone.
// While a position is picked: the candidates as an Item / Status / Actions
// table. Behaviour and rendered DOM are unchanged.
import { armourMenuAsset } from '../../model/paintedOutfitArt.js';
import { armamentIconAsset } from '../../model/equipmentArt.js';
import { assetUrl } from '../assetmap.js';
import { equipPickerTableRows, sortEquipPickerRows } from '../../model/equipPickerTable.js';
import { refuses } from './refusal.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { t } from '../strings.js';
import { el, flavour, pill, button } from '../kit/index.js';

/**
 * A piece's thumbnail. Armaments have a tight icon render; an armour set's
 * "icon" is the set itself — the body in its own palette — because there is no
 * separate object to photograph.
 */
export function thumbSrc(piece) {
  return piece.kind === 'armor'
    ? assetUrl(armourMenuAsset(piece.classId, piece.id))
    : assetUrl(armamentIconAsset(piece));
}

/**
 * @typedef {object} ArmouryPickerCtx
 * @property {object} run  The run (`run.loadout` is read at draw time).
 * @property {object} eq  `registries.equipment` (its slots name the destinations).
 * @property {HTMLElement} wrap  The Armoury overlay (a redraw's focus is put back inside it).
 * @property {() => void} draw  Redraws the Armoury.
 * @property {(plan: object|null) => void} setFooterPrimary  Fills the footer's primary slot.
 * @property {(item: object, category: string, opts: object) => void} openItemInspection  Opens an item's card.
 * @property {(slotId: string, setIndex: number, pieceId: string, label: string) => void} requestEquip  Starts an equip.
 * @property {() => {slotId: string, setIndex: number}} getPicking  The position being picked.
 * @property {() => {column: string, direction: string}} getPickerSort  The table's sort.
 * @property {(sort: {column: string, direction: string}) => void} setPickerSort
 * @property {() => boolean} getPickerShowAll  Whether rows that do not fit are listed.
 * @property {(showAll: boolean) => void} setPickerShowAll
 */

/**
 * @param {ArmouryPickerCtx} ctx
 * @param {{selectedSlot: object, allRows: Array, pickerParts: Map, footerPlans: *, draggableRows: Map, attachInventoryDrag: Function}} args
 */
export function armouryPickerTable(ctx, { selectedSlot, allRows, pickerParts, footerPlans, draggableRows, attachInventoryDrag }) {
  const {
    run, eq, wrap, draw, setFooterPrimary, openItemInspection, requestEquip,
    getPicking, getPickerSort, setPickerSort, getPickerShowAll, setPickerShowAll,
  } = ctx;
  // Read live: the closure's cells change between draws, never within this call.
  const picking = getPicking();
  const pickerSort = getPickerSort();
  const pickerShowAll = getPickerShowAll();
  // A redraw replaces every control; put keyboard focus back on the one pressed.
  const redrawFocus = (selector) => { draw(); wrap.querySelector(selector)?.focus({ preventScroll: true }); };
  const all = sortEquipPickerRows(equipPickerTableRows(allRows, selectedSlot, { setIndex: picking.setIndex, loadout: run.loadout }), pickerSort);
  const shown = pickerShowAll ? all : all.filter((r) => r.fits);
  const slotLabel = (id) => (eq.slots || []).find((s) => s.id === id)?.label || id;
  const root = el('div', { class: 'equip-picker', dataset: { component: UI.armouryEquipPickerTable } });
  const filter = button({
    label: pickerShowAll ? t('armoury.picker.fitsOnly') : t('armoury.picker.showAll'),
    className: 'equip-picker-filter',
    attrs: { 'aria-pressed': String(pickerShowAll) },
  });
  filter.addEventListener('click', () => { setPickerShowAll(!getPickerShowAll()); redrawFocus('.equip-picker-filter'); });
  root.append(filter);
  if (!shown.length) {
    root.append(flavour(`Nothing in Inventory fits ${selectedSlot.label}.`, { class: 'ep-hint' }));
    setFooterPrimary(null);
    return root;
  }
  const sortHead = (key, label) => {
    const active = pickerSort.column === key;
    const sortButton = el('button', { type: 'button', class: 'equip-picker-sort', dataset: { sort: key } }, [label]);
    sortButton.addEventListener('click', () => {
      // A redraw makes a fresh table, so read the current sort at the click.
      const current = getPickerSort();
      setPickerSort(current.column === key
        ? { column: key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column: key, direction: 'asc' });
      redrawFocus(`.equip-picker-sort[data-sort="${key}"]`);
    });
    return el('th', { role: 'columnheader', 'aria-sort': active ? (pickerSort.direction === 'asc' ? 'ascending' : 'descending') : 'none' }, [sortButton]);
  };
  const thead = el('thead', { role: 'rowgroup' }, [el('tr', { role: 'row' }, [
    sortHead('name', t('armoury.picker.col.item')),
    sortHead('status', t('armoury.picker.col.status')),
    el('th', { role: 'columnheader' }, [el('span', { class: 'sr-only' }, [t('armoury.picker.col.actions')])]),
  ])]);
  const tbody = el('tbody', { role: 'rowgroup' });
  for (const r of shown) {
    const parts = pickerParts.get(r.key);
    const first = r.elsewhere[0];
    const metaBits = [r.category];
    if (r.status === 'nofit') metaBits.push(t(r.reason === 'kind' ? 'armoury.picker.reason.kind' : 'armoury.picker.reason.hand', { slot: selectedSlot.label }));
    if (r.status === 'elsewhere' && r.row.count === 1) metaBits.push(t('armoury.picker.onlyCopy', { slot: slotLabel(first.slotId), n: first.setIndex + 1 }));
    const statusLabel = r.status === 'elsewhere'
      ? t('armoury.picker.status.elsewhere', { slot: slotLabel(first.slotId), n: first.setIndex + 1 })
      : t(`armoury.picker.status.${r.status}`, {});
    const img = el('img', { class: 'equip-picker-thumb', src: thumbSrc(r.row.item), alt: '', loading: 'lazy', decoding: 'async' });
    // The cell stays a table cell; its flex layout lives on an inner wrapper.
    // Phones drop the Status column, so the pill also rides under the name.
    const statusPill = () => pill({ label: statusLabel, attrs: { class: `equip-picker-pill is-${r.status}` } });
    const itemCell = el('td', { role: 'cell' }, [el('div', { class: 'equip-picker-item' }, [img, el('div', {}, [
      el('strong', { class: 'equip-picker-name' }, [r.name]),
      el('span', { class: 'equip-picker-meta' }, [metaBits.join(' · ')]),
      el('span', { class: 'equip-picker-inline-status' }, [statusPill()]),
    ])])]);
    const statusCell = el('td', { role: 'cell', class: 'equip-picker-status' }, [statusPill()]);
    const inspect = button({
      label: t('armoury.action.inspect'),
      className: 'equip-picker-inspect',
      attrs: { 'aria-haspopup': 'dialog' },
    });
    inspect.addEventListener('click', () => openItemInspection(r.row.item, r.row.category, { owned: r.row.count, opener: inspect }));
    const actions = [inspect];
    if (r.fits && parts?.target) {
      const target = parts.target;
      // The row already names the slot, so its button is the short verb;
      // the full destination stays in the accessible name.
      const act = button({
        label: t(`armoury.picker.act.${target.kind}`),
        weight: target.kind === 'unequip' ? 'danger' : 'primary',
        className: 'equip-picker-act',
        attrs: { 'aria-label': parts.actionLabel, title: parts.actionLabel },
      });
      act.dataset.act = target.kind;
      if (!parts.seal.ok) { act.disabled = true; refuses(act, () => parts.seal.reason); }
      else if (!parts.transition.ok) { act.disabled = true; refuses(act, () => parts.transition.reason); }
      else act.addEventListener('click', () => requestEquip(target.slot.id, target.setIndex, target.pieceId, parts.actionLabel));
      actions.push(act);
    }
    const actionsCell = el('td', { role: 'cell' }, [el('div', { class: 'equip-picker-actions' }, actions)]);
    // Buttons are taps, not drag handles: keep the row's pointer capture off them.
    actionsCell.addEventListener('pointerdown', (event) => event.stopPropagation());
    const tr = el('tr', { role: 'row',
      class: `equip-picker-row is-${r.status}`,
      dataset: { itemId: r.id, rowKey: r.key, status: r.status },
    }, [itemCell, statusCell, actionsCell]);
    // Mouse and pen users can still drag a row onto any named position.
    const draggableRow = draggableRows.get(r.key);
    if (draggableRow) attachInventoryDrag(tr, draggableRow);
    tbody.append(tr);
  }
  setFooterPrimary(null);
  root.append(el('table', { role: 'table', class: 'equip-picker-table' }, [
    el('caption', { class: 'sr-only' }, [t('armoury.picker.caption', { slot: `${selectedSlot.label} · ${picking.setIndex + 1}` })]),
    thead,
    tbody,
  ]));
  return root;
}
