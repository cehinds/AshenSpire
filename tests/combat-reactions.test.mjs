import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewIntent } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCoopCombat, endTurn, chooseReaction, joinCombat, leaveCombat } from '../src/engine/coopCombat.js';
import { combatRules } from '../src/content/combatRules.js';
import { createFoundation } from '../src/engine/combatRules.js';
import { armCombatCounter } from '../src/engine/combatMatchups.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';

function fixture({ version = 1, cardIds = ['guardCounter', 'sweepingBlow'], enemyCount = 2 } = {}) {
  const registries = createRegistries({ ...contentBundle, enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
    ? { ...enemy, firstMove: 'slash', moves: { slash: { intent: 'attack', damage: 1, hits: 2, weight: 1,
      tags: ['camp:physical', 'maneuver:attack', 'reach:contact', 'targeting:single'] } } } : enemy) });
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: version,
    enemyIds: Array(enemyCount).fill('wanderingSoldier'), player: { classId: 'reaver', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: cardIds.length,
      deck: cardIds.map((cardId, index) => ({ cardId, instanceId: `r${index}`, upgraded: false })) } });
  combat.player.block = 100;
  for (const enemy of combat.enemies) { enemy.intentRevealed = false; enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 0 }; }
  return { combat, registries };
}
const answer = (combat, optionId = null) => dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId });

test('incoming plans pause before hits, reveal only the actor, and decline resumes roster order once', () => {
  const { combat } = fixture();
  const out = dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.phase, 'enemy');
  assert.ok(combat.pendingReaction?.options.length >= 2);
  assert.equal(out.events.filter(event => event.type === 'damageDealt').length, 0);
  assert.equal(out.events.filter(event => event.type === 'enemyMoveStarted').length, 0);
  assert.equal(previewIntent(combat, 'e1').hidden, false);
  assert.equal(previewIntent(combat, 'e2').hidden, true);
  const before = serializeCombatSnapshot(combat), rng = combat.rng.getCounters();
  assert.throws(() => dispatch(combat, { type: 'chooseReaction', offerId: 'stale' }));
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), rng);
  const first = answer(combat);
  assert.deepEqual(first.events.filter(event => event.type === 'enemyMoveStarted').map(event => event.sourceId), ['e1']);
  assert.equal(combat.pendingReaction.sourceId, 'e2');
  answer(combat);
  assert.equal(combat.turn, 2);
  assert.equal(combat.phase, 'player');
  assert.deepEqual(combat.enemies.map(enemy => enemy.performedMoves), [['slash'], ['slash']]);
});

test('one selected Counter pays once and successful multi-hit return follows the whole incoming action', () => {
  const { combat } = fixture({ enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  assert.ok(option);
  const out = answer(combat, option.id);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1);
  assert.equal(out.events.filter(event => event.type === 'combatCounterTriggered').length, 1);
  const trigger = out.events.findIndex(event => event.type === 'combatCounterTriggered');
  const contacts = out.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'damageDealt' && event.targetId === 'player');
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every(({ index }) => index < trigger));
  assert.equal(combat.pendingReaction, undefined);
});

test('reload preserves committed plan and all RNG streams through a paid reaction', () => {
  const { combat, registries } = fixture({ enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const rng = createRng(combat.rng.seed, combat.rng.getCounters());
  const restored = restoreCombatSnapshot({ registries, rng, snapshot });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  assert.deepEqual(answer(combat, option.id), answer(restored, option.id));
  assert.deepEqual(serializeCombatSnapshot(combat), serializeCombatSnapshot(restored));
  assert.deepEqual(combat.rng.getCounters(), restored.rng.getCounters());
});

test('historical combat without carried reaction rules keeps immediate hand cleanup', () => {
  const { combat } = fixture({ version: null, enemyCount: 1 });
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(combat.phase, 'player');
  assert.equal(combat.turn, 2);
});

test('unaffordable and offensive-only cards do not offer a defensive reaction', () => {
  for (const cardIds of [['strike'], ['guardCounter', 'sweepingBlow']]) {
    const { combat } = fixture({ enemyCount: 1, cardIds });
    combat.player.energy = 0;
    combat.player.stamina = 0;
    combat.player.mana = 0;
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.pendingReaction, undefined);
    assert.equal(combat.turn, 2);
  }
});

test('tampered saved reaction commands are rejected atomically', () => {
  const { combat } = fixture({ enemyCount: 1 });
  combat.piles.hand.push({ cardId: 'strike', instanceId: 'ordinary', upgraded: false });
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  option.play = { type: 'playCard', cardInstanceId: 'ordinary', targetId: 'e1' };
  const before = serializeCombatSnapshot(combat), counters = combat.rng.getCounters();
  assert.throws(() => answer(combat, option.id), /no longer playable/);
  assert.deepEqual(serializeCombatSnapshot(combat), before);
  assert.deepEqual(combat.rng.getCounters(), counters);
});

test('a defensive Sweep can cancel its attacker without executing its intent', () => {
  const { combat } = fixture();
  combat.enemies[0].hp = 1;
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'sweepingBlow');
  assert.ok(option);
  answer(combat, option.id);
  assert.equal(combat.enemies[0].alive, false);
  assert.deepEqual(combat.enemies[0].performedMoves || [], []);
  assert.equal(combat.eventLog.some(event => event.type === 'enemyMoveStarted' && event.sourceId === 'e1'), false);
});

