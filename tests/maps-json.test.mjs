// JSON map layer: engine/maps/components/*.json and games/ashenspire/maps/*.json.
// The current-generator numbers are held to src/content/mapconfig.js and
// src/engine/mapgen.js, so drift in either direction fails here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMaps, loadMapFiles, strings, assetIds, resolveAtlasPath } from '../tools/maps-validate.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = loadMapFiles();

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'maps-json-'));
  for (const rel of ['engine/contracts', 'engine/maps', 'games/ashenspire/maps', 'src/content/mapconfig.js', 'src/engine/mapgen.js', 'content/source/worldAtlas.json']) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(dir, rel), { recursive: true });
  }
  return dir;
}

test('maps and components validate against their contracts and the current generator', async () => {
  const { problems, counts } = await validateMaps();
  assert.deepEqual(problems, []);
  assert.equal(counts.maps, 3);
  assert.ok(counts.components >= 7);
});

test('every node type the generator uses has a node component', () => {
  const nodes = Object.values(files.components).filter(c => c.kind === 'node').map(c => c.id).sort();
  for (const type of ['monster', 'event', 'elite', 'shrine', 'merchant', 'treasure', 'boss']) assert.ok(nodes.includes(type), type);
  const kinds = new Set(Object.values(files.components).map(c => c.kind));
  for (const kind of ['route', 'landmark', 'region']) assert.ok(kinds.has(kind), kind);
});

test('the proposed 0.8.0 rulings sit beside the current generator', () => {
  for (const m of Object.values(files.maps)) {
    const p = m.generator.proposed;
    assert.equal(p.steps, 10); assert.equal(p.bossStep, 10); assert.equal(p.paths, 3);
    assert.deepEqual(p.weights, { monster: 50, elite: 10, merchant: 15, shrine: 15, treasure: 10 });
    assert.equal(Object.values(p.weights).reduce((a, b) => a + b, 0), 100);
    assert.ok(p.constraints.some(c => c.rule === 'minEliteChances' && c.value === 2));
    assert.deepEqual(m.generator.weights, { monster: 45, event: 22, shrine: 12, elite: 8, merchant: 5 });
  }
});

test('the atlas path resolves to the world map', () => {
  const atlas = JSON.parse(readFileSync(join(ROOT, 'content/source/worldAtlas.json'), 'utf8'));
  assert.equal(resolveAtlasPath(atlas, 'world_maps[mapId=fractured-realm]').authoringTargetNodes, 200);
  assert.equal(resolveAtlasPath(atlas, 'world_maps[mapId=nowhere]'), undefined);
});

test('no glyphs: every string is ASCII', () => {
  for (const set of Object.values(files)) for (const v of Object.values(set)) assert.deepEqual(strings(v).filter(s => /[^\x00-\x7f]/.test(s)), []);
});

test('drift in mapconfig.js fails the check', async () => {
  const dir = sandbox();
  try {
    const cfg = join(dir, 'src/content/mapconfig.js');
    writeFileSync(cfg, readFileSync(cfg, 'utf8').replace('minElites: 2', 'minElites: 3'));
    const { problems } = await validateMaps({ root: dir });
    assert.ok(problems.some(p => /minElites/.test(p)), problems.join('\n'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a weight naming a missing component, or a broken atlas path, fails the check', async () => {
  const dir = sandbox();
  try {
    const file = join(dir, 'games/ashenspire/maps/act1.json');
    const m = JSON.parse(readFileSync(file, 'utf8'));
    m.generator.weights.ghost = 1; m.atlas.path = 'maps[mapId=missing]';
    writeFileSync(file, JSON.stringify(m));
    const { problems } = await validateMaps({ root: dir });
    assert.ok(problems.some(p => /ghost/.test(p)));
    assert.ok(problems.some(p => /atlas path/.test(p)));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the tool names every asset id the layer references', () => {
  const ids = assetIds(files);
  assert.ok(ids.includes('bg.bg_act1') && ids.includes('node-boss'));
});
