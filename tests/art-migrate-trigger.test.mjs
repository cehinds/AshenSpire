// The art intake's trigger and token gates, read as text from the workflow. A YAML
// parser would drop a duplicate key, and the defect here is exactly which event the
// token-bearing job may run on, so the file is read as written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const art = readFileSync(join(ROOT, '.github/workflows/art-migrate.yml'), 'utf8');
const pages = readFileSync(join(ROOT, '.github/workflows/pages-builds.yml'), 'utf8');

// The text of one top-level job (its block runs from `  <name>:` to the next job key).
function jobBlock(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === `  ${name}:`);
  assert.ok(start >= 0, `job ${name} exists`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^  [a-z][a-z-]*:\s*$/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

test('the art intake runs on pull_request_target, never on pull_request', () => {
  const on = art.slice(art.indexOf('\non:'), art.indexOf('\npermissions:'));
  assert.match(on, /^  pull_request_target:\n    branches: \[dev\]\n    types: \[opened, synchronize, reopened, closed\]$/m);
  assert.doesNotMatch(on, /^  pull_request:/m, 'no plain pull_request trigger may remain');
});

test('the token-using jobs fire only on pull_request_target', () => {
  for (const job of ['intake', 'close-intake']) {
    const block = jobBlock(art, job);
    assert.match(block, /if: github\.event_name == 'pull_request_target'/, `${job} is gated on pull_request_target`);
    assert.doesNotMatch(block, /event_name == 'pull_request'(?!_)/, `${job} names no plain pull_request event`);
  }
});

test('the pin bump never runs for a pull request event', () => {
  const block = jobBlock(art, 'pin-bump');
  const ifLine = block.split('\n').find((l) => l.trimStart().startsWith('if:'));
  assert.doesNotMatch(ifLine, /pull_request/, 'pin-bump if names no pull_request event');
  assert.match(block, /if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch' \|\| github\.event_name == 'repository_dispatch'/);
});

test('a fork run names no art token: the secret is gated on a same-repository head', () => {
  const block = jobBlock(art, 'intake');
  const gate = block.slice(block.indexOf('- name: Decide whether to migrate'), block.indexOf('- name: Check out the art repository'));
  assert.match(gate, /HAS_ART_TOKEN: \$\{\{ github\.event\.pull_request\.head\.repo\.full_name == github\.repository && secrets\.ART_REPO_WRITE_TOKEN != '' \}\}/);
});

test('removing the art (state none) never closes the intake: it must stay open to be merged', () => {
  const block = jobBlock(art, 'intake');
  assert.doesNotMatch(block, /gh pr close/, 'the intake job closes nothing');
  assert.match(jobBlock(art, 'close-intake'), /gh pr close/, 'only close-intake (source PR closed unmerged) closes it');
});

test('pages: a failed or cancelled feature, fix or chore preview still runs assemble and deploy', () => {
  const prefix = "startsWith(github.event.workflow_run.head_branch, 'feature/') || startsWith(github.event.workflow_run.head_branch, 'fix/') || startsWith(github.event.workflow_run.head_branch, 'chore/')";
  const assemble = jobBlock(pages, 'assemble');
  assert.ok(assemble.includes(`(github.event.workflow_run.name == 'dev preview' && github.event.workflow_run.head_branch != 'dev' && (github.event.workflow_run.conclusion == 'success' || ${prefix}))`), 'assemble admits branch previews on any conclusion');
  const deploy = jobBlock(pages, 'deploy');
  assert.ok(deploy.includes(`github.event.workflow_run.conclusion == 'success'\n              || startsWith(github.event.workflow_run.head_branch, 'feature/')`), 'deploy admits them');
  assert.ok(pages.includes(`(github.event.workflow_run.name == 'dev preview' && github.event.workflow_run.head_branch != 'dev' && (github.event.workflow_run.conclusion == 'success' || ${prefix}))`), 'the Report step mirrors the deploy guard');
  // alternative/ previews keep the success-only rule: the workflow_run filter lists them, the guard does not admit them.
  assert.doesNotMatch(prefix, /alternative/);
});

test('pages: the current-head check still drops a preview with no successful run for its head', () => {
  const step = pages.slice(pages.indexOf('- name: Fetch each open pull request'), pages.indexOf('- name: Assemble the site'));
  assert.match(step, /select\(\.head_sha == \$sha\)\]\[0\] \| select\(\.conclusion == "success"\)/);
  assert.match(step, /if \[ -z "\$run" \]; then[\s\S]*?continue/);
});

test('pages: the preview fetch selects only live artifacts and never fails the run for a missing or expired one', () => {
  const step = pages.slice(pages.indexOf('- name: Fetch each open pull request'), pages.indexOf('- name: Assemble the site'));
  assert.match(step, /select\(\.expired == false\)/, 'the artifact filter keeps only non-expired artifacts');
  assert.doesNotMatch(step, /exit 1/, 'no step path exits the run on a missing or failed preview artifact');
  assert.doesNotMatch(step, /Preview artifact missing/, 'a missing artifact is a warning, not an error');
  assert.match(step, /preview artifact expired; push to rebuild/, 'an expired artifact is named with its PR and the rebuild hint');
  assert.match(step, /if \[ -z "\$name" \]; then[\s\S]*?continue/, 'a missing artifact skips that PR');
});

test('art intake: the stage step builds on the existing intake branch when it is present', () => {
  const block = jobBlock(art, 'intake');
  const stage = block.slice(block.indexOf('- name: Stage the files'), block.indexOf('- name: Push the intake branch'));
  assert.match(stage, /git rev-parse --verify -q "refs\/remotes\/origin\/\$branch"/, 'stage checks for the fetched intake branch');
  assert.match(stage, /git checkout -B "\$branch" "origin\/\$branch"/, 'stage checks out the existing intake branch when present');
  assert.match(stage, /else\s*\n\s*git checkout -B "\$branch"\n/, 'only a missing branch starts from main');
  assert.doesNotMatch(stage, /ART_REPO_WRITE_TOKEN/, 'the stage step holds no token');
  const fetch = block.slice(block.indexOf('- name: Fetch the existing intake branch'), block.indexOf('- name: Stage the files'));
  assert.match(fetch, /ART_REPO_WRITE_TOKEN: \$\{\{ secrets\.ART_REPO_WRITE_TOKEN \}\}/, 'the fetch step is the token-bearing one');
  assert.match(fetch, /git fetch -q origin "\+refs\/heads\/\$BRANCH:refs\/remotes\/origin\/\$BRANCH"/);
});

test('art intake: the push is a plain fast-forward, never a force', () => {
  const intake = jobBlock(art, 'intake');
  const block = intake.slice(intake.indexOf('- name: Push the intake branch'), intake.indexOf('- name: Open or update the pull request'));
  assert.doesNotMatch(block, /--force/, 'no force push of the intake branch');
  assert.match(block, /git push origin "HEAD:refs\/heads\/\$BRANCH"/);
});

test('intake runs are never cancelled mid-run', () => {
  const block = jobBlock(art, 'intake');
  assert.match(block, /group: art-intake-pr-\$\{\{ github\.event\.pull_request\.number \}\}\n\s+cancel-in-progress: false/);
});

test('pages: a malformed artifact is skipped before it can become a comment target', () => {
  const step = pages.slice(pages.indexOf('- name: Fetch each open pull request'), pages.indexOf('- name: Assemble the site'));
  const check = step.indexOf("-name '*.html' | wc -l");
  assert.ok(check > 0 && check < step.indexOf('>> "$entries"'), 'the one-html check precedes the manifest entry');
});

test('the art PR body lists every file on the intake branch, not only this run\'s', () => {
  const block = jobBlock(art, 'intake');
  assert.match(block, /git -C "\$GITHUB_WORKSPACE\/art-repo" diff --name-only origin\/main HEAD/);
});

test('no list in art-migrate is cut by an early-closing pipe (SIGPIPE under pipefail)', () => {
  assert.doesNotMatch(art, /\|\s*head\b/);
});

test('removal is requested only once the art PR exists', () => {
  const block = jobBlock(art, 'intake');
  const sticky = block.slice(block.indexOf('- name: Sticky comment'), block.indexOf('- name: Fail while'));
  assert.match(sticky, /if \[ -n "\$ART_PR_URL" \]; then[\s\S]*?remove these files[\s\S]*?else[\s\S]*?Keep the files/);
});

test('pages: the newest run for the head SHA must itself be the success', () => {
  assert.ok(pages.includes(`[.workflow_runs[] | select(.head_sha == $sha)][0] | select(.conclusion == "success")`));
});

test('pages: branch previews match feature, fix and chore prefixes in any case (Chore/X too)', () => {
  const wf = readFileSync(new URL('../.github/workflows/pages-builds.yml', import.meta.url), 'utf8');
  const filters = wf.match(/test\("\^\(feature\|fix\|chore\)\/"[^)]*\)/g) || [];
  assert.ok(filters.length >= 3, `expected the three PR-branch filters, found ${filters.length}`);
  for (const f of filters) assert.match(f, /; "i"\)$/, `case-sensitive branch filter: ${f}`);
});

