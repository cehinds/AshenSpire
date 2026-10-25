import test from 'node:test';
import assert from 'node:assert/strict';
import { MEGA_MAPS } from '../src/content/environments.js';
import { paintingFrame, paintingPointAt, terrainSettingAt } from '../src/model/mapPaintingFrame.js';
import { presentationProblems } from '../src/model/locationPresentation.js';

const box = { x0: 0, y0: 0, w: 400, h: 1000 };
const painting = { terrain: [
  { rect: [0.4, 0.4, 0.2, 0.2], settingId: 'city' },
  { rect: [0.3, 0.3, 0.4, 0.4], settingId: 'forest' },
  { rect: [0.0, 0.0, 0.2, 0.2], settingId: 'shore' },
] };
// A frame that puts the whole painting 1:1 on the board, unmirrored or mirrored.
const plain = { cw: 400, ch: 600, ox: 0, oy: 100, flipX: false, flipY: false };
const mirrored = { cw: 400, ch: 600, ox: 0, oy: 100, flipX: true, flipY: true };

test('paintingPointAt inverts placement and mirroring', () => {
  assert.deepEqual(paintingPointAt(plain, { x: 100, y: 190 }), { u: 0.25, v: 0.15 });
  assert.deepEqual(paintingPointAt(mirrored, { x: 300, y: 610 }), { u: 0.25, v: 0.15 });
  assert.equal(paintingPointAt(null, { x: 1, y: 1 }), null);
});

test('terrainSettingAt takes the first zone that holds the point', () => {
  assert.equal(terrainSettingAt(painting, plain, { x: 200, y: 400 }), 'city');
  assert.equal(terrainSettingAt(painting, plain, { x: 130, y: 330 }), 'forest');
  assert.equal(terrainSettingAt(painting, plain, { x: 20, y: 120 }), 'shore');
  assert.equal(terrainSettingAt(painting, plain, { x: 390, y: 690 }), null);
});

test('terrainSettingAt reads the unmirrored painting under a flipped frame', () => {
  // Board (380,680) is the painting's top-left once both axes are mirrored.
  assert.equal(terrainSettingAt(painting, mirrored, { x: 380, y: 680 }), 'shore');
  assert.equal(terrainSettingAt(painting, plain, { x: 380, y: 680 }), null);
  assert.equal(terrainSettingAt(painting, mirrored, { x: 200, y: 400 }), 'city');
});

test('terrainSettingAt is null without a frame, zones or point', () => {
  assert.equal(terrainSettingAt(painting, null, { x: 200, y: 400 }), null);
  assert.equal(terrainSettingAt({}, plain, { x: 200, y: 400 }), null);
  assert.equal(terrainSettingAt(painting, plain, null), null);
});

test('a real framed painting resolves a zone through its own frame', () => {
  const world = MEGA_MAPS.find((m) => m.id === 'the-fractured-realm');
  const frame = paintingFrame({ anchor: world.biomes['hollow-weald'], aspect: 2 / 3, box, start: { x: 200, y: 950 } });
  assert.ok(frame);
  // The centre of the authored city zone, projected into the board, reads back as city.
  const [x, y, w, h] = world.terrain.find((z) => z.settingId === 'city').rect;
  const u = x + w / 2, v = y + h / 2;
  const point = { x: frame.flipX ? frame.ox + frame.cw - u * frame.cw : frame.ox + u * frame.cw,
    y: frame.flipY ? frame.oy + frame.ch - v * frame.ch : frame.oy + v * frame.ch };
  assert.equal(terrainSettingAt(world, frame, point), 'city');
});

test('every authored terrain zone is well formed and names a known setting', () => {
  assert.deepEqual(presentationProblems(), []);
  const settings = new Set(['road', 'city', 'forest', 'dungeon', 'mine', 'shore', 'bridge']);
  for (const world of MEGA_MAPS) {
    assert.ok(world.terrain?.length, `${world.id} has terrain zones`);
    for (const { rect, settingId } of world.terrain) {
      assert.ok(settings.has(settingId), `${world.id}: ${settingId}`);
      const [x, y, w, h] = rect;
      assert.ok(w > 0 && h > 0 && x >= 0 && y >= 0 && x + w <= 1.0001 && y + h <= 1.0001, `${world.id} rect ${rect}`);
    }
  }
});
