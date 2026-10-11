// Pure model for the Armoury equip-picker table (Item / Status / Actions).
// It groups and sorts candidate rows for one equipment position. No UI here:
// fit comes from fitsSlot() in loadout.js, the only predicate for it.
import { fitsSlot, pieceHand, slotHand } from './loadout.js';

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
