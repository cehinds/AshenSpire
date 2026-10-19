// D15 (FixCore): equipment and deck editing happen outside combat only, and the Armoury announces new finds.
// Core carries `editorWhere: "noncombat"` on its cards module; Current keeps "strategize" and is unchanged.
import { gameModule } from './gameProfile.js';
import { carriedIds } from './loadout.js';
import { deckEditingOn } from './deckRules.js';

export const noncombatEditing = run => !!run && gameModule(run, 'cards')?.editorWhere === 'noncombat';
/** True while Core forbids deck and equipment changes: any fight that has not resolved (a pending reaction is still a fight). */
export const editingLocked = (run, combat) => noncombatEditing(run) && !!combat && !combat.result;

// `run.armorySeen` holds the carried item ids and class-qualified bought/reward armour refs the player has already looked at
// in the Armoury. A run without the field (a new run, an older save) starts with everything it carries seen, so only later
// finds glow. A save from before armour refs were tracked has no ARMOUR_MARK and has its current armour marked seen once.
const ARMOUR_MARK = '@armour';
const armourRefs = run => (Array.isArray(run.loadout?.boughtArmour) ? run.loadout.boughtArmour : [])
  .filter(row => row && row.id).map(row => `armour:${row.classId}/${row.id}`);
const snapshot = run => [...carriedIds(run.loadout), ...armourRefs(run), ARMOUR_MARK];
export function newArmouryItems(run) {
  if (!run?.loadout) return [];
  if (!Array.isArray(run.armorySeen)) { run.armorySeen = snapshot(run); return []; }
  if (!run.armorySeen.includes(ARMOUR_MARK)) run.armorySeen = [...run.armorySeen, ...armourRefs(run), ARMOUR_MARK];
  const seen = new Set(run.armorySeen);
  return [...carriedIds(run.loadout), ...armourRefs(run)].filter(id => !seen.has(id));
}
export const armouryHasNew = run => noncombatEditing(run) && newArmouryItems(run).length > 0;
export function markArmourySeen(run) { if (run?.loadout) run.armorySeen = snapshot(run); }
/** Core opens the deck editor from the Armoury at will, unless the cards module disables manual editing. */
export const profileOpensDeckEditor = run => noncombatEditing(run) && gameModule(run, 'cards')?.editorEnabled !== false;
/** The one predicate for 'the Armoury opens the deck editor': the profile allows it and the player's Deck editing setting is on. */
export const armouryOpensDeckEditor = (run, settings) => profileOpensDeckEditor(run) && deckEditingOn(settings);
