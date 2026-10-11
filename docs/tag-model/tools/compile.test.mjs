// Tests for compile.mjs. Run: node --test docs/tag-model/tools/compile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readRows, analyze, render, TAGS_PATH, NODES_PATH, TAGGING_PATH, REPORT_PATH,
} from './compile.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, 'compile.mjs');

const real = () => ({
  tags: readRows(readFileSync(TAGS_PATH, 'utf8')),
  nodes: readRows(readFileSync(NODES_PATH, 'utf8')),
  tagging: readRows(readFileSync(TAGGING_PATH, 'utf8')),
});

test('CLI runs on the real files, exits 0 and writes the report', () => {
  const out = execFileSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.match(out, /^# Tag model round-trip report/);
  assert.match(out, /\*\*Verdict: (lossless|NOT lossless)/);
  assert.ok(existsSync(REPORT_PATH) && statSync(REPORT_PATH).size > 0, 'report file written');
  assert.equal(readFileSync(REPORT_PATH, 'utf8'), out);
});

test('real files: mapped + unmapped equals the live total', () => {
  const res = analyze(real());
  assert.ok(res.liveTotal > 0);
  assert.equal(res.mappedCount + res.unmapped.length, res.liveTotal);
  const domainMapped = res.domains.reduce((a, d) => a + d.mapped, 0);
  const domainUnmapped = res.domains.reduce((a, d) => a + d.unmapped, 0);
  assert.equal(domainMapped, res.mappedCount);
  assert.equal(domainUnmapped, res.unmapped.length);
});

test('real files: unmapped list is sorted by usage, most used first', () => {
  const { unmapped } = analyze(real());
  for (let i = 1; i < unmapped.length; i++) {
    assert.ok(unmapped[i - 1].usage >= unmapped[i].usage, `row ${i} out of order`);
  }
});

test('synthetic collision: two tags map the same live id', () => {
  const tags = [
    { id: 'a', parent: '', label: 'A', glyph: '', color: '', status: 'live-tag', liveId: 'x' },
    { id: 'b', parent: '', label: 'B', glyph: '', color: '', status: 'live-tag', liveId: 'x' },
  ];
  const nodes = [{ id: 'x', parentId: '', label: 'A', glyph: '', color: '' }];
  const res = analyze({ tags, nodes, tagging: [] });
  assert.deepEqual(res.collisions, [{ liveId: 'x', tagIds: ['a', 'b'] }]);
  assert.equal(res.verdict.lossless, false);
  assert.match(render(res), /\| x \| a, b \|/);
});

test('synthetic unmapped: a live id with carriers and no tag is listed first', () => {
  const tags = [{ id: 'a', parent: '', label: 'A', glyph: '', color: '', status: 'live-tag', liveId: 'x' }];
  const nodes = [
    { id: 'x', parentId: '', label: 'A', glyph: '', color: '' },
    { id: 'y', parentId: '', label: 'Y', glyph: '', color: '' },
    { id: 'z', parentId: '', label: 'Z', glyph: '', color: '' },
  ];
  const tagging = [
    { family: 'f', scope: '', objectId: 'o1', tagId: 'z' },
    { family: 'f', scope: '', objectId: 'o2', tagId: 'z' },
    { family: 'f', scope: '', objectId: 'o1', tagId: 'y' },
  ];
  const res = analyze({ tags, nodes, tagging });
  assert.equal(res.mappedCount, 1);
  assert.deepEqual(res.unmapped, [
    { id: 'z', usage: 2 },
    { id: 'y', usage: 1 },
  ]);
  assert.equal(res.verdict.lossless, false);
});

test('synthetic reverse-missing: a live-tag whose liveId is not a live node', () => {
  const tags = [
    { id: 'a', parent: '', label: 'A', glyph: '', color: '', status: 'live-tag', liveId: 'gone' },
    { id: 'b', parent: '', label: 'B', glyph: '', color: '', status: 'new', liveId: '' },
  ];
  const nodes = [{ id: 'x', parentId: '', label: 'X', glyph: '', color: '' }];
  const res = analyze({ tags, nodes, tagging: [] });
  assert.deepEqual(res.reverse, [{ tagId: 'a', liveId: 'gone' }]);
});

test('synthetic lossless: a perfect one-to-one mapping with no usage gaps', () => {
  const tags = [{ id: 'a', parent: '', label: 'A', glyph: '', color: '', status: 'live-tag', liveId: 'x' }];
  const nodes = [{ id: 'x', parentId: '', label: 'A', glyph: '', color: '' }];
  const res = analyze({ tags, nodes, tagging: [] });
  assert.equal(res.verdict.lossless, true);
});
