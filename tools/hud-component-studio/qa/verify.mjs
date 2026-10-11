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
// Untouched seed: a scene equal to the seed exports no tokens for any form factor, so a designer who
// exports from an unedited studio cannot overwrite the tuned content files.
for (const ff of FFS) {
  const tokens = api.exportTokens(structuredClone(scene), scene, bindings, ff);
  assert.deepEqual(tokens, {}, `untouched seed exports no tokens for ${ff}`);
  assert.deepEqual(api.buildFile(ff, tokens).tokens, {}, `untouched seed file for ${ff} has an empty token map`);
}
console.log('PASS untouched seed exports {} for all four form factors');

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

// Synthetic shadow change: the Tablet player details frame shadow exports only --hud-panel-shadow, in tablet.
const shadowed = structuredClone(scene);
shadowed.nodes.find(n => n.id === 'player-details-frame').formFactors = { tablet: { shadow: { x: 0, y: 5, blur: 6, spread: 0, color: 'rgba(0,0,0,0.55)' } } };
const tabletShadow = api.exportTokens(shadowed, scene, bindings, 'tablet');
assert.deepEqual(Object.keys(tabletShadow), ['--hud-panel-shadow'], 'tablet shadow change exports only --hud-panel-shadow');
assert.equal(api.checkValue(bindings.tokens['--hud-panel-shadow'], tabletShadow['--hud-panel-shadow']), null, 'exported panel shadow is valid per contract');
for (const ff of ['mobile', 'desktop', 'widescreen']) assert.deepEqual(api.exportTokens(shadowed, scene, bindings, ff), {}, `${ff} is unaffected by a tablet shadow change`);
console.log('PASS synthetic tablet shadow change exports only --hud-panel-shadow in tablet.json');

// Import CSS JSON accepts every committed content file (multi-layer shadows, unitless 0, 48%), and
// re-exporting an untouched import yields exactly the tokens it imported. (A token whose value equals
// the studio seed would be the documented exception: it is not re-exported, and --merge keeps it.)
const contentDir = path.join(root, '..', '..', 'content', 'hud-layout');
for (const ff of FFS) {
  const file = JSON.parse(await readFile(path.join(contentDir, `${ff}.json`), 'utf8'));
  const studio = structuredClone(scene);
  api.importFile(file, studio, scene, bindings);
  const tokens = api.exportTokens(studio, scene, bindings, ff);
  for (const [token, value] of Object.entries(tokens)) assert.equal(value, file.tokens[token], `${ff}: ${token} re-exports as imported`);
  for (const token of Object.keys(file.tokens).filter(t => !(t in tokens))) {
    const alone = structuredClone(scene);
    api.importFile(api.buildFile(ff, { [token]: file.tokens[token] }), alone, scene, bindings);
    assert.deepEqual(api.exportTokens({ ...alone, cssBaseline: undefined }, scene, bindings, ff), {}, `${ff}: ${token} is omitted only because it equals the seed`);
  }
  assert.deepEqual(Object.keys(tokens).sort(), Object.keys(file.tokens).sort(), `${ff}: untouched import re-exports every committed token`);
}
assert.equal(api.checkValue(bindings.tokens['--hud-text-plate-radius'], '0'), null, 'unitless 0 is a length');
assert.throws(() => api.importTokens(api.buildFile('mobile', { '--hud-text-plate-radius': '1rem' }), scene, scene, bindings), /import needs px units or 0/);
console.log('PASS Import CSS JSON accepts all four content/hud-layout files and re-exports each untouched import unchanged');

// Each binding reads its component in the view where it is shown. An enemy nameplate move made in
// Enemy selected (Mobile, Edit all views off) exports; the same move made only in Idle does not.
const plateSeed = scene.nodes.find(n => n.id === 'enemy-nameplate');
const inView = (state) => {
  const s = structuredClone(scene);
  const n = s.nodes.find(node => node.id === 'enemy-nameplate');
  n.states = { ...(n.states || {}), [state]: { ...(n.states?.[state] || {}), y: plateSeed.y - 40 } };
  return s;
};
assert.equal(api.exportTokens(inView('enemy-selected'), scene, bindings, 'mobile')['--hud-enemy-nameplate-dy'], '-30px', 'a move in Enemy selected exports');
assert.deepEqual(api.exportTokens(inView('idle'), scene, bindings, 'mobile'), {}, 'the same move made only in Idle exports nothing');
const note = (stateId, extra = {}) => api.exportViewNote({ scene, bindings, nodeId: 'enemy-nameplate', stateId, formFactor: 'mobile', allViews: false, ...extra });
assert.equal(note('idle'), 'Exports from Enemy selected', 'the Inspector says which view exports');
assert.equal(note('enemy-selected'), null);
assert.equal(note('idle', { allViews: true }), null, 'an all-views edit reaches the export view');
assert.equal(note('idle', { formFactor: 'desktop' }), null, 'form factor overrides apply to every view');
assert.equal(api.exportViewNote({ scene, bindings, nodeId: 'player-details', stateId: 'idle', formFactor: 'mobile', allViews: false }), 'Exports from Player selected');
console.log('PASS bindings export from their own view; an edit in another view is named by the Inspector note');

// Reverting a committed override: import desktop.json, reset the tools span to the seed, export → null.
const desktopFile = JSON.parse(await readFile(path.join(contentDir, 'desktop.json'), 'utf8'));
const reverted = structuredClone(scene);
api.importFile(desktopFile, reverted, scene, bindings);
delete reverted.nodes.find(n => n.id === 'hand-toolbar').formFactors.desktop.span;
const revertedTokens = api.exportTokens(reverted, scene, bindings, 'desktop');
assert.equal(revertedTokens['--hud-tools-span'], null, 'a reset baseline token exports null');
assert.equal(Object.values(revertedTokens).filter(v => v === null).length, 1, 'only the reset token is null');
assert.equal(revertedTokens['--hud-header-hp-max-width'], '48%', 'other committed tokens re-export as imported');
for (const ff of ['mobile', 'tablet', 'widescreen']) assert.ok(!Object.values(api.exportTokens(reverted, scene, bindings, ff)).includes(null), `no null for ${ff} without an import there`);
console.log('PASS import, reset to seed and export writes null for that token only');
