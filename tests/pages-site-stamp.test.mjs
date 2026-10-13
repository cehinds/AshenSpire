// The pages selftest rebuilds dev's newest [build-stamp] commit, not its live
// tip: a merge landing on dev mid-run is unstamped (run 38351851211).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newestStampOf } from '../tools/pages-site.mjs';

test('newestStampOf picks the newest first-parent [build-stamp] commit, past a later merge', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pages-stamp-'));
  try {
    const run = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    const commit = (msg) => { writeFileSync(join(dir, 'f'), msg); run(['add', 'f']); run(['commit', '-qm', msg]); return run(['rev-parse', 'HEAD']).trim(); };
    run(['init', '-q', '-b', 'dev']);
    commit('build: stamp 0.7.1.1 [build-stamp]');
    commit('Merge pull request #1 from x/y');
    const stamp = commit('build: stamp 0.7.1.2 [build-stamp]');
    commit('docs: refresh current-dev architecture [architecture-sync]');
    commit('Merge pull request #3 from x/w\n\nmentions [build-stamp] in its body');
    commit('Revert [build-stamp] handling');
    commit('Merge pull request #2 from x/z');
    assert.equal(newestStampOf('dev', run), stamp);
    assert.equal(newestStampOf(null, run), null);
    assert.equal(newestStampOf('no-such-ref', run), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
