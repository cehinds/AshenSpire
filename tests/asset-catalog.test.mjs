// Asset catalog (engine/contracts/asset-catalog.schema.json) derived from art-manifest.json.
import test from 'node:test';
import {packSource} from '../tools/art-source.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';
import { buildAssetCatalog, buildSummary, checkCatalog, idOf, kindOf, readMissing, serializeCatalog, CATALOG_FILE, SUMMARY_FILE, MAX_BYTES } from '../tools/asset-catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(ROOT, 'engine/contracts/asset-catalog.schema.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'art-manifest.json'), 'utf8'));
const catalog = buildAssetCatalog();

test('the catalog satisfies its contract', () => {
  validateGameSchema(catalog, schema);
  assert.equal(catalog.format, 'ashen.assets@1');
});

test('ids are dotted words', () => {
  for (const id of Object.keys(catalog.assets)) assert.match(id, /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9][A-Za-z0-9_-]*)*$/, id);
  assert.equal(idOf('assets/bg/bg_act1.webp'), 'bg.bg_act1');
  assert.equal(idOf('music/map/map.mp3'), 'music.map.map');
});

test('kind follows the extension', () => {
  assert.equal(kindOf('a/b.webp'), 'image');
  assert.equal(kindOf('music/x.mp3'), 'audio');
  assert.equal(kindOf('assets/fonts/x.woff2'), 'font');
  assert.equal(kindOf('x.json'), 'data');
  assert.equal(kindOf('x.txt'), 'text');
  assert.equal(kindOf('x.bin'), 'other');
});

test('every manifest entry is in the catalog with all its tiers', () => {
  const missing = readMissing();
  assert.equal(Object.keys(catalog.assets).length, Object.keys(manifest.assets).length + Object.keys(missing).length);
  const byPath = new Map();
  for (const a of Object.values(catalog.assets)) for (const [tier, p] of Object.entries(a.files)) byPath.set(`${tier}:${p}`, a);
  for (const entry of Object.values(manifest.assets)) for (const [tier, rec] of Object.entries(entry)) assert.ok(byPath.has(`${tier}:${rec.path}`), `${tier}:${rec.path}`);
});

test('every referenced file exists in required verified light/common packs and any available high pack', () => {
  for(const pack of ['light','common']) assert.equal(packSource(pack,{root:ROOT}).from,'cache');
  let high=false;
  try { high=packSource('high',{root:ROOT}).from==='cache'; } catch(error) {
    assert.match(error.message,/fetch-art|not fetched|not verified|missing|fetch/i);
  }
  for (const [id,a] of Object.entries(catalog.assets)) for(const [tier,file] of Object.entries(a.files)) {
    if(tier==='high'&&!high)continue; // Full HIGH byte coverage is the official pack CI's scope.
    assert.ok(existsSync(join(packSource(tier,{root:ROOT}).dir,file)),`${id} ${tier} ${file}`);
  }
});

test('placeholder is true exactly when no tier has a file', () => {
  for (const [id, a] of Object.entries(catalog.assets)) assert.equal(!!a.placeholder, Object.keys(a.files).length === 0, id);
  const missing = Object.keys(readMissing());
  assert.ok(missing.length > 0);
  for (const id of missing) { assert.ok(catalog.assets[id].placeholder, id); assert.ok(readMissing()[id].reason, id); }
});

test('the committed catalog or summary is current, and respects the size cap', () => {
  assert.deepEqual(checkCatalog(), []);
  const full = existsSync(join(ROOT, CATALOG_FILE)), summary = existsSync(join(ROOT, SUMMARY_FILE));
  assert.notEqual(full, summary, 'exactly one of catalog.json and catalog.summary.json is committed');
  if (full) assert.ok(statSync(join(ROOT, CATALOG_FILE)).size < MAX_BYTES);
  else {
    assert.ok(Buffer.byteLength(serializeCatalog(catalog)) >= MAX_BYTES, 'summary only when the full catalog is over the cap');
    const s = JSON.parse(readFileSync(join(ROOT, SUMMARY_FILE), 'utf8'));
    assert.equal(s.count, Object.keys(catalog.assets).length);
    assert.equal(s.sha256, buildSummary(catalog).sha256);
  }
});

test('summary counts add up', () => {
  const s = buildSummary(catalog);
  assert.equal(Object.values(s.byKind).reduce((a, b) => a + b, 0), s.count);
  assert.ok(s.byKind.audio >= 1 && s.byKind.font >= 1 && s.byKind.image > 1000);
});
