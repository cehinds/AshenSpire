import test from 'node:test';
import assert from 'node:assert/strict';
import { cardClassification, actualCardRank } from '../src/model/cardClassification.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel, playingCardClasses } from '../src/model/playingCard.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
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

test('shared card model exposes canonical identity and separate ability labels with legacy CSS hooks', () => {
  const registries = createRegistries(contentBundle);
  for (const [id, subtype] of [['frostCounter', 'Counter'], ['crystalBarrier', 'Defense'], ['dodgeRoll', 'Evade']]) {
    const def = applyCardTraits(applyCombatExpansionCard(registries.cards.get(id)));
    const model = playingCardModel(registries, { cardId: id }, { definition: def });
    assert.equal(model.type.id, 'stance');
    assert.equal(model.type.label, 'STANCE');
    assert.equal(model.type.subtype, subtype);
    assert.ok(playingCardClasses(model).includes('type-stance'));
    assert.ok(playingCardClasses(model).includes('type-' + def.type));
    assert.equal(model.stanceType, subtype.toLowerCase());
  }
});
