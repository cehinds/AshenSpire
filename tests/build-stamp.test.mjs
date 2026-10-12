// tests/build-stamp.test.mjs — tools/build-stamp.mjs, and the workflow that runs it.
//
// The pure core (restamp, landedInSubjects, parseRange) is driven directly; the
// tool's own corpus runs through its --selftest door; and the wiring in
// .github/workflows/build-stamp.yml is pinned as text, the way
// tests/ci-stage-placement.test.mjs pins ci.yml, because a workflow that runs
// on the wrong ref or with the wrong permission is silent until it is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BOT_AUTHOR as BOT, isNullSha, landedAfterBase, landedInSubjects, landedSince, parseRange, pickStampBase, restamp } from '../tools/build-stamp.mjs';

// A throwaway repository whose first-parent line is the given commit subjects,
// oldest first. Each entry is a subject; an empty commit carries it.
// Each entry is a subject (authored by "dev") or { subject, author }.
function repoWith(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'build-stamp-base-'));
  const run = (author, ...args) => execFileSync('git', args, {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: author, GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: author, GIT_COMMITTER_EMAIL: 't@example.invalid' },
  }).trim();
  const git = (...args) => run('dev', ...args);
  git('init', '-q', '-b', 'main');
  const shas = entries.map((e) => {
    const { subject, author = 'dev' } = typeof e === 'string' ? { subject: e } : e;
    run(author, 'commit', '-q', '--allow-empty', '-m', subject);
    return git('rev-parse', 'HEAD');
  });
  return { dir, shas, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOOL = fileURLToPath(new URL('../tools/build-stamp.mjs', import.meta.url));
const WORKFLOW = readFileSync(new URL('../.github/workflows/build-stamp.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const DEV_PREVIEW = readFileSync(new URL('../.github/workflows/dev-preview.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const BOX = { release: '0.7.1', ordinal: 1405 };
const link = (n, s) => `- **Entry ${n}** ([#${n}](https://github.com/cehinds/AshenSpire/pull/${n}), \`${s}\`)`;
const MD = [link(12, '0.7.1.1400'), link(13, '0.7.1.1400'), link(1884, '0.7.1.1400'), link(18, '0.7.1.1400')].join('\n');
const stampOf = (text, n) => new RegExp(`/pull/${n}\\),\\s*\`([^\`]+)\``).exec(text)?.[1];

test('restamp re-points exactly the named receipt to the box', () => {
  const r = restamp(MD, ['12'], BOX);
  assert.deepEqual(r.changed, [{ pr: '12', from: '0.7.1.1400', to: '0.7.1.1405' }]);
  assert.equal(stampOf(r.text, 12), '0.7.1.1405');
  assert.equal(stampOf(r.text, 13), '0.7.1.1400', 'the neighbour keeps its stamp');
  assert.equal(r.text.replace('0.7.1.1405', '0.7.1.1400'), MD, 'nothing else in the file moves');
});

test('restamp reports a pull request with no receipt, and changes nothing for it', () => {
  const r = restamp(MD, ['99'], BOX);
  assert.equal(r.text, MD);
  assert.deepEqual(r.missing, ['99']);
  assert.deepEqual(r.changed, []);
});

test('restamp leaves a stamp that is already the box alone', () => {
  const at = MD.replace(/0\.7\.1\.1400/g, '0.7.1.1405');
  const r = restamp(at, ['12', '13'], BOX);
  assert.equal(r.text, at);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.current, ['12', '13']);
});

test('restamp re-points two pull requests in one call', () => {
  const r = restamp(MD, ['12', '13'], BOX);
  assert.deepEqual(r.changed.map((c) => c.pr), ['12', '13']);
  assert.equal(stampOf(r.text, 1884), '0.7.1.1400');
});

test('restamp never crosses a number that is a prefix of another (#18 and #1884)', () => {
  const eighteen = restamp(MD, ['18'], BOX);
  assert.equal(stampOf(eighteen.text, 18), '0.7.1.1405');
  assert.equal(stampOf(eighteen.text, 1884), '0.7.1.1400');
  const big = restamp(MD, ['1884'], BOX);
  assert.equal(stampOf(big.text, 1884), '0.7.1.1405');
  assert.equal(stampOf(big.text, 18), '0.7.1.1400');
  assert.deepEqual(restamp(MD, ['1'], BOX).missing, ['1'], 'the number 1 is not a receipt of any of them');
});

test('restamp leaves a receipt with no stamp after its link alone, and says so', () => {
  const bare = '- **Bare** ([#20](https://github.com/cehinds/AshenSpire/pull/20))';
  const r = restamp(bare, ['20'], BOX);
  assert.equal(r.text, bare);
  assert.deepEqual(r.unstamped, ['20']);
});

test('landedInSubjects: merge commits anywhere, a squash suffix on the first-parent line only, each number once', () => {
  assert.deepEqual(landedInSubjects([
    'Merge pull request #5 from a/b',
    { subject: 'Add a thing (#6)', firstParent: true },
    { subject: 'Fix inside a branch (#7)', firstParent: false },
    'Merge PR #8: a title',
    'Merge pull request #5 from a/b',
  ]), ['5', '6', '8']);
});

test('parseRange and isNullSha: a range is <before>..<after>; an all-zero before has no range to walk', () => {
  assert.deepEqual(parseRange('abc123..def456'), { before: 'abc123', after: 'def456' });
  assert.throws(() => parseRange('abc123'), /<before>\.\.<after>/);
  assert.equal(isNullSha('0000000000000000000000000000000000000000'), true);
  assert.equal(isNullSha(''), true);
  assert.equal(isNullSha('d69eb3c79f'), false);
});

test('build-stamp --selftest exits 0 with its known-bad corpus green', () => {
  const r = spawnSync(process.execPath, [TOOL, '--selftest'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /build-stamp-selftest: OK/);
});

test('build-stamp refuses a malformed --prs list with exit 2, not an empty stamp', () => {
  const r = spawnSync(process.execPath, [TOOL, '--prs', 'twelve'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

// --- the workflow, as text -------------------------------------------------

// The lines of one `run: |` block, and the lines of the whole job, by their
// own indentation, so a later edit that moves a `${{ }}` into a script is seen.
function runBlocks(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (/^ {8}run: \|/.test(lines[i])) {
      const body = [];
      for (let j = i + 1; j < lines.length && (lines[j] === '' || /^ {10}/.test(lines[j])); j += 1) body.push(lines[j]);
      out.push(body.join('\n'));
    }
  }
  return out;
}

test('build-stamp.yml triggers only on dev branch pushes and a manual dispatch', () => {
  const on = /\non:\n([\s\S]*?)\n\S/.exec(WORKFLOW)?.[1] || '';
  assert.match(on, /push:\n {4}branches: \[dev, alternative\/dev, 'alternative\/\*\*\/dev'\]/);
  assert.match(on, /workflow_dispatch:/);
  assert.doesNotMatch(on, /pull_request/, 'a pull request must not run the stamp');
});

test('build-stamp.yml grants contents: write, and no more', () => {
  assert.match(WORKFLOW, /\npermissions:\n {2}contents: write\n/);
  assert.doesNotMatch(WORKFLOW, /contents: write[\s\S]*pull-requests: write/);
});

test('build-stamp.yml skips the bot\'s own commit and any non-dev ref', () => {
  const guard = /if: (.*)/.exec(WORKFLOW)?.[1] || '';
  assert.match(guard, /!\(github\.event\.head_commit\.author\.name == 'github-actions\[bot\]' && startsWith\(github\.event\.head_commit\.message, 'build: stamp '\) && contains\(github\.event\.head_commit\.message, '\[build-stamp\]'\)\)/, 'the skip is the bot author and the stamp prefix, not a substring');
  assert.match(guard, /\(github\.event_name == 'workflow_dispatch' \|\|/);
  assert.match(guard, /github\.ref_name == 'dev'/);
  assert.match(guard, /startsWith\(github\.ref_name, 'alternative\/'\) && endsWith\(github\.ref_name, '\/dev'\)/);
  assert.match(guard, /github\.ref_name != 'alternative\/dev'/);
});

test('build-stamp.yml checks out full history, then sets up node, then fetches the art before building', () => {
  const checkout = WORKFLOW.indexOf('uses: actions/checkout@v5');
  const node = WORKFLOW.indexOf('uses: ./.github/actions/setup-node');
  const art = WORKFLOW.indexOf('uses: ./.github/actions/fetch-art');
  const build = WORKFLOW.indexOf('node tools/build-stamp.mjs --stamp');
  assert.ok(checkout > 0 && node > checkout && art > node && build > art, 'checkout, setup-node, fetch-art, build in that order');
  assert.match(WORKFLOW.slice(checkout, node), /fetch-depth: 0/);
  assert.match(WORKFLOW.slice(art, art + 600), /packs: \$\{\{ env\.ART_PACKS \}\}/);
  assert.match(WORKFLOW, /ART_PACKS: all/);
});

test('build-stamp.yml runs the whole stamp as one --stamp step, before anything is added or pushed', () => {
  // The convergence loop owns the build, the re-point, the module write and the
  // rebuilds. The workflow must not run those steps itself: a separate write
  // after a build is exactly the one-build-behind defect (the module is in the digest).
  assert.doesNotMatch(WORKFLOW, /tools\/launch\.mjs/);
  assert.doesNotMatch(WORKFLOW, /about-changelog\.mjs --write/);
  const at = (s) => WORKFLOW.indexOf(s);
  assert.ok(at('build-stamp.mjs --stamp --since-last-stamp') > 0 && at('node tools/build-stamp.mjs --stamp --prs') > 0);
  assert.ok(at('build-stamp.mjs --stamp --since-last-stamp') < at('git add --'));
  assert.ok(at('node tools/build-stamp.mjs --stamp --prs') < at('git add --'));
  assert.match(WORKFLOW, /GITHUB_EVENT_BEFORE="\$BEFORE" node tools\/build-stamp\.mjs --stamp --since-last-stamp/, 'the base falls back to the event before, via env');
});

test('build-stamp.yml adds exactly the three derived files, never the built HTML or everything', () => {
  assert.match(WORKFLOW, /git add -- buildordinal\.json CHANGELOG\.md src\/content\/changelog\.generated\.js/);
  assert.doesNotMatch(WORKFLOW, /git add (-A|\.|--all)\b/);
  assert.doesNotMatch(WORKFLOW, /\.html/, 'the built HTML is never named by this workflow');
});

test('build-stamp.yml keeps github.event.before and inputs out of script text', () => {
  const blocks = runBlocks(WORKFLOW);
  assert.ok(blocks.length >= 1, 'the workflow has run blocks');
  for (const body of blocks) assert.doesNotMatch(body, /\$\{\{/, 'a run block interpolates an expression');
  assert.match(WORKFLOW, /BEFORE: \$\{\{ github\.event\.before \}\}/);
  assert.match(WORKFLOW, /PRS: \$\{\{ github\.event\.inputs\.prs \}\}/);
});

test('build-stamp.yml retries the push four times with 2, 4 and 8 second backoff, like architecture-sync', () => {
  assert.match(WORKFLOW, /delays=\(2 4 8\)/);
  assert.match(WORKFLOW, /for attempt in 1 2 3 4; do/);
  assert.match(WORKFLOW, /git push -q origin "HEAD:\$REF_NAME"/);
});

test('build-stamp.yml never kills a running stamp, and states that a later run covers a missed one', () => {
  assert.match(WORKFLOW, /group: build-stamp-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false/);
  assert.match(WORKFLOW, /ONE pending run per group/, 'the workflow names GitHub\'s one-pending-run rule');
  assert.match(WORKFLOW, /A later run covers what an earlier cancelled or\n# failed run missed/);
  assert.match(WORKFLOW, /PROMOTION WAITS FOR THIS RUN/);
  assert.match(WORKFLOW, /A push made with GITHUB_TOKEN does not\n# start other workflows/);
});

test('dev-preview ignores only the two derived files on PRs and dev, and stays strict on promoted branches', () => {
  const step = DEV_PREVIEW.slice(DEV_PREVIEW.indexOf('- name: The rebuild changed nothing committed'));
  const body = step.slice(0, step.indexOf('\n      # #498'));
  assert.match(body, /pull_request:\*\|push:dev\|push:alternative\/dev\|push:alternative\/\*\/dev\|workflow_dispatch:dev\|workflow_dispatch:alternative\/dev\|workflow_dispatch:alternative\/\*\/dev\)/, 'a dispatch on dev takes the relaxed branch too');
  assert.match(body, /grep -Ev '\^\(buildordinal\\\.json\|src\/content\/changelog\\\.generated\\\.js\)\$'/);
  assert.match(body, /\*\)\n {14}test -z "\$\(git status --porcelain\)" ;;/, 'every other ref keeps the strict check');
});

// The base is git's, not only the pure core's: the same rule, run on a real history.
test('landedSince starts after the last [build-stamp] commit, even when the event before is later', () => {
  const r = repoWith(['base', { subject: 'build: stamp 0.7.1.1 [build-stamp]', author: BOT }, 'Merge pull request #7 from a/b', 'Add a thing (#8)']);
  try {
    // A run whose before is the #7 merge (a later point) must still count #7: the
    // stamp is the base, so nothing a cancelled run missed is skipped.
    assert.deepEqual(landedSince(r.shas[2], { cwd: r.dir }).sort(), ['7', '8']);
  } finally { r.cleanup(); }
});

test('landedSince with no stamp counts from the event before, and with neither, HEAD only', () => {
  const r = repoWith(['base', 'Merge pull request #7 from a/b', 'Add a thing (#8)']);
  try {
    assert.deepEqual(landedSince(r.shas[0], { cwd: r.dir }).sort(), ['7', '8']);
    assert.deepEqual(landedSince('0000000000000000000000000000000000000000', { cwd: r.dir }), ['8'], 'an all-zero before is HEAD only');
  } finally { r.cleanup(); }
});

// The stamped tip gets its own dev-preview build. GITHUB_TOKEN starts no push-triggered run,
// so build-stamp dispatches dev-preview itself. A failed dispatch is retried, and a rerun
// whose push already landed (the no-diff branch) re-dispatches for a stamp commit only.
test('build-stamp.yml dispatches dev-preview after a successful push, with retries, and re-dispatches on a rerun of a stamp', () => {
  const perms = WORKFLOW.slice(WORKFLOW.indexOf('\npermissions:'), WORKFLOW.indexOf('\njobs:'));
  assert.match(perms, /\n {2}contents: write\n/);
  assert.match(perms, /\n {2}actions: write\n/, 'the dispatch needs actions: write');
  assert.doesNotMatch(perms, /pull-requests|packages|id-token/, 'no other write scope');
  assert.match(WORKFLOW, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(DEV_PREVIEW, /\n {2}workflow_dispatch:/, 'dev-preview can be dispatched');

  // The dispatch is one function with three tries and 2 and 4 seconds of backoff.
  const fn = WORKFLOW.slice(WORKFLOW.indexOf('dispatch_preview() {'), WORKFLOW.indexOf('delays=(2 4 8)'));
  assert.match(fn, /gh workflow run dev-preview\.yml --repo "\$GITHUB_REPOSITORY" --ref "\$REF_NAME"/);
  assert.match(fn, /for try in 1 2 3; do/);
  assert.match(fn, /sleep \$\(\(2 \*\* try\)\)/, 'backoff is 2 then 4 seconds');
  assert.match(fn, /return 1/, 'a dispatch that fails all three tries fails the job');

  // After a successful push, and only then, it is called and a failure stops the job.
  const push = WORKFLOW.indexOf('if git push -q origin "HEAD:$REF_NAME"; then');
  const exit0 = WORKFLOW.indexOf('exit 0', push);
  const success = WORKFLOW.slice(push, exit0);
  assert.ok(push > 0 && success.includes('if ! dispatch_preview; then exit 1; fi'), 'the dispatch sits in the push-success branch');

  // The no-diff branch: a stamp HEAD re-dispatches; an ordinary no-diff run does not.
  const nodiff = WORKFLOW.slice(WORKFLOW.indexOf('if git diff --cached --quiet; then'), WORKFLOW.indexOf('box="$(node -p'));
  assert.match(nodiff, /node tools\/build-stamp\.mjs --is-stamp-head/);
  assert.match(nodiff, /if \[ "\$stamp_head" -eq 0 \]; then\s+if ! dispatch_preview; then exit 1; fi/, 'only a stamp HEAD dispatches');
  assert.match(nodiff, /elif \[ "\$stamp_head" -ne 1 \]/, 'a harness fault is not read as "not a stamp"');
  assert.ok(nodiff.indexOf('dispatch_preview') < nodiff.lastIndexOf('exit 0'), 'the dispatch comes before the no-diff exit 0');
});

// THE STAMP IS THE BOT'S, EXACTLY. A human squash that mentions the marker is neither a base nor a skip.
test('a human squash that mentions [build-stamp] is not a base, and its pull request is still counted', () => {
  const r = repoWith(['base', 'Explain the [build-stamp] marker (#9)', 'Merge pull request #4 from a/b']);
  try {
    assert.deepEqual(landedSince(r.shas[0], { cwd: r.dir }).sort(), ['4', '9'], 'the human squash is no stamp, and #9 counts');
  } finally { r.cleanup(); }
});

test('a bot commit with a wrong subject is not a base', () => {
  const r = repoWith(['base', { subject: 'build: stamp [build-stamp] by hand', author: BOT }, 'Add a thing (#8)']);
  try {
    assert.deepEqual(landedSince(r.shas[0], { cwd: r.dir }).sort(), ['8'], 'the wrong subject is not a base, so #8 counts from before');
  } finally { r.cleanup(); }
});
