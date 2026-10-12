import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition, combatStandingGround, SHORT_PHONE_ENEMY_LIFT } from '../src/ui/models/CombatCompositionModel.js';
import { alternativeEnemyTargetGrid } from '../src/ui/models/AlternativeEnemyTargetGridModel.js';
import { fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { allocateCombatBands } from '../src/ui/models/CombatLayout.js';
import { combatBandConfig } from '../src/ui/models/CombatBandConfigModel.js';
import { footerArtHeight } from '../src/ui/models/FooterLayoutModel.js';

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

test('a crowded narrow row shares overlap among enemies instead of crossing the player', () => {
  // Review scenario: 320x568 phone, three wide enemies, player at the left.
  const actors = ['p', 'a', 'b', 'c'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 120, leading: 40, slot: { id, ground: 230 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [60, 200, 260, 200][i], visibleHeight: 120, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width: 320, height: 248, handTop: 400 });
  const player = fit[0];
  for (const enemy of fit.slice(1)) {
    const half = 120 * enemy.scale / 2;
    assert(enemy.x - half >= player.x - 1e-9, `${enemy.id} stays right of the player's centre line`);
    assert(enemy.x + half <= 320 - 6 + 1e-9, `${enemy.id} stays on stage`);
  }
});

test('a short portrait field keeps its enemies back on the floor, clear of the player', () => {
  // Owner's phone (2026-10-11): a 360x620 game viewport leaves a ~267px field
  // (under 300, so not "spacious"). Enemies used to drop to ~83% of the field,
  // almost on the player's foot line.
  const height = 267, width = 360;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 240 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 220, 300][i], visibleHeight: 80, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height });
  const [player, ...enemies] = fit;
  for (const enemy of enemies) {
    assert.ok(enemy.ground <= height * .6, `enemy feet at ${enemy.ground}`);
    assert.ok(enemy.ground >= enemy.visibleHeight + 40 + 6, 'intent and HP keep their headroom');
    assert.ok(player.ground - enemy.ground >= height * .25, 'depth between the player and the enemy row');
  }
});

test('a short portrait phone lifts its enemies a little; the camera keeps the unlifted standing line', () => {
  // Owner (2026-10-11): at 360x620 the enemy figures stand higher, their intent
  // and HP still clear of the ribbon. The backdrop frames the standing line,
  // which must not move with the lift, so the horizon stays where it was.
  const height = 267, width = 360;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 240 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 220, 300][i], visibleHeight: 80, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height });
  const backRow = height * .48 + (240 - height * .9) * .25;
  const [, ...enemies] = fit;
  assert.equal(SHORT_PHONE_ENEMY_LIFT, .05);
  for (const enemy of enemies) assert.ok(Math.abs(enemy.ground - (backRow - height * SHORT_PHONE_ENEMY_LIFT)) < 1e-9,
    `enemy feet at ${enemy.ground}, expected the back row lifted by 5% of the field`);
  assert.ok(Math.abs(combatStandingGround(fit, actors, 0) - backRow) < 1e-9, 'standing line is the unlifted back row');
});

// Widescreen back row (the owner's 1920x1080 window). The back-row ground line
// is height x .48 here (the stage slots sit at .9 of the field). A wide enemy's
// art is capped midway between its uncapped height and the headroom above that
// line (owner's "middle ground", 2026-10-12), so its feet land between the old
// position and the line: below the line, above where they were uncapped.
function wideStage1080() {
  const zoom = 1080 / 730, width = 1920 / zoom;
  const bands = allocateCombatBands({ width, height: 730, zoom, footerArtPx: footerArtHeight(width, zoom, true) * zoom }, combatBandConfig(true));
  return { width, height: bands.battlefield };
}

function wideEncounter({ width, height, enemies, leading = 66 }) {
  const player = { slot: { id: 'p', x: width * .3, ground: height * .9, depth: 1, side: 'player' }, side: 'player',
    ratio: 1, multiplier: 1, leading: 20, visibleWidth: 90, visibleHeight: 200, footOffset: 0, enemyId: 'reaver' };
  const foes = enemies.map((e, i) => ({ slot: { id: `e${i}`, x: width * .8, ground: height * .9, depth: 1, side: 'enemy' },
    side: 'enemy', ratio: e.ratio, multiplier: e.multiplier ?? 1, leading, visibleWidth: 110, visibleHeight: e.visibleHeight,
    footOffset: 0, enemyId: e.enemyId ?? 'bloodHound' }));
  return [player, ...foes];
}

const wideCases = [
  ['one normal enemy', [{ ratio: .9, visibleHeight: 150 }]],
  ['three normal enemies', [{ ratio: .9, visibleHeight: 150 }, { ratio: .9, visibleHeight: 150 }, { ratio: .9, visibleHeight: 150 }]],
  ['one boss', [{ ratio: 1.3, multiplier: 1.25, visibleHeight: 300, enemyId: 'boss' }]],
];

for (const [label, enemies] of wideCases) {
  test(`wide 1920x1080 ${label}: art is midway between uncapped and the back-row fit, feet between the line and their old place`, () => {
    const { width, height } = wideStage1080();
    const actors = wideEncounter({ width, height, enemies });
    const sizes = fitAlternativeSprites({ width, height, actors, narrow: false });
    const fits = alternativeCombatComposition({ sizes, actors, width, height, handLeft: width * .35, solo: enemies.length === 1, wide: true });
    const backGround = height * .48;
    for (const enemy of fits.filter(fit => fit.id.startsWith('e'))) {
      const uncapped = Math.min(sizes.find(size => size.id === enemy.id).visibleHeight, height * .7);
      const backRowFit = backGround - 66 - 6;
      assert.ok(enemy.visibleHeight > backRowFit + 1e-9 && enemy.visibleHeight < uncapped - 1e-9,
        `enemy ${enemy.id} art ${enemy.visibleHeight} is not between the back-row fit ${backRowFit} and uncapped ${uncapped}`);
      assert.ok(enemy.ground > backGround + 1e-9, `enemy ${enemy.id} feet at ${enemy.ground} are not below the back row ${backGround}`);
      assert.ok(enemy.ground < uncapped + 66 + 6 - 1e-9, `enemy ${enemy.id} feet at ${enemy.ground} did not rise from ${uncapped + 72}`);
      assert.ok(enemy.visibleHeight + 66 + 6 <= enemy.ground + 1e-9,
        `enemy ${enemy.id} art ${enemy.visibleHeight} plus headroom overruns its feet at ${enemy.ground}`);
    }
  });
}

test('the classic (non-wide) 1920x1080 composition keeps its unscaled figure and descending feet', () => {
  const { width, height } = wideStage1080();
  const actors = wideEncounter({ width, height, enemies: [{ ratio: .9, visibleHeight: 150 }] });
  const sizes = fitAlternativeSprites({ width, height, actors, narrow: false });
  const [, enemy] = alternativeCombatComposition({ sizes, actors, width, height, handLeft: width * .35, solo: true, wide: false });
  const fitted = sizes.find(size => size.id === 'e0').visibleHeight;
  assert.equal(enemy.visibleHeight, fitted, 'the figure is not scaled down outside the wide layout');
  assert.equal(enemy.ground, Math.max(fitted + 66 + 6, height * .48), 'feet keep the unchanged non-wide placement');
});
