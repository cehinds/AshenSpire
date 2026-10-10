import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneLayers, sceneWindowLayers, battlefieldBackdropConfig } from '../src/ui/models/SceneLayerModel.js';
import { illustratedBackgroundHtml } from '../src/ui/components/illustratedBackground.js';
import { targetLayer, targetOutline } from '../src/ui/models/TargetLayerModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';
import { ENVIRONMENTS } from '../src/content/environments.js';
import { LEGACY_SCENES } from '../src/model/legacyDungeon.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const scenes = ENVIRONMENTS.flatMap(region => region.scenes);
// Battlefield sizes measured in the browser: 1440x860, 1280x800, 390x844,
// 375x667 (stacked) and 844x390 (rails).
const fields = [[1440, 460], [1280, 424], [390, 450], [375, 336], [844, 148], [360, 470]];
// Where a crop draws atlas point (ax, ay) in battlefield px.
const project = ([vx, vy, vw, vh], width, height, ax, ay) => [(ax - vx) * width / vw, (ay - vy) * height / vh];

test('alternative scene renderer preserves the authored layer order without mutating its catalog', () => {
  const layers = Object.freeze([{ id: 'floor' }, { id: 'structures' }, { id: 'skybox' }]);
  assert.deepEqual(layers.map(layer => layer.id), ['floor', 'structures', 'skybox']);
  const html = illustratedBackgroundHtml({ region: 'test', scene: 'test', viewBox: [0, 0, 100, 100],
    layers: layers.map(layer => ({ ...layer, href: 'test.webp', width: 100, height: 100 })) });
  assert(html.indexOf('data-layer="floor"') < html.indexOf('data-layer="structures"'));
  assert(html.indexOf('data-layer="structures"') < html.indexOf('data-layer="skybox"'));
});

test('full-screen backdrop grounds the figures using the battlefield window', () => {
  for (const [width, height, fieldTop, fieldHeight] of [[1910, 986, 98, 469], [390, 844, 84, 400], [844, 390, 40, 240]]) {
    const formation = combatFormation({ width, height: fieldHeight, friends: ['p1'], enemies: ['e1', 'e2'] });
    const sceneHeight = fieldTop + fieldHeight;
    const config = battlefieldBackdropConfig({ height: sceneHeight, fieldTop, fieldHeight, formation });
    const expectedFloor = fieldTop + Math.max(0, Math.min(...formation.cells.map(cell => cell.ground)) - formation.rowSpacing / 2);
    assert.deepEqual(config, battlefieldBackdropConfig({ height: sceneHeight, fieldTop, fieldHeight, formation: { ...formation, slots: [] } }), 'deaths do not pan the painting');
    for (const scene of [...scenes, ...LEGACY_SCENES]) {
      const layers = sceneWindowLayers({ width, height, windowTop: 0, windowHeight: sceneHeight, scene, config });
      const [x, y, w, h] = scene.box;
      const [, paintedFloor] = project(layers.frame.viewBox, width, height, x, y + scene.floorStart * h);
      assert.ok(near(paintedFloor, expectedFloor), `${scene.id}: skyline clears the furthest feet by half a row`);
      for (const slot of formation.slots) assert.ok(fieldTop + slot.ground >= paintedFloor - 1e-6, 'feet meet or extend below the floor within projection roundoff');
      const [vx, vy, vw, vh] = layers.skyline.viewBox;
      assert.ok(vx >= x && vy >= y && vx + vw <= x + w + 1e-9 && vy + vh <= y + h + 1e-9, 'battlefield crop stays inside its atlas cell');
      const [, paintedSkyTop] = project(layers.frame.viewBox, width, height, x, y);
      assert.ok(paintedSkyTop <= 1e-6, 'sky covers the header without an empty top band');
      const html = illustratedBackgroundHtml({ region: 'test', scene: scene.id, viewBox: scene.box, layers: [] });
      assert.ok(html.includes(`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${scene.box.join(' ')}" overflow="hidden">`), 'frame continuation clips adjacent atlas cells');
    }
  }
});

