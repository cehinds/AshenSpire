import test from 'node:test';
import assert from 'node:assert/strict';
import { cardAffectsEnemies, hitBadgeTargetIds } from '../src/model/hitBadge.js';

// Owner ruling D8 (2026-10-18): the hit-% badge shows on each valid target while a
// card that can inflict damage or an effect on it is selected. No Perception gate.
const enemies = [{ id: 'a', alive: true }, { id: 'b', alive: true }, { id: 'c', alive: false }];
test('damaging card shows a badge on every living enemy, whatever Perception read', () => {
  const strike = { effects: [{ op: 'damage', target: 'enemy', amount: 6 }] };
  assert.deepEqual(hitBadgeTargetIds(strike, enemies), ['a', 'b']);
});
test('effect-only card against enemies shows a badge', () => {
  assert.deepEqual(hitBadgeTargetIds({ effects: [{ op: 'applyStatus', target: 'enemy', status: 'weak' }] }, enemies), ['a', 'b']);
  assert.equal(cardAffectsEnemies({ counterPayload: { hp: 4 } }), true);
});
test('no selection or a self-only card shows no badge', () => {
  assert.deepEqual(hitBadgeTargetIds(null, enemies), []);
  assert.deepEqual(hitBadgeTargetIds({ effects: [{ op: 'block', target: 'self', amount: 5 }] }, enemies), []);
});
