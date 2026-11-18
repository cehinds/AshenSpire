// Class-themed equipment picks (owner, 2026-11-18, ruling 15): every weapon and armour piece can be found and used by any class; when a reward, shop
// or armament offer picks an item, each pick comes from the class-themed items 75% of the time and from the whole pool 25% of the time. Each pick rolls
// separately, and a class with no themed item left falls back to the whole pool. Themes are data (equipmentTypes.json `themes`, `themedPercent`).
import { GEAR_TYPES } from '../content/gearTypes.js';
import { GearWeaponTypeOf, GearArmourGroupOf } from './gearEffects.js';

/** True when a weapon or armour row belongs to the class's theme (its type or group is listed for the class). */
export function ItemIsThemed(row, classId, kind) {
  const theme = GEAR_TYPES.themes[classId];
  if (!theme || !row) return false;
  return kind === 'armor' ? theme.armourGroups.includes(GearArmourGroupOf(row)) : theme.weaponTypes.includes(GearWeaponTypeOf(row));
}

/**
 * ThemedItemPick(rng, stream, ids, { classId, kind, rowOf }) -> one id from `ids`: a themed one 75% of the time (when any is left), else any.
 * One `rng.int` roll per pick, then one `rng.pick`, so a replay of the offer's stream reads the same.
 */
export function ThemedItemPick(rng, stream, ids, { classId, kind, rowOf }) {
  if (!ids.length) return null;
  const themed = ids.filter(id => ItemIsThemed(rowOf(id), classId, kind));
  const roll = rng.int(stream, 1, 100);
  return rng.pick(stream, roll <= GEAR_TYPES.themedPercent && themed.length ? themed : ids);
}
