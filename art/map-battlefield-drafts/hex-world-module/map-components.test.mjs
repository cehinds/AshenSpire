import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from './validate.mjs';
import {loadMapComponents,mapArtCandidates,optionalComponentCandidates,resolvedObjectGameplay,buildComponentMapping} from './map-components.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
function mutate(file,change,pattern){
 const temp=fs.mkdtempSync(path.join(path.dirname(root),'.map-components-test-'));
 try{fs.cpSync(root,temp,{recursive:true});const p=path.join(temp,file),data=JSON.parse(fs.readFileSync(p));change(data);fs.writeFileSync(p,JSON.stringify(data));const errors=validate(temp).errors;if(pattern)assert.match(errors.join('\n'),pattern);else assert.deepEqual(errors,[]);}finally{fs.rmSync(temp,{recursive:true,force:true});}
}

test('all historical icons and 25 matching painted icons have component mappings',()=>{
 const data=loadMapComponents();assert.equal(data.components.length,25);assert.equal(data.art.items.length,64);
 assert.deepEqual(validate().errors,[]);
});
test('all component choices use one painted style without historical fallback',()=>{
 const data=loadMapComponents();
 for(const component of data.components){
  const candidates=mapArtCandidates(data,component.id);
  assert.equal(candidates.length,1,component.id);
  assert.equal(candidates[0].styleSetId,'map-icons-painterly-v1');
  assert.equal(candidates[0].variantRole,'painted-draft');
 }
 assert.ok(data.art.items.some(i=>i.id==='batch-01-map-rest-camp'));
 assert.ok(data.art.items.some(i=>i.id==='batch-02-map-rest-camp'));
 const complete=structuredClone(data);delete complete.registry.artPolicy.requiredStyleSetId;assert.deepEqual(mapArtCandidates(complete,'bridge',[],true),[]);
 data.art.items=data.art.items.filter(i=>i.componentId!=='town'||!i.styleSetId);
 assert.deepEqual(mapArtCandidates(data,'town',[],true),[]);
});
test('missing style coverage and falsely relabeled history fail validation',()=>{
 mutate('art/map-props.json',d=>delete d.items.find(i=>i.componentId==='town'&&i.styleSetId).styleSetId,/no art under current style/);
 mutate('art/map-props.json',d=>d.items.find(i=>i.id==='technical-town').styleSetId='map-icons-painterly-v1',/style set differs from source/);
 mutate('map-components.json',d=>delete d.artPolicy.requiredStyleSetId,/schema/);
 mutate('map-components.json',d=>d.artPolicy.requiredStyleSetId='other-style',/style guide differs/);
 mutate('map-components.json',d=>d.artPolicy.styleGuide='missing.json',/missing or invalid style guide/);
 mutate('map-components.json',d=>delete d.artPolicy.styleGuide,/schema/);
});
test('optional discoveries resolve object types without occupying route slots',()=>{
 const data=loadMapComponents(),rule=data.objects.optionalRules.find(r=>r.id==='forest-road-landmarks'),tile=read('tiles/forest-road.json');
 const candidates=optionalComponentCandidates(data,rule,tile);
 assert.deepEqual(candidates.map(c=>c.componentId),['trainer','treasure']);
 assert.equal(candidates.find(c=>c.componentId==='treasure').gameplayOverrides.lootTableId,'travel-supplies');
 const town=read('tiles/westwatch.json');assert.equal(optionalComponentCandidates(data,{...rule,eligibleTileIds:['westwatch']},town).length,0);
});
test('gameplay inheritance supports component defaults and explicit instance overrides',()=>{
 const data=loadMapComponents(),tile=read('tiles/forest-road.json'),treasure=data.components.find(c=>c.id==='treasure');
 const result=resolvedObjectGameplay(tile,treasure,{lootTableId:'river-cache',trainerId:null});
 assert.equal(result.levelBandId,tile.gameplay.levelBandId);assert.equal(result.lootTableId,'river-cache');assert.equal(result.trainerId,null);
});
test('generated portable object mapping matches catalogs',()=>assert.deepEqual(read('map-component-mapping.json'),buildComponentMapping()));
test('unknown object component and tile backlinks fail',()=>{
 mutate('map-objects.json',d=>d.instances[0].componentId='missing',/unknown component/);
 mutate('tiles/bridge.json',d=>d.mapArt.objectIds=[],/missing tile object backlink/);
});
test('unmapped source art and incorrect provenance fail',()=>{
 mutate('art/map-props.json',d=>d.items=d.items.filter(i=>i.id!=='batch-01-map-bridge-stone'),/unmapped source map asset/);
 mutate('art/map-props.json',d=>d.items[0].sourceAssetId='missing',/unknown source asset/);
 mutate('art/map-props.json',d=>d.items[0].asset=d.items[1].asset,/source asset path mismatch/);
});
test('cross-component art pools and duplicate source aliases fail',()=>{
 mutate('art/map-props.json',d=>d.pools[0].itemIds.push('technical-town'),/crosses component types/);
 mutate('art/map-props.json',d=>{d.items[1].sourceManifest=d.items[0].sourceManifest;d.items[1].sourceAssetId=d.items[0].sourceAssetId;},/duplicate source mapping/);
});
test('bridge connectivity, upright art and paired travel endpoints are required',()=>{
 mutate('map-objects.json',d=>d.instances[1].tileId='upstream',/requires road connector/);
 mutate('map-objects.json',d=>d.instances[1].placement.rotationDegrees=60,/upright object cannot rotate/);
 mutate('map-objects.json',d=>d.instances[1].componentId='portal',/required paired link/);
});
test('discovery component references and optional rule mappings fail when inconsistent',()=>{
 mutate('gameplay/discoveries.json',d=>d.items[0].entries[0].componentId='missing',/unknown discovery component/);
 mutate('map-objects.json',d=>d.optionalRules[0].discoveryPoolId='missing',/unknown discovery pool/);
 mutate('map-objects.json',d=>d.optionalRules[0].eligibleTileIds=['bridge'],/tile discovery pool mapping differs|no eligible component/);
});
test('invalid placement coordinates and object save references fail',()=>{
 mutate('map-objects.json',d=>d.instances[0].placement.u=2,/schema/);
 mutate('runtime/example-state.json',d=>d.mapObjectStates[0].objectId='missing',/unknown map object/);
});

test('clearing an encounter association also clears its inherited chance',()=>{
 const data=loadMapComponents(),tile=read('tiles/bridge.json'),component=data.components.find(c=>c.id==='bridge');
 const result=resolvedObjectGameplay(tile,component,{encounterPoolId:null});assert.equal(result.encounterPoolId,null);assert.equal(result.encounterChance,0);
 mutate('map-objects.json',d=>d.instances[1].gameplayOverrides.encounterPoolId=null);
});
test('conditional artwork validates and is selected in the right context',()=>{
 mutate('art/map-props.json',d=>d.items.find(i=>i.componentId==='signpost'&&i.styleSetId).selection.all=['road']);
 const data=loadMapComponents();data.art.items.find(i=>i.componentId==='signpost'&&i.styleSetId).selection.all=['road'];
 assert.equal(mapArtCandidates(data,'signpost').length,0);assert.equal(mapArtCandidates(data,'signpost',['road']).length,1);
});
