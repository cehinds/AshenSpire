import { PROLOGUE_DEFAULTS, prologueSequence } from '../src/model/prologue.js';
// A deterministic real-input route: seed 4, then the leftmost depth-1 node. The first dungeon node is a fight
// (routes.firstFloor, owner 2026-10-18), so there is no entry Shrine step: entryRest is 0 (the key
// stays so the breakdown reads the same). Every enabled opening scene gets a counted
// Continue. The second depth is not walked by this route.
export const CORE_ENTRY_SEED = '4';
export const CORE_INPUT_ALLOWANCE = Object.freeze({ startup: 1, saveSlot: 3, creation: 3, seedEntry: 3, entryRest: 0, opening: prologueSequence(PROLOGUE_DEFAULTS).length, firstEncounter: 2, firstCombat: 3 });
export const CORE_INPUT_BUDGET = Object.values(CORE_INPUT_ALLOWANCE).reduce((sum, value) => sum + value, 0);
