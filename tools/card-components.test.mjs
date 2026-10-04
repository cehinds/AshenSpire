import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {compileCardComponents,writeCardObjects} from './card-components.mjs';
import {contentBundle} from '../src/content/index.js';
import {illustratedCardHtml,illustratedArtwork} from '../src/ui/components/illustratedCard.js';
const layout=JSON.parse(readFileSync(new URL('../src/content/card-layout.json',import.meta.url),'utf8'));
test('every card has an independent resolved object with approved left-side costs',()=>{
 const data=compileCardComponents(layout,contentBundle.cards);
 assert.equal(Object.keys(data.cards).length,contentBundle.cards.length);
 const cards=Object.values(data.cards);assert.notEqual(cards[0].layers,cards[1].layers);
 for(const card of cards){assert.equal(card.layers.find(l=>l.id==='flag').x,layout.layers.find(l=>l.id==='flag').x);assert.ok(card.layers.find(l=>l.id==='mana-icon').x<30);assert.equal(card.layers.find(l=>l.id==='title').bind,'name');}
});
test('editing one JSON coordinate propagates across all card objects',()=>{
 const edited=structuredClone(layout);edited.layers.find(l=>l.id==='flag').x=19;
 const data=compileCardComponents(edited,contentBundle.cards);
 assert.ok(Object.values(data.cards).every(c=>c.layers.find(l=>l.id==='flag').x===19));
 assert.equal(layout.layers.find(l=>l.id==='flag').x,layout.layers.find(l=>l.id==='flag').x);
});
test('live mana cost selects the exact supplied banner and never displays action',()=>{
 const model={id:'gorefireSlash',name:'Changed <title>',tags:[{label:'FIRE'}],costs:{variable:false,action:7,mana:2,stamina:7}};
 const options={rules:'Deal <span class="val">12</span> damage.',glyph:'x'};
 const combined=illustratedCardHtml(model,options);
 assert.match(combined,/Changed &lt;title&gt;/);assert.match(combined,/>2<\/div>/);assert.match(combined,/>7<\/div>/);
 assert.match(combined,/data-cost-layout="staminaMana"/);assert.match(combined,/data-component="mana-icon"/);
 assert.doesNotMatch(combined,/data-component="energy-(icon|value)"/);
 assert.ok(combined.includes(layout.artworkByCard.gorefireSlash));assert.match(combined,/-webkit-line-clamp:2/);
 const short=illustratedCardHtml({...model,costs:{...model.costs,mana:0,stamina:0}},options);
 assert.match(short,/data-cost-layout="staminaOnly"/);assert.doesNotMatch(short,/data-component="mana-(icon|value)"/);
 assert.doesNotMatch(short,/data-component="energy-(icon|value)"/);assert.match(short,/>0<\/div>/);
 const variable=illustratedCardHtml({...model,costs:{...model.costs,variable:true}},options);
 assert.match(variable,/data-card-binding="stamina"[^>]*>X<\/div>/);
 for(const [html,variant] of [[short,'staminaOnly'],[combined,'staminaMana']]){
  const height=layout.costLayouts[variant].layers.flag.h/layout.height*100;
  assert.ok(html.includes('height:'+height+'%'));
 }
});
test('release emits a separate object for every card and rejects unsafe artwork',()=>{
 const data=compileCardComponents(layout,contentBundle.cards);const out=mkdtempSync(resolve(tmpdir(),'card-release-'));writeCardObjects(data,out);
 for(const id of Object.keys(data.cards))assert.ok(existsSync(resolve(out,'cards',id+'.json')));
 const bad=structuredClone(layout);bad.layers[0].href='../secrets.png';assert.throws(()=>compileCardComponents(bad,contentBundle.cards),/unsafe/);
});

test('reviewed card/profile art survives the illustrated shell and equipment geometry stays separate',()=>{
 const gore=illustratedArtwork({cardId:'gorefireSlash'},'gorefireSlash');
 assert.equal(gore.path,layout.artworkByCard.gorefireSlash);
 const blood=illustratedArtwork({cardId:'bloodletting'},'bloodletting',{large:true});
 assert.equal(blood.path,'assets/cards/bloodletting-1024.webp');assert.equal(blood.equipment,false);
 const shield=illustratedArtwork({cardId:'guard',profileId:'shieldGuard'},'guard',{equipmentArt:'weapon.webp'});
 assert.equal(shield.kind,'official');assert.equal(shield.equipment,false);
 const fallback=illustratedArtwork({cardId:'unknown'},'unknown');assert.ok(fallback?.path);
});
