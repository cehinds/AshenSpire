import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { alternativePairs, channelRole, downloadChannel, promotionTarget, siteRoot } from '../tools/alternative-branches.mjs';
import { mergeAlternative, syncAlternatives } from '../tools/sync-alternatives.mjs';
import { branchIndex, rootIndex } from '../tools/pages-site.mjs';

function fixture(t) {
  const scratch = process.platform === 'win32' ? 'D:/repos/.codex/tmp' : tmpdir();
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(join(scratch, 'alternative-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'test');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'core.autocrlf', 'false');
  const commit = (file, text) => {
    writeFileSync(join(dir, file), text);
    git('add', '--', file); git('commit', '-m', `Update ${file}`);
  };
  commit('shared.txt', 'baseline\n');
  git('branch', 'alternative/art/dev'); git('branch', 'alternative/art/test');
  return { dir, git, commit };
}

test('only complete alternative pairs are enrolled; names retain stage and nesting', () => {
  assert.deepEqual(alternativePairs(['dev', 'alternative/dev', 'alternative/test', 'alternative/art/dev', 'alternative/art/test', 'alternative/lonely/dev', 'feature/dev']), [
    { dev: 'alternative/art/dev', test: 'alternative/art/test' }, { dev: 'alternative/dev', test: 'alternative/test' },
  ]);
  assert.equal(siteRoot('alternative/art/test'), '../../../');
  assert.equal(channelRole('alternative/art/test'), 'test');
  assert.equal(downloadChannel('alternative/art/dev'), 'dev-alternative-art');
  assert.equal(promotionTarget('dev'), 'test');
  assert.equal(promotionTarget('alternative/dev'), 'alternative/test');
  assert.equal(promotionTarget('alternative/art/dev'), 'alternative/art/test');
  assert.equal(promotionTarget('codex/topic'), 'test');
});

test('safe shared edits reach the variant without changing its files; retry is a no-op', (t) => {
  const { dir, git, commit } = fixture(t);
  git('switch', 'alternative/art/dev'); commit('variant.txt', 'keep exactly\n');
  const before = git('rev-parse', 'HEAD');
  git('switch', 'test'); commit('shared.txt', 'promoted fix\n');
  const after = mergeAlternative(dir, 'test', 'alternative/art/dev');
  assert.equal(git('show', `${after}:variant.txt`), 'keep exactly');
  assert.equal(git('show', `${after}:shared.txt`), 'promoted fix');
  assert.equal(git('rev-parse', 'alternative/art/dev'), before, 'preparation must not move a branch');
  assert.equal(mergeAlternative(dir, 'test', after), after);
});

test('even a clean nonconflicting edit in an alternative-owned file is refused', (t) => {
  const { dir, git, commit } = fixture(t);
  git('switch', 'alternative/art/dev'); commit('shared.txt', 'alternative rule\n');
  git('switch', 'test'); commit('shared.txt', 'new primary rule\n');
  assert.throws(() => mergeAlternative(dir, 'test', 'alternative/art/dev'), /overlap alternative changes:[\s\S]*shared.txt/);
  assert.equal(git('show', 'alternative/art/dev:shared.txt'), 'alternative rule');
});

test('alternative deletion and rename are protected', (t) => {
  const { dir, git, commit } = fixture(t);
  git('switch', 'alternative/art/dev'); git('mv', 'shared.txt', 'renamed.txt'); git('commit', '-m', 'Alternative rename');
  git('switch', 'test'); commit('shared.txt', 'primary edit\n');
  assert.throws(() => mergeAlternative(dir, 'test', 'alternative/art/dev'), /shared.txt/);
});

test('alternative independent aura compositor remains a protected presentation implementation', (t) => {
  const { dir, git, commit } = fixture(t);
  mkdirSync(join(dir, 'src/ui'), { recursive: true });
  git('switch', 'alternative/art/dev');
  commit('src/ui/alternativeCardStage.js', 'authored class motions\n');
  commit('src/ui/alternativeAuraRenderer.js', 'stage-owned independent aura\n');
  git('switch', 'test');
  mkdirSync(join(dir, 'src/ui'), { recursive: true });
  commit('src/ui/alternativeAuraRenderer.js', 'incoming presentation replacement\n');
  assert.throws(() => mergeAlternative(dir, 'test', 'alternative/art/dev'), /overlap alternative changes:[\s\S]*alternativeAuraRenderer/);
  assert.equal(git('show', 'alternative/art/dev:src/ui/alternativeCardStage.js'), 'authored class motions');
  assert.equal(git('show', 'alternative/art/dev:src/ui/alternativeAuraRenderer.js'), 'stage-owned independent aura');
});

test('an identical shared edit is accepted and independent variant files remain', (t) => {
  const { dir, git, commit } = fixture(t);
  git('switch', 'alternative/art/dev'); commit('shared.txt', 'same\n'); commit('variant.txt', 'kept');
  git('switch', 'test'); commit('shared.txt', 'same\n');
  const after = mergeAlternative(dir, 'test', 'alternative/art/dev');
  assert.equal(git('show', `${after}:variant.txt`), 'kept');
});

test('a conflict on alternative test prevents publishing the otherwise safe dev result', (t) => {
  const { dir, git, commit } = fixture(t);
  git('switch', 'alternative/art/test'); commit('shared.txt', 'test customization\n');
  git('switch', 'test'); commit('shared.txt', 'primary update\n');
  for (const branch of ['test', 'alternative/art/dev', 'alternative/art/test']) git('update-ref', `refs/remotes/origin/${branch}`, branch);
  assert.throws(() => syncAlternatives(dir, { regenerate: false, push: true }), /overlap alternative changes/);
  assert.equal(git('show', 'alternative/art/dev:shared.txt'), 'baseline');
  assert.equal(git('show', 'alternative/art/test:shared.txt'), 'test customization');
});

test('no alternative pairs is a successful no-op', (t) => {
  const { dir } = fixture(t);
  assert.deepEqual(syncAlternatives(dir, { push: true, regenerate: false }), []);
});

test('frozen root pair is a no-write no-op through the API and direct publishing CLI', (t) => {
  const { dir, git, commit } = fixture(t);
  const remote = join(dir, 'remote.git');
  git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
  git('branch', 'alternative/dev'); git('branch', 'alternative/test');
  git('switch', 'alternative/dev'); commit('shared.txt', 'frozen root presentation\n');
  git('switch', 'test'); commit('shared.txt', 'new primary rule\n');
  git('push', 'origin', 'test', 'alternative/dev', 'alternative/test');
  const snapshot = () => ({ refs: git('show-ref'), head: git('symbolic-ref', 'HEAD'),
    index: git('ls-files', '--stage'), status: git('status', '--porcelain'),
    objects: git('count-objects', '-v'), remote: git('--git-dir', remote, 'show-ref') });
  const before = snapshot();
  // This formerly conflicting root must be filtered before preparation, even
  // with regeneration and publication requested. No Git objects or refs move.
  assert.deepEqual(syncAlternatives(dir, { push: true, regenerate: true }), []);
  assert.deepEqual(snapshot(), before);
  const output = execFileSync(process.execPath,
    [fileURLToPath(new URL('../tools/sync-alternatives.mjs', import.meta.url)), '--push'],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, PROMOTED_SHA: 'test' } });
  assert.match(output, /root alternative branches remain frozen/);
  assert.deepEqual(snapshot(), before);
});

