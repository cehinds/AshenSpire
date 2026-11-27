import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

// Owner 2026-11-13: Sweep breaks Counter, Smash breaks Defend (damage greater than the Block held before the hit).
function fight({ maneuver = 'smash', amount = 21, block = 19, stance = 'defend', armCounter = false } = {}) {
  const profile = { camp: 'physical', maneuver, damageType: 'slashing' };
  const strike = { id: 'fixture.stanceStrike', name: 'Stance fixture', class: 'colorless', rarity: 'common', type: 'attack',
    cost: 0, manaCost: 0, costRule: 'fixed', keywords: [], tags: ['classification.attack', 'camp:physical', `maneuver:${maneuver}`],
    effects: [{ op: 'damage', target: 'enemy', amount, combatProfile: profile }], textTemplate: 'Deal {damage} damage.' };
  const enemy = id => ({ id, name: id, hp: [500, 500], poiseMax: 1000, spPool: 2, firstMove: 'parry', startingRange: 'melee',
    attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 },
    moves: {
      parry: { id: 'parry', enemyId: id, intent: 'block', block: 0, counterDamage: 0, sp: 1, weight: 1,
        tags: ['camp:physical', 'maneuver:counter', 'counter:melee', 'range:melee'] },
      thrust: { id: 'thrust', enemyId: id, intent: 'attack', damage: 1, sp: 1, weight: 1,
        tags: ['camp:physical', 'maneuver:attack', 'range:melee'] },
    } });
  const registries = createRegistries({ ...contentBundle,
    cards: [...contentBundle.cards, strike],
    tagging: [...contentBundle.tagging, ...strike.tags.map(tagId => ({ family: 'card', scope: '', objectId: strike.id, tagId }))],
    enemies: [enemy('gildedKnight'), enemy('wanderingSoldier')],
  });
  const player = { classId: 'reaver', hp: 200, maxHp: 200, mana: 10, maxMana: 10, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 'hit1', cardId: strike.id }], relicIds: [] };
  const c = createCombat({ registries, rng: createRng(50), combatExpansionVersion: 2, enemyIds: ['gildedKnight', 'wanderingSoldier'], player });
  const target = c.enemies[0];
  target.plannedMoves = []; // A follow-up is supplied only by the cases that exercise intent advancement.
  delete target.combatCounter;
  target.combatStance = { camp: 'physical', maneuver: stance };
  if (armCounter) target.combatCounter = { charges: 1, mode: 'melee', damage: 6, poiseDamage: 0, bonus: 0, carrier: { combatProfile: { camp: 'physical', maneuver: 'counter', damageType: 'slashing' } } };
  target.block = block; target.wardBlock = 0; target.hp = target.maxHp = 500;
  target.poiseMeter = { value: 0, max: 1000 }; if (target.persistentPoise) target.persistentPoise.value = target.persistentPoise.max = 1000;
  return { c, enemy: target, play: () => dispatch(c, { type: 'playCard', cardInstanceId: 'hit1', targetId: target.id }),
    broken: () => c.eventLog.filter(event => event.type === 'combatStanceBroken') };
}

test('a Smash greater than the Block held breaks a Defend stance', () => {
  const { enemy, play, broken } = fight({ amount: 40, block: 19 });
  play();
  assert.equal(enemy.combatStance, undefined);
  assert.deepEqual(broken().map(e => [e.targetId, e.from, e.by]), [[enemy.id, 'defend', 'smash']]);
});

test('a Smash that does not exceed the Block leaves the Defend stance', () => {
  const { c, enemy, play, broken } = fight({ amount: 1, block: 19 });
  play();
  assert.equal(enemy.combatStance?.maneuver, 'defend');
  assert.equal(broken().length, 0);
  assert.ok(c.eventLog.some(event => event.type === 'damageDealt'));
});

test('a Sweep that lands on a Counter stance clears the armed reply and the stance', () => {
  const { c, enemy, play, broken } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  const hp = c.player.hp;
  play();
  assert.equal(enemy.combatStance, undefined);
  assert.equal(enemy.combatCounter, undefined);
  assert.equal(c.player.hp, hp, 'no reply');
  assert.equal(c.eventLog.filter(event => event.type === 'combatCounterTriggered').length, 0);
  assert.deepEqual(broken().map(e => [e.from, e.by]), [['counter', 'sweep']]);
});

test('a Sweep does not break a Defend stance and a Smash does not break a Counter stance', () => {
  const sweep = fight({ maneuver: 'sweep', amount: 40, block: 19, stance: 'defend' });
  sweep.play();
  assert.equal(sweep.broken().length, 0);
  const smash = fight({ maneuver: 'smash', amount: 40, block: 0, stance: 'counter' });
  smash.play();
  assert.equal(smash.broken().length, 0);
});

test('the Block comparison is strict: more breaks, equal or less holds (21 vs 20, 21 vs 21, 21 vs 23)', () => {
  // The fixture's Smash has 21 damage before matchups; the pool the hit meets is read back from the receipt.
  const seen = {};
  for (const block of [20, 21, 23]) {
    const f = fight({ amount: 21, block }); f.play();
    const d = f.c.eventLog.find(e => e.type === 'damageDealt' && e.sourceId === 'player');
    const held = d.blocked + d.blockRemaining;
    seen[held] = f.enemy.combatStance === undefined;
    assert.equal(f.broken().length, 21 > held ? 1 : 0, `Block ${held}`);
  }
  assert.deepEqual(seen, { 20: true, 21: false, 23: false });
});

