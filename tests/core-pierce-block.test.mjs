// Owner bug 2026-10-26: "Attacks are bypassing block". In Core a piercing hit (Rogue daggers, spears, many enemies) skipped all Block.
// Owner ruling the same day: "pierce should be about floor(.2 * damage)": each pierce hit lets floor(0.2 x its own damage) past Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baseRegistries, registries } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const unlocks = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const settle = combat => { while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); };
const plain = { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 };

test('Rogue dagger strike (12) against Block 50 loses floor(0.2 x 12) = 2 HP', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 50, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  const strike = combat.piles.hand.find(c => c.cardId === 'core.strike');
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.equal(hit.amount, 12, 'fixture: the dagger strike deals 12');
  assert.equal(500 - enemy.hp, 2);
  assert.equal(hit.blocked, 10);
  assert.equal(enemy.block, 40, 'Block was spent');
});

// An enemy whose Slash is a 5x3 piercing action.
const pierceRegistries = Object.freeze({ ...baseRegistries, enemies: { ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id),
  get: id => {
    const row = baseRegistries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage: 5, hits: 3, damageType: 'piercing',
      tags: [...(row.moves.slash.tags || []).filter(tag => !tag.startsWith('damage:')), 'damage:piercing'] } } } : row;
  } } });

test('dispatch: an enemy 5x3 piercing action on Block 40 loses 3 x floor(1) = 3 HP, and the forecast matches', () => {
  const run = createRunState({ registries: pierceRegistries, classId: 'reaver', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries: pierceRegistries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(combat.player, { hp: 100, maxHp: 100, block: 40, barrier: 0, statuses: {}, ratings: { ...plain }, ratingSources: [], persistentPoise: { value: 0, max: 0 } });
  delete combat.player.combatStance;
  Object.assign(enemy, { maxStamina: 3, stamina: 3, statuses: {}, ratings: { ...plain }, ratingSources: [], basePrecisionBonus: 1000 });
  enemy.intent = { ...enemy.intent, moveId: 'slash' }; enemy.plannedMoves = [];
  combat.piles.hand = [];
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const forecast = combat.eventLog.slice(start).find(e => e.type === 'enemyActorTurnStarted')?.intentPreview?.hitDamages;
  settle(combat);
  const hits = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id);
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map(e => e.amount), [5, 5, 5], 'fixture: three 5-damage hits');
  assert.deepEqual(hits.map(e => e.hpLoss), [1, 1, 1]);
  assert.equal(100 - combat.player.hp, 3);
  assert.deepEqual(forecast, [1, 1, 1], 'preview matches apply');
});

test('dispatch: a player multi-hit pierce card on Block 40 loses floor(0.2 x each hit) per hit', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: unlocks });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 40, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  combat.player.statuses.weak = { stacks: 1 }; // smaller hits, so floor(0.2 x hit) differs from a flat bypass
  combat.piles.hand.push({ instanceId: 'multi', cardId: 'twinPrick', upgraded: false });
  Object.assign(combat.player, { stamina: 10, mana: 10, maxStamina: 10, maxMana: 10 });
  primeAccuracyRolls(combat, { count: 6 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'multi', targetId: enemy.id });
  settle(combat);
  const hits = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.ok(hits.length >= 2, `fixture: a multi-hit card (${hits.length} hits)`);
  assert.deepEqual(hits.map(e => e.amount - e.blocked), hits.map(e => Math.floor(0.2 * e.amount)));
  assert.equal(500 - enemy.hp, hits.reduce((sum, e) => sum + Math.floor(0.2 * e.amount), 0));
});
