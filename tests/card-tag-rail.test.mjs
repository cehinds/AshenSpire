import test from 'node:test';
import assert from 'node:assert/strict';
import { cardSideTags, cardTagRailHtml, cardCategorySigilHtml } from '../src/ui/components/cardTagSymbols.js';
import { applyCardAppearance } from '../src/ui/components/cardAppearance.js';
import { CARD_COMPONENTS } from '../src/content/cardComponents.generated.js';
import { ACTION_SIGILS, SCHOOL_SIGILS } from '../src/content/combatSigils.js';
import { contentBundle } from '../src/content/index.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { withModalDom } from './helpers/modal-dom.mjs';

const reg=createRegistries(contentBundle);
const model=(...ids)=>({tags:ids.map(id=>({id,label:id.split(':').at(-1)}))});
const effect=(status,stacks=2,extra={})=>({op:'applyStatus',status,stacks,target:'enemy',...extra});
test('rail orders category, actual damage types and up to three statuses, capped at five',()=>{
  const m=model('ability:foo','damage:fire','camp:spell','damage:slashing','school:force');
  const def={effects:[{op:'damage',amount:5},effect('bleed'),effect('weak'),effect('frost'),effect('venom')]};
  const rows=cardSideTags(m,def,reg);
  assert.deepEqual(rows.map(row=>row.id),['camp:spell','damage:fire','damage:slashing','status:bleed','status:weak']);
  assert.deepEqual(rows.slice(-2).map(row=>row.count),[2,2]);
  assert.equal(cardSideTags(model('camp:physical'),def,reg).length,4);
  assert.deepEqual(cardSideTags(model('ability:foo'),{},reg),[]);
  assert.deepEqual(cardSideTags(model(),{cardTags:[]},reg),[]);
  assert.deepEqual(cardSideTags(model(),def,{statuses:new Map()}),[]);
});
test('utility school metadata is not shown as damage while actual damage and HP counters retain it',()=>{
  for(const id of ['attune','crystalBarrier','starstoneWard','astralArmorCard']){
    const def=applyCombatExpansionCard(resolveCard(reg,{cardId:id}));
    assert.ok(def.cardTags.includes('damage:blunt'));
    const rows=cardSideTags(model(...def.cardTags),def,reg);
    assert.equal(rows[1].id,'school:alteration',id);
    assert.ok(!rows.some(row=>row.id.startsWith('damage:')),id);
  }
  const tags=model('camp:spell','damage:fire','school:fire');
  for(const def of [
    {effects:[{op:'damage',amount:3}]},
    {effects:[{op:'conditional',then:[{op:'damage',amount:3}]}]},
    {effects:[{op:'damage',amount:{f:'stat',key:'strength'}}]},
    {counterPayload:{hp:2,ward:0,poise:0}},
    {counterPayload:{effects:[{op:'damage',amount:2}]}},
  ])assert.equal(cardSideTags(tags,def,reg)[1].id,'damage:fire');
  for(const def of [{attack:{damageType:'fire'}},{effects:[{op:'damage',amount:0}]},{counterPayload:{hp:0,ward:2,poise:4}}]){
    assert.equal(cardSideTags(tags,def,reg)[1].id,'school:fire');
  }
});
test('explicit element replaces duplicate school identity before the five-icon cap',()=>{
  const def={effects:[effect('weak'),effect('frost'),effect('bleed')]};
  for(const [school,element] of [['frost','frost'],['decay','necrotic'],['illusion','psychic'],['alteration','alternation']]){
    const rows=cardSideTags(model('camp:spell','school:'+school,'element:'+element),def,reg);
    assert.deepEqual(rows.map(row=>row.id),['camp:spell','element:'+element,'status:weak','status:frost','status:bleed']);
  }
  assert.equal(cardSideTags(model('camp:spell','element:unknown','school:frost'),{},reg)[1].id,'school:frost');
});
test('stack badges never invent sums, conditional results, pressure or unknown formula values',()=>{
  for(const effects of [
    [effect('strength',2,{target:'ally'}),effect('strength',1,{target:'self'})],
    [effect('bleed'),effect('bleed',2,{if:{p:'inStance',stance:'gorefire'}})],
    [effect('bleed',{f:'stacks',status:'bleed',of:'target'})],
    [effect('bleed',3,{chance:50})],
    [{op:'buildup',status:'bleed',amount:20}],
  ])assert.equal(cardSideTags(model(),{effects},reg)[0].count,undefined);
  const extra={counterPayload:{effects:[effect('bleed')]},upcast:{effects:[effect('weak',4)]}};
  assert.deepEqual(cardSideTags(model(),extra,reg).map(row=>[row.id,row.count]),[['status:bleed',undefined],['status:weak',undefined]]);
});
test('a single direct status uses numeric resolved preview or provably constant authored stacks',()=>{
  const def={effects:[effect('bleed',{f:'add',args:[1,2]})]};
  assert.equal(cardSideTags(model(),def,reg)[0].count,3);
  assert.equal(cardSideTags(model(),def,reg,{values:[{op:'applyStatus',status:'bleed',value:7}]})[0].count,7);
  assert.equal(cardSideTags(model(),def,reg,{values:[{op:'applyStatus',status:'weak',value:9}]})[0].count,3);
});
test('real resolved card quantities remain honest across ranks and upgrades',()=>{
  for(const ref of [{cardId:'ashOath'},{cardId:'ashOath',upgraded:true},{cardId:'rend',abilityRank:2},{cardId:'hemorrhage'}]){
    const def=resolveCard(reg,ref),rows=cardSideTags(playingCardModel(reg,ref),def,reg);
    assert.ok(rows.some(row=>row.id.startsWith('status:')),ref.cardId);
    assert.ok(rows.filter(row=>row.id.startsWith('status:')).every(row=>row.count===undefined),ref.cardId);
  }
});
test('approved category and damage geometry is shared without changing Smash',()=>{
  const physical=cardCategorySigilHtml('physical');
  assert.ok(physical.includes('M16 2 29 7v10'));
  assert.ok(!physical.includes(ACTION_SIGILS.smash.shape));
  assert.ok(cardCategorySigilHtml('spell').includes(ACTION_SIGILS.spell.shape));
  for(const id of ['damage:slashing','blade'])assert.ok(cardTagRailHtml([{id,label:id}]).includes(ACTION_SIGILS.attack.shape));
  assert.ok(cardTagRailHtml([{id:'damage:blunt',label:'Blunt'}]).includes('M5 2h22v12H5'));
  for(const id of ['earth','evade','piercing','frost','fire'])assert.ok(CARD_COMPONENTS.template.symbols.tags[id].svg.body);
});
test('Earth and Alteration swap their existing glyphs across rails, aliases and authored layouts',()=>{
  const stone='<path d="m8 5 13-2 9 11-3 14-16 3L2 20Zm1 4-4 10 7 8 1-12Zm6 6-1 12 10-2 3-10Zm1-3h9l-6-6-7 2Z"/>';
  const mountains='<path d="m1 25 10-20 8 13 5-7 7 14ZM3 28h26v3H3Z"/>';
  for(const [id,shape] of [['alteration',stone],['earth',mountains]]){
    assert.equal(SCHOOL_SIGILS[id].shape,shape);
    assert.equal(SCHOOL_SIGILS[id].solid,true);
    for(const layout of [CARD_COMPONENTS.template,...Object.values(CARD_COMPONENTS.cards)])assert.equal(layout.symbols.tags[id].svg.body,shape);
    const tagIds=['school:'+id,'element:'+id,'damage:'+id,...(id==='alteration'?['element:alternation']:[])];
    for(const tagId of tagIds){
      const markup=cardTagRailHtml([{id:tagId,label:id}]);
      assert.ok(markup.includes(shape),tagId);
      withModalDom(()=>{
        const face=document.createElement('div');face.dataset.cardLayoutId='strike';
        face.innerHTML=markup;document.body.append(face);
        applyCardAppearance(face);
        assert.equal(face.querySelector('[data-tag-id] svg path').getAttribute('d'),shape.match(/d="([^"]+)"/)[1],tagId);
        assert.equal(face.querySelector('[data-tag-id]').getAttribute('aria-label'),id);
      });
    }
  }
});
test('evasion uses the boot only from authored identity or dodge payload',()=>{
  for(const def of [{evade:{charges:1}},{effects:[{op:'dodgeRoll'}]}])assert.equal(cardSideTags(model('camp:physical'),def,reg)[1].id,'effect:evade');
  assert.equal(cardSideTags(model('camp:physical'),{name:'Dodge',effects:[{op:'block'}]},reg).length,1);
  const boot=cardTagRailHtml([{id:'effect:evade',label:'Evade'}]);
  assert.ok(boot.includes(CARD_COMPONENTS.template.symbols.tags.evade.svg.body));
});
test('numeric badges survive authored symbol replacement and unsafe counts are omitted',()=>{
  withModalDom(()=>{
    const face=document.createElement('div');face.dataset.cardLayoutId='strike';
    const markup=cardTagRailHtml([{id:'status:bleed',label:'Bleed',count:2}]);
    assert.match(markup,/class="card-tag-count" aria-hidden="true">2<\/span>/);
    face.innerHTML=markup;document.body.append(face);
    const badge=face.querySelector('.card-tag-count');
    applyCardAppearance(face);
    assert.equal(face.querySelector('.card-tag-count'),badge);
    assert.equal(face.querySelector('[data-tag-id]')?.getAttribute('aria-label'),'Bleed 2');
  });
  const html=cardTagRailHtml([{id:'status:bleed',label:'<script>',count:'<img onerror=x>'}]);
  assert.ok(!html.includes('card-tag-count'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
});
test('boolean traits show no count while numeric traits keep their value',()=>{
  const tags={tags:[{id:'trait:counterstrike',label:'Counterstrike'},{id:'trait:flux',label:'Flux'}]};
  const rows=cardSideTags(tags,{traitValues:{counterstrike:true,flux:2}},reg);
  const counter=rows.find(row=>row.id==='trait:counterstrike');
  const flux=rows.find(row=>row.id==='trait:flux');
  assert.equal(counter.count,undefined);
  assert.equal(flux.count,2);
  const counterHtml=cardTagRailHtml([counter]);
  assert.ok(!counterHtml.includes('card-tag-count'));
  assert.ok(!counterHtml.includes('Counterstrike 1'));
  assert.match(counterHtml,/aria-label="Counterstrike"/);
  assert.match(cardTagRailHtml([flux]),/aria-label="Flux 2"/);
});