test('pages: the dev-preview workflow_run trigger admits feature/, fix/, chore/ branches in any case (branch filters are case-sensitive)', () => {
  const wf = readFileSync(new URL('../.github/workflows/pages-builds.yml', import.meta.url), 'utf8');
  const line = wf.match(/workflow_run:[\s\S]*?branches: \[(.*)\]\s*$/m)?.[1] ?? '';
  const globs = [...line.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(g => !g.startsWith('alternative/'));
  // GitHub filter globs: [..] is a one-character class, ** matches the rest.
  const re = g => new RegExp('^' + g.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
  for (const branch of ['feature/a', 'Feature/a', 'FEATURE/a', 'fEature/a', 'fix/a', 'FIX/a', 'chore/a', 'Chore/FixCombatUi2', 'CHORE/a'])
    assert.ok(globs.some(g => re(g).test(branch)), `trigger would skip ${branch}`);
  // dev is listed for the build-stamp run only; no preview prefix may match the bare dev branch.
  assert.ok(globs.includes('dev'), 'dev is listed for the build-stamp completion');
  assert.ok(!globs.some(g => g !== 'dev' && re(g).test('dev')), 'no preview prefix may match dev');
});

// pages-builds publishes dev from the build-stamp run that follows the push, never from the push
// itself. The guards are GitHub expressions, so each one is evaluated against the events it must
// admit and refuse, not only matched as text. The translation covers the operators these guards use.
const stampFile = readFileSync(join(ROOT, '.github/workflows/build-stamp.yml'), 'utf8');

// The text of a job's `if:` (a single line, or a folded `>-` block whose lines are indented deeper).
function jobIf(job) {
  const lines = jobBlock(pages, job).split('\n');
  const i = lines.findIndex((l) => l.startsWith('    if: '));
  assert.ok(i >= 0, `job ${job} has an if`);
  const first = lines[i].slice('    if: '.length);
  if (first !== '>-') return first;
  const body = [];
  for (let j = i + 1; j < lines.length && lines[j].startsWith('      '); j += 1) body.push(lines[j].trim());
  return body.join(' ');
}

// The `${{ }}` expression of an env var in the assemble job's steps (PUBLISH_REQUESTED, ART_REPO_TOKEN).
function stepEnv(name) {
  const m = jobBlock(pages, 'assemble').match(new RegExp(`^ +${name}: \\$\\{\\{ (.*) \\}\\}$`, 'm'));
  assert.ok(m, `env ${name} exists`);
  return m[1];
}

function evalGh(expr, ctx) {
  const js = expr
    .replace(/github\.event\.workflow_run\.(\w+)/g, 'ctx.wr.$1')
    .replace(/github\.event_name/g, 'ctx.event')
    .replace(/github\.ref_name/g, 'ctx.refName')
    .replace(/github\.ref\b/g, 'ctx.ref')
    .replace(/github\.(triggering_)?actor/g, 'ctx.actor')
    .replace(/github\.repository_owner/g, 'ctx.owner')
    .replace(/inputs\.publish/g, 'ctx.publish')
    .replace(/startsWith\(/g, 'startsWith(')
    .replace(/!=/g, '\u0001').replace(/==/g, '===').replace(/\u0001/g, '!==');
  const startsWith = (a, b) => String(a ?? '').startsWith(b);
  const full = { event: 'push', ref: 'refs/heads/main', refName: 'main', actor: 'owner', owner: 'owner', publish: '', wr: {}, ...ctx };
  return new Function('ctx', 'startsWith', `return (${js});`)(full, startsWith);
}

const CASES = [
  // [name, context, assemble, deploy, PUBLISH_REQUESTED]
  ['build-stamp on dev succeeds: dev publishes', { event: 'workflow_run', wr: { name: 'build-stamp', head_branch: 'dev', conclusion: 'success' } }, true, true, true],
  ['build-stamp on dev fails: nothing publishes', { event: 'workflow_run', wr: { name: 'build-stamp', head_branch: 'dev', conclusion: 'failure' } }, false, false, false],
  ['build-stamp on dev is cancelled: nothing publishes', { event: 'workflow_run', wr: { name: 'build-stamp', head_branch: 'dev', conclusion: 'cancelled' } }, false, false, false],
  ['dev preview on dev succeeds: skipped, it must not rebuild an unstamped head', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'dev', conclusion: 'success' } }, false, false, false],
  ['dev preview on dev fails: skipped', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'dev', conclusion: 'failure' } }, false, false, false],
  ['dev preview on feature/x succeeds: unchanged', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'feature/x', conclusion: 'success' } }, true, true, true],
  ['dev preview on fix/x fails: unchanged (stale build dropped later)', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'fix/x', conclusion: 'failure' } }, true, true, true],
  ['dev preview on chore/x fails: unchanged', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'chore/x', conclusion: 'failure' } }, true, true, true],
  ['dev preview on alternative/a/dev fails: success-only, unchanged', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'alternative/a/dev', conclusion: 'failure' } }, false, false, false],
  ['dev preview on alternative/a/dev succeeds: unchanged', { event: 'workflow_run', wr: { name: 'dev preview', head_branch: 'alternative/a/dev', conclusion: 'success' } }, true, true, true],
  ['pull_request_target closed: unchanged', { event: 'pull_request_target', ref: 'refs/heads/dev', refName: 'dev' }, true, true, true],
  ['push to release publishes: unchanged', { event: 'push', ref: 'refs/heads/release', refName: 'release' }, true, true, true],
  ['push to test assembles, never deploys: unchanged', { event: 'push', ref: 'refs/heads/test', refName: 'test' }, true, false, false],
];