test('retired root writer and architecture job cannot update the historical root branch', () => {
  const sync = readFileSync(new URL('../.github/workflows/alternative-sync.yml', import.meta.url), 'utf8');
  assert.match(sync, /policy-tests:[\s\S]*python -m unittest discover -s tests -p test_alternative_sync\.py -v/);
  assert.match(sync, /\n  sync:\s*\n    needs: policy-tests[\s\S]*?\n    if: \$\{\{ false \}\}/);
  const architecture = readFileSync(new URL('../.github/workflows/architecture-sync.yml', import.meta.url), 'utf8');
  assert.match(architecture, /if: github\.ref_name != 'alternative\/dev' &&/);
  assert.match(architecture, /github\.ref_name == 'dev'/);
  assert.match(architecture, /startsWith\(github\.ref_name, 'alternative\/'\) && endsWith\(github\.ref_name, '\/dev'\)/);
});

test('both alternative refs receive a safe promotion in one atomic push', (t) => {
  const { dir, git, commit } = fixture(t);
  const remote = join(dir, 'remote.git');
  git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
  git('switch', 'alternative/art/dev'); commit('variant.txt', 'custom content');
  git('switch', 'test'); commit('shared.txt', 'promoted');
  git('branch', 'alternative/dev'); git('branch', 'alternative/test');
  git('push', 'origin', 'test', 'alternative/art/dev', 'alternative/art/test', 'alternative/dev', 'alternative/test');
  const rootBefore = ['alternative/dev', 'alternative/test'].map(branch => git('--git-dir', remote, 'rev-parse', branch));
  const updates = syncAlternatives(dir, { push: true, regenerate: false });
  assert.equal(updates.length, 2);
  for (const { branch, sha } of updates) {
    assert.equal(git('--git-dir', remote, 'rev-parse', branch), sha);
    assert.equal(git('show', `${sha}:variant.txt`), 'custom content');
    assert.equal(git('show', `${sha}:shared.txt`), 'promoted');
  }
  assert.equal(updates[0].sha, updates[1].sha, 'test can advance to the prepared dev result without rebuilding it');
  assert.deepEqual(updates.map(({ branch }) => branch), ['alternative/art/dev', 'alternative/art/test']);
  assert.deepEqual(['alternative/dev', 'alternative/test'].map(branch => git('--git-dir', remote, 'rev-parse', branch)), rootBefore);
});

