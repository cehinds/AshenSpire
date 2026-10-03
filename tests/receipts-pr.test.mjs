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
import { pullFromEnv, ownReceipt, receiptStamp, stampMismatch } from '../tools/receipts.mjs';

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

// #1315 merged with a receipt stamped 0.7.1.518 while its merge shipped box 519.
test('stampMismatch: the pull request\'s own receipt must carry the committed box', () => {
  const box = { release: '0.5.5', ordinal: 1 };
  assert.equal(receiptStamp('12', MD), '0.5.5.1');
  assert.equal(stampMismatch('12', MD, box), null);
  assert.match(stampMismatch('12', MD, { release: '0.5.5', ordinal: 2 }), /BELOW/);
  assert.match(stampMismatch('12', MD, { release: '0.5.5', ordinal: 0 }), /ABOVE/);
  assert.match(stampMismatch('12', MD, { release: '0.5.6', ordinal: 1 }), /release 0\.5\.5/);
  assert.match(stampMismatch('12', MD.replace(', `0.5.5.1`', ''), box), /no `<release>\.<ordinal>` stamp/);
  // A prefix of the pull request number is not its receipt.
  assert.equal(receiptStamp('1', MD), null);
});

// Codex review on #1356: the gate must agree with about-changelog's reading.
test('stampMismatch: leading-zero spellings are the same build; padded stamps are prose', () => {
  const box = { release: '0.5.5', ordinal: 1 };
  assert.equal(stampMismatch('12', MD.replace('`0.5.5.1`', '`00.5.5.1`'), box), null);
  assert.equal(stampMismatch('12', MD.replace('`0.5.5.1`', '`0.5.5.0001`'), box), null);
  assert.match(stampMismatch('12', MD.replace('`0.5.5.1`', '`00.5.5.2`'), box), /ABOVE/);
  assert.match(stampMismatch('12', MD.replace('`0.5.5.1`', '`0.5.05.0`'), box), /BELOW/);
  assert.equal(receiptStamp('12', MD.replace('`0.5.5.1`', '` 0.5.5.1 `')), ' 0.5.5.1 ');
  assert.match(stampMismatch('12', MD.replace('`0.5.5.1`', '` 0.5.5.1 `'), box), /not a build/);
  assert.match(stampMismatch('12', MD.replace('`0.5.5.1`', '`0.5.5.1 `'), box), /not a build/);
});

function cli(args, env) {
  return spawnSync(process.execPath, [TOOL, ...args], {
    cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_PATH: '', GITHUB_REF: '', ...env },
  });
}

test('--check --pr: this repository\'s CHANGELOG decides the pull request head', () => {
  const md = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const box = JSON.parse(readFileSync(join(ROOT, 'buildordinal.json'), 'utf8'));
  const stamped = (want) => [...md.matchAll(/\/pull\/(\d+)\), `([^`]+)`/g)].find(([, , s]) => want(s))?.[1];
  const onBox = stamped((s) => s === `${box.release}.${box.ordinal}`);
  assert.ok(onBox, `no receipt in CHANGELOG.md is stamped with the committed box ${box.release}.${box.ordinal}`);
  const green = cli(['--check', '--pr', onBox]);
  assert.equal(green.status, 0, green.stdout + green.stderr);
  // A receipted pull request stamped with an older box is red on this tree.
  const offBox = stamped((s) => s !== `${box.release}.${box.ordinal}`);
  const behind = cli(['--check', '--pr', offBox]);
  assert.equal(behind.status, 1, behind.stdout + behind.stderr);
  assert.match(behind.stdout, new RegExp(`#${offBox}'s receipt is stamped`));
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

// The workflow wiring (review on #1317): the tool tests above cannot see
// whether receipts.yml actually runs the --pr path on a pull request, so pin
// the trigger, the event split, and the event-conditional clone here.
test('receipts.yml runs --check --pr auto on pull_request into dev, and the range check on push', () => {
  const yml = readFileSync(join(ROOT, '.github', 'workflows', 'receipts.yml'), 'utf8');
  const on = /\non:\n([\s\S]*?)\n\S/.exec(yml)?.[1] || '';
  assert.match(on, /(^|\n) {2}pull_request:\n {4}branches: \[dev\]/, 'pull_request into dev must trigger the job');
  assert.match(on, /(^|\n) {2}push:\n {4}branches: \[dev\]/, 'push to dev must still trigger the job');
  const step = (name) => {
    const at = yml.indexOf(`- name: ${name}`);
    assert.ok(at >= 0, `step "${name}" missing`);
    const next = yml.indexOf('\n      - ', at + 1);
    return yml.slice(at, next < 0 ? undefined : next);
  };
  const pr = step('This pull request has a receipt of its own');
  assert.match(pr, /if: github\.event_name == 'pull_request'/);
  assert.match(pr, /receipts\.mjs --check --pr auto/);
  const range = step('Every pull request merged since the last promotion has a receipt');
  assert.match(range, /if: github\.event_name != 'pull_request'/);
  assert.match(range, /receipts\.mjs --check\s*$/m);
  // --pr reads no history: the full clone and the origin/test fetch serve the range only.
  assert.match(yml, /fetch-depth: \$\{\{ github\.event_name == 'pull_request' && 1 \|\| 0 \}\}/);
  assert.match(step('Fetch the promotion target so the range is the real one'), /if: github\.event_name != 'pull_request'/);
});
