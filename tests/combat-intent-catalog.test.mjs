import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
import { primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { combatMatchups } from '../src/content/combatMatchups.js';

test('hidden intent cannot mark active move or replace public base damage with live damage', () => {
  const definition = { id: 'visibilityFixture', moves: {
    strike: { intent: 'attack', damage: 4 },
    guard: { intent: 'block', block: 3 },
  } };
  // A defensive second boundary: malformed callers cannot accidentally make
  // an inspector reveal a move the engine has marked hidden.
  const preview = { hidden: true, moveId: 'strike', damage: 99, hits: 7, pending: true };
  const before = JSON.stringify({ definition, preview });
  const cards = enemyMoveCards(definition, { preview });
  assert.equal(cards.some(card => card.active), false);
  assert.match(cards[0].detail, /4 base damage/);
  assert.doesNotMatch(cards[0].detail, /99|preview damage/);
  assert.doesNotMatch(cards[0].meta, /Current intent|Charging/);
  assert.equal(JSON.stringify({ definition, preview }), before);
});

test('enemy counter catalog explains reaction payload using active rules', () => {
  const definition = { id: 'counterFixture', moves: { parry: { intent: 'block', block: 4,
    counterDamage: 6, counterPoiseDamage: 2,
    tags: ['camp:physical', 'maneuver:counter', 'counter:melee'] } } };
  const rules = { incomingMultiplier: 0.4, retaliationMultiplier: 2, retaliationFlat: 7, poiseMultiplier: 3 };
  const [card] = enemyMoveCards(definition, { registries: { balance: { combatMatchups: { counter: rules } } } });
  assert.match(card.detail, /6 base counter damage/);
  assert.match(card.detail, /Incoming eligible damage × 0.4/);
  assert.match(card.detail, /floor\(base × 2\) \+ 7 \+ bonus/);
  assert.match(card.detail, /2 base counter Poise damage × 3/);
});

test('scaled enemy Counter catalog base agrees with armed runtime payload', () => {
  const move = { intent: 'block', block: 4, counterDamage: 6,
    tags: ['camp:physical', 'maneuver:counter', 'counter:melee'] };
  const definition = { id: 'counterScaleFixture', moves: { parry: move } };
  for (const damageMult of [0.5, 2, 2.25]) {
    const enemy = { id: 'e1', enemyId: definition.id, damageMult };
    const context = { combatMatchupRules: combatMatchups, enqueue() {} };
    primeEnemyCounter(context, enemy, move, 'parry');
    const [card] = enemyMoveCards(definition, { enemy });
    assert.ok(card.detail.includes(`${enemy.combatCounter.damage} base counter damage`),
      `damageMult ${damageMult}: catalog must state the armed payload ${enemy.combatCounter.damage}`);
  }
});
