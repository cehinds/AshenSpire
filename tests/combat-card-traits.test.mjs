// Reaction rules version 2: the card trait projection (docs/combat-card-traits-contract.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCardTraits, cardTier } from '../src/content/traitProjection.js';
import { CARD_TRAIT_RULES } from '../src/content/combatCardTraits.js';
import { armamentCards } from '../src/content/cards/armaments.js';
import { colorlessCards } from '../src/content/cards/colorless.js';
import { coopCards } from '../src/content/cards/coop.js';
import { corruptedCards } from '../src/content/cards/corrupted.js';
import { heraldCards } from '../src/content/cards/herald.js';
import { reaverCards } from '../src/content/cards/reaver.js';
import { rogueCards } from '../src/content/cards/rogue.js';
import { starseerCards } from '../src/content/cards/starseer.js';
import { applyCombatExpansionCard, combatExpansionNewCards } from '../src/content/combatExpansionCards.js';
import { applyAbilityGrade } from '../src/model/abilityGrades.js';
import { combatProfileFor, combatProfileTags } from '../src/model/combatCardProfile.js';
import { objectTagIds } from '../src/content/tags.js';
import { progressionCards } from '../src/content/progression/cards.js';

// Every card definition, the way the engine's resolved definition reaches the projection:
// authored tags attached, then the combat expansion overlay, then the projection.
const cardDefs = [armamentCards, colorlessCards, coopCards, corruptedCards, heraldCards, reaverCards, rogueCards, starseerCards]
  .flat().filter(def => def?.id);
const withTags = def => def.tags ? def : { ...def, tags: objectTagIds('card', def.id) };
const expanded = def => applyCombatExpansionCard(withTags(def));
const projected = def => applyCardTraits(expanded(def));
const allDefs = [...cardDefs, ...progressionCards, ...combatExpansionNewCards];

const traitsOf = def => def.traitValues || {};
const hasTrait = (def, tag) => (def.tags || []).includes(tag);

test('cardTier reads the authored grade for graded cards and half the rank otherwise', () => {
  assert.equal(cardTier({ gradeProfiles: [], abilityRank: 3 }), 3);
  assert.equal(cardTier({ gradeProfiles: [] }), 0);
  assert.equal(cardTier({}), 0);
  assert.equal(cardTier({ rank: 1 }), 0);
  assert.equal(cardTier({ rank: 4 }), 2);
  assert.equal(cardTier({ rank: 5 }), 2);
  assert.equal(cardTier({ rank: 12 }), 5);
});

test('every maneuver:counter card carries trait:reaction', () => {
  const counters = allDefs.map(projected).filter(def => combatProfileFor(def).maneuver === 'counter');
  assert.ok(counters.length > 0);
  for (const def of counters) assert.ok(hasTrait(def, 'trait:reaction'), def.id);
});

test('every smash card carries Impact of at least 2', () => {
  const smashes = allDefs.map(projected).filter(def => combatProfileFor(def).maneuver === 'smash');
  assert.ok(smashes.length > 0);
  for (const def of smashes) assert.ok(traitsOf(def).impact >= 2, `${def.id} impact ${traitsOf(def).impact}`);
});

test('dodgeRoll is a reaction only: no Counterstrike and no Impact', () => {
  const dodge = projected(cardDefs.find(def => def.id === 'dodgeRoll'));
  assert.equal(dodge.traitValues.reaction, true);
  assert.equal(dodge.traitValues.counterstrike, undefined);
  assert.equal(dodge.traitValues.impact, undefined);
  assert.equal(hasTrait(dodge, 'trait:counterstrike'), false);
  assert.equal(hasTrait(dodge, 'trait:impact'), false);
});

test('a graded counter family gives Impact 1 at rank 0 and Impact 3 at rank 5', () => {
  const family = progressionCards.find(def => def.id === 'progression-crimson-reprisal');
  assert.ok(family, 'progression-crimson-reprisal exists');
  const at = rank => applyCardTraits(expanded(applyAbilityGrade(family, rank)));
  assert.equal(at(0).traitValues.impact, 1);
  assert.equal(at(5).traitValues.impact, 3);
});

