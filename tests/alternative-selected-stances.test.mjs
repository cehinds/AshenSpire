import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {alternativeSelectedStances as catalog} from '../src/content/alternativeSelectedStances.js';
import {withAlternativeArt} from '../tools/asset-pack.mjs';
import {webpDimensions} from '../tools/mobileart-policy.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('all twelve runtime stances preserve the owner-selected sources and packaged Full/Lite identities',()=>{
 const choices=JSON.parse(readFileSync(new URL('../'+catalog.selections,import.meta.url))).choices;
 const packed=withAlternativeArt({assets:{}});
 let count=0;
 for(const [actor,{frames}]of Object.entries(catalog.classes))for(const [stance,frame]of Object.entries(frames)){
  const choice=choices.find(c=>c.actor===actor&&c.stance===({offensive:'attack',defensive:'defend',casting:'casting'}[stance]));
  assert.equal(frame.sourceOption,choice.sourceOption);
  assert.equal(frame.source.sha256,choice.source.sha256);
  assert.equal(hash(readFileSync(new URL('../pose-studio/stances/options-20261008/'+frame.source.path,import.meta.url))),frame.source.sha256);
  for(const [path,expected]of [[frame.path,frame.sha256],[frame.lite,frame.liteSha256]]){
   const bytes=readFileSync(new URL('../'+path,import.meta.url));
   assert.equal(hash(bytes),expected);
   const {width,height}=webpDimensions(bytes);
   assert.deepEqual([width,height],frame.rasterSize);
   assert.ok(Math.max(width,height)<=256);
   assert.equal(packed.assets[path].common.sha256,expected);
  }
  assert.deepEqual(frame.anchor,[256,464]);assert.equal(frame.bounds[3],464);
  count++;
 }
 assert.equal(count,12);assert.equal(Object.keys(catalog.hashes).length,24);
});
