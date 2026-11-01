// tests/version-advance.test.mjs — the automatic release-triple bump (owner, 2026-11-01).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reconcileCuts, advanceSeries, advanceSource, advanceSubject, nextTriple, parseTriple, recordsSource, VERSION_FILE, SERIES_FILE } from '../tools/version-advance.mjs';

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
  assert.equal(recordsSource(subjects, 'release', sha), true);
  assert.equal(recordsSource(subjects, 'release', 'b'.repeat(40)), false);
  assert.equal(recordsSource(['version-advance: 0.8.0 after main ' + sha], 'main', sha), true);
  assert.equal(recordsSource(['mentions version-advance: 0.7.3 after release ' + sha], 'release', sha), false, 'only a subject that starts with it counts');
  assert.throws(() => recordsSource([], 'release', 'not a sha'));
});

test('idempotence is keyed on branch AND sha: a release record does not satisfy main', () => {
  const sha = 'd'.repeat(40);
  const cut = [advanceSubject('0.7.3', 'release', sha)];
  assert.equal(recordsSource(cut, 'release', sha), true);
  assert.equal(recordsSource(cut, 'main', sha), false, 'main fast-forwarded to a cut sha still owes its minor bump');
  assert.equal(recordsSource([...cut, advanceSubject('0.8.0', 'main', sha)], 'main', sha), true);
  assert.throws(() => recordsSource(cut, 'dev', sha));
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

test('CLI: --read-current and --subject, and the subject round-trips through the guard', () => {
  const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'tools/version-advance.mjs'), ...args], { encoding: 'utf8' });
  const sha = 'c'.repeat(40);
  const cur = parseTriple(readFileSync(join(ROOT, VERSION_FILE), 'utf8')).join('.');
  assert.equal(run('--kind', 'candidate', '--read-current').stdout.trim(), cur);
  const subject = run('--subject', '0.7.3', 'release', sha);
  assert.equal(subject.status, 0);
  assert.equal(subject.stdout.trim(), `version-advance: 0.7.3 after release ${sha} [version-advance]`);
  assert.equal(recordsSource([subject.stdout.trim()], 'release', sha), true);
  assert.equal(run('--subject', '0.7.3', 'dev', sha).status, 2);
});

test('reconcile: only earlier lost runs are applied, in order, current last', () => {
  const r = (number, branch, sha, conclusion) => ({ number, branch, sha, conclusion });
  const cur = { number: 10, branch: 'release', sha: 'r2' };
  // The coordinator's scenario: release #10 is still setting up, a later main #11 was
  // queued then cancelled by release #12. #10 must not take #11, or the minor bump lands
  // before the candidate bump (0.7.2 -> 0.8.2 instead of 0.8.1).
  const runs = [r(8, 'release', 'r0', 'cancelled'), r(9, 'main', 'm0', 'failure'), r(11, 'main', 'm1', 'cancelled'), r(7, 'release', 'ok', 'success')];
  assert.deepEqual(reconcileCuts(runs, cur), [
    { branch: 'release', sha: 'r0' }, { branch: 'main', sha: 'm0' }, { branch: 'release', sha: 'r2' },
  ]);
  // The later run (#12) reconciles #11 and #10's lost work in order.
  assert.deepEqual(reconcileCuts([...runs, r(10, 'release', 'r2', 'cancelled')], { number: 12, branch: 'release', sha: 'r3' }).map((c) => c.sha),
    ['r0', 'm0', 'r2', 'm1', 'r3']);
  // De-duplicates on branch+sha, and keeps the same sha on two branches as two cuts.
  assert.deepEqual(reconcileCuts([r(1, 'release', 'x', 'cancelled'), r(2, 'release', 'x', 'failure'), r(3, 'main', 'x', 'cancelled')], { number: 5, branch: 'release', sha: 'x' }),
    [{ branch: 'main', sha: 'x' }, { branch: 'release', sha: 'x' }]);
});
