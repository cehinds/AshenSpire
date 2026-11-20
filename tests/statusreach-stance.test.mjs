import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { statusReach, CODE_APPLIERS } from '../tools/statusreach.mjs';

const readFile = () => CODE_APPLIERS.map(row => row.needle).join('\n');
test('stance statuses require a positive grant from an actual projected carrier', () => {
  const live = statusReach(contentBundle, { readFile });
  for (const status of ['precision', 'evade']) {
    assert.ok(live.reached.includes(status), status);
    assert.ok(live.witness.get(status).some(route => route.startsWith('R8 ')), status);
  }
  const disabled = statusReach(contentBundle, { readFile,
    stanceRules: { offensivePrecision: 0, evadeStacks: 0, spellStatusStacks: 0 } });
  assert.ok(disabled.unreached.includes('precision'));
  // W25-EvadeCards (intended by the design): Evade cards grant their stacks with their own applyStatus effect, not only through stance entry,
  // so switching the stance-entry grant off no longer makes Evade unreachable; the carrier is still required (see the empty bundle below).
  assert.ok(disabled.reached.includes('evade'));
  assert.ok(disabled.witness.get('evade').some(route => route.startsWith('R8 authored Evade status')));
  const noSpeakers = { ...contentBundle, cards: [], enemies: [] };
  const empty = statusReach(noSpeakers, { readFile });
  assert.ok(empty.unreached.includes('precision'), 'definitions without a carrier are not reach');
  assert.ok(empty.unreached.includes('evade'), 'definitions without a carrier are not reach');
});
