// D15 (FixCore): equipment and deck editing happen outside combat only, and the Armoury announces new finds.
// Core carries `editorWhere: "noncombat"` on its cards module; Current keeps "strategize" and is unchanged.
import { gameModule } from './gameProfile.js';
import { carriedIds } from './loadout.js';

export const noncombatEditing = run => !!run && gameModule(run, 'cards')?.editorWhere === 'noncombat';
/** True while Core forbids deck and equipment changes: any fight that has not resolved (a pending reaction is still a fight). */
export const editingLocked = (run, combat) => noncombatEditing(run) && !!combat && !combat.result;

// `run.armorySeen` holds the carried item ids the player has already looked at in the Armoury. A run without the field
// (a new run, an older save) starts with everything it carries seen, so only later finds glow.
export function newArmouryItems(run) {
  if (!run?.loadout) return [];
  if (!Array.isArray(run.armorySeen)) { run.armorySeen = carriedIds(run.loadout); return []; }
  const seen = new Set(run.armorySeen);
  return carriedIds(run.loadout).filter(id => !seen.has(id));
}
export const armouryHasNew = run => noncombatEditing(run) && newArmouryItems(run).length > 0;
export function markArmourySeen(run) { if (run?.loadout) run.armorySeen = carriedIds(run.loadout); }
/** Core opens the deck editor from the Armoury at will, unless the cards module disables manual editing. */
export const profileOpensDeckEditor = run => noncombatEditing(run) && gameModule(run, 'cards')?.editorEnabled !== false;
