// tests/jev.test.mjs — the deterministic gate (tools/jev.mjs): triage rules,
// the exit-code contract, restamp and the devmerge conflict classifier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync as readdirSyncFs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGEN_STEPS, sparseLocal, triage, loadRules, severityOf, runChecks, FAST_CHECKS } from '../tools/jev.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JEV = resolve(ROOT, 'tools/jev.mjs');

const SPARSE = { 'sparse-local': () => true };

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
  ['infra-flake', 'Error: The runner has received a shutdown signal.', true, 'rerun-once'],
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
    const r = triage(`prefix noise\n${line}\nsuffix noise`, loadRules(), SPARSE);
    const m = r.matches.find(x => x.id === id);
    assert.ok(m, `expected ${id}, got ${r.matches.map(x => x.id).join(',') || 'none'}`);
    assert.equal(m.deterministic, deterministic);
    assert.equal(m.action, action);
    assert.equal(m['evidence-line'], line.trim().slice(0, 240));
  });
}

test('exit-code contract: pass 0, explained-no-fix 1, model 2, unmatched failure 2', () => {
  assert.deepEqual([triage('about-changelog check-order: OK — 12 checks passed').verdict, triage('about-changelog check-order: OK — 12 checks passed').exit], ['pass', 0]);
  // No failure word but no success evidence either: unknown, a model decides.
  assert.deepEqual([triage('all green').verdict, triage('all green').exit], ['unknown', 2]);
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
  const r = spawnSync(process.execPath, [JEV, 'triage', '-', '--human'], { input: 'Error: The runner has received a shutdown signal.\n', encoding: 'utf8' });
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

test('generated-stale matches each generator\'s real diagnostic (tool name after the failure)', () => {
  // Copied from the generators' own messages.
  for (const line of [
    'STALE: src/config/generated/ui.js does not match content/config/ — run node tools/config-build.mjs',
    'STALE: src/framework/data/mechanics.js does not match mechanics.json — run node tools/framework-data-build.mjs',
    'Error: Stale generated game configuration: games/ashenspire/game.lock.json; run node tools/game-config.mjs build',
    '3 generated file(s) are out of date — run: node tools/content-build.mjs',
    'error: games/ashenspire/build.summary.json is stale; run node tools/build-game.mjs and commit it',
  ]) {
    const r = triage(line + '\n');
    assert.deepEqual(r.matches.map(m => m.id), ['generated-stale'], line);
    assert.equal(r.exit, 0, line);
  }
  // An orphaned generated file is not something regen fixes.
  const o = triage('  ORPHANED src/content/generated/old.js — no source file produces it; it ships stale\n');
  assert.ok(!o.matches.some(m => m.id === 'generated-stale'));
});

test('the tools\' capital RED / FAILED verdicts are failures (real about-changelog output)', () => {
  for (const line of [
    'about-changelog check-order: RED — receipt #2501: cites build 90 but buildordinal.json is at 80',
    "about-changelog check-order: RED — heading '## 2026-10-30' sits below '## 2026-10-29' but is newer",
    'tool: FAILED',
    'verdict: node tools/pages-site.mjs exited 1 — propagated verbatim',
  ]) {
    const r = triage(line + '\n');
    assert.equal(r.exit, 2, line);
  }
  // A stamp-order RED that restamp fixes still routes to restamp.
  const s = triage('about-changelog check-order: RED — build rises within 2026-10-31: #1 cites 0.7.2.5\n');
  assert.deepEqual(s.matches.map(m => m.id), ['changelog-order']);
  // Prose "red" and an OK verdict are not failures.
  assert.equal(triage('the red banner shows\nabout-changelog check-order: OK — 1275 checks passed\n').exit, 0);
});

test('config-build REFUSED (Codex repro) and every non-pass `<tool>: VERDICT —` in tools/ count as failures', () => {
  const refused = triage("config-build: REFUSED — 1 problem(s):\n  content/config/buttons.json: unknown section 'typoSection'\n");
  assert.equal(refused.exit, 2);
  // Scan the repo's own tools for their verdict words so a new one can't silently read as a pass.
  const readdirSync = (u) => readdirSyncFs(u);
  const words = new Set();
  for (const f of readdirSync(new URL('../tools/', import.meta.url))) {
    if (!f.endsWith('.mjs')) continue;
    const src = readFileSync(new URL(`../tools/${f}`, import.meta.url), 'utf8');
    for (const m of src.matchAll(/[a-z0-9-]+: ([A-Z][A-Z-]{1,}) —/g)) words.add(m[1]);
  }
  assert.ok(words.size >= 5, 'found the tools\' verdict words');
  for (const w of words) {
    const r = triage(`some-tool: ${w} — detail\n`);
    if (['OK', 'PASS', 'PASSED', 'GREEN'].includes(w)) assert.equal(r.exit, 0, w);
    else assert.equal(r.exit, 2, `${w} must not read as a pass`);
  }
});

test('a diagnostic with no failure word and no success evidence goes to a model (Codex repro)', () => {
  const r = triage("content-build: reviewProbe.csv: duplicate column 'id'\n");
  assert.equal(r.exit, 2);
  for (const ok of ['154 passed, 0 failed', 'content-build: generated files are current', '# fail 0', 'mechanics-generate: up to date', 'ok 3 - a test']) {
    assert.equal(triage(ok + '\n').exit, 0, ok);
  }
});

test('restampChangelog moves the restamped receipt to the top of its date group', () => {
  const r = restampChangelog(CHANGELOG, { pr: 2500, build: '0.7.2.72' });
  assert.equal(r.moved, true);
  const receipts = r.text.split('\n').slice(0, r.text.split('\n').indexOf('## 2026-10-30')).filter(l => l.startsWith('- '));
  assert.ok(receipts[0].includes('#2500') && receipts[0].includes('`0.7.2.72`'), 'restamped receipt is first');
  assert.deepEqual(receipts.slice(1).map(l => l.match(/#(\d+)/)[1]), ['2436', '2432'], 'others keep their order');
  // Codex's case: a lower receipt (#2432 at .69) restamped to .71 must rise above #2436.
  const c = restampChangelog(CHANGELOG, { pr: 2432, build: '0.7.2.73' });
  const first = c.text.split('\n').find(l => l.startsWith('- '));
  assert.ok(first.includes('#2432') && first.includes('`0.7.2.73`'));
});

test('restamp and devmerge never exempt the receipt with --pending', () => {
  const src = readFileSync(new URL('../tools/jev.mjs', import.meta.url), 'utf8');
  assert.ok(!/'--pending'/.test(src), 'no --pending in jev.mjs');
});

test('restampChangelog takes a receipt left under an older date into the newest group', () => {
  const text = [
    '# Changelog', '', '## 2026-11-01', '',
    '- **Dev today** ([#2600](https://github.com/cehinds/AshenSpire/pull/2600), `0.7.2.80`). New.',
    '', '## 2026-10-31', '',
    '- **Mine** ([#2501](https://github.com/cehinds/AshenSpire/pull/2501), `0.7.2.70`). Opened yesterday.',
    '- **Other** ([#2432](https://github.com/cehinds/AshenSpire/pull/2432), `0.7.2.69`). Stays.', '',
  ].join('\n');
  const r = restampChangelog(text, { pr: 2501, build: '0.7.2.81' });
  assert.equal(r.relocatedFrom, '2026-10-31');
  const lines = r.text.split('\n');
  const newest = lines.slice(lines.indexOf('## 2026-11-01'), lines.indexOf('## 2026-10-31'));
  assert.ok(newest.find(l => l.startsWith('- ')).includes('#2501') && newest.join('\n').includes('`0.7.2.81`'), 'moved to the top of the newest group, restamped');
  const older = lines.slice(lines.indexOf('## 2026-10-31'));
  assert.ok(!older.some(l => l.includes('#2501')), 'gone from the older group');
  assert.ok(older.some(l => l.includes('#2432') && l.includes('`0.7.2.69`')), 'other receipts untouched');
});

test('restampChangelog matches the receipt\'s own PR field, not a prose mention of the PR', () => {
  const text = [
    '# Changelog', '', '## 2026-10-31', '',
    '- **Follow-up** ([#2600](https://github.com/cehinds/AshenSpire/pull/2600), `0.7.2.80`). Follows [#2501](https://github.com/cehinds/AshenSpire/pull/2501).',
    '- **Mine** ([#2501](https://github.com/cehinds/AshenSpire/pull/2501), `0.7.2.70`). The real one.', '',
  ].join('\n');
  const r = restampChangelog(text, { pr: 2501, build: '0.7.2.81' });
  const lines = r.text.split('\n');
  assert.ok(lines.some(l => l.includes('The real one') && l.includes('`0.7.2.81`')), '#2501 restamped');
  assert.ok(lines.some(l => l.includes('Follow-up') && l.includes('`0.7.2.80`')), '#2600 untouched');
});

test('restampChangelog rewrites the build field, not a version in the receipt\'s words (Codex repro)', () => {
  const text = ['# Changelog', '', '## 2026-10-31', '',
    '- **Fix `0.7.2.60` display** ([#2501](https://github.com/cehinds/AshenSpire/pull/2501), `0.7.2.79`). Text.', ''].join('\n');
  const r = restampChangelog(text, { pr: 2501, build: '0.7.2.80' });
  const line = r.text.split('\n').find(l => l.includes('#2501'));
  assert.ok(line.includes('**Fix `0.7.2.60` display**'), 'summary untouched');
  assert.ok(line.includes('/pull/2501), `0.7.2.80`'), 'build field restamped');
  assert.equal(r.from, '0.7.2.79');
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

// ---- failure detection (a false "pass" is the worst outcome) ----

test('a log of only a TypeError and stack is unmatched, exit 2', () => {
  const r = triage("TypeError: Cannot read properties of undefined (reading 'x')\n    at foo (src/a.js:1:2)\n    at bar (src/b.js:3:4)\n");
  assert.deepEqual([r.verdict, r.exit], ['unmatched', 2]);
  for (const l of ['AssertionError [ERR_ASSERTION]: x', 'Failed to compile', 'npm ERR! code 1', '# fail 2', 'not ok 5 - x', 'Process completed with exit code 1.'])
    assert.equal(triage(l).exit, 2, l);
  assert.equal(triage('# tests 5\n# pass 5\n# fail 0\n').exit, 0);
});

test('a safe rule match never hides an unexplained failure line', () => {
  const r = triage('content-build --check: src/content/generated/cards.js is stale\nnot ok 5 - tests/combat.test.mjs\n# fail 1\n');
  assert.equal(r.exit, 2);
  assert.equal(r.matches.at(-1).id, 'unmatched');
});

test('CLI: the TypeError-only log exits 2', () => {
  const r = spawnSync(process.execPath, [JEV, 'triage', '-'], { input: 'TypeError: Cannot read properties of undefined\n    at x (a.js:1:1)\n', encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('a retried ECONNRESET warning is not an infra flake; a real failure beside it exits 2', () => {
  const log = 'npm warn retry ECONNRESET, retrying\nnot ok 5 - tests/combat.test.mjs\n# fail 1\n';
  const r = triage(log);
  assert.equal(r.exit, 2);
  assert.ok(!r.matches.some(m => m.id === 'infra-flake'));
  const lost = triage('npm error code ECONNRESET\nnpm error network request failed\nnpm error A complete log of this run can be found in x.log\n');
  assert.deepEqual([lost.exit, lost.matches.map(m => m.id)], [0, ['infra-flake']]);
});

test('runChecks: a failing check no rule recognises is exit 2, never 1', () => {
  const r = runChecks([{ id: 'x' }], () => ({ status: 1, out: 'quiet death' }));
  assert.equal(r.exit, 2);
});

test('changelog-order keys on about-changelog failure output, not the echoed --check-order command', () => {
  const header = 'Run node tools/verdict.mjs -- node tools/about-changelog.mjs --check-order\n';
  const r = triage(`${header}ok\nnot ok 3 - tests/unrelated.test.mjs\n`);
  assert.equal(r.exit, 2);
  assert.ok(!r.matches.some(m => m.id === 'changelog-order'));
  const real = triage(`${header}Error: check-order: build rises within 2026-10-31: #1 cites x\n`);
  assert.deepEqual(real.matches.map(m => m.id), ['changelog-order']);
});

test('a non-stamp check-order error (heading order, bullet shape) is not restampable and exits 2', () => {
  for (const line of [
    "Error: check-order: heading '## 2026-10-30' sits below '## 2026-10-29' but is newer",
    "Error: check-order: line 'x' carries a receipt but is not a top-level '- ' bullet",
  ]) {
    const r = triage(line + '\n');
    assert.ok(!r.matches.some(m => m.id === 'changelog-order'), line);
    assert.equal(r.exit, 2, line);
  }
});

test('a bare "The operation was canceled." (also printed on a step timeout) is not a runner flake', () => {
  const r = triage('Error: The operation was canceled.\n');
  assert.ok(!r.matches.some(m => m.id === 'infra-flake'));
  assert.equal(r.exit, 2);
});

test('sparse-missing-file only applies in a local sparse checkout, never under CI', () => {
  const log = "Error: ENOENT: no such file or directory, open 'docs/component-catalog.html'\n";
  assert.equal(triage(log, loadRules(), SPARSE).exit, 0);
  const none = triage(log, loadRules(), { 'sparse-local': () => false });
  assert.deepEqual([none.exit, none.matches.length], [2, 0]);
  // git stub: core.sparseCheckout value and `ls-files -t` rows ('S ' = skip-worktree).
  const gitWith = (sparse, rows) => args => ({ out: args[0] === 'config' ? sparse : args[0] === 'ls-files' ? rows : '' });
  const excluded = gitWith('true\n', 'S docs/component-catalog.html\n');
  assert.equal(sparseLocal('ENOENT component-catalog.html', { env: {}, git: excluded }), true);
  assert.equal(sparseLocal('ENOENT component-catalog.html', { env: { CI: 'true' }, git: excluded }), false, 'never under CI');
  assert.equal(sparseLocal('ENOENT component-catalog.html', { env: {}, git: gitWith('false\n', 'S docs/component-catalog.html\n') }), false, 'needs core.sparseCheckout');
  assert.equal(sparseLocal('ENOENT component-catalog.html', { env: {}, git: gitWith('true\n', 'H docs/component-catalog.html\n') }), false, 'deleted but not sparse-excluded');
  assert.equal(sparseLocal('ENOENT component-catalog.html', { env: {}, git: gitWith('', 'H docs/component-catalog.html\n') }), false, 'full checkout, plain deletion');
  assert.equal(sparseLocal('ENOENT component-catalog.html', { env: {}, git: gitWith('true\n', '') }), false, 'untracked file');
  assert.equal(sparseLocal('ENOENT elsewhere.txt', { env: {}, git: excluded }), false);
});

test('CLI under CI: a sparse-missing-file log exits 2', () => {
  const r = spawnSync(process.execPath, [JEV, 'triage', '-'], { input: "Error: ENOENT: no such file or directory, open 'docs/component-catalog.html'\n", encoding: 'utf8', env: { ...process.env, CI: 'true' } });
  assert.equal(r.status, 2);
});

test('resolveChangelogConflict keeps date groups intact when dev adds a newer date (Codex repro)', () => {
  const text = [
    '# Changelog', '',
    '<<<<<<< HEAD',
    '## 2026-10-31', '',
    '- **Mine** ([#2501](https://github.com/cehinds/AshenSpire/pull/2501), `0.7.2.70`). PR receipt.',
    '=======',
    '## 2026-11-01', '',
    '- **Dev new day** ([#2600](https://github.com/cehinds/AshenSpire/pull/2600), `0.7.2.80`). Dev.', '',
    '## 2026-10-31', '',
    '- **Dev yesterday** ([#2599](https://github.com/cehinds/AshenSpire/pull/2599), `0.7.2.79`). Dev.',
    '>>>>>>> origin/dev', '',
    '## 2026-10-30', '', '- **Old** ([#2400](https://github.com/cehinds/AshenSpire/pull/2400), `0.7.2.10`). History.', '',
  ].join('\n');
  const r = resolveChangelogConflict(text);
  const lines = r.split('\n');
  assert.ok(!r.includes('<<<<<<<') && !r.includes('>>>>>>>'));
  const firstHeading = lines.findIndex(l => l.startsWith('## '));
  const mine = lines.findIndex(l => l.includes('#2501'));
  assert.equal(lines[firstHeading], '## 2026-11-01');
  assert.ok(mine > firstHeading && mine < lines.indexOf('## 2026-10-31'), 'our receipt sits inside the newest date group');
  assert.equal(lines.filter(l => l === '## 2026-10-31').length, 1, 'one 2026-10-31 heading');
  assert.ok(lines.some(l => l.includes('#2599')) && lines.some(l => l.includes('#2600')));
});

test('resolveChangelogConflict keeps dev\'s copy of a receipt dev restamped (identity by PR)', () => {
  const text = [
    '# Changelog', '', '## 2026-10-31', '',
    '<<<<<<< HEAD',
    '- **Mine** ([#2501](https://github.com/cehinds/AshenSpire/pull/2501), `0.7.2.70`). New.',
    '- **One** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.7.2.60`). Old stamp.',
    '=======',
    '- **One** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.7.2.70`). Old stamp.',
    '>>>>>>> origin/dev', '',
  ].join('\n');
  const r = resolveChangelogConflict(text);
  const ones = r.split('\n').filter(l => l.includes('[#1]'));
  assert.deepEqual(ones.length, 1);
  assert.ok(ones[0].includes('`0.7.2.70`'), "dev's restamped copy kept");
  assert.ok(r.includes('#2501'), 'our new receipt kept');
});

test('resolveChangelogConflict escalates when ours edited a receipt\'s wording that dev restamped (Codex repro)', () => {
  const text = [
    '# Changelog', '', '## 2026-10-31', '',
    '<<<<<<< HEAD',
    '- **One** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.7.2.60`). Corrected wording.',
    '=======',
    '- **One** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.7.2.70`). Old wording.',
    '>>>>>>> origin/dev', '',
  ].join('\n');
  assert.throws(() => resolveChangelogConflict(text), /edited on both sides/);
});

test('classifyConflicts treats config-build output as generated', () => {
  assert.deepEqual(classifyConflicts(['src/config/generated/ui.js']).generated, ['src/config/generated/ui.js']);
  assert.deepEqual(classifyConflicts(['content/config/ui/screens/title.json']).other, ['content/config/ui/screens/title.json']);
});

test('resolveChangelogConflict refuses a non-receipt change on our side', () => {
  const text = ['# Changelog', '<<<<<<< HEAD', 'Intro paragraph we rewrote.', '=======', 'Intro paragraph.', '>>>>>>> origin/dev', '## 2026-10-31', ''].join('\n');
  assert.throws(() => resolveChangelogConflict(text), /non-receipt line/);
});

test('resolveChangelogConflict drops the diff3 base section', () => {
  const text = [
    '## 2026-10-31', '',
    '<<<<<<< HEAD',
    '- **Mine** (#1, `0.7.2.60`).',
    '||||||| merged common ancestors',
    '- **Base** (#9, `0.7.2.40`).',
    '=======',
    '- **Theirs** (#3, `0.7.2.70`).',
    '>>>>>>> origin/dev',
    '- **Tail** (#4, `0.7.2.50`).', '',
  ].join('\n');
  const r = resolveChangelogConflict(text);
  assert.deepEqual(r.split('\n'), ['## 2026-10-31', '', '- **Mine** (#1, `0.7.2.60`).', '- **Theirs** (#3, `0.7.2.70`).', '- **Tail** (#4, `0.7.2.50`).', '']);
});

// ---- devmerge real paths, on a temp git fixture ----
import { devmerge } from '../tools/jev.mjs';
import { mkdirSync, existsSync, realpathSync } from 'node:fs';

const OK_DEPS = (over = {}) => ({
  regen: () => ({ exit: 0, steps: [] }),
  restamp: () => ({ exit: 0, from: 'a', to: 'b' }),
  node: () => ({ status: 0, out: '' }),
  ...over,
});

// origin (bare) + work clone; `setup(w)` runs on both branches via helpers.
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'jev-dmx-'));
  const sh = (cwd, ...a) => { const r = spawnSync('git', a, { cwd, encoding: 'utf8' }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout; };
  const put = (cwd, path, text) => { mkdirSync(dirname(join(cwd, path)), { recursive: true }); writeFileSync(join(cwd, path), text); };
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  sh(root, 'init', '-q', '--bare', '-b', 'dev', origin);
  sh(root, 'clone', '-q', origin, work);
  sh(work, 'config', 'user.email', 'a@b.c'); sh(work, 'config', 'user.name', 'x');
  sh(work, 'checkout', '-q', '-B', 'dev');
  for (const [p, t] of Object.entries(files)) put(work, p, t);
  sh(work, 'add', '.'); sh(work, 'commit', '-qm', 'base'); sh(work, 'push', '-q', 'origin', 'dev');
  sh(work, 'checkout', '-q', '-b', 'feature');
  const onDev = (edit, msg = 'dev change') => { sh(work, 'checkout', '-q', 'dev'); edit(work, put, sh); sh(work, 'add', '-A'); sh(work, 'commit', '-qm', msg); sh(work, 'push', '-q', 'origin', 'dev'); sh(work, 'checkout', '-q', 'feature'); };
  const onFeature = (edit, msg = 'feature change') => { edit(work, put, sh); sh(work, 'add', '-A'); sh(work, 'commit', '-qm', msg); };
  return { root, work, sh, put, onDev, onFeature, done: () => rmSync(root, { recursive: true, force: true }) };
}

const CL_BASE = '# Changelog\n\n## 2026-10-31\n\n- **Base** (#1, `0.7.2.1`).\n';

test('devmerge: conflicting generated file takes dev side, conflicting CHANGELOG merges, then commits', () => {
  const f = fixture({ 'src/content/generated/cards.js': 'base\n', 'CHANGELOG.md': CL_BASE, 'a.txt': 'a\n' });
  try {
    f.onDev(w => { f.put(w, 'src/content/generated/cards.js', 'dev\n'); f.put(w, 'CHANGELOG.md', CL_BASE + '- **Theirs** (#3, `0.7.2.3`).\n'); });
    f.onFeature(w => { f.put(w, 'src/content/generated/cards.js', 'mine\n'); f.put(w, 'CHANGELOG.md', CL_BASE + '- **Mine** (#2, `0.7.2.2`).\n'); });
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS() });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(r.verdict, 'merged');
    assert.deepEqual([r.resolved.generated, r.resolved.changelog], [['src/content/generated/cards.js'], ['CHANGELOG.md']]);
    assert.equal(readFileSync(join(f.work, 'src/content/generated/cards.js'), 'utf8'), 'dev\n');
    const cl = readFileSync(join(f.work, 'CHANGELOG.md'), 'utf8');
    assert.ok(cl.indexOf('Mine') < cl.indexOf('Theirs') && !/<<<<<<<|=======|>>>>>>>/.test(cl));
    assert.equal(f.sh(f.work, 'status', '--porcelain').trim(), '');
    assert.equal(f.sh(f.work, 'rev-list', '--parents', '-n1', 'HEAD').trim().split(' ').length, 3, 'a merge commit');
  } finally { f.done(); }
});

test('devmerge restamps the Markdown (noRegen) before regen projects the changelog (Codex order repro)', () => {
  const f = fixture({ 'CHANGELOG.md': CL_BASE, 'a.txt': 'a\n' });
  try {
    f.onDev(w => { f.put(w, 'a.txt', 'dev\n'); });
    f.onFeature(w => { f.put(w, 'b.txt', 'mine\n'); });
    const calls = [];
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS({
      restamp: (o) => { calls.push(['restamp', o.noRegen === true]); return { exit: 0, from: 'a', to: 'b' }; },
      regen: () => { calls.push(['regen']); return { exit: 0, steps: [] }; },
    }) });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.deepEqual(calls, [['restamp', true], ['regen']]);
  } finally { f.done(); }
});

test('devmerge: a conflict in a non-generated file aborts the merge and exits 2', () => {
  const f = fixture({ 'src/model/combat.js': 'base\n' });
  try {
    f.onDev(w => f.put(w, 'src/model/combat.js', 'dev\n'));
    f.onFeature(w => f.put(w, 'src/model/combat.js', 'mine\n'));
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS() });
    assert.deepEqual([r.exit, r.verdict, r.files], [2, 'needs-model', ['src/model/combat.js']]);
    assert.equal(f.sh(f.work, 'status', '--porcelain').trim(), '');
    assert.equal(readFileSync(join(f.work, 'src/model/combat.js'), 'utf8'), 'mine\n');
    assert.equal(existsSync(join(f.work, '.git/MERGE_HEAD')), false);
  } finally { f.done(); }
});

test('devmerge: a clean merge commits; an up-to-date branch reports so', () => {
  const f = fixture({ 'a.txt': 'a\n' });
  try {
    assert.equal(devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS() }).verdict, 'up-to-date');
    f.onDev(w => f.put(w, 'b.txt', 'b\n'));
    f.onFeature(w => f.put(w, 'c.txt', 'c\n'));
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS() });
    assert.deepEqual([r.exit, r.verdict], [0, 'merged']);
    assert.ok(existsSync(join(f.work, 'b.txt')) && existsSync(join(f.work, 'c.txt')));
  } finally { f.done(); }
});

