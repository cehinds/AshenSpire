import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
