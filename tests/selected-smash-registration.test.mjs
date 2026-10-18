import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {alternativeSelectedStances as catalog} from '../src/content/alternativeSelectedStances.js';
import {registerSelectedSmash} from '../tools/selected-smash-registration.mjs';
const production=JSON.parse(readFileSync(new URL('../pose-studio/stances/update-stances/selected-smash-sm03/production.json',import.meta.url)));

test('SM03 registration is reproducible from production exports and preserves every existing pilot painting',()=>{
  const rebuilt=structuredClone(catalog),profile=rebuilt.weaponProfiles['reaver-greatsword-pilot'];
  const unchanged=Object.fromEntries(Object.entries(profile.frames).filter(([key])=>!production.frames.some(frame=>frame.key===key)));
  for(const frame of production.frames) {
    delete profile.frames[frame.key];
    for(const tier of [frame.full,frame.mobile]) {
      const name=tier.path.replace('assets-display/alternative/','');delete rebuilt.hashes[name];delete rebuilt.filePaths[name];
    }
  }
  delete profile.selectedSmash;
  registerSelectedSmash(rebuilt);
  assert.deepEqual(rebuilt,catalog,'the authoritative manifest rebuilds exactly the committed catalog');
  for(const [key,frame]of Object.entries(unchanged))assert.deepEqual(profile.frames[key],frame,key+' stays unchanged');
  assert.equal(profile.frames['attack-1'].path,profile.frames.smash.path,'normal Attack keeps its original S painting');
  assert.equal(profile.frames.smash.sha256,production.sourceBookends.existingFullSha256);
  assert.equal(profile.frames.smash.liteSha256,production.sourceBookends.existingMobileSha256);
});

test('the selected Smash retains exact bookend registration, airborne height and the complete impact footprint',()=>{
  const profile=catalog.weaponProfiles['reaver-greatsword-pilot'];
  assert.deepEqual(production.sourceBookends.derivedActionOffset,
    production.sourceBookends.existingRuntimeDrawOffset.map((value,index)=>value-production.sourceBookends.sourcePadding[index]));
  for(const source of production.frames) {
    const frame=profile.frames[source.key];
    assert.deepEqual(frame.size,[768,768]);assert.deepEqual(frame.mobileRasterSize,[256,256]);
    assert.deepEqual(frame.drawOffset,[-78,-192]);
    assert.deepEqual(frame.stageBounds,source.sourceAlphaBounds.map((value,index)=>value+frame.drawOffset[index%2]));
    assert.equal(catalog.hashes[frame.path.replace('assets-display/alternative/','')],source.full.sha256);
    assert.equal(catalog.hashes[frame.lite.replace('assets-display/alternative/','')],source.mobile.sha256);
  }
  assert.equal(profile.frames['smash-airborne'].stageBounds[1],-81);
  assert.equal(profile.frames['smash-impact'].stageBounds[3],510,'dust below the ground plane remains visible');
});
