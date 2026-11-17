// What lowers a run's deck minimum (owner, 2026-11-17, playtest items 22-23).
// A leaf, so the deck editor (model/deckRules.js) and the Armoury floor
// (model/loadout/equipChange.js) read one rule without importing each other.
import { deckRules } from '../content/deckRules.js';
import { isCoreProfile } from './gameProfile.js';
import { ItemMinDeckDelta } from './itemProperties.js';

/**
 * LevelMinDeckDelta(run) → how many cards a Core run's character level takes
 * off the editor's minimum: 1 for each level in
 * `deckRules.minimumReductionLevels` the run has reached. Other profiles: 0.
 */
export function LevelMinDeckDelta(run) {
  if (!isCoreProfile(run)) return 0;
  const level = Number.isInteger(run?.level?.level) ? run.level.level : 1;
  return deckRules.minimumReductionLevels.filter((at) => level >= at).length;
}

/** DeckMinDelta(run) → everything that lowers this run's minimum: held items and relics, then level. */
export function DeckMinDelta(run) {
  return ItemMinDeckDelta(run) + LevelMinDeckDelta(run);
}

/** SettingsDeckMinimum(settings) → the player's own minimum: 0 when unlimited, else `deckMinSize` (its default when unset or invalid). */
export function SettingsDeckMinimum(settings = {}) {
  const read = (key) => (settings && settings[key] !== undefined && settings[key] !== null ? settings[key] : deckRules.defaults[key]);
  if (read('deckMinUnlimited')) return 0;
  const size = read('deckMinSize');
  return Number.isInteger(size) && size >= 0 ? size : deckRules.defaults.deckMinSize;
}

/**
 * ReducedDeckMinimum(minimum, delta) → a minimum less its reductions, never below the hard
 * safety floor `deckRules.minimumReductionSafetyFloor` (1: a deck is never empty) — nor above
 * the player's own setting when that is lower. The deck editor and the Armoury both ask it.
 */
export function ReducedDeckMinimum(minimum, delta) {
  return Math.max(Math.min(minimum, deckRules.minimumReductionSafetyFloor), minimum - delta, 0);
}

/** CoreDeckMinimum(run, settings) → Core's one minimum: the player's setting less this run's reductions. */
export function CoreDeckMinimum(run, settings = {}) {
  return ReducedDeckMinimum(SettingsDeckMinimum(settings), DeckMinDelta(run));
}
