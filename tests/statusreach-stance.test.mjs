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
  assert.ok(disabled.unreached.includes('evade'));
  const noSpeakers = { ...contentBundle, cards: [], enemies: [] };
  const empty = statusReach(noSpeakers, { readFile });
  assert.ok(empty.unreached.includes('precision'), 'definitions without a carrier are not reach');
  assert.ok(empty.unreached.includes('evade'), 'definitions without a carrier are not reach');
});
