// node --test workbench/tests/layout-modes.test.mjs — Layout Studio's mode list and
// the deep link #mod=layout&mode=battlefield|sketch (parsed by the Workbench host).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, hashFor } from '../modules/host.mjs';
import * as L from '../modules/layout/modes.mjs';

test('the deep link opens battlefield and sketch, and unknown modes open UI config', () => {
  const battlefield = parseHash('#mod=layout&mode=battlefield');
  assert.equal(battlefield.mod, 'layout');
  assert.equal(L.modeFor(battlefield.params.mode), 'battlefield');
  assert.equal(L.modeFor(parseHash('#mod=layout&mode=sketch').params.mode), 'sketch');
  assert.equal(L.modeFor(parseHash('#mod=layout').params.mode), 'config');
  assert.equal(L.modeFor('zigzag'), 'config');
  assert.equal(L.modeFor(undefined), 'config');
});

test('a mode not built yet opens UI config rather than an empty page', () => {
  assert.equal(L.modeFor('deck'), 'config');
  assert.deepEqual(L.comingNext().map((m) => m.id), ['deck', 'orb', 'book-recipes', 'card-layers']);
});

test('the link for a mode round-trips through the host\'s hash helpers', () => {
  assert.equal(hashFor('layout', L.paramsFor('battlefield')), '#mod=layout&mode=battlefield');
  assert.equal(hashFor('layout', L.paramsFor('config')), '#mod=layout');
  assert.equal(L.modeFor(parseHash(hashFor('layout', L.paramsFor('sketch'))).params.mode), 'sketch');
});
