import test from 'node:test';
import assert from 'node:assert/strict';
import { assertImmediateContracts } from '../tools/combat-audit/cards.mjs';
test('positive authored effects require operation receipts even when card dispatch succeeds', () => {
  const card = { id: 'fixture', effects: [{ op: 'damage', amount: 6, target: 'enemy' }] };
  assert.throws(() => assertImmediateContracts(card, [{ type: 'cardPlayed', cardInstanceId: 'a' }], 'a'), /must emit damageDealt/);
  assert.throws(() => assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'b', incoming: 6 }], 'a'), /must emit damageDealt/);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'a', incoming: 6 }], 'a').covered, ['damage']);
});
test('counter reply payload requires preparation rather than premature HP damage', () => {
  const card = { id: 'counter', tags: ['maneuver:counter'], effects: [{ op: 'damage', amount: 6 }] };
  assert.throws(() => assertImmediateContracts(card, [], 'a'), /payload must arm/);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'combatCounterArmed', cardInstanceId: 'a' }], 'a'), {
    covered: ['counter-preparation'], uncovered: ['deferred-damage'] });
});
