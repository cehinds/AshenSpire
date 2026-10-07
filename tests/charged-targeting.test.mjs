import test from 'node:test';
import assert from 'node:assert/strict';
import { cardNeedsEnemyTarget, friendlyTargetPlan } from '../src/model/friendlyTargets.js';

test('a resolved hostile charge overrides self-only card aiming in the client target plan', () => {
  const players = [{ id: 'a', alive: true, connected: true }, { id: 'b', alive: true, connected: true }];
  const guard = { effects: [{ op: 'block', target: 'self', amount: 4 }] };
  assert.deepEqual(friendlyTargetPlan(guard, 'a', players).legalIds, ['a']);
  assert.equal(cardNeedsEnemyTarget(guard), false);
  const charged = { ...guard, combatPreview: { needsTarget: true } };
  assert.equal(friendlyTargetPlan(charged, 'a', players).active, false);
  assert.equal(cardNeedsEnemyTarget(charged), true);
  assert.equal(cardNeedsEnemyTarget({ effects: [{ target: 'enemy' }] }), true);
  assert.equal(cardNeedsEnemyTarget({ effects: [{ target: 'allEnemies' }] }), false);
});
