import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { renderCard } from '../src/ui/components/card.js';
import { illustratedCardHtml, CARD_LAYERS } from '../src/ui/components/illustratedCard.js';
import { rewardDom } from './helpers/reward-dom.mjs';
const reg = createRegistries(contentBundle);

test('every ability family presents each authored rank and its canonical identity', () => {
  for (const card of reg.cards.all().filter(card => card.gradeProfiles)) for (let abilityRank = 0; abilityRank <= 5; abilityRank++) {
    const model = playingCardModel(reg, { cardId: card.id, abilityRank });
    assert.equal(model.abilityRank, abilityRank);
    assert.equal(model.rankBadge, abilityRank>0?`Rank ${abilityRank}`:null);
    assert.ok(model.rankHelp.includes(`Rank ${abilityRank}`));
    assert.equal(model.type.label, card.abilityKind === 'spell' ? abilityRank === 0 ? 'Cantrip' : 'Spell' : abilityRank === 0 ? 'Technique' : 'Combat Maneuver');
    assert.equal(model.type.subtype, abilityRank > 0 && model.costs.mana > 0 && card.tags.includes('source:weapon') ? 'Weapon Art' : null);
    assert.ok(model.type.glyph && model.type.help.includes(model.type.label));
  }
});

test('rank zero is hidden and positive ranks are written out in the face rank layer', () => {
  const dom = rewardDom(), saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]])); Object.assign(globalThis, dom);
  try {
    for (const [cardId, label] of [['progression-cinder-orbit', 'Cantrip'], ['progression-ember-hew', 'Technique']]) for (const abilityRank of [0, 1, 5]) {
      const face = renderCard(reg, { cardId, abilityRank });
      const badge=face.querySelector('.card-rank');
      if(abilityRank===0)assert.equal(badge,null);
      else{assert.ok(badge);assert.equal(badge.getAttribute('data-card-layer'),'9');
        assert.match(illustratedCardHtml(playingCardModel(reg,{cardId,abilityRank}),{rules:''}),new RegExp(`>Rank ${abilityRank}</span>`));}
      assert.equal(face.querySelector('.card-ability-type'), null);
      assert.ok(face.querySelector('.combat-sigil-action'));
      assert.ok(face.getAttribute('aria-label').includes(abilityRank === 0 ? label : label === 'Cantrip' ? 'Spell' : 'Combat Maneuver'));
      assert.ok(face.getAttribute('aria-label').includes(`rank ${abilityRank}`));
    }
    const plain = renderCard(reg, { cardId: 'strike' }), ranked = renderCard(reg, { cardId: 'strike', rank: 2 });
    assert.equal(plain.querySelector('.card-rank'), null); assert.equal(plain.querySelector('.card-ability-type'), null);
    assert.ok(ranked.querySelector('.card-rank'));
    assert.match(illustratedCardHtml(playingCardModel(reg,{cardId:'strike',rank:2}),{rules:''}),/>Rank 2<\/span>/);
    const firstRank=playingCardModel(reg,{cardId:'strike',rank:1});
    assert.equal(firstRank.rankBadge,'Rank 1');
    assert.match(illustratedCardHtml(firstRank,{rules:''}),/>Rank 1<\/span>/);
    assert.match(renderCard(reg,{cardId:'strike',rank:1}).getAttribute('aria-label'),/rank 1/);
    const legacy = playingCardModel(reg, { cardId: 'stomp', rank: 2 });
    assert.equal(legacy.abilityRank, null); assert.equal(legacy.rank, 2);
  } finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});

test('painted components separate fills from trims and reserve the top layer for rank',()=>{
  assert.deepEqual(CARD_LAYERS,{background:1,art:2,backdrops:3,footerTrim:4,fills:5,trim:6,icons:7,text:8,rank:9});
  const html=illustratedCardHtml(playingCardModel(reg,{cardId:'cinderSigil',abilityRank:1}),{rules:'6 damage.'});
  for(const component of ['base','card-trim','panel','panel-trim','flag','flag-trim'])assert.ok(html.includes(`data-component="${component}"`),component);
  for(const layer of Object.values(CARD_LAYERS))assert.ok(html.includes(`data-card-layer="${layer}"`),`layer ${layer}`);
  assert.equal((html.match(/class="card-rank"/g)||[]).length,1);
});