test('paid Counter reply to an automatic return terminates the chain', () => {
  const { combat } = fixture({ cardIds: ['guardCounter', 'strike'], enemyCount: 1 });
  const enemy = combat.enemies[0];
  enemy.block = 100;
  enemy.combatStance = { camp: 'physical', maneuver: 'counter', reach: 'contact', targeting: 'single' };
  armCombatCounter(combat, enemy, { moveId: 'returnCarrier',
    tags: ['camp:physical', 'maneuver:counter', 'reach:contact', 'targeting:single'],
    combatProfile: { ...enemy.combatStance, damageType: 'blunt' } }, { payload: { hp: 1, poise: 0, ward: 0 } });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'r1', targetId: enemy.id });
  const option = combat.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  const out = answer(combat, option.id);
  assert.deepEqual(out.events.filter(event => event.type === 'combatCounterTriggered').map(event => event.sourceKind), ['enemy', 'player']);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 1);
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(combat.queue.length, 0);
  assert.equal(combat.pendingExpansionActions, 0);
});

test('disconnect settles the last owned offer and reconnect resumes the saved cursor', () => {
  const { registries } = fixture();
  const players = ['a', 'b'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
    combatExpansionVersion: 2, deck: [{ cardId: 'guardCounter', instanceId: `${id}:counter`, upgraded: false }] }));
  const C = createCoopCombat({ registries, rng: createRng(709), players, enemyIds: ['wanderingSoldier'], reactionRulesVersion: 1 });
  for (const P of C.players.values()) P.entity.block = 100;
  C.foundation = createFoundation(combatRules);
  endTurn(C, 'a'); endTurn(C, 'b');
  const serial = C.foundation.actionSerial;
  leaveCombat(C, 'b');
  assert.equal(C.pendingReaction.ownerId, 'a');
  assert.equal(C.foundation.actionSerial, serial);
  const rolls = structuredClone(C.foundation.rolls), counts = structuredClone(C.foundation.counts);
  leaveCombat(C, 'a');
  assert.equal(C.pendingReaction, undefined);
  assert.equal(C.phase, 'suspended');
  assert.equal(C.foundation.actionSerial, serial);
  assert.deepEqual(C.foundation.rolls, rolls);
  assert.deepEqual(C.foundation.counts, counts);
  const snapshot = JSON.parse(JSON.stringify(serializeCoopCombatSnapshot(C)));
  const restored = createCoopCombat({ registries, rng: createRng(709, C.rng.getCounters()), players, enemyIds: [], snapshot });
  joinCombat(C, players[1]); joinCombat(restored, players[1]);
  assert.equal(C.pendingReaction, undefined);
  assert.equal(C.phase, 'player');
  assert.equal(C.turn, 2);
  assert.deepEqual(decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(C)), decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(restored)));
  assert.deepEqual(C.rng.getCounters(), restored.rng.getCounters());
});

test('co-op collects owned choices in saved seat order before either seat takes damage, with exact reload', () => {
  const { registries } = fixture();
  const players = ['a', 'b'].map(id => ({ id, classId: 'reaver', maxHp: 100, hp: 100,
    maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
    combatExpansionVersion: 2, deck: [{ cardId: 'guardCounter', instanceId: `${id}:counter`, upgraded: false }] }));
  const C = createCoopCombat({ registries, rng: createRng(709), players, enemyIds: ['wanderingSoldier'], reactionRulesVersion: 1 });
  for (const P of C.players.values()) P.entity.block = 100;
  endTurn(C, 'a'); endTurn(C, 'b');
  assert.equal(C.pendingReaction.ownerId, 'a');
  const snapshot = serializeCoopCombatSnapshot(C), counters = C.rng.getCounters();
  assert.throws(() => chooseReaction(C, 'b', { offerId: C.pendingReaction.id }));
  assert.deepEqual(serializeCoopCombatSnapshot(C), snapshot);
  assert.deepEqual(C.rng.getCounters(), counters);
  const restored = createCoopCombat({ registries, rng: createRng(709, counters), players, enemyIds: [], snapshot });
  chooseReaction(C, 'a', { offerId: C.pendingReaction.id });
  chooseReaction(restored, 'a', { offerId: restored.pendingReaction.id });
  assert.equal(C.pendingReaction.ownerId, 'b');
  assert.equal(C.enemies[0].performedMoves?.length || 0, 0);
  assert.equal(C.players.get('a').entity.block, 100);
  const option = C.pendingReaction.options.find(row => row.cardId === 'guardCounter');
  chooseReaction(C, 'b', { offerId: C.pendingReaction.id, optionId: option.id });
  chooseReaction(restored, 'b', { offerId: restored.pendingReaction.id, optionId: option.id });
  assert.equal(C.turn, 2);
  assert.deepEqual(decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(C)), decodeCoopCombatSnapshot(serializeCoopCombatSnapshot(restored)));
  assert.deepEqual(C.rng.getCounters(), restored.rng.getCounters());
});
