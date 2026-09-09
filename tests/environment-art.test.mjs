import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ENVIRONMENTS, MEGA_MAPS, ENVIRONMENT_ATLAS_SIZE } from '../src/content/environments.js';
import { regionForRun, combatEnvironment, worldMapForRun } from '../src/model/environmentArt.js';
import { mapTerrainHtml } from '../src/ui/components/environmentArt.js';
import { mapKnowledge } from '../src/model/mapknowledge.js';

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
    for (const path of [r.atlas, r.map]) assert.ok(existsSync(new URL('../' + path, import.meta.url)), path);
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
  assert.match(html, /class="terrain-detail"[^>]+mask="url\(#terrain-/);
  const full = mapTerrainHtml({ world: MEGA_MAPS[0], width: 300, height: 600, points, fog: false });
  assert.doesNotMatch(full, /class="terrain-detail"[^>]+mask=/);
  assert.notEqual(html.match(/id="(terrain-\d+)-light/)[1], full.match(/id="(terrain-\d+)-light/)[1]);
});


test('mega map stays fixed across acts, routes and reloads, with all layouts reachable', () => {
  const run = Object.freeze({ seedString: 'WORLD', actNumber: 1, floor: 0 });
  const world = worldMapForRun(run);
  assert.equal(worldMapForRun({ ...run, actNumber: 5, floor: 12, path: ['a', 'b'] }), world);
  assert.equal(worldMapForRun(JSON.parse(JSON.stringify(run))), world);
  assert.equal(new Set(Array.from({ length: 100 }, (_, i) => worldMapForRun({ seedString: String(i) }).id)).size, MEGA_MAPS.length);
  for (const w of MEGA_MAPS) assert.ok(existsSync(new URL('../' + w.map, import.meta.url)), w.map);
});
