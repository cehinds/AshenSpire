// Pure model for the Armoury equip-picker table (Item / Status / Actions).
// It groups and sorts candidate rows for one equipment position. No UI here:
// fit comes from fitsSlot() in loadout.js, the only predicate for it.
import { fitsSlot } from './loadout.js';

export const EQUIP_PICKER_CATEGORIES = Object.freeze(['Armour', 'Weapon', 'Shield', 'Staff', 'Armament']);
export const EQUIP_PICKER_STATUS_ORDER = Object.freeze({ here: 0, free: 1, elsewhere: 2, nofit: 3 });

/**
 * equipPickerTableRows(rows, slot, { setIndex, loadout }) → frozen array of
 * frozen picker rows for one equipment position.
 *
 * Only equipable categories are kept, in input order. `status` is 'nofit' when
 * the slot will not take the item, 'here' when this position already holds it,
 * 'elsewhere' when another position holds it, and 'free' otherwise.
 */
export function equipPickerTableRows(rows, slot, { setIndex, loadout } = {}) {
  if (!slot || !Number.isInteger(setIndex) || setIndex < 0) {
    throw new Error('equipPickerTableRows requires a slot and an integer setIndex');
  }
  const sets = (loadout && loadout.sets) || {};
  const out = [];
  for (const row of (rows || [])) {
    if (!row || !row.item || !EQUIP_PICKER_CATEGORIES.includes(row.category)) continue;
    const fits = fitsSlot(slot, row.item);
    const here = (sets[slot.id] || [])[setIndex] === row.id;
    const elsewhere = [];
    for (const [slotId, list] of Object.entries(sets)) {
      if (!Array.isArray(list)) continue;
      list.forEach((value, index) => {
        if (value !== row.id) return;
        if (slotId === slot.id && index === setIndex) return;
        elsewhere.push(Object.freeze({ slotId, setIndex: index }));
      });
    }
    const status = !fits ? 'nofit' : here ? 'here' : elsewhere.length ? 'elsewhere' : 'free';
    const reason = fits ? null : !(slot.kinds || []).includes(row.item.kind) ? 'kind' : 'hand';
    out.push(Object.freeze({
      key: row.key,
      id: row.id,
      name: row.name,
      category: row.category,
      row,
      fits,
      status,
      elsewhere: Object.freeze(elsewhere),
      reason,
    }));
  }
  return Object.freeze(out);
}

/**
 * sortEquipPickerRows(tableRows, { column, direction }) → new frozen array.
 * Never mutates the input. `status` sorts by EQUIP_PICKER_STATUS_ORDER with the
 * name as tie-break; `name` sorts by name with status as tie-break. `desc`
 * negates the whole comparator. Array sort is stable, so ties keep input order.
 */
export function sortEquipPickerRows(tableRows, { column = 'status', direction = 'asc' } = {}) {
  if (column !== 'status' && column !== 'name') {
    throw new Error(`sortEquipPickerRows: unknown column '${column}'`);
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw new Error(`sortEquipPickerRows: unknown direction '${direction}'`);
  }
  const byStatus = (a, b) => EQUIP_PICKER_STATUS_ORDER[a.status] - EQUIP_PICKER_STATUS_ORDER[b.status];
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const primary = column === 'status'
    ? (a, b) => byStatus(a, b) || byName(a, b)
    : (a, b) => byName(a, b) || byStatus(a, b);
  const sign = direction === 'desc' ? -1 : 1;
  return Object.freeze([...(tableRows || [])].sort((a, b) => sign * primary(a, b)));
}
