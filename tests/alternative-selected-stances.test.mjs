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

// Restored from the removed pose-studio era: the shipped Reaver greatsword profile's
// own data and art. The parts that read pose-studio selection/review manifests are
// archived on the `tools-archive` branch.
test('the Reaver greatsword profile ships its pinned art and preserves native geometry',()=>{
 const profile=catalog.weaponProfiles['reaver-greatsword-pilot'];
 assert.equal(profile.classId,'reaver');assert.equal(profile.weaponFamily,'greatsword');
 const expected=['counter','defend','evade','sweep','smash','guard-break','impact-v','impact-g','impact-h','evade-1','evade-2','evade-3','attack-1','attack-2','attack-3','attack-4','attack-5','attack-6','smash-takeoff','smash-airborne','smash-impact','sweep-windup','sweep-contact','sweep-finish'];
 assert.deepEqual(Object.keys(profile.frames).sort(),expected.sort());
 assert.deepEqual(profile.canvas,[768,512]);assert.deepEqual(profile.stageAnchor,[384,464]);
 const packed=withAlternativeArt({assets:{}});
 const imageSize=bytes=>bytes.toString('ascii',1,4)==='PNG'?[bytes.readUInt32BE(16),bytes.readUInt32BE(20)]:[webpDimensions(bytes).width,webpDimensions(bytes).height];
 for(const [role,frame]of Object.entries(profile.frames)){
  for(const [path,expectedHash,size]of [[frame.path,frame.sha256,frame.rasterSize],[frame.lite,frame.liteSha256,frame.mobileRasterSize]]){
   const bytes=readFileSync(artPath(path));
   assert.equal(hash(bytes),expectedHash);assert.deepEqual(imageSize(bytes),size);
   assert.equal(packed.assets[path].common.sha256,expectedHash);
  }
  assert.ok(Math.max(...frame.mobileRasterSize)<=256);
  assert.ok(Math.abs(frame.size[0]/frame.size[1]-frame.mobileRasterSize[0]/frame.mobileRasterSize[1])<.01);
  assert.deepEqual(frame.stageAnchor,[384,464]);
  assert.deepEqual(frame.stageBounds,frame.bounds.map((value,index)=>value+frame.drawOffset[index%2]));
  // Sweep and smash motion frames legitimately reach past the 768x512 canvas.
  if(/^(sweep|smash-)/.test(role))continue;
  assert.ok(frame.stageBounds[0]>=0&&frame.stageBounds[2]<=768&&frame.stageBounds[1]>=0&&frame.stageBounds[3]<=512);
 }
 assert.equal(new Set(Object.values(profile.frames).map(frame=>frame.path)).size,21);
 assert.equal(profile.frames.smash.sha256,'9abfefe7258a3bfa2238e7c0516396c61baa5ca009a649b8408183b91fcdf6e2');
 assert.equal(profile.frames.smash.liteSha256,'7d96cbc87ccb1159befa85a192f4cdf72cea0170f7dd00b34af26074ad70a182');
 assert.equal(profile.frames['guard-break'].sha256,'74957dcadbbdcc3565168c32edc43bacd08f0ade78519233c6bbc6c2d8032deb');
 assert.equal(profile.frames['guard-break'].liteSha256,'d9bc33e53b598710b46150efd22fdf9103ce48149a4c6cefecda58c65433f6d5');
 assert.deepEqual(profile.approvedSequences.impact.holds,[2,3,1,2,3,2]);
 assert.deepEqual(profile.approvedSequences.attack.previewIds,['AT1','AT2','AT3','AT4','AT5','AT6']);
 assert.deepEqual(profile.approvedSequences.evade.previewIds,['EV1','EV2','EV3']);
});