test('the same break applies to a player target and never to a staggered stance', async () => {
  const { BreakStanceOnHit } = await import('../src/engine/combatMatchups.js');
  const { c } = fight();
  const carrier = maneuver => ({ combatProfile: { camp: 'physical', maneuver, damageType: 'slashing' } });
  const enemy = c.enemies[0];
  c.player.combatStance = { camp: 'physical', maneuver: 'counter' };
  c.player.combatCounter = { charges: 1, mode: 'melee' };
  const event = BreakStanceOnHit(c, enemy, c.player, carrier('sweep'), { blockBefore: 0, incoming: 5 });
  assert.deepEqual([event.from, event.by, event.targetId], ['counter', 'sweep', 'player']);
  assert.equal(c.player.combatStance, undefined);
  assert.equal(c.player.combatCounter, undefined);
  c.player.combatStance = { camp: 'physical', maneuver: 'defend' };
  assert.equal(BreakStanceOnHit(c, enemy, c.player, carrier('smash'), { blockBefore: 19, incoming: 19 }), null);
  assert.equal(BreakStanceOnHit(c, enemy, c.player, carrier('smash'), { blockBefore: 19, incoming: 21 })?.from, 'defend');
  c.player.combatStance = { maneuver: 'staggered' };
  assert.equal(BreakStanceOnHit(c, enemy, c.player, carrier('sweep'), { blockBefore: 0, incoming: 9 }), null);
});

test('a broken Counter move leaves the enemy intent at once: the next planned follow-up becomes the intent', () => {
  const { c, enemy, play } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  assert.equal(enemy.intent.moveId, 'parry');
  enemy.plannedMoves = [{ moveId: 'thrust', sp: 1 }];
  const ai = c.rng.getCounters().enemyAI || 0;
  play();
  assert.equal(enemy.intent.moveId, 'thrust');
  assert.deepEqual(enemy.plannedMoves, []);
  const gone = c.eventLog.find(event => event.type === 'enemyMoveUnavailable' && event.sourceId === enemy.id);
  assert.deepEqual([gone.moveId, gone.resource, gone.reason], ['parry', 'stance', 'stanceBroken']);
  assert.equal(c.rng.getCounters().enemyAI || 0, ai, 'no enemyAI draw');
});

test('a broken Counter move with no follow-up leaves the enemy with no move', () => {
  const { c, enemy, play } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  enemy.plannedMoves = [];
  play();
  assert.equal(enemy.intent.moveId, null);
  assert.equal(enemy.intent.kind, 'idle');
  assert.equal(enemy.combatStance, undefined);
  assert.equal(c.eventLog.filter(event => event.type === 'enemyMoveUnavailable').length, 1);
});

test('breaking an instance-only level Counter cancels its intent without changing the shared definition or drawing AI', () => {
  const { c, enemy, play } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  const definition = c.registries.enemies.get(enemy.enemyId);
  const before = structuredClone(definition);
  const moveId = 'level.fixtureCounter';
  enemy.extraMoves = { [moveId]: { id: moveId, enemyId: enemy.enemyId, intent: 'block', sp: 1,
    counterDamage: 2, block: 0, weight: 1, tags: ['camp:physical', 'maneuver:counter', 'counter:melee', 'range:melee'] } };
  enemy.intent = { ...enemy.intent, moveId };
  enemy.plannedMoves = [];
  const ai = c.rng.getCounters().enemyAI || 0;
  play();
  assert.deepEqual([enemy.intent.moveId, enemy.intent.kind], [null, 'idle']);
  const gone = c.eventLog.find(event => event.type === 'enemyMoveUnavailable' && event.sourceId === enemy.id);
  assert.deepEqual([gone.moveId, gone.resource, gone.reason], [moveId, 'stance', 'stanceBroken']);
  assert.equal(c.rng.getCounters().enemyAI || 0, ai);
  assert.deepEqual(definition, before);
  assert.equal(Object.hasOwn(definition.moves, moveId), false);
});

test('a broken base Counter advances to its instance-only level follow-up without a new AI pick or registry mutation', () => {
  const { c, enemy, play } = fight({ maneuver: 'sweep', amount: 5, block: 0, stance: 'counter', armCounter: true });
  const definition = c.registries.enemies.get(enemy.enemyId);
  const before = structuredClone(definition);
  const moveId = 'level.fixtureFollowup';
  enemy.extraMoves = { [moveId]: { id: moveId, enemyId: enemy.enemyId, intent: 'attack', sp: 1,
    damage: 4, weight: 1, tags: ['camp:physical', 'maneuver:attack', 'range:melee'] } };
  enemy.plannedMoves = [{ moveId, sp: 1 }];
  const ai = c.rng.getCounters().enemyAI || 0;
  assert.doesNotThrow(play);
  assert.equal(enemy.intent.moveId, moveId);
  assert.deepEqual(enemy.plannedMoves, []);
  const gone = c.eventLog.find(event => event.type === 'enemyMoveUnavailable' && event.sourceId === enemy.id);
  assert.deepEqual([gone.moveId, gone.resource, gone.reason], ['parry', 'stance', 'stanceBroken']);
  assert.equal(c.rng.getCounters().enemyAI || 0, ai);
  assert.deepEqual(definition, before);
  assert.equal(Object.hasOwn(definition.moves, moveId), false);
});

