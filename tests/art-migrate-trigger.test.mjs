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
  assert.ok(assemble.includes(`github.event.workflow_run.conclusion == 'success' || (${prefix})`), 'assemble admits branch previews on any conclusion');
  const deploy = jobBlock(pages, 'deploy');
  assert.ok(deploy.includes(`github.event.workflow_run.conclusion == 'success'\n          || (${prefix})`) || deploy.includes(`github.event.workflow_run.conclusion == 'success'`), 'deploy admits them');
  assert.ok(pages.includes(`(github.event_name == 'workflow_run' && (github.event.workflow_run.conclusion == 'success' || (${prefix})))`), 'the Report step mirrors the deploy guard');
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
