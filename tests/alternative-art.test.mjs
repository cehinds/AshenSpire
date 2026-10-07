import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';
import { alternativePlayerId, alternativeBackdropHtml } from '../src/ui/alternativeArt.js';
import { ARMOUR } from '../src/content/equipment.js';
import { ENVIRONMENTS } from '../src/content/environments.js';
import { LEGACY_SCENES } from '../src/model/legacyDungeon.js';
import { combatBackdropHtml } from '../src/ui/components/environmentArt.js';
import { contentBundle } from '../src/content/index.js';

test('all reviewed actors and both export tiers have pinned bytes and idle bounds', () => {
  assert.equal(catalog.sourceCommit, '41ae95ae42cce66e56805cc35ae1903a92a4d5a5');
  for (const [family, count] of Object.entries({ armor: 19, enemy: 33, companion: 2, speaker: 5 }))
    assert.equal(Object.values(catalog.sprites).filter(s => s.family === family).length, count);
  for (const [file, hash] of Object.entries(catalog.hashes)) {
    const bytes = readFileSync(new URL('../assets-alternative/' + file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, file);
  }
  for (const [id, art] of Object.entries(catalog.sprites)) {
    const [w,h] = art.size, [x0,y0,x1,y1] = art.bounds;
    assert(x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0 && x1 <= w && y1 <= h, id);
    assert.equal(art.pose, 'idle');
    assert(catalog.hashes[art.path.split('/').pop()], id);
    assert(catalog.hashes[art.mobilePath.split('/').pop()], id);
    if (art.family !== 'enemy') assert.match(art.facing, /rear/);
  }
});

test('every canonical armor maps exactly, including dedicated alias appearances and shared sets', () => {
  const used = new Set();
  for (const row of ARMOUR) {
    const expected = catalog.sprites[`${row.classId}-${row.id}`]
      ? `${row.classId}-${row.id}` : `${row.artClassId || row.classId}-${row.artKey || row.id}`;
    assert(catalog.sprites[expected], `${row.classId}/${row.id} must have an explicit visual mapping`);
    assert.equal(alternativePlayerId(row.classId, row.id), expected);
    used.add(expected);
  }
  assert.equal(used.size, 19, 'every dedicated appearance is reachable');
  assert.equal(alternativePlayerId('reaver', 'bastion'), 'reaver-bastion');
  assert.equal(alternativePlayerId('starseer', 'rimeweave'), 'starseer-rimeweave');
  assert.equal(alternativePlayerId('rogue', 'waywatcher'), 'rogue-waywatcher');
  assert.equal(alternativePlayerId('reaver', 'unknown'), 'reaver-default');
});

test('enemy, companion and speaker IDs match the canonical content roster', () => {
  for (const [family, rows] of [['enemy', contentBundle.enemies], ['companion', contentBundle.companions], ['speaker', contentBundle.speakers]]) {
    assert.deepEqual(Object.keys(catalog.sprites).filter(id => catalog.sprites[id].family === family).sort(), rows.map(r => r.id).sort(), family);
  }
});

test('all canonical settings retain independent device transforms and four pinned layers', () => {
  const ids = [...ENVIRONMENTS.flatMap(r => r.scenes), ...LEGACY_SCENES].map(s => s.id).sort();
  assert.deepEqual(Object.keys(catalog.scenes).sort(), ids);
  assert.equal(ids.length, 32);
  assert.equal(Object.keys(catalog.sceneLayers).length, 69);
  for (const id of ids) {
    const scene = catalog.scenes[id];
    for (const [device, layout] of Object.entries(scene.devices)) {
      assert.equal(layout.layers.length, 4, `${id}/${device}`);
      assert.equal(new Set(layout.layers.map(l => l.depth)).size, 4);
      for (const layer of layout.layers) {
        const art = catalog.sceneLayers[layer.id];
        assert(art, layer.id);
        for (const key of ['path', 'mobilePath']) assert(catalog.hashes[art[key].split('/').pop()]);
        for (const key of ['x','y','width','height','depth']) assert(Number.isFinite(layer[key]));
      }
    }
    assert.notDeepEqual(scene.devices.desktop.layers, scene.devices.phone.layers);
    assert.match(combatBackdropHtml({}, id), new RegExp(`data-scene="${id}"`));
    assert.equal((alternativeBackdropHtml(id).match(/class="alternative-scene-layer"/g) || []).length, 4);
  }
  assert.equal(alternativeBackdropHtml('not-a-scene'), null);
  assert.throws(() => combatBackdropHtml({}, 'not-a-scene'), /Unknown combat preview/);
});

test('saved dungeon location selects its own layered scene', () => {
  for (const scene of LEGACY_SCENES) {
    const html = combatBackdropHtml({ legacyDungeon: { id: scene.region, current: scene.nodeStart } });
    assert(html.includes(`data-scene="${scene.id}"`), scene.id);
  }
});

test('phone first paint references only phone scene exports before fitting', () => {
  const previous = globalThis.document;
  globalThis.document = { documentElement: { dataset: { layout: 'narrow' } } };
  try {
    for (const id of Object.keys(catalog.scenes)) {
      const html = alternativeBackdropHtml(id);
      const paths = [...html.matchAll(/assets-alternative\/[A-Za-z0-9-]+\.webp/g)].map(m => m[0]);
      assert.equal(paths.length, 5);
      assert(paths.every(p => p.endsWith('-mobile.webp')), id);
    }
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
