// tools/eliteDoor.mjs — the elite chest's place in a simulated reward door,
// shared by tools/runsim.mjs and tools/measure-classes.mjs.
//
// The game (src/main.js, the reward door) rolls the elite chest into the
// door's offer BEFORE any reward row is collected, so the chest reads the run
// as it stood at the door: its owned-upgrade option can never name a card the
// same door hands out. A simulator that pushed the door's card, skill-draft or
// class-draft pick into run.deck first and rolled the chest after let that
// builder pick a just-added instance (PR #1287 review) — deck strength the
// real game never reaches.
//
// The chest draws on 'relicRewards' only (engine/encounters.js
// relicStreamOnly), a stream no other door row touches, so rolling it first
// moves no card, draft, flask or cinder roll.

import { rollEliteChest } from '../src/engine/encounters.js';

/**
 * rollChestThenApplyRows(registries, rng, run, pool, applyRows) → the elite
 * chest frozen at the door (null off an elite door or when it builds nothing).
 * Rolls the chest against the run as it stands, THEN calls applyRows() to
 * land the door's other rewards. The caller auto-collects the returned chest
 * afterwards, as the reward screen's Continue does.
 */
export function rollChestThenApplyRows(registries, rng, run, pool, applyRows) {
  const chest = pool === 'elite' ? rollEliteChest(registries, rng, run) : null;
  applyRows();
  return chest;
}
