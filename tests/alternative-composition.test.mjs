import test from 'node:test';
import assert from 'node:assert/strict';
import { combatSpriteGeometry } from '../src/ui/components/combatSpriteGeometry.js';
import { combatArtworkKey } from '../src/ui/models/CombatCompositionModel.js';
import { alternativeCombatComposition, combatStandingGround, SPACIOUS_RIBBON_RESERVE } from '../src/ui/models/CombatCompositionModel.js';
import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
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
  const fit = alternativeCombatComposition({ actors, sizes, width: 390, height: 460, perspectiveGrid: true });
  fit.forEach((size, i) => {
    assert.equal(size.x, actors[i].slot.x);
    assert.equal(size.ground, actors[i].slot.ground);
    assert.equal(size.visibleHeight, 120, 'composition never refits the body');
  });
});

test('a body at the field edge stays on stage', () => {
  const actor = { side: 'enemy', visibleWidth: 100, leading: 40, slot: { id: 'a', x: 10, ground: 300 } };
  const [fit] = alternativeCombatComposition({ actors: [actor], sizes: [{ id: 'a', visibleHeight: 120, scale: 1, multiplier: 1 }], width: 390, perspectiveGrid: true });
  assert.equal(fit.x, 56);
});

test('selected pose reach clamps mobile artwork without refitting its body or domain cell', () => {
  const stage = { dataset: { idleHeightRatio: '1', idleWidthRatio: String(246/261), maximumWidthRatio: String(456/261) },
    matches: selector => selector === '.painted-stage', querySelector: () => null };
  // The live alternative card stage is the sprite's first child itself,
  // rather than a painted stage nested inside a separate sprite wrapper.
  const sprite = { firstElementChild: stage, offsetHeight: 190, offsetWidth: 179 };
  const geometry = combatSpriteGeometry(sprite, () => {});
  const aimed = { ...sprite, firstElementChild: { matches: () => false, querySelector: () => null },
    querySelector: selector => selector === ':scope > .painted-stage[data-maximum-width-ratio]' ? stage : null };
  assert.deepEqual(combatSpriteGeometry(aimed, () => {}), geometry, 'a preceding self-target outline cannot hide the pilot envelope');
  const nested = { ...sprite, firstElementChild: { querySelector: selector => selector === '.painted-stage' ? stage : null } };
  assert.equal(combatSpriteGeometry(nested, () => {}).edgeWidth, geometry.edgeWidth, 'root and nested stages carry the same edge reserve');
  assert.equal(geometry.visibleWidth, 179, 'fitting preserves the directly mounted body box, including DOM rounding');
  const actor = { side: 'player', ...geometry, leading: 0,
    slot: { id: 'player', cell: 'C1', x: 63.13275125, ground: 373.44975 } };
  const size = { id: 'player', scale: .6080383240223463, visibleHeight: 186.34860359596735, multiplier: 1 };
  const before = structuredClone(actor);
  const [fitted] = alternativeCombatComposition({ actors: [actor], sizes: [size], width: 390, perspectiveGrid: true });
  assert.ok(fitted.x > actor.slot.x, 'the screen edge requires a presentation shift');
  assert.ok(fitted.x - geometry.edgeWidth*fitted.scale/2 >= 6-1e-9);
  assert.ok(fitted.x + geometry.edgeWidth*fitted.scale/2 <= 384+1e-9);
  assert.equal(fitted.scale, size.scale);
  assert.equal(fitted.visibleHeight, size.visibleHeight);
  assert.equal(fitted.ground, actor.slot.ground);
  assert.deepEqual(actor, before, 'the domain cell and its foot anchor remain authoritative');
  const layout = { width: 390, height: 426, zoom: 1, actors: [actor] };
  assert.notEqual(combatArtworkKey(layout), combatArtworkKey({ ...layout, actors: [{ ...actor, edgeWidth: undefined }] }),
    'changing reviewed pose coverage invalidates the cached presentation');
  for (const width of [390, 1440]) {
    const centred = { ...actor, slot: { ...actor.slot, x: width/2 } };
    assert.equal(alternativeCombatComposition({ actors: [centred], sizes: [size], width, perspectiveGrid: true })[0].x,
      width/2, 'a figure already within the viewport stays at its existing centre');
  }
  delete stage.dataset.maximumWidthRatio;
  const original = { ...geometry }; delete original.edgeWidth;
  assert.deepEqual(combatSpriteGeometry(sprite, () => {}), original,
    'other directly mounted profiles retain all their existing geometry');
});

