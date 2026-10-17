import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadArtModules} from './json-modules.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2));

function fixture(t) {
  const dir = mkdtempSync(resolve(tmpdir(), 'art-json-modules-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  cpSync(resolve(root, 'modules'), dir, {recursive: true});
  const index = resolve(dir, 'index.json');
  const config = read(index);
  config.assetBase = root;
  write(index, config);
  return {dir, index};
}

test('module data equals the portable exports, including existing scene order', () => {
  const data = loadArtModules();
  assert.deepEqual(data.locationPools, read(resolve(root, 'location-pools.example.json')));
  assert.deepEqual(data.composition, read(resolve(root, 'composition.example.json')));
  assert.equal(data.locationPools.profiles.length, 21);
  assert.equal(data.composition.presets.length, 11);
});

test('scene edits are read directly from their region module without rebuilding exports', t => {
  const {dir, index} = fixture(t);
  const path = resolve(dir, 'regions/ashen-crown/scenes.json');
  const module = read(path);
  module.presets[0].props[0].anchorU = 0.27;
  write(path, module);
  assert.equal(loadArtModules(index).composition.presets[0].props[0].anchorU, 0.27);
});

test('new scenes append without requiring an order-list edit', t => {
  const {dir, index} = fixture(t);
  const path = resolve(dir, 'regions/ashen-crown/scenes.json');
  const module = read(path);
  module.presets.push({...module.presets[0], id: 'ashen-crown/market-alternative'});
  write(path, module);
  assert.equal(loadArtModules(index).composition.presets.at(-1).id, 'ashen-crown/market-alternative');
});

test('duplicate profile IDs fail instead of silently overriding a location', t => {
  const {dir, index} = fixture(t);
  const path = resolve(dir, 'regions/ashen-crown/pools.json');
  const module = read(path);
  module.profiles.push(module.profiles[0]);
  write(path, module);
  assert.throws(() => loadArtModules(index), /duplicate profileId/);
});

test('a region mismatch fails with the affected module path', t => {
  const {dir, index} = fixture(t);
  const path = resolve(dir, 'regions/ashen-crown/scenes.json');
  const module = read(path);
  module.presets[0].regionId = 'pale-marches';
  write(path, module);
  assert.throws(() => loadArtModules(index), /Region mismatch.*ashen-crown/);
});

test('missing image references fail before rendering or export', t => {
  const {dir, index} = fixture(t);
  const path = resolve(dir, 'regions/ashen-crown/pools.json');
  const module = read(path);
  module.profiles[0].primaryPools[0].ground = 'missing-ground.png';
  write(path, module);
  assert.throws(() => loadArtModules(index), /Missing art\/source reference: missing-ground.png/);
});

test('unknown scene ordering IDs fail instead of silently dropping an entry', t => {
  const {index} = fixture(t);
  const config = read(index);
  config.sceneOrder.push('missing/scene');
  write(index, config);
  assert.throws(() => loadArtModules(index), /sceneOrder contains duplicate or unknown/);
});
