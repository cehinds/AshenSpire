// Playtest 2026-11-17 (items 31, 35): the icons under an enemy show its stance weakness. Prepared is weak to melee,
// Idle (no stance) to all damage; any other stance, a Broken or Staggered one, or no stance row shows none.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StanceWeaknessFor } from '../src/model/stanceWeakness.js';
import { stanceWeaknessChip } from '../src/ui/components/weaknessChips.js';
import { withKitDom } from './helpers/dom.mjs';

test('Prepared (and its casting id) is weak to melee; Idle to all damage', () => {
  assert.deepEqual(StanceWeaknessFor({ maneuver: 'prepared' }), { stance: 'prepared', to: 'melee' });
  assert.deepEqual(StanceWeaknessFor({ maneuver: 'casting' }), { stance: 'prepared', to: 'melee' });
  assert.deepEqual(StanceWeaknessFor({ maneuver: 'neutral' }), { stance: 'neutral', to: 'all' });
  assert.deepEqual(StanceWeaknessFor({}), { stance: 'neutral', to: 'all' });
});

test('other stances, a broken stance and no stance row show no stance weakness', () => {
  for (const maneuver of ['attack', 'smash', 'sweep', 'counter', 'defend']) assert.equal(StanceWeaknessFor({ maneuver }), null, maneuver);
  assert.equal(StanceWeaknessFor({ maneuver: 'prepared', broken: true }), null);
  assert.equal(StanceWeaknessFor({ maneuver: 'neutral', staggered: true }), null);
  assert.equal(StanceWeaknessFor(null), null);
});

test('the chip names the weakness and wears its mark', () => {
  withKitDom(() => {
    const prepared = stanceWeaknessChip({ stance: 'prepared', to: 'melee' });
    assert.equal(prepared.dataset.stance, 'prepared');
    assert.match(prepared.getAttribute('aria-label'), /Prepared: melee hits deal more damage/);
    assert.ok(prepared.querySelector('svg'));
    const idle = stanceWeaknessChip({ stance: 'neutral', to: 'all' });
    assert.match(idle.getAttribute('aria-label'), /Idle \(no stance\): every hit deals more damage/);
    assert.equal(stanceWeaknessChip(null), null);
  });
});
