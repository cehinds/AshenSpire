// tests/ci-stage-placement.test.mjs — the browser full run is a functional
// check, so it runs at the test stage (push to test), not only at release.
//
// WHY. It sat as the last step of browser-guard-stamp, which is release-only,
// so a functional regression reached release before anything ran it. A check
// moves to the stage whose job it is; this pins the full run to a test-stage
// job (its `if:` admits push to test and not release) and forbids the release-
// only stamp job from running it again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CI = fileURLToPath(new URL('../.github/workflows/ci.yml', import.meta.url));

function jobs(text) {
  const out = new Map();
  const body = text.slice(text.indexOf('\njobs:\n'));
  const marks = [...body.matchAll(/^ {2}([A-Za-z0-9_-]+):\n/gm)];
  marks.forEach((m, i) => out.set(m[1], body.slice(m.index, i + 1 < marks.length ? marks[i + 1].index : body.length)));
  return out;
}

test('the whole-run probe runs in a test-stage job, not in the release-only stamp job', () => {
  const all = jobs(readFileSync(CI, 'utf8').replace(/\r\n/g, '\n'));
  const probing = [...all].filter(([, job]) => /run: .*node tools\/full-run-probe\.mjs/.test(job)).map(([name]) => name);
  assert.deepEqual(probing, ['browser-full-run'], `full-run-probe runs in: ${probing.join(', ')}`);
  const job = all.get('browser-full-run');
  assert.match(job, /if: \$\{\{ \(github\.event_name == 'workflow_dispatch' && contains\(fromJSON\('\["all","test"\]'\), inputs\.stage\)\) \|\| \(github\.event_name == 'push' && github\.ref_name != 'release'\) \}\}/, 'browser-full-run is not a test-stage job');
  assert.match(job, /uses: \.\/\.github\/actions\/fetch-art/, 'browser-full-run runs without the fetched art packs');
  assert.match(job, /uses: \.\/\.github\/actions\/which-browser/, 'browser-full-run runs without a browser');
  assert.match(all.get('boundary'), /browser-full-run/, 'boundary does not name browser-full-run');
});
