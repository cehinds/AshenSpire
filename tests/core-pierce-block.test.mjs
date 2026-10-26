// Owner bug 2026-10-26: "Attacks are bypassing block". In Core a piercing hit (Rogue daggers, spears, many enemies) skipped all Block.
// It now lets only the Piercing guard bypass (once per action and target, spent over the contacts in order) past Block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { live, baseRegistries, profile } from './helpers/fixcore-combat-rules.mjs';
import { dispatch } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import * as Matchups from '../src/engine/combatMatchups.js';
import { pierceGuardBypass } from '../src/engine/gameProfileCombat.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

test('Rogue dagger strike against Block 50 loses only the Piercing bypass to HP', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 50, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  const strike = combat.piles.hand.find(c => c.cardId === 'core.strike');
  primeAccuracyRolls(combat, { count: 3 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: strike.instanceId, targetId: enemy.id });
  const hit = combat.eventLog.slice(start).find(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  const bypass = pierceGuardBypass(combat);
  assert.ok(hit.amount > bypass, 'fixture: the strike is bigger than the bypass');
  assert.equal(500 - enemy.hp, bypass, 'HP lost is the bypass only');
  assert.equal(hit.blocked, hit.amount - bypass);
  assert.equal(enemy.block, 50 - hit.blocked, 'Block was spent');
});

test('a multi-hit pierce action spends the bypass once, over its contacts in order', () => {
  const combat = live();
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 500; enemy.block = 40;
  const carrier = { tags: ['camp:physical', 'damage:piercing'], skipRatingBonus: true, physicalDamageType: 'piercing',
    combatProfile: { camp: 'physical', maneuver: 'attack', damageType: 'piercing', range: 'melee', targeting: 'single' } };
  const contacts = [5, 5, 5].map(amount => ({ camp: 'physical', maneuver: 'attack', damageType: 'piercing', physicalDamageType: 'piercing', magicShare: 0, amount, splitBase: amount }));
  primeAccuracyRolls(combat, { count: 3 });
  const receipt = Matchups.beginTacticalAction(combat, combat.player, enemy, carrier, contacts);
  const lost = contacts.map((contact, index) => {
    const before = enemy.hp;
    applyAttackDamage(combat, combat.player, enemy, contact.amount, carrier.tags, { ...carrier, expansionContact: { receipt, index } });
    return before - enemy.hp;
  });
  const bypass = pierceGuardBypass(combat);
  assert.ok(bypass > 0 && bypass < 15);
  assert.equal(lost.reduce((a, b) => a + b, 0), bypass, 'one bypass for the whole action, not one per hit');
  assert.equal(enemy.block, 40 - (15 - bypass));
});

// Live Core resolves a multi-hit action hit by hit (contactPolicy perHit), so the once-per-action bypass must survive between hits.
const pierceRegistries = Object.freeze({ ...baseRegistries, enemies: { ...baseRegistries.enemies, has: id => baseRegistries.enemies.has(id),
  get: id => {
    const row = baseRegistries.enemies.get(id);
    return id === 'wanderingSoldier' ? { ...row, firstMove: 'slash', moves: { ...row.moves, slash: { ...row.moves.slash, damage: 5, hits: 3, damageType: 'piercing',
      tags: [...(row.moves.slash.tags || []).filter(tag => !tag.startsWith('damage:')), 'damage:piercing'] } } } : row;
  } } });

test('dispatch: an enemy 5x3 piercing action on Block 40 loses one bypass in total, and the forecast matches', () => {
  const run = createRunState({ registries: pierceRegistries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: pierceRegistries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(combat.player, { hp: 100, maxHp: 100, block: 40, barrier: 0, statuses: {}, ratings: { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 }, ratingSources: [], persistentPoise: { value: 0, max: 0 } });
  delete combat.player.combatStance;
  Object.assign(enemy, { maxStamina: 3, stamina: 3, statuses: {}, ratings: { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 }, ratingSources: [], basePrecisionBonus: 1000 });
  enemy.intent = { ...enemy.intent, moveId: 'slash' }; enemy.plannedMoves = [];
  combat.piles.hand = [];
  primeAccuracyRolls(combat, { count: 3 });
  const bypass = pierceGuardBypass(combat);
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const revealed = combat.eventLog.slice(start).find(e => e.type === 'enemyActorTurnStarted');
  const forecast = revealed?.intentPreview?.hitDamages;
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const hits = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id);
  assert.equal(hits.length, 3);
  assert.equal(100 - combat.player.hp, bypass, 'one bypass for the whole action');
  assert.deepEqual(hits.map(e => e.hpLoss), [bypass, 0, 0]);
  assert.deepEqual(forecast, [bypass, 0, 0], 'the forecast spends the bypass once too');
});

test('dispatch: a player multi-hit pierce card on Block 40 loses one bypass in total', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 40, barrier: 0, persistentPoise: { value: 0, max: 0 } });
  combat.piles.hand.push({ instanceId: 'multi', cardId: 'twinPrick', upgraded: false });
  combat.player.stamina = combat.player.mana = 10; combat.player.maxStamina = combat.player.maxMana = 10;
  primeAccuracyRolls(combat, { count: 6 });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'multi', targetId: enemy.id });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const hits = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.ok(hits.length >= 2, `fixture: a multi-hit card (${hits.length} hits)`);
  assert.equal(500 - enemy.hp, pierceGuardBypass(combat));
});
