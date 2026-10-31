// tests/jev.test.mjs — the deterministic gate (tools/jev.mjs): triage rules,
// the exit-code contract, restamp and the devmerge conflict classifier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { triage, loadRules, severityOf, runChecks, FAST_CHECKS } from '../tools/jev.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JEV = resolve(ROOT, 'tools/jev.mjs');

// One fixture log line per rule: [rule id, line, deterministic, action].
const FIXTURES = [
  ['generated-stale', 'content-build --check: src/content/generated/cards.js is stale', true, 'regen'],
  ['generated-stale', 'build-game --check: games/ashenspire/build.summary.json out of date', true, 'regen'],
  ['conflict-markers-generated', 'src/content/generated/cards.js:12:<<<<<<< HEAD', true, 'regen'],
  ['conflict-markers-generated', 'games/ashenspire/game.lock.json:3:<<<<<<< HEAD', true, 'regen'],
  ['changelog-order', 'about-changelog --check-order failed: build rises within date 2026-10-31', true, 'restamp'],
  ['golden-hash-mismatch', 'not ok 3 - tests/engine-transaction-determinism.test.mjs golden hash mismatch', false, 'model'],
  ['golden-hash-mismatch', 'tests/combat-rounds-seeded.test.mjs: expected hash 9f3c got 11aa', false, 'model'],
  ['coop-census-count', 'tests/run-node-lanes.test.mjs: co-op census count expected 14 got 15', false, 'model'],
  ['sparse-missing-file', "Error: ENOENT: no such file or directory, open 'docs/component-catalog.html'", true, 'ignore-local'],
  ['sparse-missing-file', 'tools/attack-source-audit.csv: no such file', true, 'ignore-local'],
  ['infra-flake', 'Error: The operation was canceled.', true, 'rerun-once'],
  ['infra-flake', 'npm error code ECONNRESET', true, 'rerun-once'],
  ['infra-flake', 'fatal: unable to access https://github.com/x/y.git: network reset', true, 'rerun-once'],
  ['uistrings-shadow', 'uistrings.mjs --check: shadow literal "Attack" in src/ui/x.js', false, 'model'],
  ['mechanics-generate-drift', 'mechanics-generate --check: would change src/engine/mechanics/x.js', false, 'model'],
  ['ops-json-case-name', 'ops.json case-name test failed: "newHostOp" is a case name in runOpcode', true, 'manual'],
];

test('every rule in the table has a fixture', () => {
  const ids = new Set(FIXTURES.map(f => f[0]));
  for (const rule of loadRules()) assert.ok(ids.has(rule.id), `rule ${rule.id} has no fixture`);
});

for (const [id, line, deterministic, action] of FIXTURES) {
  test(`rule ${id} matches: ${line.slice(0, 50)}`, () => {
    const r = triage(`prefix noise\n${line}\nsuffix noise`);
    const m = r.matches.find(x => x.id === id);
    assert.ok(m, `expected ${id}, got ${r.matches.map(x => x.id).join(',') || 'none'}`);
    assert.equal(m.deterministic, deterministic);
    assert.equal(m.action, action);
    assert.equal(m['evidence-line'], line.trim().slice(0, 240));
  });
}

test('exit-code contract: pass 0, explained-no-fix 1, model 2, unmatched failure 2', () => {
  assert.deepEqual([triage('all green').verdict, triage('all green').exit], ['pass', 0]);
  assert.equal(triage('content-build --check: x is stale').exit, 0);
  assert.equal(triage("ops.json case-name test failed").exit, 1);
  assert.equal(triage('engine-transaction-determinism golden hash mismatch').exit, 2);
  const un = triage('TypeError: x is not a function\nnot ok 1 - something novel');
  assert.deepEqual([un.verdict, un.exit, un.matches.length], ['unmatched', 2, 0]);
  assert.equal(severityOf([{ deterministic: true, action: 'regen' }, { deterministic: false, action: 'model' }]), 2);
});

