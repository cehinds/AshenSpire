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
 assert.equal(count,12);assert.equal(Object.keys(catalog.hashes).length,54);
});

test('the approved Reaver greatsword profile ships the exact preview art and preserves native geometry',()=>{
 const profile=catalog.weaponProfiles['reaver-greatsword-pilot'];
 assert.equal(profile.classId,'reaver');assert.equal(profile.weaponFamily,'greatsword');
 const manifest=JSON.parse(readFileSync(new URL('../'+profile.selections,import.meta.url)));
 const review=JSON.parse(readFileSync(new URL('../'+manifest.reviewManifest,import.meta.url)));
 const expected=['counter','defend','evade','sweep','smash','guard-break','impact-v','impact-g','impact-h','evade-1','evade-2','evade-3','attack-1','attack-2','attack-3','attack-4','attack-5','attack-6'];
 assert.deepEqual(Object.keys(profile.frames).sort(),expected.sort());
 assert.deepEqual(profile.canvas,[768,512]);assert.deepEqual(profile.stageAnchor,[384,464]);
 const packed=withAlternativeArt({assets:{}});
 const imageSize=bytes=>bytes.toString('ascii',1,4)==='PNG'?[bytes.readUInt32BE(16),bytes.readUInt32BE(20)]:[webpDimensions(bytes).width,webpDimensions(bytes).height];
 for(const choice of manifest.choices){
  const frame=profile.frames[choice.role];
  assert.equal(frame.sourceOption,choice.sourceOption);
  const source=readFileSync(new URL('../'+frame.source.path,import.meta.url));
  assert.equal(hash(source),frame.source.sha256);
  assert.deepEqual(imageSize(source),[frame.source.width,frame.source.height],'actual source dimensions must not be hardcoded landscape');
  for(const [path,expectedHash,size]of [[frame.path,frame.sha256,frame.rasterSize],[frame.lite,frame.liteSha256,frame.mobileRasterSize]]){
   const bytes=readFileSync(new URL('../'+path,import.meta.url));
   assert.equal(hash(bytes),expectedHash);assert.deepEqual(imageSize(bytes),size);
   assert.equal(packed.assets[path].common.sha256,expectedHash);
  }
  assert.ok(Math.max(...frame.mobileRasterSize)<=256);
  assert.ok(Math.abs(frame.size[0]/frame.size[1]-frame.mobileRasterSize[0]/frame.mobileRasterSize[1])<.01);
  assert.deepEqual(frame.stageAnchor,[384,464]);
  assert.deepEqual(frame.stageBounds,frame.bounds.map((value,index)=>value+frame.drawOffset[index%2]));
  assert.ok(frame.stageBounds[0]>=0&&frame.stageBounds[2]<=768&&frame.stageBounds[1]>=0&&frame.stageBounds[3]<=512);
  if(choice.aliasOf){assert.equal(frame.path,profile.frames[choice.aliasOf].path);assert.equal(frame.lite,profile.frames[choice.aliasOf].lite);continue;}
  if(!choice.preserve){
   const preview=review.frames[choice.previewId];
   assert.equal(frame.sha256,preview.sha256,'Full output must copy the exact director-approved preview bytes');
   assert.deepEqual(frame.size,preview.size,'a wide sword must not cause the approved body to shrink');
   assert.deepEqual(frame.drawOffset,preview.drawOffset);
   assert.ok(Math.abs(frame.stageBounds[3]-464)<=1,'standing support remains on the common floor');
  }
 }
 assert.equal(new Set(Object.values(profile.frames).map(frame=>frame.path)).size,15);
 assert.equal(profile.frames.smash.sha256,'9abfefe7258a3bfa2238e7c0516396c61baa5ca009a649b8408183b91fcdf6e2');
 assert.equal(profile.frames.smash.liteSha256,'7d96cbc87ccb1159befa85a192f4cdf72cea0170f7dd00b34af26074ad70a182');
 assert.equal(profile.frames['guard-break'].sha256,'74957dcadbbdcc3565168c32edc43bacd08f0ade78519233c6bbc6c2d8032deb');
 assert.equal(profile.frames['guard-break'].liteSha256,'d9bc33e53b598710b46150efd22fdf9103ce48149a4c6cefecda58c65433f6d5');
 assert.deepEqual(profile.approvedSequences.impact.holds,[2,3,1,2,3,2]);
 assert.deepEqual(profile.approvedSequences.attack.previewIds,['AT1','AT2','AT3','AT4','AT5','AT6']);
 assert.deepEqual(profile.approvedSequences.evade.previewIds,['EV1','EV2','EV3']);
});


test('preview sources remain reproducible after held Counter replaces its historical runtime asset',()=>{
 const spec=JSON.parse(readFileSync(new URL('../pose-studio/stances/update-stances/sequence-review/sources.json',import.meta.url)));
 for(const source of spec.sources){
  const bytes=readFileSync(new URL('../'+source.source,import.meta.url));
  assert.equal(hash(bytes),source.sha256,'preview input '+source.id+' must remain available at its recorded hash');
 }
 const attack3=spec.sources.find(source=>source.id==='AT3');
 const currentCounter=catalog.weaponProfiles['reaver-greatsword-pilot'].frames.counter;
 assert.notEqual(attack3.source,currentCounter.path);
 assert.notEqual(attack3.sha256,currentCounter.sha256);
 assert.equal(attack3.sha256,catalog.weaponProfiles['reaver-greatsword-pilot'].frames['attack-3'].sha256);
 assert.equal(hash(readFileSync(new URL('../'+attack3.originalSheetRecipe.path,import.meta.url))),attack3.originalSheetRecipe.sha256);
});
