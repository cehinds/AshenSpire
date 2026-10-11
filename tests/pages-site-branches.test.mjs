// The branches/ section of the Pages site: feature-branch builds for open PRs into
// dev. Pure functions and a temp directory only; no git history, no build.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeBranchDir, readBranchPreviews, publishBranchPreviews, branchPreviewSection, rootIndex } from '../tools/pages-site.mjs';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pages-branches-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// One PR build as the workflow lays it out: <dir>/<safe>/AshenSpire-dev-preview.html.
function stage(dir, branch, body = '<!doctype html><title>preview</title>') {
  const safe = safeBranchDir(branch);
  mkdirSync(join(dir, safe), { recursive: true });
  writeFileSync(join(dir, safe, 'AshenSpire-dev-preview.html'), body);
  return { branch, dir: safe, pr: 7, sha: 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0' };
}

test('a branch keeps its slash and any other character becomes a dash', () => {
  assert.equal(safeBranchDir('chore/CdCiPipelines'), 'chore/CdCiPipelines');
  assert.equal(safeBranchDir('feature/m1 combat+slice'), 'feature/m1-combat-slice');
  assert.throws(() => safeBranchDir('feature/../etc'), /no safe site path/);
  assert.throws(() => safeBranchDir('feature//x'), /no safe site path/);
  assert.throws(() => safeBranchDir('/feature/x'), /no safe site path/);
});

test('the manifest is read, and an entry that cannot be served is skipped and named', (t) => {
  const dir = scratch(t);
  const good = stage(dir, 'feature/good');
  mkdirSync(join(dir, 'fix', 'empty'), { recursive: true });
  const skipped = [];
  writeFileSync(join(dir, 'previews.json'), JSON.stringify({ previews: [
    good,
    { branch: 'fix/empty', dir: 'fix/empty', pr: 9, sha: 'ffffff1' },
    { branch: 'chore/x', dir: 'chore/wrong', pr: 10, sha: 'ffffff1' },
  ] }));
  const served = readBranchPreviews(dir, skipped);
  assert.deepEqual(served.map((p) => p.path), ['feature/good']);
  assert.equal(skipped.length, 2);
  assert.match(skipped[0].reason, /found 0/);
  assert.match(skipped[1].reason, /not the branch's site path/);
});

test('no manifest means no previews', (t) => {
  assert.deepEqual(readBranchPreviews(scratch(t), []), []);
});

test('a preview is published at branches/<branch>/latest/ as the playable game and a download', (t) => {
  const dir = scratch(t);
  const out = scratch(t);
  const entry = stage(dir, 'feature/m2-map-gen', '<!doctype html><title>map</title>');
  writeFileSync(join(dir, 'previews.json'), JSON.stringify({ previews: [entry] }));
  const [prev] = readBranchPreviews(dir, []);
  publishBranchPreviews(out, [prev]);
  const latest = join(out, 'branches', 'feature/m2-map-gen', 'latest');
  assert.equal(readFileSync(join(latest, 'index.html'), 'utf8'), '<!doctype html><title>map</title>');
  assert.equal(readFileSync(join(latest, 'download', 'AshenSpire-dev-preview.html'), 'utf8'), '<!doctype html><title>map</title>');
});

test('the index section lists each open-PR build and says so when there are none', () => {
  const none = branchPreviewSection([]);
  assert.match(none, /id="branch-builds"/);
  assert.match(none, /No open pull request into/);

  const html = branchPreviewSection([{ branch: 'feature/x', path: 'feature/x', pr: 12, sha: 'a1b2c3d4e5f6', file: 'AshenSpire-dev-preview.html' }]);
  assert.match(html, /open pull request #12 into dev/);
  assert.match(html, /href="branches\/feature\/x\/latest\/"/);
  assert.match(html, /href="branches\/feature\/x\/latest\/download\/AshenSpire-dev-preview\.html"/);
  assert.match(html, /commit <a href="https:\/\/github\.com\/cehinds\/AshenSpire\/commit\/a1b2c3d4e5f6">a1b2c3d4e5/);
});

test('the root index carries the branches section only when previews are passed', () => {
  const data = [{ branch: 'dev', builds: [], headTracksBuild: false, headOrdinal: null }];
  assert.doesNotMatch(rootIndex(data, 'now', []), /branch-builds/);
  const withSection = rootIndex(data, 'now', [], [{ branch: 'fix/y', path: 'fix/y', pr: 3, sha: '', file: 'AshenSpire-dev-preview.html' }]);
  assert.match(withSection, /id="branch-builds"/);
  assert.match(withSection, /branches\/fix\/y\/latest\//);
});