test('WGS1: the plate covers the battlefield undistorted, its ground on the floor band', () => {
  const { floorFraction } = wireframeUi.scene;
  for (const scene of scenes) for (const [width, height] of fields) {
    const { skyline, floor, aligned } = sceneLayers({ width, height, scene });
    assert.ok(aligned);
    const [vx, vy, vw, vh] = skyline.viewBox;
    assert.ok(near(vw / vh, width / height), 'crop keeps the battlefield aspect, so nothing stretches');
    const [x, y, w, h] = scene.box;
    assert.ok(vx >= x && vy >= y && vx + vw <= x + w + 1e-9 && vy + vh <= y + h + 1e-9, `${scene.id} ${width}x${height}: crop stays inside the painting`);
    assert.ok(near(floor.top, height * (1 - floorFraction)));
    assert.ok(near(floor.height, height * floorFraction));
    const [, groundY] = project(skyline.viewBox, width, height, x, y + scene.floorStart * h);
    assert.ok(near(groundY, floor.top, 1e-6), `${scene.id} ${width}x${height}: painted ground ${groundY} meets floor ${floor.top}`);
    assert.ok(near(floor.paintedTop, floor.top));
  }
});

test('WGS7 floor owns the formation: every foot stands on the floor band', () => {
  const ids = (p, n) => Array.from({ length: n }, (_, i) => p + i);
  for (const [width, height] of fields) {
    const { floor } = sceneLayers({ width, height, scene: scenes[0] });
    const plan = combatFormation({ width, height, friends: ids('p', 6), enemies: ids('e', 6) });
    for (const slot of plan.slots) assert.ok(slot.ground >= floor.top, `${width}x${height}: foot ${slot.ground} below floor top ${floor.top}`);
  }
});

test('layer toggles change the paint, never the feet', () => {
  const scene = scenes[5];
  const on = sceneLayers({ width: 390, height: 450, scene });
  const noFloor = sceneLayers({ width: 390, height: 450, scene, config: { ...wireframeUi.scene, floor: false } });
  const noSky = sceneLayers({ width: 390, height: 450, scene, config: { ...wireframeUi.scene, skyline: false } });
  assert.equal(noFloor.aligned, false);
  assert.equal(noFloor.floor.visible, false);
  assert.equal(noFloor.floor.top, on.floor.top, 'the floor band keeps its place for actors');
  const [vx, vy, vw, vh] = noFloor.skyline.viewBox;
  assert.ok(near(vx + vw / 2, scene.box[0] + scene.box[2] / 2) && near(vy + vh / 2, scene.box[1] + scene.box[3] / 2), 'floor off: plain centred cover crop');
  assert.equal(noSky.skyline.visible, false);
  assert.deepEqual(noSky.skyline.viewBox, on.skyline.viewBox);
  assert.ok(Object.isFrozen(on) && Object.isFrozen(on.skyline.viewBox));
  // No scene (or no size): no crop is invented.
  assert.equal(sceneLayers({ width: 0, height: 0, scene }).aligned, false);
  assert.equal(sceneLayers({ width: 390, height: 450, scene: null }).skyline.viewBox, null);
});

test('WGC4: only living enemies are eligible, and only while a command is armed', () => {
  const enemies = [{ id: 'e1', alive: true }, { id: 'e2', alive: false }, { id: 'e3', alive: true }];
  assert.deepEqual([...targetLayer({ armed: true, enemies }).eligibleIds], ['e1', 'e3']);
  assert.equal(targetLayer({ armed: true, enemies }).active, true);
  assert.deepEqual([...targetLayer({ armed: false, enemies }).eligibleIds], []);
  assert.equal(targetLayer({ armed: true, enemies: [{ id: 'e2', alive: false }] }).active, false, 'nothing to aim at is not an armed layer');
});

test('WGC4: the target outline holds its physical minimum under the depth zoom', () => {
  const c = wireframeUi.targetLayer;
  for (const scale of [0.4, 0.6, 0.7115, 1, 1.5, 2]) {
    const { width, offset } = targetOutline({ scale });
    // The browser floors outline widths to whole device pixels.
    assert.ok(Math.floor(width * scale) >= c.outlineMinPx, `outline at ${scale} draws ${Math.floor(width * scale)} px`);
    assert.ok(Math.floor(offset * scale) >= c.offsetMinPx, `offset at ${scale}`);
    assert.ok(width >= c.outlinePx && offset >= c.offsetPx, 'never thinner than authored');
  }
  assert.deepEqual({ ...targetOutline({ scale: 1.5 }) }, { width: c.outlinePx, offset: c.offsetPx }, 'large sprites keep the authored outline');
});
