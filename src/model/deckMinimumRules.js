// What lowers a run's deck minimum (owner, 2026-11-17, playtest items 22-23).
// A leaf, so the deck editor (model/deckRules.js) and the Armoury floor
// (model/loadout/equipChange.js) read one rule without importing each other.
import { deckRules } from '../content/deckRules.js';
import { isCoreProfile } from './gameProfile.js';
import { ItemMinDeckDelta } from './itemProperties.js';

/**
 * levelMinDeckDelta(run) → how many cards a Core run's character level takes
 * off the editor's minimum: 1 for each level in
 * `deckRules.minimumReductionLevels` the run has reached. Other profiles: 0.
 */
export function levelMinDeckDelta(run) {
  if (!isCoreProfile(run)) return 0;
  const level = Number.isInteger(run?.level?.level) ? run.level.level : 1;
  return deckRules.minimumReductionLevels.filter((at) => level >= at).length;
}

/** deckMinDelta(run) → everything that lowers this run's minimum: held items and relics, then level. */
export function deckMinDelta(run) {
  return ItemMinDeckDelta(run) + levelMinDeckDelta(run);
}

/** coreDeckMinimum(run) → the default editor minimum less this run's reductions, never below 0. */
export function coreDeckMinimum(run) {
  return Math.max(0, deckRules.defaults.deckMinSize - deckMinDelta(run));
}
