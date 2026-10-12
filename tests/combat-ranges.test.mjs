// The combat range vocabulary (owner, 2026-10-12): melee | reach | ranged, with
// the pre-rename contact | near | far read through an alias so old saves load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANGES, LEGACY_RANGE, normalizeRange, bringRangesForward } from '../src/model/combatRanges.js';

test('the vocabulary is melee, reach, ranged and the legacy names alias onto it', () => {
  assert.deepEqual([...RANGES], ['melee', 'reach', 'ranged']);
  assert.deepEqual({ ...LEGACY_RANGE }, { contact: 'melee', near: 'reach', far: 'ranged' });
  assert.equal(normalizeRange('contact'), 'melee');
  assert.equal(normalizeRange('near'), 'reach');
  assert.equal(normalizeRange('far'), 'ranged');
  assert.equal(normalizeRange('reach'), 'reach');
  assert.equal(normalizeRange('spell'), 'spell');
});

test('bringRangesForward renames legacy keys and values in place and leaves other meanings alone', () => {
  const saved = {
    matchups: {
      counter: { defaultCoverage: { melee: { camps: ['physical'], reaches: ['contact'] }, ranged: { reaches: ['near', 'far'] } },
        schoolMatchups: { frost: { strongReaches: ['contact'], weakSchools: ['fire'] } } },
      evade: { areaDifficulty: { contact: 0, near: 2, far: 4 } },
      distance: { nearChance: 20, farChance: 35, maximumBaseChance: 50 },
    },
    statuses: { prone: { status: 'prone', contactPercent: 25, rangedSinglePercent: -25, nearEvade: 2, farEvade: 4, standCost: 1 } },
    player: { combatStance: { maneuver: 'ranged', camp: 'physical', reach: 'far' } },
    carrier: { cardTags: ['camp:spell', 'reach:near'], combatProfile: { reach: 'contact' } },
    animation: { reach: 1 }, seat: 'reach', cue: 'contact', status: 'far',
  };
  assert.equal(bringRangesForward(saved), true);
  assert.deepEqual(saved, {
    matchups: {
      counter: { defaultCoverage: { melee: { camps: ['physical'], ranges: ['melee'] }, ranged: { ranges: ['reach', 'ranged'] } },
        schoolMatchups: { frost: { strongRanges: ['melee'], weakSchools: ['fire'] } } },
      evade: { areaDifficulty: { melee: 0, reach: 2, ranged: 4 } },
      distance: { reachChance: 20, rangedChance: 35, maximumBaseChance: 50 },
    },
    statuses: { prone: { status: 'prone', meleePercent: 25, rangedSinglePercent: -25, reachEvade: 2, rangedEvade: 4, standCost: 1 } },
    player: { combatStance: { maneuver: 'ranged', camp: 'physical', range: 'ranged' } },
    carrier: { cardTags: ['camp:spell', 'range:reach'], combatProfile: { range: 'melee' } },
    animation: { reach: 1 }, seat: 'reach', cue: 'contact', status: 'far',
  });
  // Key order is kept, so a re-serialized save reads in the same order.
  assert.deepEqual(Object.keys(saved.statuses.prone), ['status', 'meleePercent', 'rangedSinglePercent', 'reachEvade', 'rangedEvade', 'standCost']);
  assert.equal(bringRangesForward(saved), false, 'a current table is already forward');
});
