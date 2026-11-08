// src/model/weaponRange.js — a weapon's default range. Moved out of src/content/equipment.js
// (CODE-REVIEW-DEV-2026-11-06 M6) so content no longer imports the model's range vocabulary.
import { RANGES } from './combatRanges.js';

/** The closed range vocabulary every weapons.csv row states (src/model/combatRanges.js; tools/content-build.mjs refuses any other). */
export const WEAPON_RANGES = RANGES;

/**
 * A weapon's default range, `melee` | `reach` | `ranged`. Read off the def the
 * build compiled; an unstated or unknown range throws rather than defaulting.
 */
export function weaponRangeOf(weaponDef) {
  const range = weaponDef?.range;
  if (!WEAPON_RANGES.includes(range)) {
    throw new Error(`weaponRangeOf: '${weaponDef?.id}' states range '${range ?? ''}', not one of ${WEAPON_RANGES.join('|')}`);
  }
  return range;
}
