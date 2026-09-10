import test from 'node:test';
import assert from 'node:assert/strict';
import { locationPresentation as data } from '../src/content/generated/locationPresentation.js';
import { resolveLocationPresentation, presentationProblems } from '../src/model/locationPresentation.js';
import { combatEnvironment } from '../src/model/environmentArt.js';
import { locationScene } from '../src/content/locationScenes.js';

test('every node has a valid compatible scene and inspection agrees with combat', () => {
  assert.deepEqual(presentationProblems(), []);
  for (const {nodeId,profileId} of data.nodeProfiles) {
    const run = {mapNodeId:nodeId,seedString:'presentation-qa',floor:1};
    const selection = resolveLocationPresentation({...run,nodeId});
    assert.equal(selection.profileId,profileId);
    assert.equal(locationScene(nodeId,run).id,combatEnvironment(run).scene.id);
    assert.equal(combatEnvironment(run).scene.id,combatEnvironment({...run,floor:100,turn:8}).scene.id);
    assert.deepEqual(run,{mapNodeId:nodeId,seedString:'presentation-qa',floor:1});
  }
});

test('night selection and missing-night fallback retain the same setting and biome', () => {
  const exact=resolveLocationPresentation({profileId:'hollow-weald/forest',timeId:'night'});
  assert.equal(exact.timeId,'night');assert.equal(exact.timeFallback,false);
  const fallback=resolveLocationPresentation({profileId:'pale-marches/road',timeId:'night'});
  assert.equal(fallback.settingId,'road');assert.equal(fallback.regionId,'pale-marches');assert.equal(fallback.timeFallback,true);
});

test('weighted pools vary by seed and compatible saved choices survive serialization', () => {
  const input={nodeId:'pale-marches:01:1',seedString:'save'};
  const selected=resolveLocationPresentation(input);
  assert.equal(resolveLocationPresentation({...input,seedString:'changed',savedSceneId:selected.sceneId}).sceneId,selected.sceneId);
  assert.deepEqual(resolveLocationPresentation(input),resolveLocationPresentation(JSON.parse(JSON.stringify(input))));
  const seen=new Set(Array.from({length:40},(_,i)=>resolveLocationPresentation({...input,seedString:String(i)}).sceneId));assert.ok(seen.size>1);
});

test('authoring mistakes fail with their IDs', () => {
  const bad=structuredClone(data);bad.sceneProfiles.push({...bad.sceneProfiles[0],weight:0});
  assert.ok(presentationProblems(bad).some(e=>e.includes(bad.sceneProfiles[0].profileId)));
  bad.nodeProfiles[0].profileId='unknown';assert.ok(presentationProblems(bad).some(e=>e.includes(bad.nodeProfiles[0].nodeId)));
});
