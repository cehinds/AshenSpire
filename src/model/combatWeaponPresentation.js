import { selectedWeaponProfileFor } from './selectedWeaponStances.js';
import { classSmashProfileFor } from './classSmashAnimations.js';

// Temporary presentation policy: retain authored weapon families for later use,
// but combat paints the class's default weapons regardless of active hands.
// Equipment still owns card prices, damage, effects and loadout eligibility.
export const DEFAULT_COMBAT_WEAPONS = true;
const starterHands = {
  reaver: {mode:'one',right:'greatsword',left:null},
  rogue: {mode:'one',right:'dagger',left:'buckler'},
  starseer: {mode:'one',right:'ashStaff',left:null},
  herald: {mode:'one',right:'boneSceptre',left:null},
};

export function combatWeaponProfilesFor({classId,armourId,grip,appearance = 'alternative'} = {}) {
  if (appearance !== 'alternative') return {weaponProfile:null,smashProfile:null};
  const presentation = {classId,armourId:DEFAULT_COMBAT_WEAPONS ? 'default' : armourId,
    grip:DEFAULT_COMBAT_WEAPONS ? starterHands[classId] : grip};
  return {weaponProfile:selectedWeaponProfileFor(presentation),smashProfile:classSmashProfileFor(presentation)};
}
