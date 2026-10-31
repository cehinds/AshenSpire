import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {contentBundle} from '../src/content/index.js';
import {createRegistries} from '../src/model/registries.js';
import {playingCardDefinition} from '../src/model/playingCard.js';
import {playingCardArt,playingCardArtwork,cardArtFallbacks} from '../src/ui/cardArtwork.js';
import {simpleCardArt} from '../src/ui/cardArtComposition.js';
import {reviewedCardArtCatalog as catalog} from '../src/content/reviewedCardArt.generated.js';
import {cardArtLayersHtml} from '../src/ui/cardArtLayers.js';
import {baseCardPresentation} from '../src/content/generated/baseCards.js';
const reg=createRegistries(contentBundle);

test('every card without a dedicated illustration has a reviewed layered recipe',()=>{
  const missing=contentBundle.cards.filter(card=>!playingCardArtwork({cardId:card.id}));
  assert.equal(missing.length,156);
  assert.deepEqual(new Set(missing.map(c=>c.id)),new Set(Object.keys(catalog.records)));
  for(const card of missing){
    const ref={cardId:card.id},definition=playingCardDefinition(reg,ref),before=structuredClone(definition);
    const art=playingCardArt(ref,{definition,registries:reg,style:'Simple'});
    assert.equal(art.componentArt,catalog.records[card.id],card.id);
    assert.ok(art.componentArt.visualCues.length<=4);
    assert.equal(art.componentArt.sprites.filter(s=>s.id==='background').length,1);
    assert.ok(art.componentArt.sprites.length>=3);
    assert.ok(cardArtLayersHtml(art).includes('data-card-art-component'));
    assert.deepEqual(definition,before,'Art must not change combat data');
    assert.ok(cardArtFallbacks(ref,art).length,'Each assembly retains a fallback');
  }
});
test('dedicated illustrations, equipment and Legacy mode retain their existing routing',()=>{
  for(const card of contentBundle.cards.filter(c=>playingCardArtwork({cardId:c.id}))){
    const ref={cardId:card.id},definition=playingCardDefinition(reg,ref);
    const art=playingCardArt(ref,{definition,registries:reg,style:'Simple'});
    const previous=simpleCardArt(definition,{ref,registries:reg});
    if(previous)assert.deepEqual(art,previous);
    assert.equal(playingCardArt(ref,{definition,registries:reg,style:'Legacy'}).path,playingCardArtwork(ref));
  }
  const ref={cardId:'mindSpike'},definition=playingCardDefinition(reg,ref);
  assert.notEqual(playingCardArt(ref,{definition,registries:reg,style:'Legacy'})?.componentArt,catalog.records.mindSpike);
  const custom={...definition,equipmentProfileId:'custom-weapon'};
  assert.notEqual(playingCardArt(ref,{definition:custom,registries:reg,style:'Simple'})?.componentArt,catalog.records.mindSpike);
});
test('approved identity: cleanse fire, healing leaf, separate counter and earth pebble',()=>{
  const source=JSON.parse(readFileSync(new URL('../asset-data/card-art/reviewed-library.json',import.meta.url)));
  for(const row of source.rows){
    const ids=catalog.records[row.id].sprites.map(s=>s.assetId);
    if(row.rule==='cleanse-fire')assert.ok(ids.includes('H.object.0'));
    if(row.rule==='restore-leaf')assert.ok(ids.includes('G.object.0'));
    if(row.rule==='spell-counter'){assert.ok(ids.includes('O.object.4'));assert.ok(ids.includes('O.object.0'));}
  }
  assert.ok(catalog.records.stoneSling.sprites.some(s=>s.assetId==='mineral.pebble'));
  assert.ok(!catalog.records.stoneSling.sprites.some(s=>s.assetId==='V.object.0'));
  for(const asset of Object.values(catalog.assets))assert.match(asset.path,/^assets-display\/card-cutouts\/[A-Za-z0-9.]+\.png$/);
});
test('source JSON reproducibly compiles the applied recipes',()=>{
  execFileSync(process.execPath,['tools/export-reviewed-card-art.mjs','--check'],{cwd:new URL('../',import.meta.url)});
});
test('a canonical visual reference does not hide the reviewed card recipe',()=>{
  const ids=Object.keys(catalog.records).filter(id=>baseCardPresentation[id]?.canonicalCardRef);
  assert.ok(ids.length>=8);
  for(const id of ids){
    const definition=playingCardDefinition(reg,{cardId:id});
    const art=playingCardArt({cardId:baseCardPresentation[id].canonicalCardRef},{definition,registries:reg,style:'Simple'});
    assert.equal(art.componentArt,catalog.records[id],id);
  }
});
test('importing an edited background transform is refused before anything is written',()=>{
  const edited={schema:1,checked:[],catalog:structuredClone(catalog)};
  edited.catalog.records[Object.keys(catalog.records)[0]].sprites.find(s=>s.id==='background').transform.x+=10;
  const file=join(mkdtempSync(join(tmpdir(),'art-import-')),'edits.json');writeFileSync(file,JSON.stringify(edited));
  const before=readFileSync(new URL('../asset-data/card-art/reviewed-library.json',import.meta.url),'utf8');
  assert.throws(()=>execFileSync(process.execPath,['tools/export-reviewed-card-art.mjs','--import',file],{cwd:new URL('../',import.meta.url),stdio:'pipe'}),/Background transform edits are not supported/);
  assert.equal(readFileSync(new URL('../asset-data/card-art/reviewed-library.json',import.meta.url),'utf8'),before);
});
