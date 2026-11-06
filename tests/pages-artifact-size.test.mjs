import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { downloadKept, keepFor, RETENTION, planRebuilds, clampMaxRebuilds } from '../tools/pages-site.mjs';

// The Pages artifact must stay well under 1 GB (run 42174299001 was 5.2 GB and
// timed out in deploy-pages). These rules are what keeps it there.
test('only a primary channel keeps the offline file, and only for its newest build', () => {
  for (const branch of ['dev', 'test', 'release', 'main']) {
    assert.equal(downloadKept(branch, true), true, `${branch} newest`);
    assert.equal(downloadKept(branch, false), false, `${branch} archived`);
  }
  for (const branch of ['alternative/dev', 'alternative/test', 'alternative/art/dev']) {
    assert.equal(downloadKept(branch, true), false, `${branch} newest`);
  }
});

test('retention is per channel: main 3, release 10, dev 3, test 3, others 3', () => {
  assert.deepEqual(RETENTION, { main: 3, release: 10, dev: 3, test: 3 });
  for (const [branch, n] of [['main', 3], ['release', 10], ['dev', 3], ['test', 3], ['alternative/dev', 3], ['alternative/art/test', 3]]) {
    assert.equal(keepFor(branch), n, branch);
  }
});

test('an explicit keep overrides every channel, clamped to 1..25', () => {
  for (const branch of ['main', 'release', 'dev', 'alternative/dev']) {
    assert.equal(keepFor(branch, 5), 5, branch);
    assert.equal(keepFor(branch, 100), 25, `${branch} clamps high`);
  }
});

const workflow = readFileSync(new URL('../.github/workflows/pages-builds.yml', import.meta.url), 'utf8');
test('assemble fails an oversized site before it is uploaded', () => {
  const guard = workflow.indexOf('Fail if the assembled site is too big for Pages');
  const upload = workflow.indexOf('actions/upload-pages-artifact');
  assert.ok(guard > 0 && guard < upload, 'the size guard runs before the artifact upload');
  assert.match(workflow, /SITE_MAX_MB: 2500/);
});

test('the workflow passes --keep only when the dispatch input is given', () => {
  assert.doesNotMatch(workflow, /inputs\.keep \|\| '3'/);
  assert.match(workflow, /KEEP_INPUT: \$\{\{ inputs\.keep \|\| '' \}\}/);
  assert.match(workflow, /keep_args=\(--keep /);
});

// The rebuild plan (run 42186410401 died of ENOSPC rebuilding too much).
const mk = (branch, shas) => ({ branch, builds: shas.map((sha, i) => ({ branch, ordinal: 100 - i, sha, source: sha.startsWith('g') ? 'git' : 'rebuild' })) });

test('the rebuild plan dedupes by sha and tier, ignores committed and seeded builds', () => {
  const lists = [mk('dev', ['a1', 'a2', 'g1']), mk('test', ['a1', 'a3']), mk('main', ['m1', 'm2'])];
  const { plan, over } = planRebuilds(lists, { max: 50, seeded: (b) => b.branch === 'main' && b.sha === 'm1' });
  assert.deepEqual(plan.map((x) => x.key), ['a1:light', 'a2:light', 'a3:light', 'm2:light']);
  assert.equal(over.size, 0);
  const tiers = planRebuilds([mk('dev', ['a1']), mk('release', ['a1'])], { tierOf: (b) => (b === 'release' ? 'full' : 'light') });
  assert.deepEqual(tiers.plan.map((x) => x.key), ['a1:light', 'a1:full']);
});

test('the rebuild cap never drops a branch\'s newest build, only older ones past it', () => {
  const lists = [mk('release', ['r1', 'r2', 'r3', 'r4']), mk('dev', ['d1', 'd2']), mk('test', ['t1'])];
  const { plan, over } = planRebuilds(lists, { max: 4 });
  assert.deepEqual(plan.map((x) => x.sha), ['r1', 'd1', 't1', 'r2']);
  assert.deepEqual([...over].map((b) => b.sha), ['r3', 'r4', 'd2']);
  const tight = planRebuilds(lists, { max: 1 });
  assert.deepEqual(tight.plan.map((x) => x.sha), ['r1', 'd1', 't1'], 'newest builds exceed the cap but are kept');
  assert.equal(tight.over.size, 4);
});

test('--max-rebuilds clamps to 1..200 with a default of 12', () => {
  assert.equal(clampMaxRebuilds(undefined), 12);
  assert.equal(clampMaxRebuilds('abc'), 12);
  assert.equal(clampMaxRebuilds(0), 12);
  assert.equal(clampMaxRebuilds(-5), 1);
  assert.equal(clampMaxRebuilds(999), 200);
  assert.equal(clampMaxRebuilds('7'), 7);
});

test('downloadArchived is decided before a build is rebuilt, and an archived build skips the single file', () => {
  const src = readFileSync(new URL('../tools/pages-site.mjs', import.meta.url), 'utf8');
  const decide = src.indexOf('b.downloadArchived = !downloadKept(branch, served.size === 0)');
  const rebuild = src.indexOf('const a = artifactsOf(b);');
  assert.ok(decide > 0 && rebuild > decide, 'archived is set before artifactsOf rebuilds');
  assert.match(src, /rebuildAt\(b\.sha, fullArt, \{ skipSingle: b\.downloadArchived === true \}\)/);
  assert.match(src, /freeRebuilds\(listed\)/);
});