test('a concurrent alternative test update rejects the entire push', (t) => {
  const { dir, git, commit } = fixture(t);
  const remote = join(dir, 'remote.git');
  git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
  git('switch', 'test'); commit('shared.txt', 'promoted');
  git('push', 'origin', 'test', 'alternative/art/dev', 'alternative/art/test');
  const oldTest = git('rev-parse', 'origin/alternative/art/test');
  const oldDev = git('rev-parse', 'origin/alternative/art/dev');
  git('switch', 'alternative/art/test'); commit('variant.txt', 'concurrent owner edit');
  git('push', 'origin', 'alternative/art/test');
  const concurrent = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/alternative/art/test', oldTest);
  assert.throws(() => syncAlternatives(dir, { push: true, regenerate: false }), /atomic|rejected|failed/i);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'alternative/art/dev'), oldDev);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'alternative/art/test'), concurrent);
});

test('generated conflicts are regenerated and the snapshot names the merged source', (t) => {
  const { dir, git, commit } = fixture(t);
  mkdirSync(join(dir, 'tools')); mkdirSync(join(dir, 'docs'));
  // These are generator boundaries: this fixture tests merge ordering and
  // provenance, not the production digest algorithm's own existing tests.
  commit('tools/buildversion.mjs', "import {readFileSync,writeFileSync} from 'node:fs'; export const release=()=> '0.7.1'; export function bumpOrdinal(){const previous=JSON.parse(readFileSync('buildordinal.json','utf8')); writeFileSync('buildordinal.json',JSON.stringify({release:release(),ordinal:previous.ordinal+1,digest:'regenerated'}));}");
  commit('tools/update-architecture.mjs', "import {writeFileSync} from 'node:fs'; writeFileSync('docs/ARCHITECTURE-CURRENT-DEV.md',process.env.ARCHITECTURE_SOURCE_SHA);");
  commit('buildordinal.json', JSON.stringify({ release: '0.7.1', ordinal: 100 }));
  commit('docs/ARCHITECTURE-CURRENT-DEV.md', 'original');
  git('branch', '-f', 'alternative/art/dev', 'HEAD');
  git('switch', 'alternative/art/dev'); commit('buildordinal.json', JSON.stringify({ release: '0.7.1', ordinal: 101 })); commit('variant.txt', 'retained');
  git('switch', 'test'); commit('buildordinal.json', JSON.stringify({ release: '0.7.1', ordinal: 103 })); commit('shared.txt', 'new primary');
  const after = mergeAlternative(dir, 'test', 'alternative/art/dev', { regenerate: true });
  assert.deepEqual(JSON.parse(git('show', `${after}:buildordinal.json`)), { release: '0.7.1', ordinal: 104, digest: 'regenerated' });
  assert.equal(git('show', `${after}:variant.txt`), 'retained');
  const merged = git('rev-parse', `${after}^`);
  assert.equal(git('show', `${after}:docs/ARCHITECTURE-CURRENT-DEV.md`), merged);
  assert.equal(git('show', `${merged}:shared.txt`), 'new primary');
});

