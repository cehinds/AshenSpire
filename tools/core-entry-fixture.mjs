// The real-input route: New Game (a fresh profile skips the slot picker), Begin on the Class step, any key to
// skip the opening, Enter on the preselected start node, then the first fight. It no longer types a seed (the
// seed field is on the optional Review step); CORE_ENTRY_SEED stays as the seed the map fixture is checked
// against. The first dungeon node is a fight
// (routes.firstFloor, owner 2026-10-18), so there is no entry Shrine step: entryRest is 0 (the key
// stays so the breakdown reads the same). The opening costs one counted key whatever its scene count
// (way-in, 2026-11-14). The second depth is not walked by this route.
export const CORE_ENTRY_SEED = '4';
export const CORE_INPUT_ALLOWANCE = Object.freeze({ startup: 1, saveSlot: 1, creation: 1, seedEntry: 0, entryRest: 0, opening: 1, firstEncounter: 1, firstCombat: 3 });
export const CORE_INPUT_BUDGET = Object.values(CORE_INPUT_ALLOWANCE).reduce((sum, value) => sum + value, 0);
