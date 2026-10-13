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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BOT_AUTHOR as BOT, WORKFLOW_PATH, converge, isNullSha, landedAfterBase, landedInSubjects, landedSince, parseRange, pickStampBase, restamp } from '../tools/build-stamp.mjs';

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

// A re-pointed receipt keeps its date group newest build first. #1902 sat at the
// bottom of 2026-10-12 with a stale stamp; re-pointing it to 0.7.1.1429 must lift it
// above the older builds (#1900 at 1427, #1897 at 1425) and never past the heading.
const ABOUT = fileURLToPath(new URL('../tools/about-changelog.mjs', import.meta.url));
const receipt = (n, s) => `${link(n, s)}. Nothing changes in the game.`;
const ORDER_BOX = { release: '0.7.1', ordinal: 1429 };
// The checker pins the old within-date rises of the real history, so a fixture is
// checked on top of the real file's 2026-10-11 group and older, as the selftest does.
// Its builds stay below 1425, so the fixture's own group is the only one under test.
const REAL = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const HISTORY = REAL.slice(REAL.indexOf('## 2026-10-11'));
const FIXTURE_HEAD = ['# Changelog', '', '## 2026-10-12', ''];
// The receipts of the fixture's own date group, in file order (history excluded).
const groupPrs = (text) => [...text.slice(0, text.indexOf('## 2026-10-11')).matchAll(/^- .*\/pull\/(\d+)\)/gm)].map((m) => m[1]);
const checkOrderOf = (markdown, box) => {
  const dir = mkdtempSync(join(tmpdir(), 'build-stamp-order-'));
  try {
    writeFileSync(join(dir, 'CHANGELOG.md'), markdown);
    writeFileSync(join(dir, 'buildordinal.json'), JSON.stringify(box));
    const r = spawnSync(process.execPath, [ABOUT, '--root', dir, '--check-order'], { encoding: 'utf8' });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('restamp moves a re-pointed receipt to the top of its date group, and the strict order check passes', () => {
  const md = [...FIXTURE_HEAD, receipt(1900, '0.7.1.1427'), receipt(1897, '0.7.1.1425'), receipt(1902, '0.7.1.1400'), '', HISTORY].join('\n');
  const r = restamp(md, ['1902'], ORDER_BOX);
  assert.deepEqual(r.changed, [{ pr: '1902', from: '0.7.1.1400', to: '0.7.1.1429' }]);
  assert.deepEqual(groupPrs(r.text), ['1902', '1900', '1897'], 'the receipt moved above #1900, inside its own date');
  assert.deepEqual(r.text.split('\n').filter((l) => /^## /.test(l)), md.split('\n').filter((l) => /^## /.test(l)), 'no heading moved');
  const checked = checkOrderOf(r.text, ORDER_BOX);
  assert.equal(checked.status, 0, checked.out);
});

test('restamp leaves the order of a date group alone when the re-pointed receipt is already in place', () => {
  const md = [...FIXTURE_HEAD, receipt(1900, '0.7.1.1429'), receipt(1902, '0.7.1.1400'), receipt(1897, '0.7.1.1425'), '', HISTORY].join('\n');
  const r = restamp(md, ['1902'], ORDER_BOX);
  assert.equal(r.text, md.replace(receipt(1902, '0.7.1.1400'), receipt(1902, '0.7.1.1429')), 'only the stamp changes; no line moves');
  assert.deepEqual(groupPrs(r.text), ['1900', '1902', '1897']);
  assert.equal(checkOrderOf(r.text, ORDER_BOX).status, 0);
});

test('restamp moves a receipt that already carries the box up within its date group when it sits below a lower build', () => {
  // #1902 was stamped with the box by an earlier pass, but it landed under #1900 (1427): the
  // group is out of order before restamp runs. The receipt must move up even though its stamp
  // does not change.
  const md = [...FIXTURE_HEAD, receipt(1900, '0.7.1.1427'), receipt(1902, '0.7.1.1429'), receipt(1897, '0.7.1.1425'), '', HISTORY].join('\n');
  assert.notEqual(checkOrderOf(md, ORDER_BOX).status, 0, 'the fixture is out of order before restamp');
  const r = restamp(md, ['1902'], ORDER_BOX);
  assert.deepEqual(r.current, ['1902'], 'the stamp was already the box');
  assert.deepEqual(r.changed, []);
  assert.deepEqual(groupPrs(r.text), ['1902', '1900', '1897'], 'the receipt moved above #1900, inside its own date');
  assert.equal(checkOrderOf(r.text, ORDER_BOX).status, 0, checkOrderOf(r.text, ORDER_BOX).out);
});

test('restamp moves a landed receipt from an older date into the newest date group', () => {
  const md = [
    '# Changelog', '',
    '## 2026-10-13', '', receipt(1930, '0.7.1.1463'), '',
    '## 2026-10-12', '', receipt(1932, '0.7.1.1459'), receipt(1896, '0.7.1.1459'), '',
    HISTORY,
  ].join('\n');
  const r = restamp(md, ['1932'], { release: '0.7.1', ordinal: 1465 });
  const beforeYesterday = r.text.slice(0, r.text.indexOf('## 2026-10-12'));
  assert.deepEqual([...beforeYesterday.matchAll(/\/pull\/(\d+)\)/g)].map((m) => m[1]), ['1932', '1930']);
  assert.equal(r.text.match(/\/pull\/1932\)/g)?.length, 1, 'the moved receipt is not duplicated');
  assert.match(r.text.slice(r.text.indexOf('## 2026-10-12')), /\/pull\/1896\)/);
  assert.doesNotMatch(r.text.slice(r.text.indexOf('## 2026-10-12')), /\/pull\/1932\)/);
  assert.equal(checkOrderOf(r.text, { release: '0.7.1', ordinal: 1465 }).status, 0);
});

