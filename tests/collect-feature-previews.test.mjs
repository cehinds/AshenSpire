import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFeaturePreviews, freshBuild } from '../tools/collect-feature-previews.mjs';
import { branchPreviewSection } from '../tools/pages-site.mjs';
const built = 'a'.repeat(40), head = 'b'.repeat(40);
const comparison = { status: 'ahead', merge_base_commit: { sha: built }, total_commits: 1, files: [{ filename: 'docs/readme.md' }] };
test('freshness allows exact HEAD or proven documentation-only descendant', async () => {
  assert.equal(await freshBuild(() => { throw Error('unneeded'); }, 'r', built, built), true);
  assert.equal(await freshBuild(async () => comparison, 'r', built, head), true);
  for (const change of [{ status: 'diverged' }, { files: [{ filename: 'src/game.js' }] }, { files: Array(300).fill({ filename: 'README.md' }) }, { files: [] }, { files: [{ filename: 'docs/new', previous_filename: 'src/old' }] }, { merge_base_commit: { sha: head } }]) {
    assert.equal(await freshBuild(async () => ({ ...comparison, ...change }), 'r', built, head), false);
  }
});
function setup(t, options = {}) {
  const out = mkdtempSync(join(tmpdir(), 'feature-collector-'));
  t.after(() => rmSync(out, { recursive: true, force: true }));
  const original = [{ branch: 'fix/pr-only', dir: 'fix/pr-only', pr: 17 }, { branch: 'alternative/other/dev', dir: 'alternative/other/dev' }];
  writeFileSync(join(out, 'previews.json'), JSON.stringify({ previews: original }));
  const api = async (url) => {
    if (url.includes('/compare/')) return options.comparison || comparison;
    if (url.includes('/branches?')) return [{ name: 'Feature/test', commit: { sha: options.head || built } }, { name: 'feature/../unsafe', commit: { sha: built } }];
    if (url.includes('/runs?')) return { workflow_runs: [{ id: 9, head_sha: built, head_branch: 'Feature/test', conclusion: options.conclusion || 'success' }] };
    if (url.includes('/artifacts?')) return { artifacts: [{ name: `feature-preview-${built}`, expired: !!options.expired }] };
    throw Error(url);
  };
  return { out, original, api, repo: 'owner/repo', warn: () => {}, download: async (_id, _name, dir) => writeFileSync(join(dir, 'AshenSpire.html'), '<html>game</html>') };
}
test('case-insensitive feature inventory merges PR and other channel entries', async (t) => {
  const fixture = setup(t);
  const entries = await collectFeaturePreviews(fixture);
  assert.deepEqual(entries.slice(0, 2), fixture.original);
  assert.equal(entries[2].branch, 'Feature/test');
  assert.match(branchPreviewSection([{ branch: 'Feature/test', path: 'Feature/test', file: 'a.html', pr: 0 }]), /feature branch build/);
});
test('documentation-only HEAD advance keeps the tested artifact source SHA', async (t) => {
  const fixture = setup(t, { head });
  assert.equal((await collectFeaturePreviews(fixture))[2].sha, built);
});
for (const [label, options] of [['failed build', { conclusion: 'failure' }], ['expired artifact', { expired: true }], ['changed code pending', { head, comparison: { ...comparison, files: [{ filename: 'src/game.js' }] } }]]) {
  test(`${label} omits stale branch while retaining other entries`, async (t) => {
    const fixture = setup(t, options);
    assert.deepEqual(await collectFeaturePreviews(fixture), fixture.original);
  });
}
test('inventory or download failure aborts without replacing manifest', async (t) => {
  const fixture = setup(t);
  const before = readFileSync(join(fixture.out, 'previews.json'), 'utf8');
  await assert.rejects(collectFeaturePreviews({ ...fixture, download: async () => { throw Error('network unavailable'); } }));
  assert.equal(readFileSync(join(fixture.out, 'previews.json'), 'utf8'), before);
  await assert.rejects(collectFeaturePreviews({ ...fixture, api: async () => { throw Error('API failure'); } }));
});
test('invalid individual artifact is skipped', async (t) => {
  const fixture = setup(t);
  assert.deepEqual(await collectFeaturePreviews({ ...fixture, download: async () => {} }), fixture.original);
});