for (const example of [
  { name: 'an alternative counter ahead of primary', targetRelease: '0.7.1', targetOrdinal: 110, expected: 111 },
  { name: 'a larger counter from an older release', targetRelease: '0.6.9', targetOrdinal: 900, expected: 104 },
]) {
  test(`receipt regeneration respects ${example.name}`, (t) => {
    const { dir, git, commit } = fixture(t);
    mkdirSync(join(dir, 'tools')); mkdirSync(join(dir, 'docs'));
    commit('tools/buildversion.mjs', "import {readFileSync,writeFileSync} from 'node:fs'; export const release=()=> '0.7.1'; export function bumpOrdinal(){const previous=JSON.parse(readFileSync('buildordinal.json','utf8')); writeFileSync('buildordinal.json',JSON.stringify({release:release(),ordinal:previous.ordinal+1}));}");
    commit('tools/update-architecture.mjs', "import {writeFileSync} from 'node:fs'; writeFileSync('docs/ARCHITECTURE-CURRENT-DEV.md',process.env.ARCHITECTURE_SOURCE_SHA);");
    commit('buildordinal.json', JSON.stringify({ release: '0.6.9', ordinal: 100 }));
    commit('docs/ARCHITECTURE-CURRENT-DEV.md', 'original');
    git('branch', '-f', 'alternative/art/dev', 'HEAD');
    git('switch', 'alternative/art/dev');
    commit('buildordinal.json', JSON.stringify({ release: example.targetRelease, ordinal: example.targetOrdinal }));
    commit('variant.txt', 'retained');
    git('switch', 'test');
    commit('buildordinal.json', JSON.stringify({ release: '0.7.1', ordinal: 103 }));
    commit('shared.txt', 'promoted');
    const after = mergeAlternative(dir, 'test', 'alternative/art/dev', { regenerate: true });
    assert.equal(JSON.parse(git('show', `${after}:buildordinal.json`)).ordinal, example.expected);
    assert.equal(git('show', `${after}:variant.txt`), 'retained');
  });
}

test('nested preview indexes resolve play, downloads and root navigation correctly', () => {
  const branch = 'alternative/art/test';
  const b = { branch, ordinal: 12, version: '0.7.8', digest: 'abcdef', sha: 'a'.repeat(40), built: '2026-10-06', bytes: 42, shape: 'pack', download: { bytes: 30 } };
  const html = branchIndex(branch, [b], b.sha, '2026-10-06');
  const base = 'https://example.invalid/AshenSpire/alternative/art/test/';
  const urls = [...html.matchAll(/href="([^"#]+)"/g)].map((m) => new URL(m[1], base).href);
  assert.ok(urls.includes('https://example.invalid/AshenSpire/'));
  assert.ok(urls.includes(`${base}12/`));
  assert.ok(urls.includes(`${base}12/download/AshenSpire.html`));
  assert.match(html, /AshenSpire-test-alternative-art-0\.7\.8\.12\.html/);
  const data = [{ branch: 'dev', builds: [], head: 'a' }, { branch, builds: [b], head: b.sha, headOrdinal: 12 }];
  const root = rootIndex(data, '2026-10-06', []);
  assert.ok(root.indexOf('<h3>dev</h3>') < root.indexOf('id="alternative-previews"'));
  assert.ok(root.indexOf(`<h3>${branch}</h3>`) > root.indexOf('id="alternative-previews"'));
  assert.match(root, /BUILD 0\.7\.8\.12/);
});