test('devmerge: a generated file deleted on dev but edited here is removed, not left conflicted', () => {
  const f = fixture({ 'src/content/generated/old.js': 'base\n', 'a.txt': 'a\n' });
  try {
    f.onDev((w, put, sh) => sh(w, 'rm', '-q', 'src/content/generated/old.js'));
    f.onFeature(w => f.put(w, 'src/content/generated/old.js', 'mine\n'));
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS() });
    assert.deepEqual([r.exit, r.verdict], [0, 'merged']);
    assert.equal(existsSync(join(f.work, 'src/content/generated/old.js')), false);
  } finally { f.done(); }
});

test('devmerge: a failing regen leaves the merge uncommitted with the abort hint (exit 1 or 2, never 0)', () => {
  const f = fixture({ 'a.txt': 'a\n' });
  try {
    f.onDev(w => f.put(w, 'b.txt', 'b\n'));
    f.onFeature(w => f.put(w, 'c.txt', 'c\n'));
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS({ regen: () => ({ exit: 2, failed: 'x', tail: 't' }) }) });
    assert.deepEqual([r.exit, r.verdict], [2, 'regen-failed']);
    assert.match(r.hint, /git merge --abort/);
    assert.ok(existsSync(join(f.work, '.git/MERGE_HEAD')));
  } finally { f.done(); }
});

