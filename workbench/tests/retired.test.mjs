// node --test workbench/tests/retired.test.mjs — the old tool pages that the Workbench's
// modules replace. Every entry in workbench/tools.json marked `moved` names a real module and
// a deep link that parses; the notice on each old page (workbench/retired-banner.js) links to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES } from '../modules/index.mjs';
import { parseHash } from '../modules/host.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'workbench/tools.json'), 'utf8'));
const moved = registry.entries.filter((e) => e.moved);
const MODULE_IDS = new Set(MODULES.map((m) => m.id));

test('every moved entry names a real module and a deep link that parses to it', () => {
  assert.ok(moved.length >= 1, 'some tools are marked moved');
  for (const e of moved) {
    assert.ok(MODULE_IDS.has(e.moved.module), `${e.id}: module ${e.moved.module} is not in MODULES`);
    const link = parseHash(e.moved.hash);
    assert.ok(link, `${e.id}: ${e.moved.hash} does not parse`);
    assert.equal(link.mod, e.moved.module, `${e.id}: link opens ${link.mod}, not ${e.moved.module}`);
  }
});

test('coverage is full with nothing missing, or partial with the missing features listed', () => {
  for (const e of moved) {
    const { coverage, missing } = e.moved;
    assert.ok(['full', 'partial'].includes(coverage), `${e.id}: coverage ${coverage}`);
    assert.ok(Array.isArray(missing), `${e.id}: missing is a list`);
    if (coverage === 'full') assert.deepEqual(missing, [], `${e.id}: a full move lists nothing missing`);
    else assert.ok(missing.length > 0, `${e.id}: a partial move lists what is still missing`);
  }
});

test('the retired pages stay in the registry (nothing is deleted)', () => {
  for (const e of moved) {
    assert.ok(e.path, `${e.id}: path kept`);
    assert.ok(fs.existsSync(path.join(ROOT, e.path)), `${e.id}: ${e.path} still exists`);
  }
});

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<');

test('every moved page carries the notice, and the notice link parses to the module', () => {
  for (const e of moved) {
    const html = fs.readFileSync(path.join(ROOT, e.path), 'utf8');
    const hashes = [...html.matchAll(/data-hash="([^"]*)"/g)].map((m) => decode(m[1]));
    // The standalone apps (no script) link to their Workbench module instead.
    for (const m of html.matchAll(/href="http:\/\/127\.0\.0\.1:4300\/(#[^"]*)"/g)) hashes.push(decode(m[1]));
    assert.ok(hashes.length > 0, `${e.id}: ${e.path} has a notice`);
    for (const h of hashes) {
      const link = parseHash(h);
      assert.ok(link, `${e.id}: notice link ${h} does not parse`);
      assert.ok(MODULE_IDS.has(link.mod), `${e.id}: notice opens ${link.mod}, which is not a module`);
      assert.equal(link.mod, e.moved.module, `${e.id}: notice opens ${link.mod}, not ${e.moved.module}`);
    }
    if (!html.includes('retired-banner.js')) assert.ok(html.includes('class="wb-retired"'), `${e.id}: standalone notice`);
    else assert.ok(hashes.includes(e.moved.hash), `${e.id}: notice links to ${e.moved.hash}`);
  }
});

test('the banner script is one dependency-free file with no imports', () => {
  const src = fs.readFileSync(path.join(ROOT, 'workbench/retired-banner.js'), 'utf8');
  assert.ok(!/\bimport\s|\brequire\(/.test(src), 'no imports or requires');
  assert.ok(src.length < 4000, 'stays tiny');
});
