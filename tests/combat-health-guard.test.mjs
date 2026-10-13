import test from 'node:test';
import assert from 'node:assert/strict';
import { healthGuardTone, protectionPresentation } from '../src/model/blockPresentation.js';
import { combatHealthModel } from '../src/ui/models/CombatHealthModel.js';

test('the HP fill takes the highest layer still standing: Barrier > Block > Ward > none', () => {
  assert.equal(healthGuardTone({ barrier: 2, defense: 3, wardPool: 4 }), 'barrier');
  assert.equal(healthGuardTone({ barrier: 0, defense: 3, wardPool: 4 }), 'block');
  assert.equal(healthGuardTone({ barrier: 0, defense: 0, wardPool: 4 }), 'ward');
  assert.equal(healthGuardTone({ barrier: 0, defense: 0, wardPool: 0 }), 'none');
  assert.equal(healthGuardTone({}), 'none');
});

test('as each layer breaks the fill drops to the next one', () => {
  assert.equal(healthGuardTone({ barrier: 0, defense: 3, wardPool: 4 }), 'block', 'Barrier broke');
  assert.equal(healthGuardTone({ barrier: 0, defense: 0, wardPool: 4 }), 'ward', 'Block broke');
  assert.equal(healthGuardTone({ barrier: 0, defense: 0, wardPool: 0 }), 'none', 'Ward broke');
});

test('protectionPresentation keeps the Ward pool apart from Barrier and Block', () => {
  const p = protectionPresentation({ block: 5, wardBlock: 2, persistentWard: { value: 3 }, barrier: 1, persistentPoise: { value: 4 } });
  assert.equal(p.defense, 3);
  assert.equal(p.barrier, 1);
  assert.equal(p.wardPool, 5);
  assert.equal(p.poise, 4);
  assert.equal(p.ward, 6, 'the badge total still counts Barrier');
});

test('combatHealthModel carries the guard tone and the Poise trim', () => {
  assert.equal(combatHealthModel({ defense: 0, ward: 3, barrier: 0, poise: 0, wardPool: 3 }).guard, 'ward');
  assert.equal(combatHealthModel({ defense: 2, ward: 0, barrier: 0, poise: 0 }).guard, 'block');
  assert.equal(combatHealthModel({ defense: 2, ward: 3, barrier: 1, poise: 0 }).guard, 'barrier');
  assert.equal(combatHealthModel({}).guard, 'none');
  assert.equal(combatHealthModel({ poise: 3 }).poise, 3);
});

test('the Ward badge names its per-turn Ward guard apart from the Ward pool', () => {
  const guarded = protectionPresentation({ block: 5, wardBlock: 3, persistentWard: { value: 4 } });
  assert.equal(guarded.wardGuard, 3);
  const badge = combatHealthModel(guarded).badges.find(row => row.kind === 'ward');
  assert.equal(badge.value, 7, 'the Ward badge is the guard plus the persistent pool');
  assert.equal(badge.guard, 3);
  const plain = protectionPresentation({ block: 5, persistentWard: { value: 4 } });
  assert.equal(plain.wardGuard, 0);
  const plainBadge = combatHealthModel(plain).badges.find(row => row.kind === 'ward');
  assert.equal(plainBadge.value, 4);
  assert.equal(plainBadge.guard, 0);
  assert.equal(combatHealthModel({ ward: 3 }).badges[0].guard, 0, 'a caller without wardGuard reads no guard');
});
