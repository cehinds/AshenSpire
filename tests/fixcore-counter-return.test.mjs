// Core 2 Counter (owner ruling 2026-10-19, SPEC §17): return = floor(0.5 x incoming), Poise = floor(0.2 x return);
// with advantage +floor(0.25 x incoming) return, Poise = floor(0.5 x return), +floor(0.25 x incoming) Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { counterReturn, counterBeats } from '../src/engine/counterRule.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  // A plain 8-damage Attack: no rating, status or Poise noise on either side of the exchange.
  Object.assign(enemy, { hp: 500, maxHp: 500, statuses: {}, ratings: { poise: 20 }, ratingSources: [], attributes: { dexterity: 0 } });
  combat.piles.hand.push({ instanceId: 'cx1', cardId: 'core.counter' });
  return { combat, enemy };
}
function exchange() {
  const { combat, enemy } = live();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  assert.equal(enemy.intent.damage, 8); assert.equal(enemy.intent.combatProfile.maneuver, 'attack');
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  return { combat, enemy, events: combat.eventLog.slice(start) };
}

test('worked example: Attack 8 into Counter (5 Block, 4 damage) gives Block 7, return 6, Poise 3', () => {
  const { combat } = live();
  assert.deepEqual(counterReturn(combat, 8, counterBeats(combat, 'attack')), { hp: 6, poise: 3, block: 2 });
  assert.deepEqual(counterReturn(combat, 8, counterBeats(combat, 'smash')), { hp: 6, poise: 3, block: 2 });
});

test('without advantage (Sweep) the same 8 damage returns 4, Poise 0, adds no Block', () => {
  const { combat } = live();
  assert.equal(counterBeats(combat, 'sweep'), false);
  assert.deepEqual(counterReturn(combat, 8, counterBeats(combat, 'sweep')), { hp: 4, poise: 0, block: 0 });
  assert.deepEqual(counterReturn(combat, 9, false), { hp: 4, poise: 0, block: 0 });
  assert.deepEqual(counterReturn(combat, 0, true), { hp: 0, poise: 0, block: 0 });
});

test('live: the Counter adds 2 Block before the hit, then returns 6 damage and 3 Poise damage', () => {
  const { enemy, events } = exchange();
  const gained = events.find(e => e.type === 'blockGained' && e.source === 'counter');
  assert.equal(gained.amount, 2); assert.equal(gained.total, 7);
  const taken = events.find(e => e.type === 'damageDealt' && e.targetId === 'player');
  assert.equal(taken.amount, 7); assert.equal(taken.blocked, 7);
  const returned = events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  // The enemy's Poise absorbs a quarter of the 6 (SPEC §17 Poise); the return itself skips the chain's own stance multiplier.
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + e.poiseAbsorbed, 0), 6);
  const poise = events.find(e => e.type === 'persistentPoiseChanged' && e.targetId === enemy.id && e.source === 'poiseDamage' && e.cardId === 'core.counter');
  assert.equal(poise.spent, 3);
});
