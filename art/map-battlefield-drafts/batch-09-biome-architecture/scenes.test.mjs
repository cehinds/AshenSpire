import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadBiomeScenes,validateBiomeScenes,exportBiomeScenes} from './scenes.mjs';
const fixture=()=>loadBiomeScenes();
const validate=(data,extra={})=>validateBiomeScenes(data,{exists:()=>true,...extra});
test('portable modules cover three biomes, all conditions, thirty-nine scenes and 45 sources',()=>{const data=fixture();assert.equal(data.presets.length,39);assert.equal(data.pools.length,39);assert.equal(data.mountains.length,6);assert.deepEqual(validate(data),[]);assert.equal(exportBiomeScenes().assetBase,'.');assert.ok(exportBiomeScenes().biomes.every(b=>Object.keys(b).join(',')==='id'));});
test('duplicate scene IDs fail',()=>{const data=fixture();data.presets[1].id=data.presets[0].id;assert.match(validate(data).join('\n'),/duplicate scene id/);});
test('invalid layer role fails',()=>{const data=fixture();data.presets[0].layers[1].role='map-icon';assert.match(validate(data).join('\n'),/invalid role/);});
test('map icon cannot enter a prop pool',()=>{const data=fixture(),pool=data.pools.find(p=>p.role==='prop'),item=pool.items[0];assert.match(validate(data,{manifestAssets:[{file:item.asset,styleProfileId:'map-icon'}]}).join('\n'),/role mismatch/);});
test('ground cannot use a prop source and conditions must match',()=>{const data=fixture(),layer=data.presets[0].layers.find(l=>l.role==='ground');layer.asset='desert/prop-castle.png';assert.match(validate(data,{manifestAssets:[{file:layer.asset,styleProfileId:'battlefield-prop'}]}).join('\n'),/role mismatch/);assert.match(validate(data).join('\n'),/wrong ground condition/);});
test('missing files fail',()=>assert.match(validateBiomeScenes(fixture(),{exists:()=>false}).join('\n'),/missing asset/));
test('neutral city night props require explicit preview ambient grade',()=>{const data=fixture(),scene=data.presets.find(s=>s.location==='city'&&s.condition==='night');delete scene.layers.find(l=>l.role==='prop').previewAmbientGrade;assert.match(validate(data).join('\n'),/explicit night ambient grade/);});
test('dungeon interiors reject weather and time dependence',()=>{const data=fixture(),scene=data.presets.find(s=>s.interior);scene.layers.push({role:'particles',asset:'../batch-04-atmosphere/particles/rain.png'});assert.match(validate(data).join('\n'),/indoor weather/);});
test('missing biome condition coverage fails',()=>{const data=fixture();data.presets=data.presets.filter(s=>s.id!=='snowy-castle-rain');assert.match(validate(data).join('\n'),/missing coverage: snowy\/castle\/rain/);});

test('mismatched style family fails',()=>{const data=fixture();data.styleFamilyId='other';assert.match(validate(data).join('\n'),/invalid styleFamilyId/);});
test('town night requires painted night prop',()=>{const data=fixture();data.presets.find(s=>s.location==='town'&&s.condition==='night').layers.find(l=>l.role==='prop').asset='desert/prop-town-cluster.png';assert.match(validate(data).join('\n'),/painted town night prop required/);});
test('editable geometry, opacity, and grading must be finite and bounded',()=>{for(const [field,value] of [['anchorU',NaN],['visibleWidthFraction',0],['maxHeightFraction',2],['baseOcclusionPixels',-1]]){const data=fixture();data.presets[0].layers.find(l=>l.role==='prop')[field]=value;assert.match(validate(data).join('\n'),/invalid prop geometry/);}const data=fixture();data.presets[0].layers[0].opacity=Infinity;data.presets[0].layers[1].previewAmbientGrade={brightness:-1,saturation:3};assert.match(validate(data).join('\n'),/invalid opacity/);assert.match(validate(data).join('\n'),/invalid ambient grade/);});

test('outdoor dungeon entrances cover weather while interiors stay independent',()=>{const data=fixture();assert.equal(data.presets.filter(s=>s.location==='dungeon-entrance').length,9);for(const scene of data.presets.filter(s=>s.location==='dungeon-entrance'))assert.ok(scene.layers.some(l=>l.asset.endsWith('prop-dungeon-entrance.png')));const scene=data.presets.find(s=>s.location==='dungeon-entrance'&&s.condition==='night');delete scene.layers.find(l=>l.role==='prop').previewAmbientGrade;assert.match(validate(data).join('\n'),/explicit night ambient grade/);});

test('portable export matches the editable modules and resolves asset paths from this directory',()=>{assert.deepEqual(JSON.parse(readFileSync(new URL('./composition.example.json',import.meta.url),'utf8')),exportBiomeScenes());});