test('converge writes a reorder-only repair before the first write, and the result passes the order rule', () => {
  // Every landed receipt already names the committed box, so no stamp changes; only the
  // line moves. converge must count that as a change, write the text, and converge.
  const text0 = [...FIXTURE_HEAD, receipt(1900, '0.7.1.1427'), receipt(1902, '0.7.1.1429'), ''].join('\n');
  const state = { text: text0, writes: 0, about: 0 };
  const io = {
    build: () => ({ box: ORDER_BOX, bytes: '0.7.1.1429' }),
    readBox: () => ORDER_BOX,
    readChangelog: () => state.text,
    writeChangelog(t) { state.text = t; state.writes += 1; },
    // The real write refuses a receipt that cites a newer build than the group above it.
    about() {
      state.about += 1;
      const stamps = [...state.text.matchAll(/\/pull\/\d+\), `0\.7\.1\.(\d+)`/g)].map((m) => Number(m[1]));
      for (let i = 1; i < stamps.length; i += 1) {
        if (stamps[i] > stamps[i - 1]) throw new Error('build runs backward: a receipt cites a newer build than the group above it');
      }
      return false;
    },
    verify: () => null,
  };
  const r = converge(io, ['1902'], { maxRounds: 3 });
  assert.equal(r.status, 'converged', JSON.stringify(r));
  assert.equal(state.writes, 1, 'the reordered text was written');
  const whole = [state.text.trimEnd(), '', HISTORY].join('\n');
  assert.deepEqual(groupPrs(whole), ['1902', '1900']);
  assert.equal(checkOrderOf(whole, ORDER_BOX).status, 0, checkOrderOf(whole, ORDER_BOX).out);
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
  assert.match(WORKFLOW, /node tools\/build-stamp\.mjs --stamp --since-last-stamp/);
  assert.doesNotMatch(WORKFLOW, /github\.event\.before|GITHUB_EVENT_BEFORE/, 'the base is the stamp base, never the event before');
});

test('build-stamp.yml refuses unordered restamped receipts before staging or dispatch', () => {
  const guard = WORKFLOW.indexOf('node tools/about-changelog.mjs --check-order');
  assert.ok(guard > WORKFLOW.indexOf('build-stamp.mjs --stamp --since-last-stamp'));
  assert.ok(guard > WORKFLOW.indexOf('build-stamp.mjs --stamp --prs'));
  assert.ok(guard < WORKFLOW.indexOf('git add --'));
  const command = WORKFLOW.slice(guard).split('\n')[0];
  assert.equal(command, 'node tools/about-changelog.mjs --check-order', 'strict guard, without pending exemptions or ignored failures');
});

