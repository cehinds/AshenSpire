// Owner ruling 2026-11-01: "All the evade stance cards were acting as defend cards so just migrate them all as defend cards".
// A saved combatStance or concurrentStances row with maneuver 'evade' loads as Defend; the retired counterStance hybrid
// loads as Counter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bringStancesForward } from '../src/model/combatSnapshot.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { combatExpansionEntityProblems } from '../src/model/combatTacticsRules.js';
import { stanceOf } from '../src/model/stanceRules.js';
import { live, registries } from './helpers/fixcore-combat-rules.mjs';
import { createRng } from '../src/engine/rng.js';

test('bringStancesForward maps saved Evade rows to Defend and the hybrid to Counter', () => {
  const snap = { player: { combatStance: { maneuver: 'evade', camp: 'physical', range: 'melee' },
    concurrentStances: [{ maneuver: 'evade', camp: 'spell', range: 'ranged' }, { maneuver: 'attack', camp: 'physical' }] },
  enemies: [{ combatStance: { maneuver: 'evade', counterStance: true, camp: 'physical', range: 'melee' } }] };
  assert.equal(bringStancesForward(snap), true);
  assert.equal(snap.player.combatStance.maneuver, 'defend');
  assert.equal(snap.player.concurrentStances[0].maneuver, 'defend');
  assert.equal(snap.player.concurrentStances[1].maneuver, 'attack');
  assert.equal(snap.enemies[0].combatStance.maneuver, 'counter');
  assert.equal('counterStance' in snap.enemies[0].combatStance, false);
  assert.equal(bringStancesForward(snap), false, 'idempotent');
  assert.equal(stanceOf({ maneuver: 'evade', camp: 'physical' }).maneuver, 'defend', 'stanceOf also reads a legacy row as Defend');
});

test('a saved fight with an Evade stance restores in Defend stance', () => {
  const combat = live();
  combat.player.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  combat.player.concurrentStances = [{ maneuver: 'defend', camp: 'spell', range: 'ranged' }];
  const saved = serializeCombatSnapshot(combat);
  saved.player.combatStance.maneuver = 'evade';
  saved.player.concurrentStances[0].maneuver = 'evade';
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(1), snapshot: saved });
  assert.equal(restored.player.combatStance.maneuver, 'defend');
  assert.equal(restored.player.concurrentStances[0].maneuver, 'defend');
  assert.deepEqual(combatExpansionEntityProblems(restored.player), []);
  assert.equal(saved.player.combatStance.maneuver, 'evade', 'the caller\'s object is left as saved');
});

test('Evade is no longer a valid live stance', () => {
  assert.ok(combatExpansionEntityProblems({ combatStance: { maneuver: 'evade', camp: 'physical', range: 'melee' } }).some(p => p.includes('maneuver')));
});
