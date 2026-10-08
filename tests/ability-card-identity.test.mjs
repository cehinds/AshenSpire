import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { renderCard } from '../src/ui/components/card.js';
import { rewardDom } from './helpers/reward-dom.mjs';
const reg = createRegistries(contentBundle);

test('every ability family presents each authored rank and its canonical identity', () => {
  for (const card of reg.cards.all().filter(card => card.gradeProfiles)) for (let abilityRank = 0; abilityRank <= 5; abilityRank++) {
    const model = playingCardModel(reg, { cardId: card.id, abilityRank });
    assert.equal(model.abilityRank, abilityRank);
    assert.equal(model.rankBadge, `R${abilityRank}`);
    assert.ok(model.rankHelp.includes(`Rank ${abilityRank}`));
    assert.equal(model.type.label, card.abilityKind === 'spell' ? abilityRank === 0 ? 'Cantrip' : 'Spell' : abilityRank === 0 ? 'Technique' : 'Combat Maneuver');
    assert.equal(model.type.subtype, abilityRank > 0 && model.costs.mana > 0 && card.tags.includes('source:weapon') ? 'Weapon Art' : null);
    assert.ok(model.type.glyph && model.type.help.includes(model.type.label));
  }
});

test('rank zero and one are visible on rendered cards without a legacy rank overlay', () => {
  const dom = rewardDom(), saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]])); Object.assign(globalThis, dom);
  try {
    for (const [cardId, label] of [['progression-cinder-orbit', 'Cantrip'], ['progression-ember-hew', 'Technique']]) for (const abilityRank of [0, 1, 5]) {
      const face = renderCard(reg, { cardId, abilityRank });
      assert.equal(face.querySelector('.card-rank').textContent, `R${abilityRank}`);
      assert.equal(face.querySelector('.card-ability-type'), null);
      assert.ok(face.querySelector('.combat-sigil-action'));
      assert.ok(face.getAttribute('aria-label').includes(abilityRank === 0 ? label : label === 'Cantrip' ? 'Spell' : 'Combat Maneuver'));
      assert.ok(face.getAttribute('aria-label').includes(`rank ${abilityRank}`));
    }
    const plain = renderCard(reg, { cardId: 'strike' }), ranked = renderCard(reg, { cardId: 'strike', rank: 2 });
    assert.equal(plain.querySelector('.card-rank'), null); assert.equal(plain.querySelector('.card-ability-type'), null);
    assert.equal(ranked.querySelector('.card-rank').textContent, 'R2');
    const legacy = playingCardModel(reg, { cardId: 'stomp', rank: 2 });
    assert.equal(legacy.abilityRank, null); assert.equal(legacy.rank, 2);
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