test('regen runs config-build before content-build', () => {
  const ids = REGEN_STEPS.map(a => a[0]);
  assert.ok(ids.indexOf('tools/config-build.mjs') >= 0 && ids.indexOf('tools/config-build.mjs') < ids.indexOf('tools/content-build.mjs'));
  assert.ok(ids.indexOf('tools/framework-data-build.mjs') >= 0 && ids.indexOf('tools/framework-data-build.mjs') < ids.indexOf('tools/content-build.mjs'), 'framework mirrors exist before content-build sweeps strays');
});

test('devmerge: --base starting with - is rejected before git runs', () => {
  assert.deepEqual(devmerge({ base: '--upload-pack=x', cwd: ROOT }).verdict, 'bad-base');
  const r = spawnSync(process.execPath, [JEV, 'devmerge', '--base', '-x'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('devmerge: a pre-existing untracked generated file is not staged; a commit failure prints the abort hint', () => {
  const f = fixture({ 'a.txt': 'a\n' });
  try {
    f.onDev(w => f.put(w, 'b.txt', 'b\n'));
    f.onFeature(w => f.put(w, 'c.txt', 'c\n'));
    f.put(f.work, 'src/content/generated/stray.js', 'stray\n');
    const regenMakes = () => { f.put(f.work, 'src/content/generated/new.js', 'new\n'); return { exit: 0, steps: [] }; };
    const r = devmerge({ base: 'dev', pr: 2, cwd: f.work, deps: OK_DEPS({ regen: regenMakes }) });
    assert.equal(r.verdict, 'merged');
    const tracked = f.sh(f.work, 'ls-files').split('\n');
    assert.ok(tracked.includes('src/content/generated/new.js'));
    assert.ok(!tracked.includes('src/content/generated/stray.js'));
  } finally { f.done(); }
  const g = fixture({ 'a.txt': 'a\n' });
  try {
    g.onDev(w => g.put(w, 'b.txt', 'b\n'));
    g.onFeature(w => g.put(w, 'c.txt', 'c\n'));
    g.sh(g.work, 'config', 'core.hooksPath', join(g.root, 'hooks'));
    mkdirSync(join(g.root, 'hooks'));
    writeFileSync(join(g.root, 'hooks/commit-msg'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const r = devmerge({ base: 'dev', pr: 2, cwd: g.work, deps: OK_DEPS() });
    assert.deepEqual([r.exit, r.verdict], [2, 'commit-failed']);
    assert.match(r.hint, /git merge --abort/);
  } finally { g.done(); }
});

test('CLI: checks --fast skips run-node and runsim and exits 0 here', () => {
  const r = spawnSync(process.execPath, [JEV, 'checks', '--fast', '--only', 'bundle-cycles,run-node,runsim'], { encoding: 'utf8' });
  const out = JSON.parse(r.stdout.trim());
  assert.deepEqual(out.results.map(x => x.id), ['bundle-cycles']);
  assert.deepEqual(out.skipped, ['run-node', 'runsim']);
});

const RCPT = (n, words, ord) => `- **${words}** ([#${n}](https://github.com/o/r/pull/${n}), \`0.7.2.${ord}\`)`;

test('resolveChangelogConflict keeps a receipt deletion made on dev (merge base, Codex repro)', () => {
  const base = `# Changelog\n\n## 2026-10-31\n\n${RCPT(5, 'Old', 5)}\n`;
  const text = `# Changelog\n\n## 2026-10-31\n\n<<<<<<< HEAD\n${RCPT(9, 'New', 9)}\n${RCPT(5, 'Old', 5)}\n=======\n>>>>>>> origin/dev\n`;
  const r = resolveChangelogConflict(text, base);
  assert.ok(r.includes('#9]'), 'our new receipt stays');
  assert.ok(!r.includes('#5]'), 'the receipt dev deleted stays deleted');
  // Without the base the resolver cannot tell; with it, an edit of the deleted receipt escalates.
  const edited = text.replace('**Old**', '**Old, reworded**');
  assert.throws(() => resolveChangelogConflict(edited, base), /deleted on dev but edited/);
});

test('devmerge: a receipt dev deleted is not restored by our neighbouring new receipt (Codex repro)', () => {
  const head = '# Changelog\n\n## 2026-10-31\n\n';
  const f = fixture({ 'CHANGELOG.md': `${head}${RCPT(5, 'Old', 5)}\n${RCPT(1, 'Base', 1)}\n` });
  try {
    f.onDev(w => f.put(w, 'CHANGELOG.md', `${head}${RCPT(1, 'Base', 1)}\n`));
    f.onFeature(w => f.put(w, 'CHANGELOG.md', `${head}${RCPT(9, 'New', 9)}\n${RCPT(5, 'Old', 5)}\n${RCPT(1, 'Base', 1)}\n`));
    const r = devmerge({ base: 'dev', pr: 9, cwd: f.work, deps: OK_DEPS() });
    const cl = readFileSync(join(f.work, 'CHANGELOG.md'), 'utf8');
    if (r.resolved?.changelog?.length) {
      assert.equal(r.exit, 0, JSON.stringify(r));
      assert.ok(cl.includes('#9]') && !cl.includes('#5]'), cl);
    } else {
      // git merged it cleanly: the deletion must still hold.
      assert.ok(!cl.includes('#5]'), cl);
    }
  } finally { f.done(); }
});

test('resolveChangelogConflict keeps a receipt deletion made on this branch (Codex repro)', () => {
  const head = '# Changelog\n\n## 2026-10-31\n\n';
  const base = `${head}${RCPT(5, 'Old', 5)}\n${RCPT(1, 'Base', 1)}\n`;
  const ours = `${head}${RCPT(9, 'New', 9)}\n${RCPT(1, 'Base', 1)}\n`;
  const text = `${head}<<<<<<< HEAD\n${RCPT(9, 'New', 9)}\n=======\n${RCPT(8, 'Dev', 8)}\n${RCPT(5, 'Old', 5)}\n>>>>>>> origin/dev\n${RCPT(1, 'Base', 1)}\n`;
  const r = resolveChangelogConflict(text, base, ours);
  assert.ok(r.includes('#9]') && r.includes('#8]') && r.includes('#1]'), r);
  assert.ok(!r.includes('#5]'), 'the receipt this branch deleted stays deleted');
  const devEdited = text.replace('**Old**', '**Old, reworded on dev**');
  assert.throws(() => resolveChangelogConflict(devEdited, base, ours), /deleted on this branch but edited on dev/);
});

test('devmerge: a receipt this branch deleted is not restored by dev\'s neighbouring receipt (Codex repro)', () => {
  const head = '# Changelog\n\n## 2026-10-31\n\n';
  const f = fixture({ 'CHANGELOG.md': `${head}${RCPT(5, 'Old', 5)}\n${RCPT(1, 'Base', 1)}\n` });
  try {
    f.onDev(w => f.put(w, 'CHANGELOG.md', `${head}${RCPT(8, 'Dev', 8)}\n${RCPT(5, 'Old', 5)}\n${RCPT(1, 'Base', 1)}\n`));
    f.onFeature(w => f.put(w, 'CHANGELOG.md', `${head}${RCPT(9, 'New', 9)}\n${RCPT(1, 'Base', 1)}\n`));
    devmerge({ base: 'dev', pr: 9, cwd: f.work, deps: OK_DEPS() });
    const cl = readFileSync(join(f.work, 'CHANGELOG.md'), 'utf8');
    assert.ok(cl.includes('#9]') && cl.includes('#8]') && !cl.includes('#5]'), cl);
  } finally { f.done(); }
});

test('regen and restamp act on --root, else on the checkout the shell is in, not jev\'s own', async () => {
  const { targetRoot, ROOT } = await import('../tools/jev.mjs');
  const f = fixture({ 'a.txt': 'a\n' });
  try {
    const sub = join(f.work, 'deep'); mkdirSync(sub, { recursive: true });
    assert.equal(realpathSync(targetRoot([], sub)), realpathSync(f.work));
    assert.equal(targetRoot(['--root', '/x/y']), '/x/y');
    assert.equal(targetRoot([], tmpdir()), ROOT, 'outside any checkout it falls back to jev\'s');
  } finally { f.done(); }
});
