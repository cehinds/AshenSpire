import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestIds } from '../tools/art-source.mjs';
// Step 12: an id ships when art-manifest.json lists it (the pinned packs carry
// exactly those), not when a tree in this checkout happens to hold the file.
const SHIPPED = manifestIds();
import { ENVIRONMENTS, MEGA_MAPS, ENVIRONMENT_ATLAS_SIZE } from '../src/content/environments.js';
import { readFileSync } from 'node:fs';
import { paintingFrame, paintingGround } from '../src/model/mapPaintingFrame.js';
import { regionForRun, combatEnvironment, worldMapForRun, actRegionId } from '../src/model/environmentArt.js';
import { mapTerrainHtml } from '../src/ui/components/environmentArt.js';
import { mapKnowledge } from '../src/model/map/mapknowledge.js';

test('all five regions and twenty scenes are reachable without changing the run', () => {
  const seen = new Set();
  const run = Object.freeze({ seedString: 'ENVIRONMENT-COVERAGE', actNumber: 1, floor: 0 });
  for (let actNumber = 1; actNumber <= 5; actNumber++) {
    for (let floor = 0; floor < 4; floor++) seen.add(combatEnvironment({ ...run, actNumber, floor }).scene.id);
  }
  assert.equal(seen.size, 20);
  assert.deepEqual(combatEnvironment(run), combatEnvironment(JSON.parse(JSON.stringify(run))));
  assert.equal(new Set(Array.from({ length: 5 }, (_, i) => regionForRun({ ...run, actNumber: i + 1 }).id)).size, 5);
});

test('region depends on seed and act, not battle progress or engine randomness', () => {
  const run = { seedString: 'ASHEN', actNumber: 2, floor: 4 };
  assert.equal(regionForRun(run), regionForRun({ ...run, floor: 9, mapNodeId: 'node99' }));
  const seeds = new Set(Array.from({ length: 100 }, (_, i) => regionForRun({ seedString: `seed${i}` }).id));
  assert.equal(seeds.size, 5);
});

test('atlas rectangles stay inside shipped images and all artwork exists', () => {
  for (const r of ENVIRONMENTS) {
    for (const path of [r.atlas, r.map]) assert.ok(SHIPPED.has(path), path);
    assert.equal(r.scenes.length, 4);
    for (const { box: [x, y, w, h], floorStart, fieldRatio, groundAnchor } of r.scenes) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0);
      assert.ok(x + w <= ENVIRONMENT_ATLAS_SIZE[0] && y + h <= ENVIRONMENT_ATLAS_SIZE[1]);
      assert.ok(floorStart > 0 && floorStart < 1, 'authored floor boundary must be inside the painting');
      assert.equal(fieldRatio, 0.6, 'every scene reserves 60% clear ground');
      assert.ok(groundAnchor > floorStart && groundAnchor < 1, 'foot anchor is on the clear ground');
    }
  }
});

