import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate,neighbor,address,eligible,eligibleRewardEntries} from './validate.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
function mutate(file,change,pattern){const temp=fs.mkdtempSync(path.join(path.dirname(root),'.hex-validation-'));try{fs.cpSync(root,temp,{recursive:true});const p=path.join(temp,file);const d=JSON.parse(fs.readFileSync(p));change(d);fs.writeFileSync(p,JSON.stringify(d));assert.match(validate(temp).errors.join('\n'),pattern);}finally{fs.rmSync(temp,{recursive:true,force:true});}}
test('complete standalone module and real assets validate',()=>assert.deepEqual(validate().errors,[]));
test('odd-r neighbors are reciprocal on both parities',()=>{for(let r=0;r<4;r++)for(let d=0;d<6;d++){const [c2,r2]=neighbor(2,r,d);assert.deepEqual(neighbor(c2,r2,(d+3)%6),[2,r]);}});
test('chess labels extend beyond Z',()=>{assert.equal(address(0,1),'A2');assert.equal(address(26,0),'AA1');});
test('all any exclude and empty-any selection semantics',()=>{const rule={all:['forest'],any:['day','night'],exclude:['rain']};assert.equal(eligible(rule,['forest','day']),true);assert.equal(eligible(rule,['forest']),false);assert.equal(eligible(rule,['forest','night','rain']),false);assert.equal(eligible({all:[],any:[],exclude:[]},[]),true);});
test('rotation changes connector topology',()=>mutate('tiles/bridge.json',d=>d.orientationSteps=0,/connector mismatch/));
test('river must flow oppositely across shared edge',()=>mutate('tiles/upstream.json',d=>d.sides.SW.connector.flow='in',/river flow mismatch/));
test('missing connectors require explicit continuation',()=>mutate('tiles/upstream.json',d=>d.sides.NE.missingNeighbor='boundary',/needs continuation/));
test('all six local sides required by schema and topology',()=>mutate('tiles/westwatch.json',d=>delete d.sides.NW,/all six sides|schema/));
test('duplicate coordinates rejected',()=>mutate('tiles/rest-camp.json',d=>d.position={column:0,row:1,label:'A2'},/duplicate position/));
test('unknown art and enemy references rejected',()=>{mutate('tiles/westwatch.json',d=>d.art.groundPoolId='missing',/unknown ground-pools/);mutate('gameplay/encounter-pools.json',d=>d.items[0].entries[0].enemyTypeId='missing',/unknown enemy-types/);});
test('schema rejects invalid chance and rotation',()=>{mutate('tiles/westwatch.json',d=>d.orientationSteps=6,/invalid rotation|schema/);mutate('tiles/westwatch.json',d=>d.gameplay.encounterChance=2,/schema/);});
test('missing assets and unknown tags rejected',()=>{mutate('art/ground.json',d=>d.items[0].asset='missing.png',/missing asset/);mutate('tiles/westwatch.json',d=>d.tags.push('unknown'),/unknown tag/);});
test('map icons and battlefield props cannot share pool references',()=>{mutate('tiles/westwatch.json',d=>d.mapArt.propsPoolId='city-props',/unknown map-props-pools/);mutate('tiles/westwatch.json',d=>d.art.propsPoolId='map-town',/unknown props-pools/);});
test('map terrain remains unbound until hex exports exist',()=>mutate('tiles/westwatch.json',d=>d.mapArt.terrainPoolId='courtyard-ground',/map terrain exports pending|schema/));
test('technical map icon PNGs must exist',()=>mutate('art/map-props.json',d=>d.items[0].asset='missing-town.png',/missing asset/));

