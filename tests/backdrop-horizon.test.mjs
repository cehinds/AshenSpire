import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alternativeCombatComposition, combatSceneryGround, combatStandingGround } from '../src/ui/models/CombatCompositionModel.js';

// Owner (2026-10-11): at 360x620 the battlefield showed only ground. Moving
// short-portrait enemies back (0ec3cf026) also moved the backdrop camera,
// which follows the enemy ground, so the horizon and landmark left the field.
const height = 267, width = 360;
const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
  visibleWidth: 60, leading: 40, slot: { id, ground: 240 } }));
const sizes = actors.map((a, i) => ({ id: a.slot.id, x: [80, 220, 300][i], visibleHeight: 80, scale: 1, multiplier: 1 }));

test('a short portrait field frames its backdrop on the near row while its enemies stand back', () => {
  const fit = alternativeCombatComposition({ actors, sizes, width, height, handTop: height });
  const nearRow = 240 - height * .07;
  assert.ok(Math.abs(combatSceneryGround(fit, actors, 0) - nearRow) < 1e-9, 'camera keeps the pre-0ec3cf026 framing');
  assert.ok(combatStandingGround(fit, actors, 0) <= height * .6, 'enemies stay on the back row');
  assert.ok(combatStandingGround(fit, actors, 0) < combatSceneryGround(fit, actors, 0) - 40);
});

test('a tablet spacious field frames its backdrop on the enemy ground as before', () => {
  const tall = alternativeCombatComposition({ actors, sizes, width, height: 376, handTop: 376 });
  assert.equal(combatSceneryGround(tall, actors, 0), combatStandingGround(tall, actors, 0));
  assert.ok(tall.every(fit => fit.sceneryGround === undefined));
});

// Owner (2026-10-12): desktop looks like the approved phone. Its camera frames
// the near row, so the horizon and landmark stay in view, and its shared back
// row stays on the floor, above the near row.
test('a desktop field frames its backdrop on the near row and keeps the back row on its floor', () => {
  const desktopWidth = 1280, height = 417;
  const deskActors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player',
    visibleWidth: 60, leading: 40, slot: { id, ground: 360 } }));
  const deskSizes = deskActors.map((a, i) => ({ id: a.slot.id, x: [260, 560, 900][i], visibleHeight: 200, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors: deskActors, sizes: deskSizes, width: desktopWidth, height, handTop: height, desktop: true });
  const nearRow = 360 - height * .07;
  assert.ok(Math.abs(combatSceneryGround(fit, deskActors, 0) - nearRow) < 1e-9, 'camera frames the near row');
  const standing = combatStandingGround(fit, deskActors, 0);
  assert.ok(Math.abs(standing - fit[1].ground) < 1e-9, 'standing line is the shared back-row foot line');
  assert.ok(standing >= height * .48 - 1e-9 && standing <= height * .8, 'back row stands on the floor, not in the sky');
  assert.ok(standing < combatSceneryGround(fit, deskActors, 0) - 40, 'the horizon sits above the back row');
});

test('the backdrop never frames so low that the back-row feet leave its standing area', () => {
  const art = readFileSync(new URL('../src/ui/alternativeArt.js', import.meta.url), 'utf8');
  assert.match(art, /Math\.min\(ground, standGround \+ \(device\.groundAnchor - standingTop\) \* device\.height \* scale\)/);
  const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  assert.match(stage, /standGround: combatStandingGround\(sizes, actors, plan\.ground\) \/ zoom/);
});

// Owner (2026-10-12): the desktop camera frames the landmark's horizon in the
// top band of the field, like the phone (about 13%), not above it.
test('a desktop camera puts the landmark horizon a set share of the way down the field', async () => {
  const { alternativeArtCatalog } = await import('../src/ui/alternativeArtCatalog.js');
  const { horizonCameraGround, LANDMARK_HORIZON_SHARE } = await import('../src/ui/alternativeArt.js');
  const device = alternativeArtCatalog.scenes['pale-marches-2'].devices.desktop;
  const height = 347.5, width = 1200;
  const scale = Math.max(width / device.width, height / device.height);
  const ground = horizonCameraGround(device, { height, scale, share: .2 });
  const landmark = device.layers.find(layer => /landmark/.test(layer.id));
  const horizonCanvas = landmark.y + LANDMARK_HORIZON_SHARE * landmark.height;
  // The canvas top sits at fieldTop + ground - groundAnchor * device.height * scale.
  const horizonOnField = ground - device.groundAnchor * device.height * scale + horizonCanvas * scale;
  assert.ok(Math.abs(horizonOnField - .2 * height) < 1e-9, `horizon at ${horizonOnField / height} of the field`);
  assert.equal(horizonCameraGround({ layers: [], height: 1024, width: 1536, groundAnchor: .82 }, { height, scale, share: .2 }), undefined);
});
