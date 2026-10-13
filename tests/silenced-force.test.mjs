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
import { isForceProfile } from '../src/model/combatRatings.js';

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

test('the Force cards are the force school; arcane from another school is not Force', () => {
  assert.equal(isForceProfile({ camp: 'spell', school: 'force', damageType: 'arcane' }), true);
  assert.equal(isForceProfile({ camp: 'spell', tags: ['school:force'] }), true);
  assert.equal(isForceProfile({ camp: 'physical', damageType: 'force' }), true);
  assert.equal(isForceProfile({ camp: 'physical', damageType: 'arcane', damageComponents: [{ type: 'blunt', weight: 60 }, { type: 'arcane', weight: 40 }] }), false);
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
