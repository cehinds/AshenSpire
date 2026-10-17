// A deterministic real-input route: seed 4, initial Shrine, then the leftmost
// unknown node. Its pre-rolled outcome is a fight (checked against live models).
export const CORE_ENTRY_SEED = '4';
export const CORE_INPUT_ALLOWANCE = Object.freeze({ startup: 1, saveSlot: 3, creation: 3, seedEntry: 3, entryRest: 3, firstEncounter: 2, firstCombat: 3 });
export const CORE_INPUT_BUDGET = Object.values(CORE_INPUT_ALLOWANCE).reduce((sum, value) => sum + value, 0);
