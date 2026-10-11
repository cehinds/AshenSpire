import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const scene = JSON.parse(await readFile(path.join(root, 'scene.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'assets.manifest.json'), 'utf8'));
assert.equal(scene.version, 1);
assert.deepEqual(scene.states.map(s => s.id), ['idle', 'player-selected', 'enemy-selected']);
assert.equal(scene.nodes.length, 224);
assert.equal(manifest.nodeCount, scene.nodes.length);
assert.equal(manifest.assets.length, 38);
const nodes = new Map(scene.nodes.map(n => [n.id, n]));
assert.equal(nodes.size, scene.nodes.length, 'Node IDs must be unique');
const states = new Set(scene.states.map(s => s.id));
for (const node of scene.nodes) {
  assert.equal(typeof node.name, 'string');
  assert.ok(node.width > 0 && node.height > 0, 'Positive geometry: ' + node.id);
  const visited = new Set([node.id]);
  for (let parent = node.parent; parent; parent = nodes.get(parent).parent) {
    assert.ok(nodes.has(parent), 'Missing parent: ' + parent);
    assert.ok(!visited.has(parent), 'Parent cycle: ' + node.id);
    visited.add(parent);
  }
  for (const state of Object.keys(node.states || {})) assert.ok(states.has(state));
  for (const props of [node, ...Object.values(node.states || {})]) {
    if (props.asset) assert.ok(scene.assets[props.asset], 'Missing asset: ' + props.asset);
  }
}
for (const entry of [manifest.reference, ...manifest.assets]) {
  assert.ok(!path.isAbsolute(entry.src) && !entry.src.split('/').includes('..'), 'Portable asset URL');
  const bytes = await readFile(path.join(root, entry.src));
  assert.equal(bytes.length, entry.bytes, 'Size: ' + entry.src);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, 'SHA-256: ' + entry.src);
  if (entry.key) assert.equal(scene.assets[entry.key]?.src, entry.src, 'Seed asset URL');
  if (entry.source) assert.ok(!/^[A-Za-z]:|^\//.test(entry.source), 'Portable source provenance');
}
assert.equal((await readdir(path.join(root, 'assets'))).length, manifest.assets.length, 'All packaged assets are inventoried');
console.log('PASS 224-node graph, three states, 38 assets and reference SHA-256, portable asset/provenance paths');

// CSS token bindings and export.
const api = require('../css-export.js');
const bindingsText = await readFile(path.join(root, 'css-bindings.json'), 'utf8');
const bindings = JSON.parse(bindingsText);
assert.deepEqual(api.checkBindings(bindings, scene), [], 'css-bindings.json matches the scene graph');
const contractPath = path.join(root, '..', '..', 'docs', 'hud-layout-tokens.md');
const contract = await readFile(contractPath, 'utf8');
const contractRows = [...contract.matchAll(/^\| `(--hud-[a-z-]+)` \| (.+?) \| /gm)].map(m => ({ token: m[1], type: m[2].trim() }));
assert.ok(contractRows.length >= 20, 'Contract token table parsed (' + contractRows.length + ')');
const contractNames = contractRows.map(r => r.token);
assert.equal(new Set(contractNames).size, contractNames.length, 'Contract lists each token once');
const bound = Object.keys(bindings.tokens);
assert.deepEqual([...bound].sort(), [...contractNames].sort(), 'Every contract token has exactly one binding and no extra bindings');
for (const token of contractNames) {
  const occurrences = bindingsText.split(`"${token}":`).length - 1;
  assert.equal(occurrences, 1, `css-bindings.json binds ${token} exactly once`);
  const row = contractRows.find(r => r.token === token);
  const b = bindings.tokens[token];
  const expected = row.type.startsWith('keyword') ? 'keyword' : row.type.startsWith('length') ? (row.type.includes('none') ? 'length-or-none' : 'length') : row.type.split(' ')[0];
  assert.equal(b.type, expected, `${token} binding type matches contract type ${row.type}`);
  if (b.type === 'keyword') assert.deepEqual(b.values.slice().sort(), ['field', 'hand'], `${token} keyword values`);
}
console.log(`PASS css-bindings.json binds all ${contractNames.length} contract tokens exactly once, with matching types and node IDs`);

const FFS = api.FORM_FACTORS;
// Seed: only tokens explicitly set in the seed are exported, identically for each form factor, all valid per contract.
const expectedSeedTokens = Object.entries(bindings.tokens).filter(([, b]) => b.type !== 'px' && (() => {
  const seedNode = scene.nodes.find(n => n.id === b.node);
  return api.readPath(seedNode, b.path) !== undefined;
})()).map(([token]) => token).sort();
for (const ff of FFS) {
  const file = api.buildFile(ff, api.exportTokens(scene, scene, bindings, ff));
  assert.equal(file.format, 'ashenspire-hud-layout/1');
  assert.equal(file.formFactor, ff);
  assert.equal(file.source, 'hud-component-studio');
  assert.deepEqual(Object.keys(file.tokens).sort(), expectedSeedTokens, `seed export for ${ff} is exactly the explicitly set seed tokens`);
  for (const [token, value] of Object.entries(file.tokens)) {
    assert.equal(api.checkValue(bindings.tokens[token], value), null, `${ff} ${token} = ${value} is valid for its contract type`);
    assert.ok(!/[;{}<]|url\(|expression\(/i.test(value), `${ff} ${token} has no forbidden characters`);
  }
  assert.equal(Object.keys(file.tokens).some(t => t.endsWith('-dx') || t.endsWith('-dy')), false, `seed export for ${ff} has no geometry offsets`);
}
console.log(`PASS seed export for each of the four form factors yields the ${expectedSeedTokens.length} explicit seed tokens, valid per contract`);

// Synthetic move: +40 design px on player-details in Desktop only.
const moved = structuredClone(scene);
const details = moved.nodes.find(n => n.id === 'player-details');
const seedDetails = scene.nodes.find(n => n.id === 'player-details');
details.formFactors = { desktop: { x: seedDetails.x + 40 } };
const desktopTokens = api.exportTokens(moved, scene, bindings, 'desktop');
assert.equal(desktopTokens['--hud-player-details-dx'], '30px', 'desktop +40 design px becomes 30px');
for (const ff of ['mobile', 'tablet', 'widescreen']) {
  const tokens = api.exportTokens(moved, scene, bindings, ff);
  assert.equal(tokens['--hud-player-details-dx'], undefined, `${ff} has no dx from a desktop-only move`);
}
const desktopOnly = Object.keys(desktopTokens).filter(t => !(t in api.exportTokens(scene, scene, bindings, 'desktop')));
assert.deepEqual(desktopOnly, ['--hud-player-details-dx'], 'the desktop move adds only --hud-player-details-dx');
const imported = api.importTokens(api.buildFile('desktop', desktopTokens), moved, scene, bindings);
assert.deepEqual(imported.patches.filter(p => p.node === 'player-details' && p.key === 'x').map(p => [p.formFactor, p.value]), [['desktop', seedDetails.x + 39]], 'import maps 30px back to a 39 design px offset (rounding)');
console.log('PASS synthetic +40 design px desktop move exports --hud-player-details-dx "30px" only in desktop.json and imports back');
