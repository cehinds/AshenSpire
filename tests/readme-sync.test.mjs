// tests/readme-sync.test.mjs — the fast PR gate for README.md's generated regions.
// Runs on PR → dev via node --test (well under 2 s).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  README,
  REGIONS,
  markers,
  renderChannels,
  syncText,
} from '../tools/readme-sync.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = resolve(ROOT, 'tools/readme-sync.mjs');
const committed = readFileSync(README, 'utf8');

test('committed README is current with its generated regions', () => {
  const { text, problems } = syncText(committed);
  assert.deepEqual(problems, []);
  assert.equal(text, committed);
});

test('--check exits 0 on the committed README', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
  assert.match(out, /README SYNC CURRENT/);
});

test('channel table lists Test, Dev, Release and Main only', () => {
  const rows = committed.split('\n').filter((line) => line.startsWith('| ') && line.includes('latest/build.svg'));
  assert.equal(rows.length, 4);
  assert.ok(!committed.includes('Alternative Dev'));
  assert.ok(!committed.includes('Alternative Test'));
  assert.ok(!committed.includes('alternative/dev/latest'));
});

test('a stale channel row is caught', () => {
  const stale = committed.replace('[Play Dev](https://cehinds.github.io/AshenSpire/dev/latest/)',
    '[Play Dev](https://cehinds.github.io/AshenSpire/dev/old/)');
  assert.notEqual(stale, committed);
  const { text, problems } = syncText(stale);
  assert.deepEqual(problems, []);
  assert.notEqual(text, stale, 'a stale region must be rewritten, so the check goes red');
  assert.equal(text, committed);
});

test('a missing marker is caught', () => {
  const { close } = markers('channels');
  const broken = committed.replace(close, '');
  const { problems } = syncText(broken);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /missing markers for region "channels"/);
});

test('duplicate markers are caught', () => {
  const { open } = markers('channels');
  const { problems } = syncText(committed.replace(open, `${open}\n${open}`));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /duplicate markers/);
});

test('text outside the regions is never touched', () => {
  const edited = committed.replace('**Windows:**', '**Windows (edited):**');
  const { text } = syncText(edited);
  assert.ok(text.includes('**Windows (edited):**'));
});

test('renderChannels emits a header, a separator and four rows', () => {
  const lines = renderChannels().split('\n');
  assert.equal(lines.length, 6);
  assert.equal(REGIONS.length, 1);
});
