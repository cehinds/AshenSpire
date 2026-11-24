// A fight made without the bands rules (saved before rows) keeps the parent's prices: a status-only part still needs the range it always did,
// and a Retreat stack never adds an Advance (the status does not exist for such a fight).
import test from 'node:test';
import assert from 'node:assert/strict';
import { previewCard } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { applyStatus } from '../src/engine/statuses.js';
import { bandsFight } from './helpers/bands-fight.mjs';

test('without the bands key, Smoke Veil at reach costs its Advance, as on the parent', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const front = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.smokeVeil'] });
    const reach = bandsFight({ enemyIds: ['graveWisp'], hand: ['core.smokeVeil'] }); // starts at reach (band 1)
    const near = previewCard(front, 'qa0', 'e1').cost, far = previewCard(reach, 'qa0', 'e1').cost;
    assert.equal(far, near + 1, 'the status part still pays the Advance to reach a foe at band 1');
    applyStatus(front, front.player, 'retreat', 2, null);
    assert.equal(previewCard(front, 'qa0', 'e1').cost, near, 'a Retreat stack adds nothing without rows');
  } finally { fixCoreMechanics.bands = saved; }
});

test('with the bands rules, the same status-only card is free of the Advance', () => {
  const reach = bandsFight({ enemyIds: ['graveWisp'], hand: ['core.smokeVeil'] });
  const front = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.smokeVeil'] });
  assert.equal(previewCard(reach, 'qa0', 'e1').cost, previewCard(front, 'qa0', 'e1').cost);
});
