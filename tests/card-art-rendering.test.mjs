import test from 'node:test';
import assert from 'node:assert/strict';
import { playingCardArt, playingCardArtwork, cardArtFallbacks } from '../src/ui/cardArtwork.js';
import { illustratedArtwork, illustratedCardHtml } from '../src/ui/components/illustratedCard.js';
import { applyCardArtStyle } from '../src/ui/cardArtStyle.js';
import { renderCard } from '../src/ui/components/card.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { ACTION_SIGILS } from '../src/content/combatSigils.js';
import { CARD_COMPONENTS } from '../src/content/cardComponents.generated.js';

const registries=createRegistries(contentBundle);
const ref={cardId:'strike',profileId:'bladeAttack'};
const definition=resolveCard(registries,ref);

test('authored layout and actual mounted Spell footers retain the outlined sparkle',()=>{
  for (const layout of [CARD_COMPONENTS.template, ...Object.values(CARD_COMPONENTS.cards)]) {
    assert.equal(layout.symbols.actions.spell.svg.body, ACTION_SIGILS.spell.shape);
    assert.equal(layout.symbols.tags.spell.svg.body, ACTION_SIGILS.spell.shape);
    assert.notEqual(layout.symbols.tags.fire.svg.body, ACTION_SIGILS.spell.shape);
  }
  withModalDom(()=>{
    for (const cardId of ['starstonePebble', 'starSpark']) {
      const card = renderCard(registries, { cardId }, { inspection: false });
      document.body.append(card);
      const svg = card.querySelector('[data-primary-sigil="spell"] .combat-sigil-action svg');
      assert.ok(svg, cardId);
      assert.equal(svg.getAttribute('fill-rule'), 'evenodd');
      assert.equal(svg.querySelectorAll('path').length, 1);
      assert.equal(svg.querySelector('path').getAttribute('d'), 'm16 2 5 9 9 5-9 5-5 9-5-9-9-5 9-5Zm0 9-5 5 5 5 5-5Z');
    }
  });
});

test('resolved cards use Simple by default while legacy API and unsupported art are retained',()=>{
  applyCardArtStyle({});
  const simple=playingCardArt(ref,{definition,registries});
  assert.equal(simple.kind,'simple');
  assert.match(simple.path,/assets\/cards\/library\/physical-attack-\d\d-512.webp$/);
  assert.equal(playingCardArt(ref,{definition,registries,style:'Legacy'}).path,playingCardArtwork(ref));
  const unsupported={id:'utility',type:'power',cardTags:[]};
  assert.deepEqual(playingCardArt(ref,{definition:unsupported,registries}),playingCardArt(ref,{style:'Legacy'}));
  const fallback=cardArtFallbacks(ref,simple);
  assert.equal(fallback[0].path,playingCardArtwork(ref));
  assert.equal(fallback[0].kind,'official');
  assert.equal(fallback[1].kind,'outline');
  assert.equal(new Set(fallback.map(item=>item.path)).size,fallback.length);
});

test('simple portrait metadata keeps the painting and decorative layers inside its artwork well',()=>{
  const art=illustratedArtwork(ref,'strike',{definition,registries});
  const model={id:'strike',name:'Strike',costs:{action:1,mana:0,stamina:1},tags:[]};
  const html=illustratedCardHtml(model,{rules:'Deal damage.',painting:art.path,artworkKind:art.kind,artworkPosition:art.position,artworkComposition:art,glyph:''});
  assert.match(html,/data-card-art="simple"/);
  assert.match(html,/object-position:50% 50%;.*object-fit:cover/);
  assert.match(html,/overflow:hidden/);
  assert.equal((html.match(/class="playing-card-art"/g)||[]).length,1);
});

test('new artwork replaces shipped layout paintings while Legacy keeps its old precedence',()=>{
  for(const cardId of ['defend','gorefireSlash']){
    const cardRef={cardId},def=resolveCard(registries,cardRef);
    const simple=illustratedArtwork(cardRef,cardId,{definition:def,registries,style:'Simple'});
    assert.equal(simple.kind,'simple',cardId);
    assert.match(simple.path,/assets\/cards\/library\//);
    const legacy=illustratedArtwork(cardRef,cardId,{definition:def,registries,style:'Legacy'});
    assert.equal(legacy.path,illustratedArtwork(cardRef,cardId,{style:'Legacy'}).path);
    assert.notEqual(legacy.path,simple.path);
    const oldLayout=illustratedArtwork(cardRef,cardId,{extended:null,style:'Legacy'});
    assert.equal(cardArtFallbacks(cardRef,simple,{legacy:oldLayout})[0].path,oldLayout.path,'failure preserves the legacy renderer priority');
  }
});

test('mounted cards switch style immediately and image failure advances to legacy then outlines',()=>{
  withModalDom(()=>{
    applyCardArtStyle({});
    const card=renderCard(registries,ref,{inspection:false});
    document.body.append(card);
    const image=()=>card.querySelector('.playing-card-art');
    assert.equal(image().dataset.cardArt,'simple');
    const layer=document.createElement('span');
    layer.dataset.cardArtLayers='true';
    image().parentNode.append(layer);
    image().dispatchEvent(new Event('error'));
    assert.equal(image().dataset.cardArt,'official');
    assert.equal(card.querySelector('[data-card-art-layers]'),null);
    assert.equal(image().style.filter,'');
    image().dispatchEvent(new Event('error'));
    assert.equal(image().dataset.cardArt,'outline');
    applyCardArtStyle({cardArtStyle:'Legacy'});
    assert.equal(image().dataset.cardArt,'official');
    applyCardArtStyle({});
    assert.equal(image().dataset.cardArt,'simple');
  });
});
