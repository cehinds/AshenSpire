// Classic-map rest re-entry (src/model/restRevisit.js, owner 2026-10-12): a
// left rest site stays enterable until a new node is chosen, and consumed
// choices stay consumed. Headless: the model only, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import {
  openRestRecord, recordRestConsumed, markRestLeft, restRevisitNodeId, clearRestRevisitOnTravel,
} from '../src/model/restRevisit.js';

const REG = createRegistries(contentBundle);

function classicRun() {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: REG });
  run.mapNodeId = 'n1';
  return run;
}

test('openRestRecord creates a record for the current place', () => {
  const run = classicRun();
  const record = openRestRecord(run);
  assert.equal(run.restRevisit, record);
  assert.deepEqual(record, { act: run.actNumber, nodeId: 'n1', rested: false, spent: false, left: false, refilled: false });
});

test('restRevisitNodeId is the rest site while its record exists', () => {
  const run = classicRun();
  assert.equal(restRevisitNodeId(run), null);
  openRestRecord(run);
  assert.equal(restRevisitNodeId(run), 'n1');
});

test('a smith choice spends the site without marking a rest', () => {
  const run = classicRun();
  openRestRecord(run);
  recordRestConsumed(run, 'smith');
  assert.equal(run.restRevisit.spent, true);
  assert.equal(run.restRevisit.rested, false);
});

test('a rest choice marks both rested and spent', () => {
  const run = classicRun();
  openRestRecord(run);
  recordRestConsumed(run, 'rest');
  assert.equal(run.restRevisit.rested, true);
  assert.equal(run.restRevisit.spent, true);
});

test('leaving marks the record left without dropping it', () => {
  const run = classicRun();
  openRestRecord(run);
  markRestLeft(run);
  assert.equal(run.restRevisit.left, true);
  assert.equal(restRevisitNodeId(run), 'n1');
});

test('openRestRecord again returns the same object, so consumption is kept', () => {
  const run = classicRun();
  const first = openRestRecord(run);
  recordRestConsumed(run, 'rest');
  const second = openRestRecord(run);
  assert.equal(second, first);
  assert.equal(second.rested, true);
  assert.equal(second.spent, true);
});

test('travelling to the same node keeps the record', () => {
  const run = classicRun();
  openRestRecord(run);
  clearRestRevisitOnTravel(run, 'n1');
  assert.ok(run.restRevisit);
  assert.equal(restRevisitNodeId(run), 'n1');
});

test('travelling to another node drops the record', () => {
  const run = classicRun();
  openRestRecord(run);
  clearRestRevisitOnTravel(run, 'n2');
  assert.equal(run.restRevisit, undefined);
  run.mapNodeId = 'n2';
  assert.equal(restRevisitNodeId(run), null);
});

test('a record for another act is stale: no re-entry, and openRestRecord replaces it', () => {
  const run = classicRun();
  run.restRevisit = { act: run.actNumber + 1, nodeId: 'n1', rested: true, spent: true, left: true, refilled: true };
  assert.equal(restRevisitNodeId(run), null);
  const record = openRestRecord(run);
  assert.equal(record.act, run.actNumber);
  assert.equal(record.rested, false);
  assert.equal(restRevisitNodeId(run), 'n1');
});

test('the record survives a JSON round trip', () => {
  const run = classicRun();
  openRestRecord(run);
  recordRestConsumed(run, 'rest');
  markRestLeft(run);
  const restored = JSON.parse(JSON.stringify(run));
  assert.deepEqual(restored.restRevisit, run.restRevisit);
  assert.equal(restRevisitNodeId(restored), 'n1');
});

test('a run carrying restRevisit serializes and validates clean', () => {
  const run = classicRun();
  openRestRecord(run);
  recordRestConsumed(run, 'smith');
  const restored = deserializeRun(serializeRun(run));
  assert.deepEqual(restored.restRevisit, run.restRevisit);
  assert.deepEqual(validateRunShape(run), []);
  assert.deepEqual(validateRunShape(restored), []);
});

test('the atlas (journey) never re-enters a rest site', () => {
  const run = classicRun();
  openRestRecord(run);
  run.journey = {};
  assert.equal(restRevisitNodeId(run), null);
});

test('the legacy dungeon never re-enters a rest site', () => {
  const run = classicRun();
  openRestRecord(run);
  run.legacyDungeon = {};
  assert.equal(restRevisitNodeId(run), null);
});
