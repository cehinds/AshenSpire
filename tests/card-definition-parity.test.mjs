import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playingCardDefinition, playingCardModel } from '../src/model/playingCard.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { reactionRulesSnapshot } from '../src/content/combatCardTraits.js';

const registries = createRegistries(contentBundle);
const rules = { combatExpansionVersion: 2, reactionRulesVersion: 2, breakMeterVersion: 2, reactionRules: reactionRulesSnapshot() };
for (const cardId of ['crystalBarrier', 'starbladePhalanx', 'cinderSigil', 'strike', 'starstonePebble', 'frostCounter', 'mindSpike']) {
  test(`${cardId}: non-combat definition matches combat before temporary modifiers`, () => {
    const ref = { cardId, abilityRank: 1 };
    const def = playingCardDefinition(registries, ref, { rules });
    assert.deepEqual(def, resolveCombatCard({ registries, ...rules }, ref));
    assert.deepEqual(playingCardModel(registries, ref, { rules }), playingCardModel(registries, ref, { definition: def }));
  });
}
test('reward and deck descriptions use Ward while legacy runs retain Block', () => {
  const ref = { cardId: 'crystalBarrier', abilityRank: 1 };
  assert.match(cardPlainText(registries, ref, { rules }), /Gain 4 Ward/);
  assert.doesNotMatch(cardPlainText(registries, ref, { rules }), /Block/);
  assert.match(cardPlainText(registries, ref, { rules: { combatExpansionVersion: 1 } }), /Block/);
  assert.deepEqual(playingCardDefinition(registries, ref), resolveCard(registries, ref));
});
test('explicit definitions reach the model and live preview definitions take priority', () => {
  const ref = { cardId: 'crystalBarrier' };
  const definition = { ...playingCardDefinition(registries, ref, { rules }), name: 'Projected barrier' };
  const live = { ...definition, name: 'Live barrier' };
  assert.equal(playingCardModel(registries, ref, { definition }).name, definition.name);
  assert.equal(playingCardDefinition(registries, ref, { definition, rules, preview: { resolvedDefinition: live } }), live);
});

test('unoverlaid expansion cards retain projected trait tags in every model path', () => {
  const ref = { cardId: 'frostCounter', abilityRank: 1 };
  const definition = playingCardDefinition(registries, ref, { rules });
  assert.equal(definition.cardTags, undefined);
  for (const opts of [{ rules }, { definition }, { preview: { resolvedDefinition: definition, values: [] } }]) {
    const ids = playingCardModel(registries, ref, opts).tags.map(tag => tag.id);
    for (const id of ['trait:reaction', 'trait:counterstrike', 'trait:impact', 'trait:flux']) {
      assert.ok(ids.includes(id), `projected model keeps ${id}`);
    }
  }
});
