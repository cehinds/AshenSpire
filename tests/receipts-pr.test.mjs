// The receipts gate on a pull request (tools/receipts.mjs --check --pr). On
// `pull_request` the checkout is GitHub's synthetic merge commit, whose subject
// ("Merge <sha> into <sha>") names no pull request, so the range walk cannot
// see the pull request being judged. The number comes from the event payload
// (GITHUB_EVENT_PATH) or, failing that, from GITHUB_REF `refs/pull/N/merge`,
// and the pull request's OWN number must be named by a receipt before merge.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pullFromEnv, ownReceipt } from '../tools/receipts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = join(ROOT, 'tools', 'receipts.mjs');
const MD = 'x ([#12](https://github.com/o/r/pull/12), `0.5.5.1`)';

test('pullFromEnv reads the number from the pull_request event payload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipts-pr-'));
  try {
    const path = join(dir, 'event.json');
    writeFileSync(path, JSON.stringify({ number: 77, pull_request: { number: 77 } }));
    assert.equal(pullFromEnv({ GITHUB_EVENT_PATH: path }), '77');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pullFromEnv falls back to refs/pull/N/merge, and to null off a pull request', () => {
  assert.equal(pullFromEnv({ GITHUB_REF: 'refs/pull/88/merge' }), '88');
  assert.equal(pullFromEnv({ GITHUB_EVENT_PATH: '/nonexistent/event.json', GITHUB_REF: 'refs/pull/9/merge' }), '9');
  assert.equal(pullFromEnv({ GITHUB_REF: 'refs/heads/dev' }), null);
  assert.equal(pullFromEnv({}), null);
});

test('ownReceipt: named is green, unnamed is red', () => {
  assert.equal(ownReceipt('12', MD), true);
  assert.equal(ownReceipt('13', MD), false);
  // A number that is only a prefix of a receipted one is not receipted.
  assert.equal(ownReceipt('1', MD), false);
});

function cli(args, env) {
  return spawnSync(process.execPath, [TOOL, ...args], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_PATH: '', GITHUB_REF: '', ...env },
  });
}

test('--check --pr: this repository\'s CHANGELOG decides the pull request head', () => {
  const md = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const named = /\/pull\/(\d+)\)/.exec(md)[1];
  const green = cli(['--check', '--pr', named]);
  assert.equal(green.status, 0, green.stdout + green.stderr);
  const red = cli(['--check', '--pr', '999999']);
  assert.equal(red.status, 1, red.stdout + red.stderr);
  assert.match(red.stdout, /#999999/);
});

test('--check --pr auto reads the event payload, and exits 2 when there is none', () => {
  const dir = mkdtempSync(join(tmpdir(), 'receipts-pr-'));
  try {
    const path = join(dir, 'event.json');
    writeFileSync(path, JSON.stringify({ pull_request: { number: 999998 } }));
    const red = cli(['--check', '--pr', 'auto'], { GITHUB_EVENT_PATH: path });
    assert.equal(red.status, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /#999998/);
    const none = cli(['--check', '--pr', 'auto']);
    assert.equal(none.status, 2, none.stdout + none.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
