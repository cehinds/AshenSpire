import test from 'node:test';
import assert from 'node:assert/strict';
import { cardClassification, actualCardRank } from '../src/model/cardClassification.js';
import { applyCardTraits } from '../src/content/traitProjection.js';

const card = (maneuver, rank = 1, extra = {}) => ({ id: 'taxonomy-fixture', type: 'skill', rank,
  tags: ['camp:physical', `maneuver:${maneuver}`], effects: [], ...extra });

test('canonical category and stance subtype preserve authored execution kind', () => {
  for (const [maneuver, subtype, groups] of [
    ['smash', 'smash', ['offense']], ['attack', 'attack', ['offense']],
    ['sweep', 'sweep', ['offense']], ['counter', 'counter', ['offense', 'defensive']],
    ['defend', 'defense', ['defensive']],
  ]) {
    const def = card(maneuver);
    assert.deepEqual(cardClassification(def), { cardCategory: 'stance', stanceType: subtype, stanceGroups: groups });
    assert.equal(def.type, 'skill');
  }
  assert.equal(cardClassification(card('counter', 1, { evade: { charges: 1 } })).stanceType, 'evade');
  for (const type of ['power', 'consumable', 'status', 'curse'])
    assert.deepEqual(cardClassification(card('casting', 1, { type })), { cardCategory: type, stanceType: null, stanceGroups: [] });
  assert.equal(cardClassification(card('casting')).cardCategory, 'skill');
  assert.equal(cardClassification(card('casting', 1, { type: 'attack' })).stanceType, 'attack');
});

test('Sweep Reaction uses actual rank two, while Defense uses rank one', () => {
  for (const maneuver of ['sweep', 'defend']) for (const rank of [0, 1, 2, 3, 6]) {
    const expected = rank >= (maneuver === 'sweep' ? 2 : 1);
    for (const def of [card(maneuver, rank), card(maneuver, 9, { gradeProfiles: [], abilityRank: rank })]) {
      assert.equal(actualCardRank(def), rank);
      assert.equal(!!applyCardTraits(def).traitValues?.reaction, expected);
    }
  }
  assert.deepEqual(cardClassification(card('sweep', 2)).stanceGroups, ['offense', 'defensive']);
  const legacy = card('sweep', 1, { defensiveReaction: true });
  assert.deepEqual(cardClassification(legacy).stanceGroups, ['offense', 'defensive']);
  assert.equal(!!applyCardTraits(legacy).traitValues?.reaction, false);
});
