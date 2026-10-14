import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';

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
