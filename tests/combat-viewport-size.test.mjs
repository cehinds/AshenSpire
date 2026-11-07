import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';
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
  assert.equal(statureMultiplier(1.75), 1.15);
  assert.equal(statureMultiplier(3), 1.15);
  assert.ok(Math.abs(targetBodyHeight({ viewportHeight: 800, portraitPhone: true, ratio: 1 }) - 176 * .5866) < 1e-9);
});

test('every combatant is combatantScale x the base share; a large one is x the stature cap', () => {
  const cfg = uiConfig.presentation.combatFormationModel.sizing.viewportScale;
  assert.equal(cfg.combatantScale, .5866);
  assert.equal(cfg.enemyScale, undefined);
  const player = targetBodyHeight({ viewportHeight: 800, portraitPhone: true, ratio: 1 });
  const enemy = targetBodyHeight({ viewportHeight: 800, portraitPhone: true, ratio: 1 });
  const large = targetBodyHeight({ viewportHeight: 800, portraitPhone: true, ratio: 1.75 });
  assert.ok(Math.abs(player - 800 * .22 * .5866) < 1e-9);
  assert.equal(enemy, player);
  assert.ok(Math.abs(large / player - 1.15) < 1e-9);
});

test('size ignores enemy count, the other side and ground depth', () => {
  const player = actor('p', 'player', 200, 0);
  const one = fit([player, actor('e1', 'enemy', 900, 0)]);
  const five = fit([player, ...[0, 1, 2, 3, 4].map(i => actor('e' + i, 'enemy', 700 + i * 110, i % 2))]);
  assert.ok(Math.abs(one.find(f => f.id === 'p').visibleHeight - 720 * .26 * .5866) < 1e-9);
  assert.ok(Math.abs(five.find(f => f.id === 'p').visibleHeight - 720 * .26 * .5866) < 1e-9);
  for (const f of five) assert.ok(Math.abs(f.visibleHeight - 720 * .26 * .5866) < 1e-9);
  assert.equal(five.lastResort, null);
});

test('a normal enemy equals the player; a large one is x1.15 of that', () => {
  const sizes = fit([actor('p', 'player', 200, 0), actor('e', 'enemy', 900, 0), actor('big', 'enemy', 1100, 1, 1.75)]);
  assert.ok(Math.abs(sizes[1].visibleHeight / sizes[0].visibleHeight - 1) < 1e-9);
  assert.ok(Math.abs(sizes[2].visibleHeight / sizes[1].visibleHeight - 1.15) < 1e-9);
});

test('neighbours in a row are spaced apart before anything is scaled', () => {
  const sizes = fit([actor('a', 'enemy', 900, 0), actor('b', 'enemy', 905, 0)]);
  assert.equal(sizes.lastResort, null);
  assert.equal(sizes[1].slid, true, 'a slid figure is flagged for composition');
  assert.ok(sizes[1].x - sizes[0].x >= sizes[0].visibleHeight * 120 / 190 * .6 - 1e-6);
  assert.equal(sizes[0].visibleHeight, sizes[1].visibleHeight);
});

test('a crowded phone row scales every combatant by one common factor', () => {
  const actors = [actor('p', 'player', 60, 0), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => actor('e' + i, 'enemy', 100 + i * 20, 0))];
  const sizes = fitViewportSprites({ width: 360, actors, viewportHeight: 780, portraitPhone: true });
  assert.ok(sizes.lastResort > 0 && sizes.lastResort < 1);
  for (const f of sizes) assert.ok(Math.abs(f.visibleHeight - 780 * .22 * .5866 * sizes.lastResort) < 1e-6, 'one common factor, player included');
});

test('row, display and Settings scale multipliers never resize a figure', () => {
  const sizes = fit([actor('p', 'player', 200, 0, 1, { multiplier: 2, userScale: 1.5 }), actor('e', 'enemy', 900, 0, 1, { multiplier: .3, userScale: 2 })]);
  assert.ok(Math.abs(sizes[0].visibleHeight - 720 * .26 * .5866) < 1e-9);
  assert.ok(Math.abs(sizes[1].visibleHeight - 720 * .26 * .5866) < 1e-9);
});

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)) / ((a.w + b.w) / 2);
const VIEWPORTS = [[360, 780, true], [390, 844, true], [844, 390, false], [1280, 720, false], [1440, 900, false], [1920, 1080, false]];

test('grid composition: enemies in one band never hide behind one another after composition', () => {
  for (const [w, h, phone] of VIEWPORTS) for (const n of [1, 3, 5]) {
    const actors = [actor('p', 'player', w * .1, 0, 1, { leading: 30 }), ...Array.from({ length: n }, (_, i) =>
      actor('e' + i, 'enemy', w * (.5 + i * .09), 0, 1, { visibleWidth: 150 }))];
    const sizes = fitViewportSprites({ width: w, actors, viewportHeight: h, portraitPhone: phone });
    const placed = alternativeCombatComposition({ sizes, actors, width: w, height: h, perspectiveGrid: true, solo: false });
    const boxes = placed.filter(s => s.id !== 'p').map(s => ({ x: s.x, w: s.visibleHeight * 150 / 190 }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(overlap(boxes[i], boxes[j]) <= .4 + 1e-6, `${w}x${h} n=${n}: ${i}-${j} overlap ${overlap(boxes[i], boxes[j])}`);
    }
  }
});

test('the hand top is a floor: a lone player shrinks (common factor) rather than stand in the hand', () => {
  const actors = [actor('p', 'player', 100, 0, 1, { leading: 40 }), actor('e', 'enemy', 900, 0)];
  const free = fit(actors, { solo: true, handTop: 700 });
  assert.equal(free.lastResort, null);
  const tight = fit(actors, { solo: true, handTop: 150 });
  assert.ok(tight.lastResort > 0 && tight.lastResort < 1);
  const p = tight.find(f => f.id === 'p');
  assert.ok(p.visibleHeight + 40 + 6 <= 150 + 1e-6, 'feet (with headroom) end above the hand top');
  assert.ok(Math.abs(tight.find(f => f.id === 'e').visibleHeight - p.visibleHeight) < 1e-9, 'everyone shrinks together');
});

test('a hidden or unmeasured hand (top 0 or below) never shrinks the figures', async () => {
  // Review on #2511: getBoundingClientRect().top is 0 for a hidden hand, which once collapsed every figure to minCommonFactor.
  const mod = await import('../src/ui/models/CombatViewportSizeModel.js');
  const src = (await import('node:fs')).readFileSync(new URL('../src/ui/models/CombatViewportSizeModel.js', import.meta.url), 'utf8');
  assert.match(src, /Number\.isFinite\(handTop\) && handTop > 0/);
  assert.equal(typeof mod.fitViewportSprites, 'function');
});
