// src/model/combatRounds.js — the Combat Rounds Preview's rules (SPEC §4.11).
//
// Pure model: settings in, frozen rules out. The one switch is an Advanced →
// Combat row whose key is a `gameConfig.` key, so New Run freezes it into
// `run.advancedConfigSnapshot.overrides` like every other Advanced row. The
// fight reads the frozen overrides, never the live settings, at its door
// (engine/runCombat.js), so a later change applies to new runs only, and a
// run born before the row existed reads it as off.
//
// The row is debug-only: its group, Combat, is not in RELEASE_ADVANCED_GROUP_IDS
// (ui/screens/settings.js), so a release build never draws it.

import { EVADE_BONUS_CSV, EVASION_ARMOR_CSV, EVASION_CARDS_CSV, STANCE_ADVANTAGE_CSV } from '../content/combatRounds.js';
import { parseEvadeBonus, parseEvasionArmor, parseEvasionCards, parseStanceAdvantage } from '../engine/combatRounds/resolver.js';

export const COMBAT_ROUNDS_KEY = 'gameConfig.combatRounds.preview';
// Two more independent toggles in the same group (owner, 2026-10-12). Both are off by default and frozen at
// New Run like the first. Momentum also runs in normal combat; the multi-action preview shows an enemy's
// planned moves in normal combat. In rounds mode each follows its own toggle.
export const MOMENTUM_KEY = 'gameConfig.combatRounds.momentum';
export const MULTI_ACTION_KEY = 'gameConfig.combatRounds.multiAction';
export const COMBAT_ROUNDS_VERSION = 1;
// The label and the note are rows of content/source/uiStrings.csv; the settings
// screen resolves `uiTextId` (ui/screens/settings.js).
export const COMBAT_ROUNDS_TEXT_ID = 'settings.row.combatRoundsPreview';

/** combatRoundsRows() → the Advanced → Combat rows for the preview toggles (all off by default). */
export function combatRoundsRows() {
  return [{
    cat: 'Advanced', advancedGroup: 'Combat', key: COMBAT_ROUNDS_KEY, def: false,
    label: 'Combat rounds preview', note: '', uiTextId: COMBAT_ROUNDS_TEXT_ID,
  }, {
    cat: 'Advanced', advancedGroup: 'Combat', key: MOMENTUM_KEY, def: false,
    label: 'Momentum', note: '',
  }, {
    cat: 'Advanced', advancedGroup: 'Combat', key: MULTI_ACTION_KEY, def: false,
    label: 'Multi-action preview', note: '',
  }];
}

// The tables are parsed once with the engine's own parsers. Maps are copied
// into plain frozen objects so the rules survive a JSON save unchanged.
function plain(map) {
  return Object.freeze(Object.fromEntries([...map].map(([key, value]) => [key, Object.freeze(typeof value === 'object' ? { ...value } : value)])));
}

let TABLES = null;
function tables() {
  if (!TABLES) {
    TABLES = Object.freeze({
      evadeBonus: plain(parseEvadeBonus(EVADE_BONUS_CSV)),
      evasionArmor: plain(parseEvasionArmor(EVASION_ARMOR_CSV)),
      evasionCards: plain(parseEvasionCards(EVASION_CARDS_CSV)),
      stanceAdvantage: plain(parseStanceAdvantage(STANCE_ADVANTAGE_CSV)),
    });
  }
  return TABLES;
}

/**
 * combatRoundsFor(settings) → the frozen preview rules a fight is built with,
 * or null when the rounds mode is off (the default). Pass the run's frozen
 * overrides, not the live settings: a fight never reads a setting it did not
 * inherit at New Run. `momentum` and `followUps` are the other two toggles: with
 * momentum off the rounds engine keeps every enemy at 0 (SPEC §4.11).
 */
export function combatRoundsFor(settings) {
  if (!settings || settings[COMBAT_ROUNDS_KEY] !== true) return null;
  return Object.freeze({
    version: COMBAT_ROUNDS_VERSION, merge: 'speed', decay: 1, tables: tables(),
    momentum: settings[MOMENTUM_KEY] === true,
    followUps: settings[MULTI_ACTION_KEY] === true,
  });
}

/**
 * normalPreviewFor(settings) → the frozen toggles a NORMAL fight is built with (rounds mode off): { momentum,
 * multiAction }, or null when neither toggle is on (the default). With rounds mode on it is null, because the
 * rounds rules carry both toggles (combatRoundsFor).
 */
export function normalPreviewFor(settings) {
  if (!settings || settings[COMBAT_ROUNDS_KEY] === true) return null;
  const momentum = settings[MOMENTUM_KEY] === true;
  const multiAction = settings[MULTI_ACTION_KEY] === true;
  if (!momentum && !multiAction) return null;
  return Object.freeze({ momentum, multiAction });
}
