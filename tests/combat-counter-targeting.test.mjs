import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { cardNeedsEnemyTarget, friendlyTargetPlan } from '../src/model/friendlyTargets.js';
import { cardTargetPlan, immediateCardEffects } from '../src/model/cardTargets.js';

const registries = createRegistries(contentBundle);
const players = [{ id: 'a', alive: true, connected: true }, { id: 'b', alive: true, connected: true }];
const enemies = [{ id: 'e1', alive: true }];
const counter = { tags: ['camp:physical', 'maneuver:counter', 'counter:melee'], effects: [
  { op: 'damage', target: 'enemy', amount: 4 }, { op: 'poiseDamage', target: 'enemy', amount: 2 },
  { op: 'block', target: 'self', amount: 4 },
] };

test('Counter client and engine plans agree on immediate self support', () => {
  assert.equal(cardNeedsEnemyTarget(counter), false);
  assert.deepEqual(immediateCardEffects(counter).map(effect => effect.op), ['block']);
  assert.deepEqual(friendlyTargetPlan(counter, 'a', players).legalIds, ['a']);
  assert.deepEqual(cardTargetPlan(counter, 'a', enemies, players), { mode: 'friendly', legalIds: ['a'] });
});

test('Counter immediate hostile support and preview charges retain enemy aiming', () => {
  for (const def of [
    { ...counter, effects: [...counter.effects, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }] },
    { ...counter, combatPreview: { needsTarget: true } },
  ]) {
    assert.equal(cardNeedsEnemyTarget(def), true);
    assert.equal(friendlyTargetPlan(def, 'a', players).active, false);
    assert.deepEqual(cardTargetPlan(def, 'a', enemies, players), { mode: 'enemy', legalIds: ['e1'] });
  }
  const ally = { ...counter, effects: [counter.effects[0], { op: 'block', target: 'ally', amount: 4 }] };
  assert.equal(cardNeedsEnemyTarget(ally), false);
  assert.deepEqual(friendlyTargetPlan(ally, 'a', players).legalIds, ['b']);
});

test('real co-op Counter prepares without an enemy target and rejects enemy aiming', () => {
  const c = createCoopCombat({ registries, rng: createRng(50), players: [{ id: 'a', classId: 'reaver',
    hp: 200, maxHp: 200, mana: 20, maxMana: 20, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 'counter1', cardId: 'riposte' }], relicIds: [] }],
    enemyIds: ['wanderingSoldier'], ratingsRules: null });
  const def = registries.cards.get('riposte'), hp = c.enemies[0].hp;
  assert.equal(cardNeedsEnemyTarget(def), false);
  assert.equal(friendlyTargetPlan(def, 'a', players).active, false, 'default Counter protection needs no aim transaction');
  assert.deepEqual(cardTargetPlan(def, 'a', enemies, players).legalIds, ['a']);
  assert.throws(() => playCard(c, 'a', 'counter1', c.enemies[0].id), /Invalid friendly target/);
  playCard(c, 'a', 'counter1');
  assert.equal(c.enemies[0].hp, hp);
  assert.equal(c.players.get('a').entity.block, 6);
  assert.equal(c.players.get('a').entity.wardBlock, 2);
  assert.equal(c.players.get('a').entity.combatCounter.charges, 1);
});
