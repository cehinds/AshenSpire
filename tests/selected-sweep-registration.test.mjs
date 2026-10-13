import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {alternativeSelectedStances as catalog} from '../src/content/alternativeSelectedStances.js';
import {registerSelectedSweep} from '../tools/selected-sweep-registration.mjs';
const production=JSON.parse(readFileSync(new URL('../pose-studio/stances/update-stances/selected-sweep-sw09/production.json',import.meta.url)));

test('SW09 registration is reproducible and only replaces its selected held stance plus three actions',()=>{
  const rebuilt=structuredClone(catalog),profile=rebuilt.weaponProfiles['reaver-greatsword-pilot'];
  const unchanged=Object.fromEntries(Object.entries(profile.frames).filter(([key])=>!production.frames.some(frame=>frame.key===key)));
  for(const frame of production.frames) {
    delete profile.frames[frame.key];
    for(const tier of [frame.full,frame.mobile]) {
      const name=tier.path.replace('assets-display/alternative/','');delete rebuilt.hashes[name];delete rebuilt.filePaths[name];
    }
  }
  delete profile.selectedSweep;
  registerSelectedSweep(rebuilt);
  assert.deepEqual(rebuilt,catalog,'the production source rebuilds exactly the committed catalog');
  for(const [key,frame]of Object.entries(unchanged))assert.deepEqual(profile.frames[key],frame,key+' remains unchanged');
  assert.equal(profile.frames['attack-1'].path,profile.frames.smash.path,'normal Attack retains its original S source');
  assert.equal(profile.frames.smash.sourceOption,'greatsword-smash-05');
  assert.equal(profile.frames['smash-impact'].sourceOption,'SM03','the dedicated ground slam stays separate');
});

test('all corrected Sweep paintings retain the shared anatomical transform, head scale and entire blade arc',()=>{
  const profile=catalog.weaponProfiles['reaver-greatsword-pilot'];
  for(const source of production.frames) {
    const frame=profile.frames[source.key];
    assert.deepEqual(frame.size,[1024,1024]);assert.deepEqual(frame.mobileRasterSize,[256,256]);
    assert.deepEqual(frame.drawOffset,[-136,-270]);assert.deepEqual(frame.stageAnchor,[384,464]);
    assert.deepEqual([520+frame.drawOffset[0],734+frame.drawOffset[1]],[384,464],'the whole strip keeps the artist pelvis/floor anchor');
    assert.deepEqual(frame.stageBounds,source.sourceAlphaBounds.map((value,index)=>value+frame.drawOffset[index%2]));
    assert.equal(catalog.hashes[frame.path.replace('assets-display/alternative/','')],source.full.sha256);
    assert.equal(catalog.hashes[frame.lite.replace('assets-display/alternative/','')],source.mobile.sha256);
  }
  assert.deepEqual(profile.frames.sweep.stageBounds,[-67,119,543,489]);
  assert.deepEqual(profile.frames['sweep-windup'].stageBounds,[47,104,833,473]);
  assert.deepEqual(profile.frames['sweep-contact'].stageBounds,[42,127,759,471]);
  assert.deepEqual(profile.frames['sweep-finish'].stageBounds,[62,151,711,476]);
});
