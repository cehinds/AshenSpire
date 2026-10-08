import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyTargetGrid } from '../src/ui/models/EnemyTargetGridModel.js';

const overlaps = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left
  && a.top < b.top + b.height && a.top + a.height > b.top;

for (const [width, height] of [[320, 250], [390, 420], [844, 150], [1440, 600]]) {
  test(`crowded foes keep distinct square slots inside ${width}×${height}`, () => {
    const targets = Array.from({ length: 3 }, (_, index) => ({ id: `e${index}`, x: width * .65, y: height * .5 }));
    const obstacles = [{ left: 0, top: 0, width, height: 35 }];
    const placements = enemyTargetGrid({ width, height, targets, obstacles });
    assert.equal(placements.length, targets.length);
    for (const [index, slot] of placements.entries()) {
      assert.equal(slot.width, slot.height);
      assert.ok(slot.width >= 48);
      assert.ok(slot.left >= 8 && slot.top >= 8);
      assert.ok(slot.left + slot.width <= width - 8 && slot.top + slot.height <= height - 8);
      assert.ok(!obstacles.some(rect => overlaps(slot, rect)));
      assert.ok(!placements.slice(index + 1).some(rect => overlaps(slot, rect)));
    }
    assert.deepEqual(enemyTargetGrid({ width, height, targets, obstacles }), placements);
  });
}

test('isolated enemy uses its nearest free grid center', () => {
  const target = { id: 'e1', x: 210, y: 210 };
  const [slot] = enemyTargetGrid({ width: 420, height: 420, targets: [target] });
  assert.ok(Math.abs(slot.left + slot.width / 2 - target.x) <= 47);
  assert.ok(Math.abs(slot.top + slot.height / 2 - target.y) <= 47);
  assert.deepEqual(enemyTargetGrid({ width: 420, height: 420, targets: [] }), []);
});

test('shifted grid fits narrow free band between intent and health controls', () => {
  const targets = [480, 600, 720].map((x, index) => ({ id: `e${index}`, x, y: 75 }));
  const obstacles = [{ left: 0, top: 0, width: 844, height: 35 }, { left: 0, top: 115, width: 844, height: 35 }];
  const slots = enemyTargetGrid({ width: 844, height: 150, targets, obstacles });
  assert.equal(slots.length, 3);
  assert.ok(slots.every(slot => !obstacles.some(rect => overlaps(slot, rect))));
});

test('fully occupied inspection area still produces distinct enemy buttons', () => {
  const slots = enemyTargetGrid({ width: 320, height: 200, targets: [1,2,3].map(id => ({ id, x: 100, y: 100 })),
    obstacles: [{ left: 0, top: 0, width: 320, height: 200 }] });
  assert.equal(slots.length, 3);
  assert.ok(slots.every((slot, index) => !slots.slice(index + 1).some(other => overlaps(slot, other))));
});

test('crowded fallback keeps the player sprite clear', () => {
  const player = { left: 0, top: 40, width: 180, height: 160 };
  const slots = enemyTargetGrid({ width: 320, height: 200,
    targets: [1,2,3].map(id => ({ id, x: 180, y: 110 })), hardObstacles: [player],
    obstacles: [{ left: 0, top: 0, width: 320, height: 55 },
      { left: 180, top: 50, width: 140, height: 80 }, { left: 180, top: 150, width: 140, height: 50 }] });
  assert.equal(slots.length, 3);
  assert.ok(slots.every((slot, index) => !overlaps(slot, player)
    && !slots.slice(index + 1).some(other => overlaps(slot, other))));
});
