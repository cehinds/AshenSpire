import test from 'node:test';
import assert from 'node:assert/strict';
import { fitViewportSprites, targetBodyHeight, statureMultiplier, bodyHeightFraction } from '../src/ui/models/CombatViewportSizeModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const actor = (id, side, x, row, ratio = 1, over = {}) => ({ side, ratio, multiplier: .5, userScale: 1, visibleHeight: 190, visibleWidth: 120,
  slot: { id, side, x, row, ground: 600, fitGround: 600 }, ...over });
const fit = (actors, extra = {}) => fitViewportSprites({ width: 1280, actors, viewportHeight: 720, ...extra });

test('the tunable shares live in the formation config', () => {
  const share = uiConfig.presentation.combatFormationModel.sizing.viewportScale.bodyHeightFraction;
  assert.deepEqual(share, { portraitPhone: .22, landscape: .26 });
  assert.equal(bodyHeightFraction(true), .22);
  assert.equal(bodyHeightFraction(false), .26);
});

test('body height is the viewport share times a capped stature', () => {
  assert.equal(statureMultiplier(1), 1);
  assert.equal(statureMultiplier(1.75), 1.3);
  assert.equal(statureMultiplier(3), 1.3);
  assert.equal(targetBodyHeight({ viewportHeight: 800, portraitPhone: true, ratio: 1 }), 176);
});

test('size ignores enemy count, the other side and ground depth', () => {
  const player = actor('p', 'player', 200, 0);
  const one = fit([player, actor('e1', 'enemy', 900, 0)]);
  const five = fit([player, ...[0, 1, 2, 3, 4].map(i => actor('e' + i, 'enemy', 700 + i * 110, i % 2))]);
  assert.equal(one.find(f => f.id === 'p').visibleHeight, 720 * .26);
  assert.equal(five.find(f => f.id === 'p').visibleHeight, 720 * .26);
  for (const f of five) assert.equal(f.visibleHeight, 720 * .26);
  assert.equal(five.lastResort, null);
});

test('the player and a normal enemy are the same height; a large one is x1.3', () => {
  const sizes = fit([actor('p', 'player', 200, 0), actor('e', 'enemy', 900, 0), actor('big', 'enemy', 1100, 1, 1.75)]);
  assert.equal(sizes[0].visibleHeight, sizes[1].visibleHeight);
  assert.ok(Math.abs(sizes[2].visibleHeight / sizes[1].visibleHeight - 1.3) < 1e-9);
});

test('neighbours in a row are spaced apart before anything is scaled', () => {
  const sizes = fit([actor('a', 'enemy', 900, 0), actor('b', 'enemy', 905, 0)]);
  assert.equal(sizes.lastResort, null);
  assert.ok(sizes[1].x - sizes[0].x >= sizes[0].visibleHeight * 120 / 190 * .75 - 1e-6);
  assert.equal(sizes[0].visibleHeight, sizes[1].visibleHeight);
});

test('a crowded phone row scales every combatant by one common factor', () => {
  const actors = [actor('p', 'player', 60, 0), ...[0, 1, 2, 3, 4].map(i => actor('e' + i, 'enemy', 100 + i * 20, 0))];
  const sizes = fitViewportSprites({ width: 360, actors, viewportHeight: 780, portraitPhone: true });
  assert.ok(sizes.lastResort > 0 && sizes.lastResort < 1);
  for (const f of sizes) assert.ok(Math.abs(f.visibleHeight - 780 * .22 * sizes.lastResort) < 1e-6, 'one common factor, player included');
});

test('row and display multipliers never resize a figure; the Settings scale does', () => {
  const sizes = fit([actor('p', 'player', 200, 0, 1, { multiplier: 2, userScale: 1 }), actor('e', 'enemy', 900, 0, 1, { userScale: 1.5 })]);
  assert.equal(sizes[0].visibleHeight, 720 * .26);
  assert.equal(sizes[1].visibleHeight, 720 * .26 * 1.5);
});