test('a short portrait field keeps its enemies back on the floor, clear of the player', () => {
  // Owner's phone (2026-10-11): a 360x620 game viewport leaves a ~267px field.
  // On the perspective grid the enemy ranks stay well behind the party's.
  const height = 267, width = 360;
  const plan = alternativeFormation(combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a', 'b'] }), width, height, true);
  const actors = plan.slots.map(slot => ({ slot, side: slot.side, visibleWidth: 60, visibleHeight: 160, leading: 40, ratio: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes: fitAlternativeSprites({ width, height, actors, narrow: true }), width, height, perspectiveGrid: true });
  const player = fit.find(f => f.id === 'p');
  for (const enemy of fit.filter(f => f.id !== 'p')) {
    assert.ok(enemy.ground <= height * .6, `enemy feet at ${enemy.ground}`);
    assert.ok(enemy.ground >= enemy.visibleHeight + 40 + 6 - 1e-9, 'intent and HP keep their headroom');
    assert.ok(player.ground - enemy.ground >= height * .25, 'depth between the player and the enemy row');
  }
  // The perspective composition carries no camera override: the backdrop frames the back rank.
  assert.equal(combatStandingGround(fit, actors, 0), Math.min(...fit.filter(f => f.id !== 'p').map(f => f.ground)));
});

test('a 130px field keeps short enemies readable on their distinct foot anchors', () => {
  const height = 130, width = 844;
  const plan = alternativeFormation(combatFormation({ width, height,
    presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a', 'b', 'c', 'd'] }), width, height, false);
  const actors = plan.slots.map(slot => ({ slot, side: slot.side, visibleWidth: 60,
    visibleHeight: 160, leading: 58, ratio: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors,
    sizes: fitAlternativeSprites({ width, height, actors, narrow: false }), width, height, perspectiveGrid: true });
  const enemies = fit.filter(size => size.id !== 'p');
  for (const size of enemies) {
    const actor = actors.find(candidate => candidate.slot.id === size.id);
    assert.ok(size.visibleHeight >= actor.slot.box.height - 1e-9, 'the overhead union cannot collapse the body');
    assert.equal(size.ground, actor.slot.ground, 'the body stays on its cell shadow');
  }
  assert.equal(new Set(enemies.map(size => size.ground)).size, 2, 'the two enemy ranks keep distinct foot lines');
});

// Owner (2026-10-12): desktop enemies stand in one back row on a shared foot
// line, like the approved phone, instead of each slot's own depth.
test('desktop enemies share one back-row foot line, with intent and HP clear of the ribbon', () => {
  const width = 1440, height = 417;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: [330, 380, 340][i] } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [260, 900, 1180][i],
    visibleHeight: 200, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true });
  const enemies = fit.slice(1);
  assert.equal(new Set(enemies.map(e => e.ground)).size, 1, 'one shared foot line');
  for (const enemy of enemies) {
    const headroom = enemy.ground - enemy.visibleHeight - actors[1].leading;
    assert.ok(headroom >= SPACIOUS_RIBBON_RESERVE - 1e-9, `intent and HP at ${headroom} clear the ribbon`);
  }
  assert.ok(enemies[0].ground <= height * .8, 'the row stays on the floor, not in the sky');
});

test('desktop enemies are centred near two thirds of the width and no enemy passes 0.8', () => {
  const width = 1440, height = 417;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 360 } }));
  // Far-apart formation columns: the 1.3 spread would push the far enemy past 0.8.
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [260, 620, 1140][i],
    visibleHeight: 200, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true });
  const enemies = fit.slice(1);
  const left = Math.min(...enemies.map(e => e.x)), right = Math.max(...enemies.map(e => e.x));
  assert.ok(Math.abs((left + right) / 2 - width * .66) < 1e-6, `centre at ${(left + right) / 2 / width}`);
  assert.ok(right <= width * .8 + 1e-9, `far enemy at ${right / width}`);
  assert.ok(left >= width * .5, `near enemy at ${left / width}`);
});