test('the strict guard catches a same-date rise when a lower receipt\'s stamp is raised in place', () => {
  const dir = mkdtempSync(join(tmpdir(), 'build-stamp-order-'));
  try {
    const box = JSON.parse(readFileSync(join(ROOT, 'buildordinal.json'), 'utf8'));
    const actual = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
    // Reproduce #1897's failure class in the newest date group: a receipt below
    // an older build is raised to the current box while its line stays fixed.
    // restamp() now moves a re-pointed receipt to the top of its date group,
    // so the out-of-order fixture is built here by editing that one stamp in place.
    const lines = actual.split('\n');
    const at = lines.findIndex((l) => l.includes('[#1934]'));
    assert.ok(at >= 0, 'the #1934 receipt is in CHANGELOG.md');
    lines[at] = lines[at].replace(/0\.7\.1\.\d+/, `0.7.1.${box.ordinal}`);
    const text = lines.join('\n');
    assert.notEqual(text, actual, 'the #1901 stamp was raised');
    assert.equal(text.split('\n').filter((l, i) => l !== actual.split('\n')[i]).length, 1, 'exactly one line changed');
    writeFileSync(join(dir, 'CHANGELOG.md'), text);
    writeFileSync(join(dir, 'buildordinal.json'), JSON.stringify(box));
    const r = spawnSync(process.execPath, [join(ROOT, 'tools/about-changelog.mjs'), '--root', dir, '--check-order'], {encoding:'utf8', timeout:60000});
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout + r.stderr, /RED — .*build rises within/);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test('build-stamp.yml adds exactly the three derived files, never the built HTML or everything', () => {
  assert.match(WORKFLOW, /git add -- buildordinal\.json CHANGELOG\.md src\/content\/changelog\.generated\.js/);
  assert.doesNotMatch(WORKFLOW, /git add (-A|\.|--all)\b/);
  assert.doesNotMatch(WORKFLOW, /\.html/, 'the built HTML is never named by this workflow');
});

test('build-stamp.yml keeps its inputs out of script text', () => {
  const blocks = runBlocks(WORKFLOW);
  assert.ok(blocks.length >= 1, 'the workflow has run blocks');
  for (const body of blocks) assert.doesNotMatch(body, /\$\{\{/, 'a run block interpolates an expression');
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

// THE LANDING BASE, on real histories shaped like the rollout: an older merge, the merge that
// INTRODUCED the stamp workflow (#1895), then whatever lands after it.
function repoWithPipeline(entries) {
  const dir = mkdtempSync(join(tmpdir(), 'build-stamp-intro-'));
  const run = (author, ...args) => execFileSync('git', args, {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: author, GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: author, GIT_COMMITTER_EMAIL: 't@example.invalid' },
  }).trim();
  const git = (...args) => run('dev', ...args);
  git('init', '-q', '-b', 'main');
  git('commit', '-q', '--allow-empty', '-m', 'Merge pull request #1800 from x/y');
  git('checkout', '-q', '-b', 'feat');
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(dir, WORKFLOW_PATH), 'name: build-stamp\n');
  git('add', '.github');
  git('commit', '-q', '-m', 'workflow: add build-stamp');
  git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', 'feat', '-m', 'Merge pull request #1895 from a/b');
  for (const e of entries) {
    const { subject, author = 'dev' } = typeof e === 'string' ? { subject: e } : e;
    run(author, 'commit', '-q', '--allow-empty', '-m', subject);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('the base is the introduction: the introducing merge counts, the merges before it do not', () => {
  // The run that should have stamped these failed or was replaced: nothing marks them.
  const r = repoWithPipeline(['Merge pull request #1900 from c/d', 'Add a thing (#1901)']);
  try {
    assert.deepEqual(landedSince({ cwd: r.dir }).sort(), ['1895', '1900', '1901']);
  } finally { r.cleanup(); }
});

test('a stamp commit after the introduction moves the base to the stamp', () => {
  const r = repoWithPipeline(['Merge pull request #1900 from c/d', { subject: 'build: stamp 0.7.1.1 [build-stamp]', author: BOT }, 'Merge pull request #1902 from e/f']);
  try {
    assert.deepEqual(landedSince({ cwd: r.dir }).sort(), ['1902']);
  } finally { r.cleanup(); }
});

test('a repository with no stamp workflow and no stamp counts HEAD only', () => {
  const r = repoWith(['Merge pull request #1800 from x/y', 'Add a thing (#8)']);
  try {
    assert.deepEqual(landedSince({ cwd: r.dir }), ['8']);
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
  const r = repoWithPipeline(['Explain the [build-stamp] marker (#1910)']);
  try {
    assert.deepEqual(landedSince({ cwd: r.dir }).sort(), ['1895', '1910']);
  } finally { r.cleanup(); }
});

test('a bot commit with a wrong subject is not a base', () => {
  const r = repoWithPipeline([{ subject: 'build: stamp [build-stamp] by hand', author: BOT }, 'Add a thing (#8)']);
  try {
    assert.deepEqual(landedSince({ cwd: r.dir }).sort(), ['1895', '8']);
  } finally { r.cleanup(); }
});

// The REAL write, not a fake. about-changelog --write refuses a stale landed receipt that sits
// above an older, newer-built group; once that receipt is re-pointed to the committed box, the
// same write goes through. This is why converge() re-points before its first about().
test('the real about-changelog --write refuses a stale landed receipt across a newer group, and accepts it re-pointed', () => {
  const ABOUT = fileURLToPath(new URL('../tools/about-changelog.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'build-stamp-write-'));
  try {
    const box = { release: '0.5.5', ordinal: 5 };
    const bt = '\x60';
    const stale = `# Changelog\n\n## 2026-10-12\n\n- **Today** ([#12](https://github.com/cehinds/AshenSpire/pull/12), ${bt}0.5.5.1${bt}).\n\n## 2026-10-11\n\n- **Yesterday** ([#13](https://github.com/cehinds/AshenSpire/pull/13), ${bt}0.5.5.5${bt}).\n`;
    writeFileSync(join(dir, 'CHANGELOG.md'), stale);
    writeFileSync(join(dir, 'buildordinal.json'), JSON.stringify(box));
    mkdirSync(join(dir, 'src', 'content'), { recursive: true });
    const write = () => spawnSync(process.execPath, [ABOUT, '--root', dir, '--write'], { encoding: 'utf8' });

    const refused = write();
    assert.notEqual(refused.status, 0, 'the stale text is refused by the real write');
    assert.match(refused.stderr + refused.stdout, /build runs backward/);

    writeFileSync(join(dir, 'CHANGELOG.md'), restamp(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), ['12'], box).text);
    const accepted = write();
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
