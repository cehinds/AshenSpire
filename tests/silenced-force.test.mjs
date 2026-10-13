// Silenced in expanded combat (owner, 2026-10-13): a Silenced creature is immune to Force. Each Force
// hit is negated whole (its arcane and blunt halves alike) and spends one Silenced stack; once the stacks
// run out, later hits land. A Force effect that is not damage spends one stack per application. The
// preview shows 0 for an immune hit, so preview equals commit. Ward and Block are not touched by an immune hit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { getStacks } from '../src/engine/statuses.js';
import { isForceHit } from '../src/model/combatRatings.js';

const OVERRIDES = {
  // Star Shower (school:force): three 3-damage hits, nothing else.
  starShower: { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 3 }], cost: 0, manaCost: 0, upgrade: undefined },
  // Starstone Pebble (school:force) reshaped as a pure Force effect on the target.
  starstonePebble: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }], cost: 0, manaCost: 0, upgrade: undefined, type: 'skill' },
};
const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => OVERRIDES[card.id] ? { ...card, ...OVERRIDES[card.id] } : card) });

function setup(cardId, stacks, version = 2) {
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: version, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId, instanceId: 'c', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.block = enemy.barrier = 0; enemy.hp = enemy.maxHp = 200;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {}; enemy.damageResistPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward: 0 };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  if (enemy.persistentWard) enemy.persistentWard.value = enemy.persistentWard.max = 0;
  if (stacks) enemy.statuses.silenced = { stacks, duration: 2 };
  return { combat, enemy };
}

test('a Force hit is the force school or any Arcane part', () => {
  assert.equal(isForceHit({ camp: 'spell', school: 'force', damageType: 'arcane' }), true);
  assert.equal(isForceHit({ camp: 'spell', tags: ['school:force'] }), true);
  assert.equal(isForceHit({ camp: 'physical', damageType: 'force' }), true);
  assert.equal(isForceHit({ camp: 'physical', damageType: 'blunt', damageComponents: [{ type: 'blunt', weight: 60 }, { type: 'arcane', weight: 40 }] }), true, 'Ruinous Blow: its Arcane part is Force');
  assert.equal(isForceHit({ camp: 'spell', damageType: 'arcane' }), true, 'a sceptre arcane attack is Force');
  assert.equal(isForceHit({ camp: 'physical', damageType: 'blunt' }), false);
  assert.equal(isForceHit({ camp: 'spell', school: 'fire', damageType: 'fire' }), false);
});

test('a 3-hit Force card into 2 Silenced stacks: hits 1 and 2 are immune and spend 2 -> 1 -> 0, hit 3 lands', () => {
  const { combat, enemy } = setup('starShower', 2);
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  const hits = out.events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.deepEqual(hits.map(e => !!e.immune), [true, true, false]);
  assert.deepEqual(hits.map(e => e.amount), [0, 0, 3]);
  const removals = out.events.filter(e => e.type === 'statusRemoved' && e.status === 'silenced');
  assert.equal(removals.length, 2, 'one stack per immune hit, logged');
  assert.equal(getStacks(enemy, 'silenced'), 0);
  assert.equal(before - enemy.hp, 3);
  // The log order per hit: the negated hit, then its stack.
  const order = out.events.filter(e => (e.type === 'damageDealt' && e.targetId === enemy.id) || (e.type === 'statusRemoved' && e.status === 'silenced')).map(e => e.type);
  assert.deepEqual(order.slice(0, 4), ['damageDealt', 'statusRemoved', 'damageDealt', 'statusRemoved']);
});

test('the preview shows 0 for the immune hits, so preview equals commit', () => {
  const { combat, enemy } = setup('starShower', 2);
  const shown = previewCard(combat, 'c', enemy.id).values.find(row => row.op === 'damage');
  const before = enemy.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  assert.deepEqual(shown.perTargetHitDamages[enemy.id].slice(0, 2), [0, 0], 'the immune hits preview 0');
  assert.equal(shown.totalDamage, before - enemy.hp);
  assert.equal(before - enemy.hp, 3);
});

test('without Silenced every Force hit lands; legacy combat keeps no Force immunity', () => {
  for (const version of [2, 1]) {
    const { combat, enemy } = setup('starShower', version === 1 ? 2 : 0, version);
    const before = enemy.hp;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
    assert.ok(before - enemy.hp >= 9, `v${version}: all three hits land`);
  }
});

