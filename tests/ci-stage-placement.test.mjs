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

test('the boundary stage summary lists the same test and release jobs the job-level if: lines assign', () => {
  const all = jobs(readFileSync(CI, 'utf8').replace(/\r\n/g, '\n'));
  const boundary = all.get('boundary');
  const listed = (name) => {
    const m = boundary.match(new RegExp(`${name}="([^"]+)"`));
    assert.ok(m, `boundary does not declare ${name}`);
    return m[1].split(' ').sort();
  };
  const stageOf = (job) => {
    const m = job.match(/\["all","(test|release)"\]/);
    return m ? m[1] : null;
  };
  const needed = [...boundary.matchAll(/needs: \[([^\]]+)\]/g)][0][1].split(',').map((s) => s.trim());
  const testJobs = needed.filter((j) => stageOf(all.get(j)) === 'test').sort();
  const releaseJobs = needed.filter((j) => stageOf(all.get(j)) === 'release').sort();
  assert.deepEqual(listed('TEST_JOBS'), testJobs, 'TEST_JOBS differs from the test-stage if: lines');
  assert.deepEqual(listed('RELEASE_JOBS'), releaseJobs, 'RELEASE_JOBS differs from the release-stage if: lines');
  assert.equal(testJobs.length + releaseJobs.length, needed.length, 'a boundary need has no stage');
  assert.match(boundary, /NOT RUN AT THIS STAGE/, 'boundary does not print what did not run at this stage');
});

test('the boundary claims print per stage, and only for a stage that ran', () => {
  const boundary = jobs(readFileSync(CI, 'utf8').replace(/\r\n/g, '\n')).get('boundary');
  const step = boundary.slice(boundary.indexOf('      - name: Named boundary'), boundary.indexOf('      - name: Fail when a job that ran'));
  assert.doesNotMatch(step, /A GREEN RUN OF THIS WORKFLOW MEANS/, 'the unconditional both-stage claim header is still printed');
  // Each stage's claims sit between its own `if [ "$RAN_… " = 1 ]; then` and the `else`
  // line, and the `else` prints one line saying those claims do not apply to this run.
  const branch = (gate) => {
    const start = step.indexOf(`if [ "$${gate}" = 1 ]; then`);
    assert.ok(start >= 0, `boundary has no if [ "$${gate}" = 1 ] block`);
    const elseAt = step.indexOf('\n          else\n', start);
    const fiAt = step.indexOf('\n          fi\n', elseAt);
    assert.ok(elseAt > start && fiAt > elseAt, `${gate} block has no else/fi`);
    return { claims: step.slice(start, elseAt), otherwise: step.slice(elseAt, fiAt) };
  };
  const test = branch('RAN_TEST');
  const release = branch('RAN_RELEASE');
  // test-stage claims: engine suite, the cold-boot storage gate, the UNAVAILABLE probe branches.
  assert.match(test.claims, /the whole engine suite passes/, 'engine-suite claim is not in the test-stage block');
  assert.match(test.claims, /\?shot= cannot write to localStorage/, 'storage claim is not in the test-stage block');
  assert.match(test.claims, /UNAVAILABLE branches/, 'UNAVAILABLE claim is not in the test-stage block');
  assert.doesNotMatch(test.claims, /reproducible|byte-identical|Armoury arrives|build version has ONE home/, 'a release-stage claim is in the test-stage block');
  assert.match(test.otherwise, /THE TEST-STAGE CLAIMS DO NOT APPLY TO THIS RUN/, 'test stage has no does-not-apply line');
  // release-stage claims: the reproducible build, the three runners, the ink, layout, motion.
  assert.match(release.claims, /the three runners build byte-identical standalones/, 'byte-identical claim is not in the release-stage block');
  assert.match(release.claims, /the Armoury arrives with the FIGURE WHOLE/, 'Armoury claim is not in the release-stage block');
  assert.match(release.claims, /the build version has ONE home/, 'build-version claim is not in the release-stage block');
  assert.doesNotMatch(release.claims, /the whole engine suite passes|\?shot= cannot write/, 'a test-stage claim is in the release-stage block');
  assert.match(release.otherwise, /THE RELEASE-STAGE CLAIMS DO NOT APPLY TO THIS RUN/, 'release stage has no does-not-apply line');
});
