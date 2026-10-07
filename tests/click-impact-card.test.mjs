import test from 'node:test';
import assert from 'node:assert/strict';
import { hasImmediateHostileDamage } from '../tools/click-impact-card.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';

const registries = createRegistries(contentBundle);
const card = cardId => resolveCard(registries, { cardId, upgraded: false });

test('latency sample candidates use immediate hostile payload rather than Attack card class', () => {
  const counter = card('guardCounter');
  assert.equal(counter.type, 'attack', 'fixture reproduces the old type-only picker');
  assert.equal(hasImmediateHostileDamage(counter), false, 'Counter reply happens on enemy impact');
  assert.equal(hasImmediateHostileDamage(card('strike')), true);
  assert.equal(hasImmediateHostileDamage(card('defend')), false);
  assert.equal(hasImmediateHostileDamage(null), false);
});

test('hostile area/random payloads qualify, while self and support effects do not', () => {
  for (const target of ['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']) {
    assert.equal(hasImmediateHostileDamage({ effects: [{ op: 'damage', target, value: 6 }] }), true);
    assert.equal(hasImmediateHostileDamage({ effects: [{ op: 'damage', target, value: 6 }] }, { targeted: true }), target === 'enemy');
  }
  assert.equal(hasImmediateHostileDamage({ effects: [{ op: 'damage', target: 'self', value: 6 }] }), false);
  assert.equal(hasImmediateHostileDamage({ effects: [{ op: 'poiseDamage', target: 'enemy', value: 6 }] }), false);
});