test('a non-damage Force effect on a Silenced enemy spends 1 stack', () => {
  const { combat, enemy } = setup('starstonePebble', 2);
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  assert.equal(getStacks(enemy, 'silenced'), 1);
});

test('Ruinous Blow (Blunt + Force) is a Force hit: a Silenced enemy is immune to it and spends a stack', () => {
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'reaver', maxHp: 200, hp: 200, maxMana: 50, mana: 50, energyMax: 10, drawPerTurn: 5, relicIds: [],
      deck: [{ instanceId: 'c', cardId: 'ruinousBlow' }],
      loadout: { sets: { rightHand: ['straightSword'], leftHand: [null], armor: ['default'] }, active: { rightHand: 0, leftHand: 0, armor: 0 } } } });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 500; enemy.statuses.silenced = { stacks: 1, duration: 2 };
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  const hits = out.events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.equal(hits[0].immune, true);
  assert.equal(hits[0].amount, 0);
  assert.equal(getStacks(enemy, 'silenced'), 0);
  assert.equal(before - enemy.hp, hits.reduce((sum, e) => sum + e.amount, 0));
});

// Any Force-card effect on the Silenced creature spends a stack (owner, 2026-10-13): here a Ward strip and a draw.
// Test-only Force cards cloned from Starstone Pebble (school:force, damage:arcane), each with one shape of effect.
const pebble = contentBundle.cards.find(card => card.id === 'starstonePebble');
const pebbleRows = contentBundle.tagging.filter(row => row.family === 'card' && row.objectId === 'starstonePebble');
const FORCE_CARDS = {
  testForceStrip: { type: 'skill', effects: [{ op: 'wardDamage', target: 'enemy', amount: 1 }] },
  testForceDraw: { type: 'skill', effects: [{ op: 'draw', amount: 1 }] },
  // A Force status first, then a Force hit: the status spends the last stack, but the hit's immunity was decided up front.
  testForceStatusHit: { type: 'attack', effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }, { op: 'damage', target: 'enemy', amount: 6 }] },
};
const FORCE_OPS = createRegistries({ ...contentBundle,
  cards: [...contentBundle.cards, ...Object.entries(FORCE_CARDS).map(([id, card]) => ({ ...pebble, id, name: id, cost: 0, manaCost: 0, upgrade: undefined, ...card }))],
  tagging: [...contentBundle.tagging, ...Object.entries(FORCE_CARDS).flatMap(([id, card]) => pebbleRows.map(row => ({ ...row, objectId: id,
    tagId: row.tagId === 'classification.attack' ? `classification.${card.type}` : row.tagId })))] });

function forceSetup(cardId, { enemyStacks = 0, playerStacks = 0 } = {}) {
  const combat = createCombat({ registries: FORCE_OPS, rng: createRng(801), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId, instanceId: 'c', upgraded: false }, { cardId: 'strike', instanceId: 'd', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 200; enemy.block = enemy.barrier = 0;
  if (enemyStacks) enemy.statuses.silenced = { stacks: enemyStacks, duration: 2 };
  if (playerStacks) combat.player.statuses.silenced = { stacks: playerStacks, duration: 2 };
  return { combat, enemy };
}

test('a Force Ward strip on a Silenced enemy spends 1 stack', () => {
  const { combat, enemy } = forceSetup('testForceStrip', { enemyStacks: 2 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  assert.equal(getStacks(enemy, 'silenced'), 1);
});

test('a Force draw spends 1 of its Silenced owner\'s stacks and none of the enemy\'s', () => {
  const { combat, enemy } = forceSetup('testForceDraw', { enemyStacks: 2, playerStacks: 2 });
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c' });
  assert.equal(getStacks(combat.player, 'silenced'), 1);
  assert.equal(getStacks(enemy, 'silenced'), 2);
});

test('immunity is decided up front: a status that spends the last stack does not un-immune the same card\'s hit', () => {
  const { combat, enemy } = forceSetup('testForceStatusHit', { enemyStacks: 1 });
  const before = enemy.hp;
  const shown = previewCard(combat, 'c', enemy.id).values.find(row => row.op === 'damage');
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  const hit = out.events.find(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.equal(hit.immune, true);
  assert.equal(before - enemy.hp, 0);
  assert.equal(shown.totalDamage, 0, 'the preview shows 0 too');
  assert.equal(getStacks(enemy, 'silenced'), 0);
});
