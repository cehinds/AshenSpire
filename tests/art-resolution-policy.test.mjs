import test from 'node:test';
import assert from 'node:assert/strict';
import { policyFor, twinDimensions } from '../tools/mobileart-policy.mjs';
import { artExportPlan } from '../tools/art-export-plan.mjs';

test('backgrounds fit a 256px box with aspect ratios preserved', () => {
  const p = policyFor('bg/title-city-tower.webp');
  assert.deepEqual(twinDimensions({width:1920,height:1080},p),{width:256,height:144});
  assert.deepEqual(twinDimensions({width:1024,height:1536},p),{width:171,height:256});
  assert.deepEqual(twinDimensions({width:600,height:400},p),{width:256,height:171});
  assert.equal(policyFor('environments/hollow-weald-map.webp').quality,p.quality);
});

test('four-scene atlases share the compact background ceiling', () => {
  const p=policyFor('environments/hollow-weald-combat.webp');
  assert.deepEqual(twinDimensions({width:1536,height:1024},p),{width:256,height:171});
  assert.deepEqual(twinDimensions({width:3072,height:2048},p),{width:256,height:171});
  assert.deepEqual(twinDimensions({width:1536,height:1024},policyFor('environments/legacy/BS-ENV-01-background.webp')),{width:256,height:171});
});

test('sprites stay at 256px with cheaper encoding, while cards retain their independent rule', () => {
  const p=policyFor('animations/bow/herald/BOW-01.webp');
  assert.deepEqual(twinDimensions({width:640,height:640},p),{width:256,height:256});
  assert.deepEqual(twinDimensions({width:200,height:100},p),{width:200,height:100});
  assert.ok(p.quality < 32);
  assert.equal(policyFor('cards/extended/card-strike-1024.webp').maxEdge,720);
  assert.equal(policyFor('cards/extended/card-strike-1024.webp').quality,44);
});

test('authoring exporters receive the same sprite and scenery rules with no native-size enlargement', () => {
  const plan=artExportPlan([{path:'assets/sprites/hero.webp',width:1024,height:1536},{path:'environments/far.webp',width:1920,height:1080},{path:'sprites/small.webp',width:100,height:200}]);
  assert.deepEqual(plan.map(({width,height})=>[width,height]),[[171,256],[256,144],[100,200]]);
  assert.equal(plan[0].quality,policyFor('sprites/hero.webp').quality);
  assert.equal(plan[1].alphaQuality,policyFor('environments/far.webp').alphaQuality);
  assert.throws(()=>artExportPlan([{path:'sprites/bad.webp',width:0,height:480}]),/positive integer/);
});


test('reviewed desktop scene exports fit 1280 by 720 without changing phone or other asset policy', () => {
  const rows = [{path:'environments/scene-forest.webp',width:1920,height:1080},
    {path:'environments/scene-landmark.webp',width:1536,height:1024},
    {path:'environments/scene-small.webp',width:200,height:100},
    {path:'environments/scene-portrait.webp',width:1024,height:1536}];
  const phoneBefore = artExportPlan(rows);
  const desktop = artExportPlan(rows, {profile:'desktop-scenes'});
  assert.deepEqual(desktop.map(({width,height})=>[width,height]), [[1280,720],[1080,720],[200,100],[480,720]]);
  assert.ok(desktop.every(row=>row.quality===78 && row.alphaQuality===80));
  assert.deepEqual(artExportPlan(rows), phoneBefore, 'requesting desktop scenes cannot alter the shared phone policy');
  assert.deepEqual(phoneBefore.map(({width,height})=>[width,height]), [[256,144],[256,171],[200,100],[171,256]]);
  for (const path of ['sprites/hero.webp','cards/portrait.webp','environments/unreviewed.webp'])
    assert.throws(()=>artExportPlan([{path,width:1536,height:1024}],{profile:'desktop-scenes'}),/reviewed scene layer/);
});