test('pages: pages-builds has no push trigger on dev; dev publishes only after build-stamp', () => {
  const on = pages.slice(pages.indexOf('\non:'), pages.indexOf('\nconcurrency:'));
  const push = on.match(/^  push:\n(?:    .*\n)*?    branches: \[(.*)\]/m);
  assert.ok(push, 'the push trigger lists its branches');
  const pushBranches = push[1].split(',').map((b) => b.trim());
  assert.deepEqual(pushBranches, ['test', 'release', 'main'], 'push branches are test, release and main');
  assert.ok(!pushBranches.includes('dev'), 'no push trigger names dev');
});

test('pages: pages-builds runs on build-stamp completing on dev, with the workflow name build-stamp.yml declares', () => {
  const name = stampFile.match(/^name: (.+)$/m)?.[1]?.trim();
  assert.equal(name, 'build-stamp');
  const on = pages.slice(pages.indexOf('\non:'), pages.indexOf('\nconcurrency:'));
  const wr = on.slice(on.indexOf('  workflow_run:'));
  assert.match(wr, /^    workflows: \[build-stamp, dev preview\]$/m, 'workflow_run names build-stamp and dev preview');
  assert.match(wr, /^    branches: \['dev', /m, 'the workflow_run branch list admits dev');
  assert.match(wr, /^    types: \[completed\]$/m);
});

test('pages: each guard admits the build-stamp completion on dev only on success, and skips a dev-preview completion on dev', () => {
  for (const job of ['assemble', 'deploy']) {
    const expr = jobIf(job);
    assert.match(expr, /github\.event\.workflow_run\.name == 'build-stamp'/, `${job} names build-stamp`);
    assert.match(expr, /github\.event\.workflow_run\.head_branch == 'dev'/, `${job} requires head_branch dev for build-stamp`);
    assert.match(expr, /github\.event\.workflow_run\.name == 'dev preview'\s*&&\s*github\.event\.workflow_run\.head_branch != 'dev'/, `${job} excludes dev preview on dev`);
  }
  for (const [name, ctx, assemble, deploy, publish] of CASES) {
    if (ctx.event === 'push' || ctx.event === 'pull_request_target') continue;
    assert.equal(evalGh(jobIf('assemble'), ctx), assemble, `assemble: ${name}`);
    assert.equal(evalGh(jobIf('deploy'), ctx), deploy, `deploy: ${name}`);
    assert.equal(evalGh(stepEnv('PUBLISH_REQUESTED'), ctx), publish, `PUBLISH_REQUESTED: ${name}`);
  }
});

test('pages: the push and dispatch paths of the deploy guard are unchanged', () => {
  for (const [name, ctx, , deploy] of CASES) {
    if (ctx.event !== 'push' && ctx.event !== 'pull_request_target') continue;
    assert.equal(evalGh(jobIf('deploy'), ctx), deploy, `deploy: ${name}`);
  }
  assert.equal(evalGh(jobIf('deploy'), { event: 'workflow_dispatch', publish: 'PUBLISH', actor: 'owner', owner: 'owner', triggeringActor: 'owner' }), true, 'the owner dispatch deploys');
});

test('pages: a workflow_run whose jobs skip gets its own concurrency group, so it cannot supersede a pending publication', () => {
  const group = pages.match(/^  group: (\$\{\{ .* \}\})$/m)?.[1];
  assert.ok(group, 'the concurrency group is an expression');
  const expr = group.slice(3, -3);
  const groupFor = ctx => evalGh(expr, ctx);
  const run = (name, head_branch, conclusion) => ({ event: 'workflow_run', wr: { name, head_branch, conclusion } });
  // Runs the publication: the same clause the jobs' `if:` use.
  assert.equal(groupFor(run('build-stamp', 'dev', 'success')), 'pages-builds');
  assert.equal(groupFor(run('dev preview', 'feature/x', 'success')), 'pages-builds');
  assert.equal(groupFor(run('dev preview', 'feature/x', 'failure')), 'pages-builds');
  assert.equal(groupFor(run('dev preview', 'alternative/a/dev', 'success')), 'pages-builds');
  // Every job skips these, so they must not share the publication group.
  assert.equal(groupFor(run('build-stamp', 'dev', 'failure')), 'pages-builds-skipped');
  assert.equal(groupFor(run('build-stamp', 'dev', 'cancelled')), 'pages-builds-skipped');
  assert.equal(groupFor(run('build-stamp', 'alternative/a/dev', 'success')), 'pages-builds-skipped');
  assert.equal(groupFor(run('dev preview', 'dev', 'success')), 'pages-builds-skipped');
  assert.equal(groupFor(run('dev preview', 'alternative/a/dev', 'failure')), 'pages-builds-skipped');
  // Non-workflow_run events keep the publication group.
  assert.equal(groupFor({ event: 'push', ref: 'refs/heads/release', refName: 'release' }), 'pages-builds');
  assert.equal(groupFor({ event: 'pull_request_target' }), 'pages-builds');
});

test('pages: the art token is gated on a protected ref AND, for a workflow_run, on a same-repository head', () => {
  // A workflow_run run takes github.ref from the default branch, so the protected-ref
  // gate alone admits a run a fork pull request started. The head-repository clause
  // must be ANDed in front of the unchanged protected-ref gate.
  const token = stepEnv('ART_REPO_TOKEN');
  assert.ok(token.includes('github.ref'), 'the token is gated on github.ref');
  assert.match(token, /github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.head_repository\.full_name == github\.repository\) && contains\(/, 'a workflow_run must come from this repository');
  assert.ok(token.endsWith("contains(fromJSON('[\"refs/heads/dev\",\"refs/heads/test\",\"refs/heads/release\",\"refs/heads/main\"]'), github.ref) && secrets.ART_REPO_TOKEN || ''"), 'the protected-ref gate text is unchanged');
});

test('pages: the checkout of a workflow_run run is dev, so it builds the stamped commit', () => {
  assert.match(pages, /ref: \$\{\{ \(github\.event_name == 'workflow_run' \|\| github\.event_name == 'pull_request_target'\) && 'dev' \|\| github\.ref \}\}/);
});
