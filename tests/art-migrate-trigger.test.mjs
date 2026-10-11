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
  assert.match(step, /select\(\.head_sha == \$sha and \.conclusion == "success"\)/);
  assert.match(step, /if \[ -z "\$run" \]; then[\s\S]*?continue/);
});
