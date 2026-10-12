// tests/check-order-pending.test.mjs — tools/about-changelog.mjs --check-order --pending.
//
// A receipt stamped with its branch's box is still a bullet and a well-formed
// stamp, but its ORDER is not judged until build-stamp re-points it after the
// merge (tools/about-changelog.mjs, PENDING RECEIPTS). These tests drive the real
// CLI against a scratch root, because the exemption is decided in the process,
// from argv and the event environment, and a unit test of the function would not
// see that wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('../tools/about-changelog.mjs', import.meta.url));

// PR #9999 landed on a stale branch: its receipt is stamped ten builds below the
// box, at the top of the newest date group, where #-receipts already name the box.
// Without the exemption that is a build rising within the date. The fixture is the
// repository's own CHANGELOG.md and buildordinal.json with that one receipt added,
// because the grandfathered-rise pins are checked on every run and a made-up file
// would fail them for the wrong reason.
const REAL = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const BOX = JSON.parse(readFileSync(new URL('../buildordinal.json', import.meta.url), 'utf8'));
const STALE = `${BOX.release}.${BOX.ordinal - 10}`;
const receipt = (n, s) => `- **Stale branch** ([#${n}](https://github.com/cehinds/AshenSpire/pull/${n}), \`${s}\`). Probe.\n`;
function withReceipt(line) {
  const i = REAL.indexOf('\n## ');
  const j = REAL.indexOf('\n- ', i) + 1;
  return REAL.slice(0, j) + line + REAL.slice(j);
}
const markdown = (stamp = STALE) => withReceipt(receipt(9999, stamp));

function run(args, { changelog = markdown(), event = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'check-order-pending-'));
  try {
    writeFileSync(join(root, 'CHANGELOG.md'), changelog);
    writeFileSync(join(root, 'buildordinal.json'), JSON.stringify(BOX));
    const env = { ...process.env, GITHUB_EVENT_NAME: '', GITHUB_EVENT_PATH: '', GITHUB_REF: '', GITHUB_EVENT_BEFORE: '' };
    if (event) {
      const path = join(root, 'event.json');
      writeFileSync(path, JSON.stringify(event));
      env.GITHUB_EVENT_NAME = 'pull_request';
      env.GITHUB_EVENT_PATH = path;
    }
    return spawnSync(process.execPath, [TOOL, '--root', root, '--check-order', ...args], { cwd: root, encoding: 'utf8', env, timeout: 60000 });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('without --pending the stale receipt is a rise, as before', () => {
  const r = run([]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /RED — .*build (runs backward|rises within)/);
});

test('--pending N exempts that receipt from the order, and prints a NOTE for it', () => {
  const r = run(['--pending', '9999']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(r.stdout.includes(`NOTE  pending: #9999 (\`${STALE}\`) — build-stamp re-points it after merge`), r.stdout);
  assert.match(r.stdout, /check-order: OK/);
});

test('--pending auto on a pull_request reads the pull request number from the event', () => {
  const r = run(['--pending', 'auto'], { event: { number: 9999, pull_request: { number: 9999 } } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /NOTE  pending: #9999/);
});

test('--pending auto exempts only the event\'s own pull request', () => {
  const r = run(['--pending', 'auto'], { event: { number: 1884, pull_request: { number: 1884 } } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
});

test('a pending receipt with a stamp that is not a build still fails, named as shape-checked', () => {
  const r = run(['--pending', '9999'], { changelog: markdown('dev artifact') });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /a pending receipt is still shape-checked/);
});

test('a bad --pending value is a usage error, exit 2, not a finding', () => {
  const r = run(['--pending', '1234,abc']);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /--pending wants 'auto' or pull request numbers/);
});

test('tests.yml passes --pending auto only on pull_request and dev pushes, and reads the base SHA from env', () => {
  const yml = readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8');
  const step = yml.slice(yml.indexOf('- name: CHANGELOG receipts run newest first'), yml.indexOf('- name: The ordering check still catches'));
  assert.match(step, /EVENT_BEFORE: \$\{\{ github\.event\.before \}\}/);
  assert.doesNotMatch(step.split('run: |')[1] || '', /\$\{\{/, 'the run script interpolates an expression');
  assert.match(step, /pull_request:\*\|push:dev\|push:alternative\/dev\|push:alternative\/\*\/dev\) pending="--pending auto"/);
  assert.match(step, /GITHUB_EVENT_BEFORE="\$EVENT_BEFORE" node tools\/verdict\.mjs -- node tools\/about-changelog\.mjs --check-order \$pending/);
});
