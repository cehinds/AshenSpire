// tests/version-advance.test.mjs — the automatic release-triple bump (owner, 2026-11-01).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { advanceSeries, advanceSource, advanceSubject, nextTriple, parseTriple, recordsSource, VERSION_FILE, SERIES_FILE } from '../tools/version-advance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = `  // version-advance: 0.7.2\n  version: '0.7.2',\n  balance,\n`;

test('candidate: 0.7.2 -> 0.7.3, minor: 0.7.3 -> 0.8.0, major untouched', () => {
  assert.deepEqual(nextTriple([0, 7, 2], 'candidate'), [0, 7, 3]);
  assert.deepEqual(nextTriple([0, 7, 3], 'minor'), [0, 8, 0]);
  assert.deepEqual(nextTriple([1, 9, 9], 'minor'), [1, 10, 0]);
  assert.deepEqual(nextTriple([1, 2, 9], 'candidate'), [1, 2, 10]);
  assert.throws(() => nextTriple([0, 7, 2], 'major'));
});

test('advanceSource rewrites only the literal and its marker', () => {
  const a = advanceSource(SRC, 'candidate');
  assert.equal(a.next, '0.7.3');
  assert.equal(a.text, SRC.replaceAll('0.7.2', '0.7.3'));
  const b = advanceSource(a.text, 'minor');
  assert.equal(b.next, '0.8.0');
  assert.equal(b.text, SRC.replaceAll('0.7.2', '0.8.0'));
  assert.equal(parseTriple(b.text).join('.'), '0.8.0');
});

test('advanceSource refuses a file that lost its literal or marker', () => {
  assert.throws(() => advanceSource('nothing', 'candidate'));
  assert.throws(() => advanceSource("  version: '0.7.2',\n", 'candidate'), /marker/);
});

test('the real home parses and carries the marker', () => {
  const text = readFileSync(join(ROOT, VERSION_FILE), 'utf8');
  const t = parseTriple(text).join('.');
  assert.match(text, new RegExp(`^\\s*// version-advance: ${t.replaceAll('.', '\\.')}$`, 'm'));
  advanceSource(text, 'candidate');
});

test('advanceSeries follows a minor bump only through the one SERIES line', () => {
  const t = "const SERIES = '0.7';\nconst x = 1;\n";
  assert.equal(advanceSeries(t, '0.8.0'), "const SERIES = '0.8';\nconst x = 1;\n");
  assert.throws(() => advanceSeries('nothing', '0.8.0'));
  const real = readFileSync(join(ROOT, SERIES_FILE), 'utf8');
  advanceSeries(real, '0.8.0');
});

test('idempotence guard: a recorded source sha is skipped, another is not', () => {
  const sha = 'a'.repeat(40);
  const subjects = ['feat: x', advanceSubject('0.7.3', 'release', sha), 'build: stamp 0.7.3.0 [build-stamp]'];
  assert.equal(recordsSource(subjects, sha), true);
  assert.equal(recordsSource(subjects, 'b'.repeat(40)), false);
  assert.equal(recordsSource(['version-advance: 0.8.0 after main ' + sha], sha), true);
  assert.equal(recordsSource(['mentions version-advance: 0.7.3 after release ' + sha], sha), false, 'only a subject that starts with it counts');
  assert.throws(() => recordsSource([], 'not a sha'));
});

test('CLI dry run in a temp copy: prints the next triple, --write moves both files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'va-'));
  try {
    for (const f of [VERSION_FILE, SERIES_FILE]) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      cpSync(join(ROOT, f), join(dir, f));
    }
    const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'tools/version-advance.mjs'), ...args],
      { env: { ...process.env, VERSION_ADVANCE_ROOT: dir }, encoding: 'utf8' });
    const cur = parseTriple(readFileSync(join(dir, VERSION_FILE), 'utf8'));
    const before = readFileSync(join(dir, VERSION_FILE), 'utf8');
    const dry = run('--kind', 'candidate');
    assert.equal(dry.status, 0);
    assert.equal(dry.stdout.trim(), nextTriple(cur, 'candidate').join('.'));
    assert.equal(readFileSync(join(dir, VERSION_FILE), 'utf8'), before, 'no --write, no change');
    assert.equal(run('--kind', 'candidate', '--check').status, 0);
    assert.equal(readFileSync(join(dir, VERSION_FILE), 'utf8'), before);
    assert.equal(run('--kind', 'bogus').status, 2);
    // Pin a known start so the examples in the owner's request are exact.
    writeFileSync(join(dir, VERSION_FILE), before.replaceAll(cur.join('.'), '0.7.2'));
    assert.equal(run('--kind', 'candidate', '--write').status, 0);
    assert.equal(parseTriple(readFileSync(join(dir, VERSION_FILE), 'utf8')).join('.'), '0.7.3');
    assert.match(readFileSync(join(dir, SERIES_FILE), 'utf8'), /const SERIES = '0\.7';/);
    assert.equal(run('--kind', 'minor', '--write').status, 0);
    assert.equal(parseTriple(readFileSync(join(dir, VERSION_FILE), 'utf8')).join('.'), '0.8.0');
    assert.match(readFileSync(join(dir, SERIES_FILE), 'utf8'), /const SERIES = '0\.8';/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
