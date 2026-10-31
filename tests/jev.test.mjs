// tests/jev.test.mjs — the deterministic gate (tools/jev.mjs): triage rules,
// the exit-code contract, restamp and the devmerge conflict classifier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { triage, loadRules, severityOf } from '../tools/jev.mjs';

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
