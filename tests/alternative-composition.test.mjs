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

test('small phones reserve room for player health and tools without refitting on selection', () => {
  const actor = { side: 'player', visibleWidth: 60, leading: 80, slot: { id: 'p', ground: 170 } };
  const size = { id: 'p', x: 55, visibleHeight: 150, scale: 1.5, multiplier: 1 };
  const [result] = alternativeCombatComposition({ actors: [actor], sizes: [size], width: 288, height: 183, handTop: 183 });
  assert.equal(result.ground, 157);
  assert(result.visibleHeight + actor.leading + 6 <= result.ground);
  assert(result.ground + 19 < 183, 'HP and tool row retain separate space');
});

test('portrait composition keeps the player above cards and enemies in the upper field', () => {
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 300 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 270, 340][i],
    visibleHeight: 150, scale: 1.5, multiplier: 1 }));
  const result = alternativeCombatComposition({ actors, sizes, width: 390, height: 400, handTop: 440 });
  assert.equal(result[0].visibleHeight, 192);
  assert.equal(result[0].ground, 414);
  assert(result[0].ground < 440 - 19, 'reserve the idle HP strip above the hand');
  assert.equal(result[0].x, 80 + 390 * .035);
  assert.equal(result[1].visibleHeight, 150);
  assert(result.slice(1).every(enemy => enemy.ground <= 400 * .5));
  assert.equal((result[1].x + result[2].x) / 2, 390 * .66);
  assert.equal(result[2].x - result[1].x, 91);
});
