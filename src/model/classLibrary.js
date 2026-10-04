// A run owns reusable class cards. run.class remains the last class identity
// for legacy stat/armour readers; classUnequipped explicitly empties its core.
import { swapRunClass } from './classSwap.js';
import { syncZones } from './state.js';
import { stampDeck } from './loadout.js';
import { learnedClassIds as learnedClassIds_ } from './classLibraryState.js';
export const learnedClassIds = learnedClassIds_;

export function equipClassCard(registries, run, classId, { inCombat = false } = {}) {
  if (inCombat || run.combatEntered) throw new Error('Class cards can only change outside combat.');
  if (run.pendingReward) throw new Error('Finish the pending reward before changing class cards.');
  if (classId !== null && (!registries.classes.has(classId) || !learnedClassIds(run).includes(classId))) throw new Error('Learn this class before equipping it.');
  const current = { coreTags: [...(run.coreTags || [])], armour: [...(run.loadout?.sets?.armor || [])], activeArmour: run.loadout?.active?.armor || 0 };
  const cards = { ...run.classCards, [run.class]: current };
  if (classId === null) {
    run.classCards = cards;
    run.classUnequipped = true;
    syncZones(run);
    return;
  }
  if (classId !== run.class) {
    const target = cards[classId];
    swapRunClass(registries, run, classId, { preserveProgress: true });
    run.coreTags = [...(target?.coreTags || [])];
    // Armour ownership survives a class being set aside. Its ordinary equip
    // rules still determine which set the active class can wear.
    if (target?.armour && run.loadout) {
      run.loadout.sets.armor = [...target.armour];
      run.loadout.active.armor = target.activeArmour || 0;
    }
  }
  run.classCards = cards;
  run.classUnequipped = false;
  if (run.attributes && run.loadout) stampDeck(registries, run);
  syncZones(run);
}
