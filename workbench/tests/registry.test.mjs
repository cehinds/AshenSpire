// node --test workbench/tests/registry.test.mjs — workbench/tools.json names
// every HTML studio, editor, viewer, exporter and QA page in the checkout, so a
// new tool cannot be added without showing up in the Workbench Library.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'workbench/tools.json'), 'utf8'));
const KINDS = ['studio', 'editor', 'viewer', 'exporter', 'qa'];
const SERVED = ['workbench-child', 'game-server', 'static', 'external'];
const SOURCES = ['art-checkout', 'editor-repo'];

// Pages that are not tools: the game itself, the Workbench, test fixtures.
const NOT_TOOLS = (p) => p === 'index.html' || /^(src|styles|workbench|build|dist)\//.test(p) || p.startsWith('tests/fixtures/');

function trackedHtml() {
  try {
    return execFileSync('git', ['ls-files', '-z', '*.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\0').filter(Boolean);
  } catch { return null; }
}

test('the registry is well formed', () => {
  assert.equal(registry.format, 'ashenspire.workbench-tools/1');
  const ids = new Set();
  for (const e of registry.entries) {
    assert.ok(/^[a-z0-9][a-z0-9-]*$/.test(e.id), `id ${e.id}`);
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`); ids.add(e.id);
    assert.ok(e.title, `${e.id}: title`);
    assert.ok(KINDS.includes(e.kind), `${e.id}: kind ${e.kind}`);
    assert.ok(SERVED.includes(e.servedBy), `${e.id}: servedBy ${e.servedBy}`);
    assert.ok(registry.areas.includes(e.area), `${e.id}: area ${e.area}`);
    assert.ok(['current', 'legacy'].includes(e.status), `${e.id}: status`);
    assert.ok(Array.isArray(e.outputs), `${e.id}: outputs`);
    if (e.source) assert.ok(SOURCES.includes(e.source) && e.servedBy === 'external', `${e.id}: source`);
    else assert.notEqual(e.servedBy, 'external', `${e.id}: external entries name their source`);
    if (e.servedBy === 'workbench-child') assert.ok(['editor', 'ui-studio', 'pose'].includes(e.toolId), `${e.id}: toolId`);
  }
});

test('every in-repo registry path exists on disk (external entries are skipped)', () => {
  const missing = registry.entries.filter((e) => !e.source && !fs.existsSync(path.join(ROOT, e.path))).map((e) => `${e.id}: ${e.path}`);
  assert.deepEqual(missing, []);
});

test('every HTML tool page in the checkout is registered', (t) => {
  const tracked = trackedHtml();
  if (!tracked) return t.skip('not a git checkout');
  const registered = new Set(registry.entries.filter((e) => !e.source).map((e) => e.path));
  const unregistered = tracked.filter((p) => !NOT_TOOLS(p) && !registered.has(p));
  assert.deepEqual(unregistered, [], 'add these to workbench/tools.json');
});

test('the named families are covered: editors under docs/design, the ateliers, the probe, root previews', (t) => {
  const tracked = trackedHtml();
  if (!tracked) return t.skip('not a git checkout');
  const must = tracked.filter((p) => /^docs\/design\/.*\/editor[^/]*\.html$/.test(p) || /^docs\/design\/.*editor\/.*\.html$/.test(p)
    || p.startsWith('docs/design/deck-row-editor/') || p.startsWith('docs/design/sp-orb-editor/')
    || p === 'docs/preview/book-library/layers/atelier.html' || p === 'tools/palette-probe.html'
    || /^[^/]+-preview\.html$/.test(p) || /^tooltip-review[^/]*\.html$/.test(p));
  assert.ok(must.length >= 15, `expected the named pages, found ${must.length}`);
  const registered = new Set(registry.entries.map((e) => e.path));
  assert.deepEqual(must.filter((p) => !registered.has(p)), []);
});