test('a non-smash physical attack gets Impact only from tier 3', () => {
  const family = progressionCards.find(def => def.id === 'progression-carrion-cut');
  assert.ok(family, 'progression-carrion-cut exists');
  const at = rank => applyCardTraits(expanded(applyAbilityGrade(family, rank)));
  assert.equal(at(2).traitValues, undefined);
  assert.equal(at(3).traitValues.impact, 2);
});

test('a power with Flux only from tier 4 when it is camp:spell', () => {
  const power = { id: 'syntheticPower', type: 'power', tags: ['camp:spell', 'maneuver:casting', 'damage:fire'], effects: [] };
  assert.deepEqual(applyCardTraits({ ...power, rank: 6 }), { ...power, rank: 6 });
  const at4 = applyCardTraits({ ...power, rank: 8 });
  assert.equal(at4.traitValues.flux, 3);
  assert.ok(at4.tags.includes('trait:flux'));
  const physical = { ...power, tags: ['camp:physical', 'maneuver:casting'] };
  assert.deepEqual(applyCardTraits({ ...physical, rank: 8 }), { ...physical, rank: 8 });
});

test('a card no trait applies to is returned as the same object', () => {
  const plain = cardDefs.find(def => def.id === 'honedEdge');
  const def = expanded(plain);
  assert.equal(applyCardTraits(def), def);
});

test('applyCardTraits never mutates its input', () => {
  for (const raw of allDefs) {
    const def = expanded(raw);
    const before = structuredClone(def);
    applyCardTraits(def);
    assert.deepEqual(def, before, def.id);
  }
});

test('no projected card repeats a tag', () => {
  for (const raw of allDefs) {
    const def = projected(raw);
    assert.equal(new Set(def.tags || []).size, (def.tags || []).length, def.id);
  }
});

test('the Impact and Flux chips carry their values in the profile tags', () => {
  const kick = projected(cardDefs.find(def => def.id === 'kickOff'));
  assert.equal(kick.traitValues.impact, 2);
  const labels = combatProfileTags(kick).map(row => row.label);
  assert.ok(labels.includes('Impact 2'), labels.join(', '));
  assert.ok(!combatProfileTags(expanded(cardDefs.find(def => def.id === 'honedEdge'))).some(row => row.id === 'trait:impact'));
});

test('per-tag card counts at tier 0 across every card', () => {
  const counts = { reaction: 0, counterstrike: 0, impact: 0, flux: 0 };
  for (const raw of allDefs) {
    const def = projected(raw);
    for (const key of Object.keys(counts)) if (traitsOf(def)[key] !== undefined) counts[key] += 1;
  }
  console.log(`trait card counts (tier from rank, all ${allDefs.length} defs): ${JSON.stringify(counts)}`);
  assert.deepEqual(counts, { reaction: 31, counterstrike: 22, impact: 60, flux: 70 });
});

test('applyCardTraits reads Impact and Flux magnitudes from the fight rules', () => {
  const smash = allDefs.find(def => combatProfileFor(expanded(def)).maneuver === 'smash' && (def.rank ?? 0) < 2);
  assert.ok(smash, 'a T0 smash card');
  const tuned = { ...CARD_TRAIT_RULES, impact: { base: { smash: 3, default: 1 }, perTwoTiers: 1 } };
  assert.equal(applyCardTraits(expanded(smash), tuned).traitValues.impact, 3);
  assert.equal(applyCardTraits(expanded(smash)).traitValues.impact, 2);
  const flux = allDefs.map(expanded).find(def => applyCardTraits(def).traitValues?.flux === 1);
  assert.ok(flux, 'a flux card at T0');
  const fluxTuned = { ...CARD_TRAIT_RULES, flux: { base: 4, perTwoTiers: 2 } };
  assert.equal(applyCardTraits(flux, fluxTuned).traitValues.flux, 4);
  assert.equal(applyCardTraits({ ...flux, rank: 4 }, fluxTuned).traitValues?.flux, 6);
});
