import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { downloadKept, keepFor, RETENTION, planRebuilds, clampMaxRebuilds, archivedFor, singleNeededKeys, lfsPointerSize, oversizeReason, LEGACY_SINGLE_MAX_BYTES, latestDownloadStub, pointerOversize } from '../tools/pages-site.mjs';

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

test('archivedFor keeps the download for the first PUBLISHED build of a primary channel only', () => {
  assert.equal(archivedFor('dev', 0), false);
  assert.equal(archivedFor('dev', 1), true);
  assert.equal(archivedFor('alternative/dev', 0), true);
});

test('each build is decided, rebuilt, published and freed in turn', () => {
  const src = readFileSync(new URL('../tools/pages-site.mjs', import.meta.url), 'utf8');
  const decide = src.indexOf('b.downloadArchived = archivedFor(branch, builds.length)');
  const rebuild = src.indexOf('const a = artifactsOf(b);', decide);
  const publish = src.indexOf('publishBuild(outDir, b, a)', rebuild);
  const free = src.indexOf('freeRebuilds([b], laterKeys);', publish);
  assert.ok(decide > 0 && rebuild > decide && publish > rebuild && free > publish);
  assert.match(src, /rebuildAt\(b\.sha, fullArt, \{ skipSingle: b\.downloadArchived === true/);
});

test('a shared build keeps its single file when any download-keeping branch lists it newest', () => {
  const lists = [mk('release', ['x1', 'r2']), mk('test', ['t1', 'x1']), mk('alternative/dev', ['x1']), mk('dev', ['d1', 'd2'])];
  const need = singleNeededKeys(lists);
  assert.deepEqual([...need].sort(), ['d1:light', 't1:light', 'x1:light'].sort());
  assert.ok(!need.has('r2:light') && !need.has('d2:light'), 'older builds may skip the single file');
  assert.ok(!singleNeededKeys([mk('alternative/dev', ['a1'])]).has('a1:light'), 'alternative channels keep no download');
});

test('rebuildAt drops a cached out dir that was stripped of its single file when a caller needs it', () => {
  const src = readFileSync(new URL('../tools/pages-site.mjs', import.meta.url), 'utf8');
  assert.match(src, /cached\.strippedSingle && !skipSingle/);
  assert.match(src, /strippedSingle: Boolean\(skipSingle && webTree\)/);
  assert.match(src, /!singleNeeded\.has\(/);
  assert.ok(src.indexOf('cached.strippedSingle') < src.indexOf('const env = { ...process.env, GIT_LFS_SKIP_SMUDGE'), 'checked on the cache hit, before any rebuild');
});

// release/548 was a 255 MB legacy inline file (305 MB with its mobile copy) and took the
// assembled site to 2810 MB (run 42254638934).
test('a committed inline build over the legacy cap is judged from its LFS pointer and refused', () => {
  const pointer = (n) => `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize ${n}\n`;
  assert.equal(lfsPointerSize(pointer(255185771)), 255185771);
  assert.equal(lfsPointerSize('<!doctype html>'), null);
  assert.match(oversizeReason(255185771), /255 MB, over the 150 MB cap/);
  assert.equal(oversizeReason(105e6), null, 'main/81 (105 MB) is still served');
  assert.equal(oversizeReason(LEGACY_SINGLE_MAX_BYTES), null);
});

test('latest/download is a redirect stub to the newest build, not a second copy of the file', () => {
  const html = latestDownloadStub(210);
  assert.ok(html.length < 1000);
  assert.match(html, /url=\.\.\/\.\.\/210\/download\/AshenSpire\.html/);
  assert.match(html, /location\.replace\("\.\.\/\.\.\/210\/download\/AshenSpire\.html"\)/);
});

test('pointerOversize refuses an over-cap pointer and ignores non-pointers and an empty read', () => {
  const ptr = (n) => `version https://git-lfs.github.com/spec/v1\noid sha256:${'b'.repeat(64)}\nsize ${n}\n`;
  assert.match(pointerOversize(ptr(255185771)), /over the 150 MB cap/);
  assert.equal(pointerOversize(ptr(56e6)), null);
  assert.equal(pointerOversize(''), null, 'the simulated-purge path passes no pointer text, so it reaches committedArtifact');
  assert.equal(pointerOversize('<!doctype html>'), null);
});

const site = readFileSync(new URL('../tools/pages-site.mjs', import.meta.url), 'utf8');
test('artifactsOf applies the pointer cap before the fetch and not under the simulated purge', () => {
  const body = site.slice(site.indexOf('function artifactsOf'));
  assert.match(body, /if \(!SIMULATE_PURGE\) try \{ pointerText = git\(/);
  assert.ok(body.indexOf('pointerOversize(pointerText)') < body.indexOf("committedArtifact(b.sha, 'AshenSpire.html')"));
  assert.match(body, /if \(tooBig\) return \{ error: tooBig \}/);
});
