import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePersistentPoise } from '../src/engine/combatStatusControl.js';

// A card that restores Poise fills it first; the overflow becomes Block.
// Other restoration (an effect) stops at full Poise, as Ward does.
function fixture({ value, max = 10 }) {
  const events = [];
  const ctx = { combatExpansionVersion: 2, restorationModifierPercent: () => 0, emit: (type, payload) => events.push({ type, payload }) };
  const entity = { id: 'p1', alive: true, block: 0, statuses: {}, persistentPoise: { value, max } };
  return { ctx, entity, events };
}

test('a card restoring Poise 7/10 by 5 fills to 10/10 and adds Block 2', () => {
  const { ctx, entity, events } = fixture({ value: 7 });
  const r = restorePersistentPoise(ctx, entity, 5, { source: 'card' });
  assert.equal(entity.persistentPoise.value, 10);
  assert.equal(entity.block, 2);
  assert.equal(r.block, 2);
  const gained = events.find(e => e.type === 'blockGained');
  assert.equal(gained.payload.amount, 2);
  assert.equal(gained.payload.targetId, 'p1');
});

test('a card restoring full Poise 10/10 by 3 adds Block 3', () => {
  const { ctx, entity } = fixture({ value: 10 });
  const r = restorePersistentPoise(ctx, entity, 3, { source: 'card' });
  assert.equal(entity.persistentPoise.value, 10);
  assert.equal(entity.block, 3);
  assert.equal(r.restored, 0);
  assert.equal(r.block, 3);
});

test('an effect restoring full Poise does not turn the overflow into Block', () => {
  const { ctx, entity, events } = fixture({ value: 10 });
  const r = restorePersistentPoise(ctx, entity, 3, { source: 'effect' });
  assert.equal(entity.block, 0);
  assert.equal(r.block, undefined);
  assert.equal(events.some(e => e.type === 'blockGained'), false);
});

test('an effect restoring 7/10 by 5 stops at 10/10 with no Block', () => {
  const { ctx, entity } = fixture({ value: 7 });
  restorePersistentPoise(ctx, entity, 5, { source: 'effect' });
  assert.equal(entity.persistentPoise.value, 10);
  assert.equal(entity.block, 0);
});

// The overflow is Block, so it honors the entity's blockCap the way gainBlock does.
function capFixture({ block, cap, value = 10, max = 10 }) {
  const { ctx, entity, events } = fixture({ value, max });
  entity.block = block;
  entity.statuses = { wallCap: { stacks: 1 } };
  ctx.registries = { statuses: { get: id => ({ id, modifiers: { blockCap: cap } }) } };
  return { ctx, entity, events };
}

test('a card overflow of 3 at Block 4 under blockCap 5 adds only 1 Block and emits 1', () => {
  const { ctx, entity, events } = capFixture({ block: 4, cap: 5 });
  const r = restorePersistentPoise(ctx, entity, 3, { source: 'card' });
  assert.equal(entity.persistentPoise.value, 10);
  assert.equal(entity.block, 5, 'Block is clamped to the cap');
  assert.equal(r.block, 1);
  const gained = events.find(e => e.type === 'blockGained');
  assert.equal(gained.payload.amount, 1, 'blockGained carries the clamped amount');
  assert.equal(gained.payload.total, 5);
});

test('a card overflow at Block already at blockCap adds no Block and emits no blockGained', () => {
  const { ctx, entity, events } = capFixture({ block: 5, cap: 5 });
  const r = restorePersistentPoise(ctx, entity, 3, { source: 'card' });
  assert.equal(entity.block, 5);
  assert.equal(r.block, 0);
  assert.equal(events.some(e => e.type === 'blockGained'), false);
});
