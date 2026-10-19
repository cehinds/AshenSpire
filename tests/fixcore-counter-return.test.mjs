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

import { previewCard } from '../src/engine/combat.js';
test('the Counter card preview names the same return the live exchange deals (no attack-rating mismatch)', () => {
  const { combat, enemy } = live();
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  // Preview against the revealed 8-damage Attack: 6 return damage, less the enemy's own Poise (25% of 6, floored).
  const receipt = damage.damageReceipt.hits[0];
  assert.equal(receipt.incoming, 6, 'the card previews floor(0.5 x 8) + floor(0.25 x 8)');
  assert.equal(damage.totalDamage, 6 - receipt.poiseReduced - 0);
  const { events } = exchange();
  const live6 = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(live6.reduce((sum, e) => sum + e.hpLoss, 0), damage.totalDamage);
});

test('preview equals live against an enemy whose attack carries rating bonuses', () => {
  const { combat, enemy } = live();
  // Restore a real attacker: 8 base plus its rating bonus, so the incoming damage is not the printed 8.
  Object.assign(enemy, { ratings: { ar: 6, poise: 20 } });
  const damage = previewCard(combat, 'cx1', enemy.id).values.find(row => row.op === 'damage');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  combat.player.block = 999;
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  const returned = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.ok(returned.length, 'the Counter fired');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss, 0), damage.totalDamage);
});

import { profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { cardPlayCosts } from '../src/engine/combat.js';
test('a reaction card played from hand costs max(SP - 1, 0); other cards are untouched', () => {
  const { combat } = live();
  const reaction = base => ({ id: 'x.reaction', staminaCost: base, manaCost: 0, tags: ['trait:reaction', 'maneuver:attack'] });
  const plain = base => ({ id: 'x.plain', staminaCost: base, manaCost: 0, tags: ['maneuver:attack'] });
  delete combat.player.combatStance;
  assert.deepEqual([0, 1, 2, 3].map(sp => profileCardCosts(combat, reaction(sp)).stamina), [0, 0, 1, 2]);
  assert.deepEqual([0, 1, 2, 3].map(sp => profileCardCosts(combat, plain(sp)).stamina), [0, 1, 2, 3]);
});

test('the real Counter card is free to play from hand; the playability check and card face read the same price', () => {
  const { combat } = live();
  assert.equal(cardPlayCosts(combat, 'cx1').stamina, 0);
  combat.player.stamina = 0;
  const before = combat.player.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  assert.equal(combat.player.stamina, before);
  assert.ok(combat.player.combatCounter, 'the zero-cost Counter still arms');
});

test('the preview marks a reduced SP price so the card face can show it down; an untouched card has no mark', () => {
  const { combat } = live();
  delete combat.player.combatStance;
  assert.equal(previewCard(combat, 'cx1').costShift, -1);
  assert.equal(previewCard(combat, 'cx1').cost, 0);
  const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
  assert.equal(previewCard(combat, strike.instanceId).costShift, undefined);
});

test('Core: the Counter returns even when damage gets through (no Poise: 8 into 7 Block leaves 1, return still 6)', () => {
  const { combat, enemy } = live();
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 0, max: 0 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  const taken = events.find(e => e.type === 'damageDealt' && e.targetId === 'player');
  assert.equal(taken.blocked, 7); assert.equal(taken.hpLoss, 1);
  const returned = events.filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + e.poiseAbsorbed, 0), 6);
});

import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
test('a Core Counter return skips matching-stance and defensive-stance stages (Sweep target keeps 4)', () => {
  const { combat, enemy } = live();
  Object.assign(combat.player, { ratings: {}, ratingSources: [], statuses: {}, combatStance: { maneuver: 'counter', camp: 'physical', range: 'melee' } });
  enemy.combatStance = { maneuver: 'sweep', camp: 'physical', range: 'melee' };
  const carrier = { skipRatingBonus: true, counterReturnAttack: true, combatReaction: true,
    combatProfile: { camp: 'physical', maneuver: 'counter', damageType: 'slashing', range: 'melee', targeting: 'single' } };
  const incoming = base => profileDamageReceipt(combat, combat.player, enemy, base, carrier).damageReceipt.hits[0].incoming;
  assert.equal(incoming(4), 4);
  assert.equal(incoming(6), 6);
});

test('Counter played while already in Counter stance still returns 6 in the worked example', () => {
  const { combat, enemy } = live();
  combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cx1' });
  Object.assign(combat.player, { block: 5, persistentPoise: { value: 20, max: 20 } });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const returned = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.cardId === 'core.counter');
  assert.equal(returned.reduce((sum, e) => sum + e.hpLoss + e.poiseAbsorbed, 0), 6);
});