test('negative coordinates terminate with validation errors',()=>{assert.equal(address(-2,0),null);mutate('tiles/westwatch.json',d=>d.position.column=-2,/schema/);});
test('malformed selection is reported through schema',()=>mutate('art/ground.json',d=>d.items[0].selection=null,/schema/));
test('river continuation still requires valid flow',()=>mutate('tiles/upstream.json',d=>d.sides.NE.connector.flow=null,/river flow must/));
test('encounter count bounds and uniqueness are enforced',()=>{mutate('gameplay/encounter-pools.json',d=>d.items[0].enemyCount.min=9,/invalid enemy count/);mutate('gameplay/encounter-pools.json',d=>d.items[0].replacement=false,/exceeds unique types/);});
test('reveal rewards validate patch and path adjacency',()=>{mutate('gameplay/reveal.json',d=>d.items[1].tileIds=['westwatch','rest-camp'],/patch must be connected/);mutate('gameplay/reveal.json',d=>d.items[2].tileIds=['westwatch','rest-camp'],/path must use adjacent/);});
test('fog is bounded and never wraps a nonseamless canvas',()=>mutate('art/weather.json',d=>d.items.find(x=>x.id==='fog').animation.wrap=true,/schema/));
test('rest scene art overrides resolve to battle pools',()=>mutate('gameplay/rest-spots.json',d=>d.items[0].battleArtOverride.propsPoolId='missing',/unknown props-pools/));

test('discovery probabilities and encounter pool presence are enforced',()=>{mutate('gameplay/discoveries.json',d=>d.items[0].spawnChance=2,/invalid probability/);mutate('tiles/bridge.json',d=>d.gameplay.encounterPoolId=null,/requires pool/);});

test('safe rest tiles cannot reference an ambush risk',()=>mutate('gameplay/rest-spots.json',d=>d.items[0].encounterRisk=.1,/safe tile cannot reference risky rest/));
test('map display flags are typed independently',()=>mutate('map.json',d=>d.display.showTileLabels='yes',/schema/));

test('blank tile template can be registered at an unused adjacent coordinate',()=>{
 const temp=fs.mkdtempSync(path.join(path.dirname(root),'.hex-validation-'));
 try {
  fs.cpSync(root,temp,{recursive:true});
  const file=path.join(temp,'map.json'),map=JSON.parse(fs.readFileSync(file));
  map.tiles.push('templates/tile.template.json');fs.writeFileSync(file,JSON.stringify(map));
  const result=validate(temp);assert.deepEqual(result.errors,[]);assert.equal(result.tiles,7);
 } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('road maps follow roads, not merely adjacent terrain',()=>mutate('gameplay/reveal.json',d=>d.items.find(x=>x.id==='road-map-reveal').tileIds=['westwatch','downstream'],/must follow road connectors/));

test('reward eligibility filters level and previously claimed unique rewards',()=>{
 const rewards=JSON.parse(fs.readFileSync(path.join(root,'gameplay/rewards.json'))).items;
 const table={entries:[{rewardId:'proposed-provisions',weight:3},{rewardId:'proposed-legacy-relic',weight:1},{rewardId:'road-map',weight:1}]};
 assert.deepEqual(eligibleRewardEntries(table,rewards,1).map(x=>x.rewardId),['proposed-provisions','road-map']);
 assert.deepEqual(eligibleRewardEntries(table,rewards,7,['road-map']).map(x=>x.rewardId),['proposed-provisions','proposed-legacy-relic']);
 assert.equal(eligibleRewardEntries(table,rewards,20).length,0);
});
test('level bands and reward ranges reject reversed or fractional ranges',()=>{
 mutate('gameplay/level-bands.json',d=>d.items[0].encounterLevelRange=[5,2],/invalid range/);
 mutate('gameplay/rewards.json',d=>d.items[0].dropLevelRange=[1.5,3],/schema/);
});
test('unknown level bands and incompatible enemy ranges are rejected',()=>{
 mutate('tiles/bridge.json',d=>d.gameplay.levelBandId='missing',/unknown level-bands/);
 mutate('gameplay/enemy-types.json',d=>d.items.forEach(x=>x.levelRange=[20,30]),/no enemy levels overlap/);
});
test('loot quantity and rolled level coverage are validated',()=>{
 mutate('gameplay/loot-tables.json',d=>d.items[0].entries[0].quantity=[5,1],/invalid range quantity/);
 mutate('gameplay/rewards.json',d=>d.items.forEach(x=>x.dropLevelRange=[7,10]),/without eligible rewards/);
});
test('claimed reward IDs must resolve',()=>mutate('runtime/example-state.json',d=>d.claimedRewardIds=['missing'],/unknown rewards/));
