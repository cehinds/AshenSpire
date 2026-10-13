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
  assert.match(job, /needs: stage\n/, 'browser-full-run does not depend on the stage decision');
  assert.match(job, /if: \$\{\{ needs\.stage\.outputs\.functional == 'true' \}\}/, 'browser-full-run is not gated on the functional stage output');
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
    if (/needs\.stage\.outputs\.functional/.test(job)) return 'test';
    const m = job.match(/\["all","(release)"\]/);
    return m ? m[1] : null;
  };
  const needed = [...boundary.matchAll(/needs: \[([^\]]+)\]/g)][0][1].split(',').map((s) => s.trim()).filter((j) => j !== 'stage');
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

test('every functional job depends on the stage decision and is gated on its functional output', () => {
  const all = jobs(readFileSync(CI, 'utf8').replace(/\r\n/g, '\n'));
  const functional = ['test', 'test-discovered', 'test-selftests', 'parse-gate', 'browser-guard', 'browser-full-run', 'browser-flask-menu', 'browser-flask-menu-plants', 'browser-guard-changelog', 'browser-startup-plants'];
  for (const name of functional) {
    const job = all.get(name);
    assert.ok(job, `ci.yml has no ${name} job`);
    assert.match(job, /\n    needs: stage\n/, `${name} does not need the stage job`);
    assert.match(job, /if: \$\{\{ needs\.stage\.outputs\.functional == 'true' \}\}/, `${name} is not gated on needs.stage.outputs.functional`);
    assert.doesNotMatch(job, /github\.ref_name != 'release'/, `${name} still decides its stage from the ref`);
  }
  const stage = all.get('stage');
  assert.ok(stage, 'ci.yml has no stage job');
  assert.match(stage, /functional: \$\{\{ steps\.decide\.outputs\.functional \}\}/, 'stage job does not output functional');
  assert.match(stage, /polish: \$\{\{ steps\.decide\.outputs\.polish \}\}/, 'stage job does not output polish');
  assert.match(stage, /git diff --quiet origin\/test HEAD/, 'stage job does not compare the release tree with test');
  assert.match(all.get('boundary'), /needs: \[stage,/, 'boundary does not need the stage job');
  assert.match(all.get('boundary'), /release tree differs from test: functional suites ran/, 'boundary does not print the differing-tree line');
});

// The four browser-check workflows run on a push to release only when its tree
// differs from origin/test, through the same stage decision as ci.yml, and their
// gated job waits on that decision.
const STAGED = ['tutorial-reach.yml', 'map-camera.yml', 'coop-hud.yml', 'quick-start.yml'];

test('tutorial-reach, map-camera, coop-hud and quick-start gate their job on the stage output', () => {
  for (const file of STAGED) {
    const text = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const all = jobs(text);
    assert.match(text, /^  push:\n    branches: \[[^\]\n]*\brelease\b/m, `${file} does not push-trigger on release`);
    const stage = all.get('stage');
    assert.ok(stage, `${file} has no stage job`);
    assert.match(stage, /outputs:\n      run: \$\{\{ steps\.decide\.outputs\.run \}\}/, `${file} stage job does not output run`);
    assert.match(stage, /filter: blob:none/, `${file} stage checkout is not blobless`);
    assert.match(stage, /git diff --quiet origin\/test HEAD/, `${file} stage job does not compare the release tree with test`);
    const gated = [...all].filter(([name, job]) => name !== 'stage' && /\n    needs: stage\n/.test(job));
    assert.equal(gated.length, 1, `${file} gates ${gated.length} jobs on the stage, expected one`);
    assert.match(gated[0][1], /\n    if: needs\.stage\.outputs\.run == 'true'\n/, `${file} job ${gated[0][0]} is not gated on needs.stage.outputs.run`);
  }
});