test('terrain reveal follows discovery and survives save/load without disclosing hidden nodes', () => {
  const nodes = Object.fromEntries(['a', 'b', 'c', 'd', 'boss'].map((id, i, ids) =>
    [id, { id, type: id === 'boss' ? 'boss' : 'fight', floor: i, col: 0, next: ids[i + 1] ? [ids[i + 1]] : [] }]));
  const graph = { nodes, startIds: ['a'], bossId: 'boss' };
  const first = mapKnowledge({ graph, run: { path: [] }, mode: 'fog' });
  const run = { path: ['a', 'b'], mapNodeId: 'b' };
  const later = mapKnowledge({ graph, run: JSON.parse(JSON.stringify(run)), mode: 'fog' });
  for (const id of first.drawn) assert.ok(later.drawn.has(id));
  assert.ok(later.drawn.has('c')); assert.ok(!later.drawn.has('d'));
  const points = [...later.drawn].map(id => ({ id, x: 10, y: nodes[id].floor * 50 }));
  const html = mapTerrainHtml({ world: MEGA_MAPS[0], width: 300, height: 600, points, fog: true });
  assert.ok(html.includes('data-terrain-node="c"'));
  assert.ok(!html.includes('data-terrain-node="d"'));
  assert.match(html, /class="map-detail-surface"[^>]+mask="url\(#terrain-/);
  const full = mapTerrainHtml({ world: MEGA_MAPS[0], width: 300, height: 600, points, fog: false });
  assert.doesNotMatch(full, /class="map-detail-surface"[^>]+mask=/);
  assert.notEqual(html.match(/id="(terrain-\d+)-light/)[1], full.match(/id="(terrain-\d+)-light/)[1]);
});


test('mega map painting is seed-stable; only its biome framing follows the act', () => {
  const run = Object.freeze({ seedString: 'WORLD', actNumber: 1, floor: 0 });
  const world = worldMapForRun(run);
  assert.equal(worldMapForRun({ ...run, actNumber: 5, floor: 12, path: ['a', 'b'] }), world);
  assert.equal(worldMapForRun({ ...run, seatOrder: ['reach', 'weald', 'marches'] }), world);
  assert.equal(worldMapForRun(JSON.parse(JSON.stringify(run))), world);
  assert.equal(new Set(Array.from({ length: 100 }, (_, i) => worldMapForRun({ seedString: String(i) }).id)).size, MEGA_MAPS.length);
  for (const w of MEGA_MAPS) assert.ok(SHIPPED.has(w.map), w.map);
});

test('the act region follows its seat, and a run without seats has none', () => {
  const order = ['weald', 'marches', 'reach'];
  assert.deepEqual([1, 2, 3].map((actNumber) => actRegionId({ seatOrder: order, actNumber })),
    ['hollow-weald', 'pale-marches', 'cinder-reach']);
  assert.equal(actRegionId({ seedString: 'x', actNumber: 1 }), null);
});

test('every painting anchors every seat region, and the framed start lands inside its biome', () => {
  const regions = ['hollow-weald', 'pale-marches', 'cinder-reach', 'ashen-crown'];
  const boards = [[435, 1136], [360, 790], [1100, 1136], [1440, 900]];
  for (const world of MEGA_MAPS) for (const region of regions) {
    const anchor = world.biomes?.[region];
    assert.ok(anchor, `${world.id} has no ${region} anchor`);
    const { x, y, w, h } = anchor.rect;
    assert.ok(x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1 && w > 0 && h > 0, `${world.id}/${region} rect`);
    for (const [bw, bh] of boards) {
      const frame = paintingFrame({ anchor, aspect: 2 / 3, box: { x0: 0, y0: 0, w: bw, h: bh }, start: { x: bw / 2, y: bh - 10 } });
      assert.ok(frame, `${world.id}/${region} ${bw}x${bh}: no frame`);
      // the start in the painting's own (unmirrored) coordinates
      const u = anchor.flipX ? 1 - frame.u : frame.u, v = anchor.flipY ? 1 - frame.v : frame.v;
      assert.ok(u >= x && u <= x + w && v >= y && v <= y + h, `${world.id}/${region} ${bw}x${bh}: start (${u.toFixed(2)},${v.toFixed(2)}) outside rect`);
      // the painting still covers the whole ground
      assert.ok(frame.ox <= 1e-6 && frame.oy <= 1e-6 && frame.ox + frame.cw >= bw - 1e-6 && frame.oy + frame.ch >= bh - 1e-6, 'cover');
    }
  }
});

test('a painting with no anchor for the region falls back to the plain cover fit', () => {
  const box = { x0: 0, y0: 0, w: 435, h: 1136 };
  assert.equal(paintingFrame({ anchor: undefined, aspect: 2 / 3, box, start: { x: 200, y: 1100 } }), null);
  assert.equal(paintingFrame({ anchor: MEGA_MAPS[0].biomes['hollow-weald'], aspect: 2 / 3, box, start: null }), null);
});

test('no-free-pan ground covers every viewBox centring can reach (hollow-weald, 435 ink, 360 viewport)', () => {
  const ink = { x0: 0, y0: 0, x1: 435, y1: 1000 }, w = 360, y0 = -200, h = 1400;
  const anchor = MEGA_MAPS[0].biomes['hollow-weald'], start = { x: 217, y: 1000 };
  const frame = paintingFrame({ anchor, aspect: 2 / 3, box: paintingGround({ ink, w, y0, h, aim: { min: ink.x0, max: ink.x1 } }), start });
  assert.ok(frame);
  for (const aimX of [20, 217, 415]) {
    const left = aimX - w / 2, right = aimX + w / 2;
    assert.ok(frame.ox <= left + 1e-6, `left edge ${aimX}`);
    assert.ok(frame.ox + frame.cw >= right - 1e-6, `right edge ${aimX}`);
  }
  // the ink-only ground (the old behaviour) leaves a gap at the left node
  const old = paintingFrame({ anchor, aspect: 2 / 3, box: paintingGround({ ink, w, y0, h }), start });
  assert.ok(old.ox > 20 - w / 2);
});

test('panning does not re-frame the painting: the ground and so the frame ignore the pan offset', () => {
  const ink = { x0: 0, y0: 0, x1: 435, y1: 1000 }, w = 360, y0 = -200, h = 1400;
  const anchor = MEGA_MAPS[1].biomes['cinder-reach'], start = { x: 217, y: 1000 };
  // the viewBox x0 at two pan offsets is irrelevant: only ink, w, y0, h enter
  const frames = [0, 75].map(() => paintingFrame({ anchor, aspect: 2 / 3, box: paintingGround({ ink, w, y0, h }), start }));
  assert.equal(frames[0].scale, frames[1].scale);
  assert.equal(frames[0].transform, frames[1].transform);
  assert.deepEqual(paintingGround({ ink, w, y0, h }), paintingGround({ ink, w, y0, h }));
});

test('solo and co-op hand the act its seatOrder (the biome framing wiring)', () => {
  assert.match(readFileSync(new URL('../src/ui/screens/map.js', import.meta.url), 'utf8'), /act: \{[^\n]*seatOrder: run\.seatOrder/);
  assert.match(readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8'), /seatOrder: snap\.seatOrder/);
});
