import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';

test('alternative battlefield keeps its approved stature, center and hand overlap', () => {
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 300 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 270, 340][i],
    visibleHeight: 150, scale: 1.5, multiplier: 1 }));
  const result = alternativeCombatComposition({ actors, sizes, width: 390, height: 400, handTop: 440 });
  assert.equal(result[0].visibleHeight, 192);
  assert.equal(result[0].ground, 440 + 192 * .5);
  assert.equal(result[0].x, 80 + 390 * .035);
  assert.equal(result[1].visibleHeight, 120);
  assert.equal((result[1].x + result[2].x) / 2, 390 * .55);
  assert.equal(result[2].x - result[1].x, 70);
});
