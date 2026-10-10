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

test('enemies sharing a formation column are spread so neither hides the other', () => {
  const actors = ['p', 'a', 'b', 'c'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 300 } }));
  // a and c share a column (front and back rank), as in the 3-enemy phone fight.
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [60, 210, 290, 210][i],
    visibleHeight: 120, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width: 360, height: 250, handTop: 440 });
  const enemies = fit.slice(1).sort((l, r) => l.x - r.x);
  const half = enemy => 60 * enemy.scale / 2;
  for (let i = 1; i < enemies.length; i++)
    assert(enemies[i].x - enemies[i - 1].x >= (half(enemies[i]) + half(enemies[i - 1])) - 1e-9,
      'neighbouring enemies no longer overlap');
  assert(enemies.every(enemy => enemy.x - half(enemy) >= 6 - 1e-9 && enemy.x + half(enemy) <= 360 - 6 + 1e-9),
    'the group stays on stage');
});

test('a short landscape stage keeps depth ranks stacked for their overhead lanes', () => {
  const actors = ['p', 'a', 'c'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 120 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 500, 500][i], visibleHeight: 60, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width: 844, height: 140, handTop: 200 });
  assert.equal(fit[1].x, fit[2].x);
});
