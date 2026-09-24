// The receipts gate's fallback window (tools/receipts.mjs, no promotion target
// fetched) must end where its oldest merge JOINED the first-parent line. When
// that merge sits on a side branch, excluding only its ancestors let the
// first-parent walk run back past the side branch's fork and judge squashes
// the window never covered (Codex review on #1275). This drives the real git
// walk against a scratch repository built for exactly that shape.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rangeSubjects, unreceipted } from '../tools/receipts.mjs';

function scratchRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'receipts-window-'));
  let t = 1_700_000_000;
  const git = (...args) => {
    t += 60;
    const date = `${t} +0000`;
    return execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
        GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_CONFIG_NOSYSTEM: '1', HOME: dir,
      },
    }).trim();
  };
  let n = 0;
  const commit = (subject) => { const f = `f${n++}`; writeFileSync(join(dir, f), f); git('add', f); git('commit', '-q', '-m', subject); };
  const merge = (branch, subject) => git('merge', '-q', '--no-ff', '-m', subject, branch);

  git('init', '-q', '-b', 'main');
  commit('root');
  // A side branch forks from root and carries a merge of its own: the oldest
  // merge the 4-merge window will select, and it is NOT on main's first parents.
  git('checkout', '-q', '-b', 'side');
  git('checkout', '-q', '-b', 'sub');
  commit('sub work');
  git('checkout', '-q', 'side');
  commit('side work');
  merge('sub', "Merge branch 'sub' into side");
  // Main moves on after the fork with a squash that has no receipt. It is older
  // than the side branch's landing, so the window must not judge it.
  git('checkout', '-q', 'main');
  commit('Old unreceipted squash (#90)');
  merge('side', 'Merge pull request #91 from o/side');
  for (let i = 0; i < 4; i += 1) commit(`chore ${i}`);
  for (const pr of [92, 93]) {
    git('checkout', '-q', '-b', `b${pr}`);
    commit(`work for ${pr}`);
    git('checkout', '-q', 'main');
    merge(`b${pr}`, `Merge pull request #${pr} from o/b${pr}`);
  }
  return dir;
}

test('the fallback window stops where its oldest merge joined the first-parent line', () => {
  const dir = scratchRepo();
  try {
    const md = [91, 92, 93].map((n) => `x ([#${n}](https://github.com/o/r/pull/${n}), \`0.1.0.${n}\`)`).join('\n');
    const subjects = rangeSubjects(null, { cwd: dir, limit: 4 });
    const { merged, missing } = unreceipted(subjects, md);
    assert.ok(merged.includes('91') && merged.includes('93'), `the window still covers the recent landings, got ${merged.join(', ')}`);
    assert.deepEqual(missing, [], 'a squash from before the side branch landed is outside the window');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