test('CLI: stale line plus golden mismatch prints both matches and exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-'));
  try {
    const log = join(dir, 'ci.log');
    writeFileSync(log, 'content-build --check: src/content/generated/cards.js is stale\nnot ok 3 - tests/engine-transaction-determinism.test.mjs hash mismatch\n');
    const r = spawnSync(process.execPath, [JEV, 'triage', log], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    const out = JSON.parse(r.stdout.trim());
    assert.deepEqual(out.matches.map(m => m.id), ['generated-stale', 'golden-hash-mismatch']);
    assert.equal(out.verdict, 'needs-model');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: stdin triage and --human', () => {
  const r = spawnSync(process.execPath, [JEV, 'triage', '-', '--human'], { input: 'Error: The operation was canceled.\n', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /infra-flake -> rerun-once/);
});

test('fast-check list names every required check, in order', () => {
  assert.deepEqual(FAST_CHECKS.map(c => c.id), ['style-lint', 'content-build', 'config-build', 'game-config', 'framework-data-build', 'build-game', 'bundle-cycles', 'mechanics-generate', 'uistrings', 'run-node', 'runsim']);
});

test('runChecks: pass is 0, an auto-fixable failure is 1, an unmatched one is 2; exit is the max', () => {
  const outputs = {
    'style-lint': { status: 0, out: '' },
    'content-build': { status: 1, out: 'content-build: src/content/generated/cards.js is stale' },
    'uistrings': { status: 1, out: 'boom\nFAIL something nobody has a rule for' },
  };
  const list = ['style-lint', 'content-build', 'uistrings'].map(id => ({ id }));
  const r = runChecks(list, c => outputs[c.id]);
  assert.deepEqual(r.results.map(x => [x.id, x.exit]), [['style-lint', 0], ['content-build', 1], ['uistrings', 2]]);
  assert.deepEqual(r.results[1].matches, ['generated-stale']);
  assert.equal(r.exit, 2);
  assert.equal(runChecks([{ id: 'style-lint' }], () => ({ status: 0, out: '' })).exit, 0);
});

// ---- restamp ----
import { restampChangelog } from '../tools/jev.mjs';

const CHANGELOG = [
  '# Changelog', '', '## 2026-10-31', '',
  '- **Newest** ([#2436](https://github.com/cehinds/AshenSpire/pull/2436), `0.7.2.71`). Text A.',
  '- **Mine** ([#2500](https://github.com/cehinds/AshenSpire/pull/2500), `0.7.2.60`). Text B.',
  '- **Mine** ([#2500](https://github.com/cehinds/AshenSpire/pull/2500), `0.7.2.60`). Text B.',
  '- **Old** ([#2432](https://github.com/cehinds/AshenSpire/pull/2432), `0.7.2.69`). Text C.',
  '', '## 2026-10-30', '',
  '- **Older** ([#2500](https://github.com/cehinds/AshenSpire/pull/2500), `0.7.2.10`). Do not touch.', '',
].join('\n');

test('restampChangelog sets the first matching receipt and dedupes under the newest heading only', () => {
  const r = restampChangelog(CHANGELOG, { pr: 2500, build: '0.7.2.72' });
  assert.equal(r.deduped, 1);
  assert.equal(r.from, '0.7.2.60');
  const lines = r.text.split('\n');
  assert.equal(lines.filter(l => l.includes('#2500') && l.includes('Text B')).length, 1);
  assert.ok(lines.some(l => l.includes('Text B') && l.includes('`0.7.2.72`')));
  assert.ok(lines.some(l => l.includes('Do not touch') && l.includes('`0.7.2.10`')), 'older heading is untouched');
  assert.ok(lines.some(l => l.includes('Text A') && l.includes('`0.7.2.71`')), 'other PRs are untouched');
});

test('restampChangelog refuses a PR with no receipt under the newest heading', () => {
  assert.throws(() => restampChangelog(CHANGELOG, { pr: 9999, build: '0.7.2.72' }), /names PR #9999/);
});

test('CLI restamp on a temp root reads the build from buildordinal.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-rs-'));
  try {
    writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG);
    writeFileSync(join(dir, 'buildordinal.json'), JSON.stringify({ release: '0.7.2', ordinal: 88 }));
    const r = spawnSync(process.execPath, [JEV, 'restamp', '--pr', '2500', '--root', dir, '--no-regen'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), /Text B\./);
    assert.match(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), /pull\/2500\), `0\.7\.2\.88`\)/);
    assert.equal(JSON.parse(r.stdout.trim()).to, '0.7.2.88');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---- devmerge ----
import { classifyConflicts, resolveChangelogConflict } from '../tools/jev.mjs';

test('classifyConflicts: generated files, changelog, everything else', () => {
  const r = classifyConflicts([
    'src/content/generated/cards.js', 'games/ashenspire/build.summary.json', 'games/ashenspire/game.lock.json',
    'src/content/changelog.generated.js', 'src/framework/data/terms.js', 'CHANGELOG.md',
    'src/model/combat.js', 'src/framework/data/sub/x.js', 'content/source/cards/a.json',
  ]);
  assert.deepEqual(r.generated, ['src/content/generated/cards.js', 'games/ashenspire/build.summary.json', 'games/ashenspire/game.lock.json', 'src/content/changelog.generated.js', 'src/framework/data/terms.js']);
  assert.deepEqual(r.changelog, ['CHANGELOG.md']);
  assert.deepEqual(r.other, ['src/model/combat.js', 'src/framework/data/sub/x.js', 'content/source/cards/a.json']);
  assert.deepEqual(classifyConflicts([]), { generated: [], changelog: [], other: [] });
});

test('resolveChangelogConflict keeps ours first, then theirs, dropping lines theirs already has', () => {
  const text = [
    '## 2026-10-31', '',
    '<<<<<<< HEAD',
    '- **Mine** (#1, `0.7.2.60`).',
    '- **Shared** (#2, `0.7.2.61`).',
    '=======',
    '- **Shared** (#2, `0.7.2.61`).',
    '- **Theirs** (#3, `0.7.2.70`).',
    '>>>>>>> origin/dev',
    '- **Tail** (#4, `0.7.2.50`).', '',
  ].join('\n');
  const r = resolveChangelogConflict(text);
  assert.deepEqual(r.split('\n'), [
    '## 2026-10-31', '',
    '- **Mine** (#1, `0.7.2.60`).',
    '- **Shared** (#2, `0.7.2.61`).',
    '- **Theirs** (#3, `0.7.2.70`).',
    '- **Tail** (#4, `0.7.2.50`).', '',
  ]);
  assert.ok(!/<<<<<<<|=======|>>>>>>>/.test(r));
});

test('devmerge refuses a dirty tree (exit 1) without touching it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-dm-'));
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  try {
    g('init', '-q'); g('config', 'user.email', 'a@b.c'); g('config', 'user.name', 'x');
    writeFileSync(join(dir, 'a.txt'), '1'); g('add', '.'); g('commit', '-qm', 'init');
    writeFileSync(join(dir, 'a.txt'), '2');
    const r = spawnSync(process.execPath, [JEV, 'devmerge'], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout.trim()).verdict, 'dirty-tree');
    assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8'), '2');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
