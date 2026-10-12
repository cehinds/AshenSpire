import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createCoopCombat, endTurn, chooseReaction, chooseDiscard, playCard } from '../src/engine/coopCombat.js';
import { serializeCoopCombatSnapshot, decodeCoopCombatSnapshot } from '../src/engine/coopCombatSnapshot.js';

// `strike` is tagged `trait:reaction` in this bundle only (the real projection is separate work).
function fixture({ version = 2, cardIds = ['guardCounter', 'sweepingBlow'], enemyCount = 1 } = {}) {
  const registries = createRegistries({ ...contentBundle,
    tagging: [...contentBundle.tagging, { family: 'card', scope: '', objectId: 'strike', tagId: 'trait:reaction' }],
    enemies: contentBundle.enemies.map(enemy => enemy.id === 'wanderingSoldier'
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

test('version 2 offers a trait:reaction card by tag, and version 1 does not', () => {
  const v2 = fixture({ cardIds: ['strike'] });
  dispatch(v2.combat, { type: 'endTurn' });
  assert.ok(v2.combat.pendingReaction?.options.some(option => option.cardId === 'strike'));
  const v1 = fixture({ version: 1, cardIds: ['strike'] });
  dispatch(v1.combat, { type: 'endTurn' });
  assert.equal(v1.combat.pendingReaction, undefined);
});

const answer = (combat, optionId = null) => dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId });
const pick = (combat, cardInstanceId) => combat.pendingReaction.options.find(row => row.play.cardInstanceId === cardInstanceId).id;
const offeredInstances = combat => [...new Set(combat.pendingReaction.options.map(row => row.play.cardInstanceId))];
const resources = combat => ({ energy: combat.player.energy, stamina: combat.player.stamina, mana: combat.player.mana });

test('passing with an empty stack matches the version 1 Back outcome', () => {
  const back = version => {
    const { combat } = fixture({ version, cardIds: ['guardCounter'] });
    dispatch(combat, { type: 'endTurn' });
    const out = answer(combat);
    return { types: out.events.map(event => event.type), phase: combat.phase, turn: combat.turn, hp: combat.player.hp };
  };
  assert.deepEqual(back(2), back(1));
});

test('a pushed reaction is not paid, stays in hand, and the seat is offered again at depth 1', () => {
  const { combat } = fixture({ cardIds: ['guardCounter', 'sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  const root = combat.pendingReaction.groupKey, before = resources(combat);
  const out = answer(combat, pick(combat, 'r1'));
  assert.deepEqual(resources(combat), before);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 0);
  assert.ok(combat.piles.hand.some(inst => inst.instanceId === 'r1'));
  assert.deepEqual(combat.reactionStack.entries.map(entry => entry.cardInstanceId), ['r1']);
  assert.equal(combat.pendingReaction.id, `${root}:player:1`);
  assert.ok(out.events.some(event => event.type === 'combatReactionStacked' && event.depth === 1 && event.cardInstanceId === 'r1'));
});

test('a stacked instance and a second Counter are not offered again', () => {
  const { combat } = fixture({ cardIds: ['guardCounter', 'sweepingBlow', 'whirlingGuard', 'guardCounter'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r1'));
  assert.ok(offeredInstances(combat).includes('r0') && offeredInstances(combat).includes('r3'));
  answer(combat, pick(combat, 'r0'));
  assert.deepEqual(offeredInstances(combat), ['r2']);
  assert.ok(combat.pendingReaction.id.endsWith(':player:2'));
});

test('two stacked reactions resolve last pushed first, both before the enemy hits', () => {
  const { combat } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  const out = answer(combat, pick(combat, 'r1'));
  const played = out.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'cardPlayed');
  assert.deepEqual(played.map(({ event }) => event.cardInstanceId), ['r1', 'r0']);
  const hits = out.events.map((event, index) => ({ event, index })).filter(({ event }) => event.type === 'damageDealt' && event.targetId === 'player');
  assert.ok(hits.length > 0 && hits.every(({ index }) => index > played.at(-1).index));
  assert.equal(combat.reactionStack, undefined);
  assert.equal(combat.pendingReaction, undefined);
});

test('a stack entry that is no longer in hand fizzles and pays nothing', () => {
  const { combat } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  combat.piles.hand = combat.piles.hand.filter(inst => inst.instanceId !== 'r0');
  const before = resources(combat);
  const out = answer(combat);
  assert.ok(out.events.some(event => event.type === 'combatReactionFizzled' && event.cardInstanceId === 'r0' && event.reason === 'notInHand'));
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 0);
  assert.equal(combat.reactionStack, undefined);
  assert.equal(combat.turn, 2);
  assert.deepEqual(resources(combat), before);
});

test('a saved stack is validated: side, owner and the offer depth must match', () => {
  const { combat, registries } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restore = snapshot => restoreCombatSnapshot({ registries, rng: createRng(701), snapshot: JSON.parse(JSON.stringify(snapshot)) });
  assert.equal(restore(saved).reactionStack.entries.length, 1);
  const badSide = structuredClone(saved);
  badSide.reactionStack.entries[0].side = 'bogus';
  assert.throws(() => restore(badSide), /Invalid reaction stack/);
  const badDepth = structuredClone(saved);
  badDepth.pendingReaction.id = badDepth.pendingReaction.id.replace(/:1$/, ':0');
  assert.throws(() => restore(badDepth), /does not match its stack depth/);
});

test('an enemy-side stack entry is rejected', () => {
  const { combat } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  combat.reactionStack.entries.push({ ...combat.reactionStack.entries[0], side: 'enemy' });
  assert.throws(() => answer(combat), /Enemy reactions are not implemented/);
});

test('a saved stack with a depth 1 offer resumes to the same state as an unsaved run', () => {
  const { combat, registries } = fixture({ cardIds: ['sweepingBlow', 'whirlingGuard'] });
  dispatch(combat, { type: 'endTurn' });
  answer(combat, pick(combat, 'r0'));
  assert.ok(combat.pendingReaction.id.endsWith(':player:1'));
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot });
  const json = value => JSON.parse(JSON.stringify(value));
  assert.deepEqual(json(serializeCombatSnapshot(restored)), json(serializeCombatSnapshot(combat)));
  // The second push leaves the seat with nothing to offer, so the stack resolves in that call.
  const outs = [combat, restored].map(state => [answer(state, pick(state, 'r1'))]);
  assert.deepEqual(json(outs[0].map(out => out.events)), json(outs[1].map(out => out.events)));
  assert.deepEqual(json(serializeCombatSnapshot(restored)), json(serializeCombatSnapshot(combat)));
  assert.deepEqual(restored.rng.getCounters(), combat.rng.getCounters());
});

test('a seat stops at maxDepth, so the fifth copy is never offered', () => {
  const { combat } = fixture({ cardIds: ['strike', 'strike', 'strike', 'strike', 'strike'] });
  for (const enemy of combat.enemies) { enemy.hp = 500; enemy.maxHp = 500; }
  dispatch(combat, { type: 'endTurn' });
  for (const id of ['r0', 'r1', 'r2']) answer(combat, pick(combat, id));
  assert.ok(combat.pendingReaction.id.endsWith(':player:3'));
  // The fourth push reaches maxDepth, so the seat is done and the four entries resolve at once.
  const out = answer(combat, pick(combat, 'r3'));
  assert.equal(combat.pendingReaction, undefined);
  assert.equal(out.events.filter(event => event.type === 'combatReactionStacked' && event.depth === 4).length, 1);
  assert.equal(out.events.filter(event => event.type === 'cardPlayed').length, 4);
  assert.equal(combat.piles.hand.some(inst => inst.instanceId === 'r4'), true);
  assert.equal(combat.turn, 2);
});
