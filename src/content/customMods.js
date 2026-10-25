// src/content/customMods.js — Custom Climb modifiers. The label/description
// tables are authored in content/source/customMods.json (the three groups, the
// Ascension ladder and how main.js reads them are in content/source/CONTENT-NOTES.md,
// "Custom Climb modifiers"); content-build compiles it to
// src/content/generated/customMods.js. Edit the JSON; this file keeps the
// functions and the endless constants.
//
// Tuning magnitudes live in balance.js (balance.endless / balance.customMods);
// the endless constants below re-export from there so there is one source.

import { balance } from './balance.js';
import { customMods } from './generated/customMods.js';

export const DIFFICULTY_MODS = customMods.difficultyMods;
export const CHAOS_MODS = customMods.chaosMods;
export const DECK_MODES = customMods.deckModes;

// Ascension enables the first N difficulty rules (hardest impact first).
export const ASCENSION_ORDER = customMods.ascensionOrder;
export const MAX_ASCENSION = ASCENSION_ORDER.length;

// True when a run carries any non-default rule (so it is flagged + excluded
// from win-rate telemetry).
export function isCustomRun(custom) {
  if (!custom) return false;
  if (custom.ascension > 0) return true;
  if (custom.deckMode && custom.deckMode !== 'standard') return true;
  // A run whose map was capped or re-weighted is not the game the win rate is
  // about. Missing this line would have let a deliberately-shortened debug run
  // count as a win against the real climb — the whole point of the flag.
  if (custom.mapShape && Object.keys(custom.mapShape).length) return true;
  // A pinned first seat (SPEC §13.4) is a chosen climb, not the seeded one.
  if (custom.firstSeat) return true;
  return !!(custom.mods && Object.values(custom.mods).some(Boolean));
}

// ---- Endless Spire -----------------------------------------------------------
// Acts beyond 3 reuse the content of act ((n-1) % 3) + 1; `loop` counts
// completed 3-act cycles (0 on the first pass) and drives per-cycle scaling.
// Pure math so main.js, runsim, and tests all agree on the same numbers.
export const ENDLESS_HP_PER_LOOP = balance.endless.hpPerLoop;
export const ENDLESS_STR_PER_LOOP = balance.endless.strPerLoop;

export function endlessActInfo(actNumber) {
  const per = balance.endless.actsPerCycle;
  return { contentAct: ((actNumber - 1) % per) + 1, loop: Math.floor((actNumber - 1) / per) };
}

// Resolve the effective active-mod set: explicit toggles OR ascension-enabled.
export function activeMods(custom) {
  const out = { ...((custom && custom.mods) || {}) };
  const asc = (custom && custom.ascension) || 0;
  for (let i = 0; i < asc && i < ASCENSION_ORDER.length; i++) out[ASCENSION_ORDER[i]] = true;
  return out;
}
