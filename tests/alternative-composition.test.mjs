import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';
import { alternativeEnemyTargetGrid } from '../src/ui/models/AlternativeEnemyTargetGridModel.js';

test('alternative labeled targets keep their original 88 pixel cells', () => {
  const targets = [{ id: 'a', x: 280, y: 190 }, { id: 'b', x: 350, y: 190 }];
  const slots = alternativeEnemyTargetGrid({ width: 650, height: 400, targets });
  assert.equal(slots.length, 2);
  assert(slots.every(slot => slot.width === 88 && slot.height === 88));
});

test('every body stands on its cell\'s foot anchor', () => {
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player', visibleWidth: 60, leading: 40,
    slot: { id, x: [65, 195, 325][i], ground: [400, 210, 290][i] } }));
  const sizes = actors.map(a => ({ id: a.slot.id, x: 0, visibleHeight: 120, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width: 390, height: 460 });
  fit.forEach((size, i) => {
    assert.equal(size.x, actors[i].slot.x);
    assert.equal(size.ground, actors[i].slot.ground);
    assert.equal(size.visibleHeight, 120, 'composition never refits the body');
  });
});

test('a body at the field edge stays on stage', () => {
  const actor = { side: 'enemy', visibleWidth: 100, leading: 40, slot: { id: 'a', x: 10, ground: 300 } };
  const [fit] = alternativeCombatComposition({ actors: [actor], sizes: [{ id: 'a', visibleHeight: 120, scale: 1, multiplier: 1 }], width: 390 });
  assert.equal(fit.x, 56);
});