test('a tablet spacious field keeps its own depth rows (no shared desktop line)', () => {
  const width = 1024, height = 400;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: [330, 380, 340][i] } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [260, 500, 700][i],
    visibleHeight: 100, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height });
  assert.notEqual(fit[1].ground, fit[2].ground, 'tablet enemies keep their slot depth');
});

// Owner (2026-10-12): at 1280x720 the desktop bands leave the field near 297px,
// under the spacious threshold. The desktop shared back row, its centring and
// the 0.80 cap still apply there.
test('a 1280x720 desktop field (about 297px high) still shares the back row and caps it', () => {
  const width = 1280, height = 297;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: [250, 280, 265][i] } }));
  // Far-apart formation columns: an uncapped 1.3 spread would push the far enemy past 0.8.
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [200, 560, 1100][i],
    visibleHeight: 110, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true });
  const enemies = fit.slice(1);
  assert.equal(new Set(enemies.map(e => e.ground)).size, 1, 'one shared foot line at 297px');
  assert.ok(enemies[0].ground <= height * .8, 'the row stays on the floor');
  const left = Math.min(...enemies.map(e => e.x)), right = Math.max(...enemies.map(e => e.x));
  assert.ok(Math.abs((left + right) / 2 - width * .66) < 1e-6, `centre at ${(left + right) / 2 / width}`);
  assert.ok(right <= width * .8 + 1e-9, `far enemy at ${right / width}`);
  for (const enemy of enemies) {
    const headroom = enemy.ground - enemy.visibleHeight - actors[1].leading;
    assert.ok(headroom >= SPACIOUS_RIBBON_RESERVE - 1e-9, `intent and HP at ${headroom} clear the ribbon`);
  }
  // Horizon framing: the backdrop frames the near row, as on the spacious desktop.
  assert.ok(enemies.every(e => e.sceneryGround !== undefined), 'desktop enemies carry the horizon framing');
});

// Codex P2 (2026-10-12): at 1280x720 a back row above the standing area lifted
// the backdrop camera off the horizon. The row now moves down to that floor.
test('a desktop back row moves down onto the standing-area floor and never up', () => {
  const width = 1280, height = 297;
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 250 } }));
  const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [200, 560, 900][i], visibleHeight: 110, scale: 1, multiplier: 1 }));
  const without = alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true });
  const floor = 244;
  const withFloor = alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true, horizonFloor: floor });
  const [, ...enemies] = withFloor;
  assert.equal(new Set(enemies.map(e => e.ground)).size, 1, 'still one shared foot line');
  for (const enemy of enemies) assert.ok(enemy.ground >= floor - 1e-9, `feet at ${enemy.ground}, below the floor ${floor}`);
  assert.ok(enemies[0].ground > without[1].ground, 'the row moved down');
  // A floor above the field never pushes the row past its bottom edge.
  const low = alternativeCombatComposition({ actors, sizes, width, height, handTop: height, desktop: true, horizonFloor: 400 });
  assert.ok(low[1].ground <= height + 1e-9, 'the row stays inside the field');
  // Without a floor, or on a phone, nothing changes.
  const phone = alternativeCombatComposition({ actors, sizes, width: 360, height: 267, handTop: 267, horizonFloor: 300 });
  assert.deepEqual(phone, alternativeCombatComposition({ actors, sizes, width: 360, height: 267, handTop: 267 }));
});
