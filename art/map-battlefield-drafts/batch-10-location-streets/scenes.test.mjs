import test from 'node:test';
import {gameAsset} from '../paired-game.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadLocationScenes,validateLocationScenes,exportLocationScenes,directory} from './scenes.mjs';
const fixture=()=>loadLocationScenes();
const validate=(data,extra={})=>validateLocationScenes(data,{exists:()=>true,...extra});
const atlasBytes=fs.readFileSync(gameAsset('content/source/worldAtlas.json'));
const atlas=JSON.parse(atlasBytes);
test('requested settings retain86 source references with the legacy combined floor unselected',()=>{
 const data=fixture(),brief=JSON.parse(fs.readFileSync(path.join(directory,'brief.json')));
 assert.equal(data.scenes.length,28);assert.equal(data.introMap.items.length,12);assert.deepEqual(validate(data,{atlas,atlasBytes}),[]);
 const expected=new Set(Object.entries(brief.settings).flatMap(([id,s])=>brief.assetNames.filter(r=>!s.reuse?.[r]).map(r=>id+'/'+r+'.png')));
 const used=new Set(data.scenes.flatMap(s=>s.layers.map(l=>l.asset)).filter(f=>!f.startsWith('../')));
 assert.equal(expected.size,86);assert.deepEqual([...expected].filter(f=>!used.has(f)),['castle-throne-room/ground.png']);assert.ok([...used].every(f=>expected.has(f)));
});
test('portable export remains identical to the modules and uses paths relative to its directory',()=>{const out=exportLocationScenes();assert.equal(out.assetBase,'.');assert.ok(!('sceneFiles' in out));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'composition.example.json'))),out);});
test('source map identities, names, positions and full Crownfall coverage are checked',()=>{
 const data=fixture();data.introMap.items.pop();assert.match(validate(data,{atlas}).join('\n'),/intro node coverage/);
 const changed=fixture();changed.introMap.items.find(i=>i.position).position.x=.99;assert.match(validate(changed,{atlas}).join('\n'),/source position differs/);
});
test('stale intro fingerprints and unknown scene references are rejected',()=>{const data=fixture();data.introMap.sourceSha256='bad';data.introMap.items[0].sceneId='missing';assert.match(validate(data,{atlasBytes}).join('\n'),/fingerprint changed/);assert.match(validate(data).join('\n'),/unknown intro scene/);});
test('side framing requires an explicit crop policy and a clear central corridor',()=>{
 const data=fixture(),prop=data.scenes[0].layers.find(l=>l.role==='prop');prop.placement.intentionalViewportCrop=false;prop.placement.innerEdgeU=.5;
 assert.match(validate(data).join('\n'),/edge crop must be explicit/);assert.match(validate(data).join('\n'),/blocks center/);
});
test('invalid geometry, opacity and grading fail before composition',()=>{
 const data=fixture(),prop=data.scenes[0].layers.find(l=>l.role==='prop');prop.placement.heightFraction=Infinity;prop.opacity=2;prop.previewAmbientGrade={brightness:-1,saturation:1};
 assert.match(validate(data).join('\n'),/invalid prop size/);assert.match(validate(data).join('\n'),/invalid opacity/);assert.match(validate(data).join('\n'),/invalid ambient grade/);
});
test('a throne is a rear focal prop while reused architectural pieces retain their own roles',()=>{
 const data=fixture(),throne=data.scenes.find(s=>s.id==='castle-throne-room').layers.find(l=>l.id==='prop-left');assert.equal(throne.placement.mode,'rear-focal');assert.equal(throne.placement.intentionalViewportCrop,false);
 const bad=fixture(),ground=bad.scenes[0].layers.find(l=>l.role==='ground');assert.match(validate(bad,{manifest:[{file:ground.asset,styleProfileId:'battlefield-prop'}]}).join('\n'),/wrong art role/);
});
test('cave, tunnel and dungeon interiors exclude outdoor weather',()=>{
 const data=fixture(),scene=data.scenes.find(s=>s.id==='cave-interior');scene.layers.push({role:'particles',asset:'../batch-04-atmosphere/particles/rain.png'});assert.match(validate(data).join('\n'),/outdoor weather cannot enter interior/);
});
test('painted night floors and backdrops cannot be silently replaced by daytime materials',()=>{
 const data=fixture(),scene=data.scenes.find(s=>s.id==='city-street-night'),ground=scene.layers.find(l=>l.role==='ground');assert.match(validate(data,{manifest:[{file:ground.asset,styleProfileId:'battlefield-ground',tags:{lighting:['day']}}]}).join('\n'),/painted night source required/);
});
test('duplicates, missing art, wrong order and live production bindings fail',()=>{
 const data=fixture();data.scenes[1].id=data.scenes[0].id;data.scenes[0].layers.reverse();data.scenes[0].productionBinding='live';
 assert.match(validate(data,{exists:()=>false}).join('\n'),/missing art asset/);assert.match(validate(data).join('\n'),/duplicate scene/);assert.match(validate(data).join('\n'),/invalid layer order/);assert.match(validate(data).join('\n'),/cannot bind production/);
});

test('time-of-day components remain separate from weather and appear once per outdoor recipe',()=>{
 const data=fixture();assert.deepEqual(Object.keys(data.timeOfDayFilters.items),['day','night']);
 for(const scene of data.scenes.filter(s=>!s.interior)){
  const layer=scene.layers.filter(l=>l.purpose==='time-of-day');assert.equal(layer.length,1);
  assert.equal(layer[0].filterId,scene.condition==='night'?'night':'day');
 }
 const rain=data.scenes.find(s=>s.id==='city-street-rain');assert.equal(rain.layers.filter(l=>l.role==='filter').length,2);
 const bad=fixture();bad.scenes[0].layers.push(structuredClone(bad.scenes[0].layers.find(l=>l.purpose==='time-of-day')));
 assert.match(validate(bad).join('\n'),/choose only one time-of-day/);
 const unknown=fixture();unknown.scenes[0].layers.find(l=>l.purpose==='time-of-day').asset='missing.png';
 assert.match(validate(unknown).join('\n'),/unknown time-of-day component/);
});
test('interiors can opt into a time tint while still excluding outdoor weather',()=>{
 const data=fixture(),scene=data.scenes.find(s=>s.id==='cave-interior');scene.layers.push(structuredClone(data.timeOfDayFilters.items.night));
 assert.deepEqual(validate(data),[]);
 scene.layers[scene.layers.length-1].purpose='weather';assert.match(validate(data).join('\n'),/outdoor weather cannot enter interior/);
});

test('indoor skyboxes are room shells and rugs remain separate from bare ground and chairs',()=>{
 const data=fixture(),scene=data.scenes.find(s=>s.id==='castle-throne-room');
 assert.equal(scene.backdropType,'room-shell');
 assert.equal(scene.layers.find(l=>l.role==='ground').asset,'dungeon-corridor/ground.png');
 assert.ok(scene.layers.some(l=>l.id==='prop-left'&&l.asset==='castle-throne-room/prop-left.png'));
 const rug=scene.layers.find(l=>l.id==='runner-rug');assert.equal(rug.placement.mode,'floor-surface');
 assert.deepEqual(validate(data),[]);
 rug.placement.anchorV=2;assert.match(validate(data).join('\n'),/invalid floor prop/);
 const bad=fixture(),room=bad.scenes.find(s=>s.id==='castle-throne-room');room.layers.unshift(room.layers.pop());assert.match(validate(bad).join('\n'),/invalid layer order/);
});
