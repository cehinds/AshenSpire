import test from 'node:test';
import {artPath} from '../tools/art-source.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {alternativeSelectedStances as catalog} from '../src/content/alternativeSelectedStances.js';
import {withAlternativeArt} from '../tools/asset-pack.mjs';
import {webpDimensions} from '../tools/mobileart-policy.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Original source bytes/PNG dimensions/recipe reproducibility are checked in AI-Art's source-contract CI.
// Game owns these selection links, verified runtime bytes and native geometry.
test('all twelve runtime stances preserve packaged Full/Lite identities',()=>{
 const packed=withAlternativeArt({assets:{}});
 let count=0;
 for(const [actor,{frames}]of Object.entries(catalog.classes))for(const [stance,frame]of Object.entries(frames)){
  for(const [path,expected]of [[frame.path,frame.sha256],[frame.lite,frame.liteSha256]]){
   const bytes=readFileSync(artPath(path));
   assert.equal(hash(bytes),expected);
   const {width,height}=webpDimensions(bytes);
   assert.deepEqual([width,height],frame.rasterSize);
   assert.ok(Math.max(width,height)<=256);
   assert.equal(packed.assets[path].common.sha256,expected);
  }
  assert.deepEqual(frame.anchor,[256,464]);assert.equal(frame.bounds[3],464);
  count++;
 }
 assert.equal(count,12);assert.equal(Object.keys(catalog.hashes).length,66);
});

