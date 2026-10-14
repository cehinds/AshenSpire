import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { assertResumeIdentity, isDirectInvocation } from './browser-combat.mjs';
import { pathToFileURL } from 'node:url';

function summarize(cases, inventory = { cards: [{ id: 'strike', classes: ['reaver'], upgraded: false }] }) {
  const dir = mkdtempSync(resolve(tmpdir(), 'combat-summary-'));
  const path = resolve(dir, 'report.json');
  writeFileSync(path, JSON.stringify({ finished: 'complete', build: { source: 'test', ordinal: '1' }, sourceDigests: {}, inventory, cases, errors: [] }));
  const result = spawnSync(process.execPath, [new URL('./browser-combat.mjs', import.meta.url).pathname,
    '--mode=summarize', `--reports=${path}`], { encoding: 'utf8', env: { ...process.env, QA_OUTPUT: dir } });
  let manifest;
  try { manifest = JSON.parse(readFileSync(resolve(dir, 'combined-manifest.json'), 'utf8')); } catch { /* rejected before summary */ }
  rmSync(dir, { recursive: true, force: true });
  return { ...result, manifest };
}
const row = (device, status = 'passed') => ({ device, classId: 'reaver', category: 'card', cardId: 'strike', variant: 'base', status, before: { upcastTiers: [] } });

test('default matrix rejects a missing phone report', () => {
  const result = summarize([row('desktop')]);
  assert.equal(result.status, 1);
  assert.deepEqual(result.manifest.missingKeys, ['phone/reaver/card/strike/base']);
});
test('a finished empty report cannot claim complete coverage', () => {
  const result = summarize([]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nonempty cases/);
});
test('empty authored inventory cannot claim complete coverage', () => {
  const result = summarize([row('desktop'), row('phone')], { cards: [] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nonempty authored inventory/);
});
test('historical failed reruns preserve provenance without inflating coverage', () => {
  const result = summarize([row('desktop', 'failed'), row('desktop'), row('phone'), row('phone')]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.manifest.latestKeys, 2);
  assert.equal(result.manifest.requiredKeys, 2);
  assert.equal(result.manifest.historicalFailures.length, 1);
  assert.equal(result.manifest.historicalFailures[0].index, 0);
  assert.equal(result.manifest.historicalFailures[0].latest.index, 1);
  assert.equal(result.manifest.historicalFailures[0].resolved, true);
});
test('resume refuses changed HTML bytes even when source and ordinal match', () => {
  const report = { htmlSha256: 'original', build: { source: 'same', ordinal: '1530' }, sourceDigests: { module: 'same' }, cases: [row('desktop')] };
  assert.throws(() => assertResumeIdentity(report, { ...report, htmlSha256: 'changed' }), /compiled HTML byte identity/);
  assert.equal(report.cases.length, 1, 'failed validation preserves the original history');
  assert.doesNotThrow(() => assertResumeIdentity(report, report));
  assert.throws(() => assertResumeIdentity({ ...report, htmlSha256: undefined }, report), /must pin compiled HTML bytes/);
});
test('distinct enemy rows keep distinct provenance keys', () => {
  const enemy = id => ({ ...row('desktop'), category: 'enemy-turn', enemyIds: [id] });
  const result = summarize([row('desktop'), row('phone'), enemy('wanderingSoldier'), enemy('gildedKnight')]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.manifest.latestKeys, 4);
  assert.equal(result.manifest.cases.filter(item => item.key.includes('/enemy-turn/')).length, 2);
});
test('direct invocation decodes filesystem paths rather than comparing URL pathnames', () => {
  const path = resolve(tmpdir(), 'audit folder', 'browser-combat.mjs');
  assert.equal(isDirectInvocation(path, pathToFileURL(path).href), true);
  assert.equal(isDirectInvocation(path + '.other', pathToFileURL(path).href), false);
  assert.equal(isDirectInvocation(undefined, pathToFileURL(path).href), false);
});
