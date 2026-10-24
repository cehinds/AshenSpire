// src/content/progression/unlocks.js — the authored unlock rows are in
// content/source/progressionUnlockRows.json; content-build compiles it to
// src/content/generated/progressionUnlockRows.js. Edit the JSON, not this file.
// Existing families rescheduled by the approved expansion catalog.
// Item gates derive from the single gear requirements table.
// Stays JS: the weapon and armament gate rows are derived from gear.js and the
// ARMAMENTS table (a piece is a 'weapon' or an 'armament'), appended after the JSON rows.
import { ARMAMENTS } from '../equipment.js';
import { progressionGearRequirements } from './gear.js';
import { progressionUnlockRows } from '../generated/progressionUnlockRows.js';
export const progressionUnlocks = progressionUnlockRows.concat(progressionGearRequirements.filter(row => row.level > 0).map(({classId,level,ref}) => ({classId,level,ref,kind:ref.startsWith('armament/') && ARMAMENTS.find(piece => piece.id === ref.slice(9))?.kind === 'weapon' ? 'weapon' : 'armament'})));
