import fs from 'node:fs';
import {loadMapComponents,validateMapComponents} from './map-components.mjs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {directions,neighbor,address} from './hex-geometry.mjs';
import {validateEdge,compareEdges} from './hex-adjacency.mjs';
import {loadGeneration,validateGenerationDefinitions,validateGeneratedLayout} from './hex-generation.mjs';
import {loadStyleLibrary,validateArtCatalog} from '../style-system/art-style.mjs';
export {directions,neighbor,address};
export function eligible(rule,tags){return rule.all.every(t=>tags.includes(t))&&(!rule.any.length||rule.any.some(t=>tags.includes(t)))&&!rule.exclude.some(t=>tags.includes(t));}
export function eligibleRewardEntries(table,rewards,level,claimed=[]){
 const byId=new Map(rewards.map(r=>[r.id,r]));
 return table.entries.filter(e=>{const r=byId.get(e.rewardId);return r&&level>=r.dropLevelRange[0]&&level<=r.dropLevelRange[1]&&!(r.repeatPolicy==='once-per-run'&&claimed.includes(r.id));});
}
function coversRange(ranges,[min,max]){
 let next=min;
 for(const [lo,hi]of [...ranges].sort((a,b)=>a[0]-b[0])){if(lo>next)break;if(hi>=next)next=hi+1;if(next>max)return true;}
 return next>max;
}
export function validate(root=path.dirname(fileURLToPath(import.meta.url))){
 const errors=[];const check=(ok,msg)=>{if(!ok)errors.push(msg);};
 const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));const index=read('index.json');const map=read(index.map);
 const docs=new Map([['index.json',index],[index.map,map]]);
 const componentData=loadMapComponents(root);
 docs.set(index.components,componentData.registry);docs.set(index.objects,componentData.objects);
 for(const module of componentData.modules)docs.set(module.file,module.data);
 for(const p of [...Object.values(index.generation),...Object.values(index.templates??{}),...Object.values(index.catalogs),...Object.values(index.art),...Object.values(index.mapArt).filter(Boolean),...Object.values(index.gameplay),index.runtimeExample,...map.tiles])docs.set(p,read(p));
 const schemaCheck=spawnSync('python',['-c',`import json,sys,jsonschema,pathlib
root=pathlib.Path(sys.argv[1]); schema=json.loads((root/'schemas/module.schema.json').read_text()); validator=jsonschema.Draft202012Validator(schema)
for name in json.loads(sys.argv[2]):
 for error in validator.iter_errors(json.loads((root/name).read_text())): print(name+': schema '+'.'.join(map(str,error.path))+': '+error.message)
`,root,JSON.stringify([...docs.keys()])],{encoding:'utf8'});
 if(schemaCheck.status!==0)errors.push('Schema validation requires Python jsonschema: '+(schemaCheck.stderr||schemaCheck.error));
 else if(schemaCheck.stdout.trim())errors.push(...schemaCheck.stdout.trim().split('\n'));
 if(errors.length)return {errors,documents:docs.size,tiles:map.tiles.length};
 const generationData=loadGeneration(root);
 errors.push(...validateGenerationDefinitions(generationData));
 errors.push(...validateGeneratedLayout(read(index.generation.example),generationData));
 const tags=new Set(read(index.catalogs.tags).items.map(x=>x.id));
 const styleLibrary=loadStyleLibrary();
 const sets={};
 for(const [p,d] of docs){
  check(fs.existsSync(path.resolve(root,path.dirname(p),d.$schema)),`${p}: missing schema`);
  const items=d.items??[];const ids=items.map(x=>x.id);check(new Set(ids).size===ids.length,`${p}: duplicate IDs`);sets[d.id]=new Set(ids);
  function walk(v){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(k==='tags'&&Array.isArray(x))for(const t of x)check(tags.has(t),`${p}: unknown tag ${t}`);if(k==='selection'){check(['all','any','exclude'].every(k=>Array.isArray(x[k])),`${p}: malformed selection`);for(const ts of Object.values(x))for(const t of ts)check(tags.has(t),`${p}: unknown selection tag ${t}`);}if(['spawnChance','encounterChance','encounterRisk','healFraction'].includes(k))check(Number.isFinite(x)&&x>=0&&x<=1,`${p}: invalid probability ${k}`);if(['levelRange','dropLevelRange','recommendedPlayerLevelRange','encounterLevelRange','rewardLevelRange','quantity'].includes(k)&&Array.isArray(x))check(Array.isArray(x)&&x.length===2&&x.every(n=>Number.isSafeInteger(n)&&n>=1)&&x[0]<=x[1],`${p}: invalid range ${k}`);if(k==='weight')check(Number.isFinite(x)&&x>0,`${p}: invalid weight`);if(k==='productionBinding')check(x===null,`${p}: proposal cannot bind production`);walk(x);}}walk(d);
  if(d.kind==='art'){
   errors.push(...validateArtCatalog(d,path.resolve(root,d.assetBase),{library:styleLibrary,mapStyleSetId:componentData.registry.artPolicy.requiredStyleSetId}));
   const poolIds=d.pools.map(x=>x.id);check(new Set(poolIds).size===poolIds.length,`${p}: duplicate pool IDs`);sets[d.id+'-pools']=new Set(poolIds);
   for(const x of items){for(const file of [x.asset,...(x.animation?.frames??[])])check(fs.existsSync(path.resolve(root,d.assetBase,file)),`${p}: missing asset ${file}`);if(x.overscan?.descriptorFile)check(fs.existsSync(path.resolve(root,x.overscan.descriptorFile)),`${p}: missing overscan descriptor`);}
   for(const pool of d.pools){for(const id of pool.itemIds)check(ids.includes(id),`${p}: unknown art item ${id}`);check(pool.draw.min>=0&&pool.draw.max>=pool.draw.min,`${p}: invalid draw range`);check(pool.replacement||pool.draw.max<=pool.itemIds.length,`${p}: draw exceeds unique items`);}
  }
 }
 const ref=(set,id,where)=>check(id===null||sets[set]?.has(id),`${where}: unknown ${set} reference ${id}`);
 for(const x of read(index.gameplay['encounter-pools']).items){check(x.enemyCount.min<=x.enemyCount.max,`${x.id}: invalid enemy count range`);check(x.replacement||x.enemyCount.max<=new Set(x.entries.map(e=>e.enemyTypeId)).size,`${x.id}: enemy count exceeds unique types`);for(const e of x.entries)ref('enemy-types',e.enemyTypeId,x.id);}
 for(const x of read(index.gameplay['loot-tables']).items)for(const e of x.entries)ref('rewards',e.rewardId,x.id);
 for(const x of read(index.gameplay['rest-spots']).items)for(const [k,id]of Object.entries(x.battleArtOverride??{}))ref(k.replace('PoolId','')+'-pools',id,x.id);
 for(const x of read(index.gameplay.rewards).items)for(const id of x.effectIds??[])ref('effects',id,x.id);
 for(const x of read(index.gameplay.effects).items)if(x.revealRuleId)ref('reveal',x.revealRuleId,x.id);
 for(const x of read(index.gameplay.trainers).items)ref('rewards',x.costRewardId,x.id);
 for(const x of read(index.gameplay.discoveries).items)for(const e of x.entries)ref({trainer:'trainers',rest:'rest-spots',loot:'loot-tables'}[e.kind],e.refId,x.id);
 for(const template of generationData.templates)ref('biomes',template.biomeId,template.id);
 const levelBands=read(index.gameplay['level-bands']).items;
 const rewards=read(index.gameplay.rewards).items;
 const encounters=read(index.gameplay['encounter-pools']).items;
 const enemies=read(index.gameplay['enemy-types']).items;
 const tiles=map.tiles.map(read);const byPos=new Map();const ids=new Set();const regions=new Set(map.regions.map(x=>x.id));
 for(const t of tiles){
  const {column:c,row:r,label}=t.position;const key=`${c},${r}`;check(!ids.has(t.id),`duplicate tile ID ${t.id}`);ids.add(t.id);check(!byPos.has(key),`duplicate position ${key}`);byPos.set(key,t);
  check(Number.isInteger(c)&&Number.isInteger(r)&&c>=map.bounds.minColumn&&c<=map.bounds.maxColumn&&r>=map.bounds.minRow&&r<=map.bounds.maxRow,`${t.id}: out of bounds`);check(label===address(c,r),`${t.id}: wrong address`);
  check(Number.isInteger(t.orientationSteps)&&t.orientationSteps>=0&&t.orientationSteps<6,`${t.id}: invalid rotation`);check(Object.keys(t.sides).length===6&&directions.every(d=>t.sides[d]),`${t.id}: must author all six sides`);
  check(regions.has(t.regionId),`${t.id}: unknown region`);ref('biomes',t.biomeId,t.id);
  ref('map-props-pools',t.mapArt?.propsPoolId,t.id);
  check(t.mapArt?.terrainPoolId===null,`${t.id}: map terrain exports pending`);
  for(const k of Object.keys(index.art))ref(k+'-pools',t.art[k+'PoolId'],t.id);
  for(const [k,s]of Object.entries({encounterPoolId:'encounter-pools',lootTableId:'loot-tables',revealRuleId:'reveal',restSpotId:'rest-spots',trainerId:'trainers',discoveryPoolId:'discoveries'}))ref(s,t.gameplay[k],t.id);
  for(const q of t.gameplay.questIds)ref('quests',q,t.id);for(const e of t.gameplay.environmentEffectIds)ref('effects',e,t.id);
  if(t.tags.includes('safe')) {
   check(t.gameplay.encounterChance===0,`${t.id}: safe tile cannot have encounter chance`);
   const rest=read(index.gameplay['rest-spots']).items.find(x=>x.id===t.gameplay.restSpotId);
   if(rest)check(rest.encounterRisk===0,`${t.id}: safe tile cannot reference risky rest`);
  }
  ref('level-bands',t.gameplay.levelBandId,t.id);
  const band=levelBands.find(b=>b.id===t.gameplay.levelBandId);
  if(band){
   const pool=encounters.find(p=>p.id===t.gameplay.encounterPoolId);
   if(pool&&t.gameplay.encounterChance>0)check(pool.entries.some(e=>{const enemy=enemies.find(x=>x.id===e.enemyTypeId);return enemy&&Math.max(enemy.levelRange[0],band.encounterLevelRange[0])<=Math.min(enemy.levelRange[1],band.encounterLevelRange[1]);}),`${t.id}: no enemy levels overlap area band`);
   const loot=read(index.gameplay['loot-tables']).items.find(x=>x.id===t.gameplay.lootTableId);
   if(loot){const ranges=loot.entries.map(e=>rewards.find(r=>r.id===e.rewardId)?.dropLevelRange).filter(Boolean);check(coversRange(ranges,band.rewardLevelRange),`${t.id}: loot table leaves reward levels without eligible rewards`);}
  }
  check(t.gameplay.encounterChance===0||t.gameplay.encounterPoolId!==null,`${t.id}: positive encounter chance requires pool`);
  check(t.gameplay.encounterChance>=0&&t.gameplay.encounterChance<=1,`${t.id}: invalid encounter chance`);
 }
 for(const t of tiles)for(let local=0;local<6;local++){
  const edge=t.sides[directions[local]];if(!edge)continue;const world=(local+t.orientationSteps)%6;const n=byPos.get(neighbor(t.position.column,t.position.row,world).join(','));
  for(const error of validateEdge(edge,generationData.profiles))errors.push(`${t.id}/${directions[local]}: ${error}`);
  check(['boundary','continues'].includes(edge.missingNeighbor),`${t.id}: missing edge policy`);
  if(edge.connector?.kind==='river')check(['in','out'].includes(edge.connector.flow),`${t.id}: river flow must be in or out`);
  if(!n){if(edge.connector)check(edge.missingNeighbor==='continues',`${t.id}: open connector needs continuation`);continue;}
  const other=n.sides[directions[((world+3-n.orientationSteps)%6+6)%6]];if(!other)continue;
  const match=compareEdges(edge,other,generationData.profiles);if(!match.compatible)errors.push(`${t.id}/${directions[local]}: incompatible touching edge with ${n.id}: ${match.reasons.join(' ')}`);
  check((edge.connector?.kind??null)===(other.connector?.kind??null),`${t.id}/${directions[local]}: connector mismatch with ${n.id}`);
  if(edge.connector?.kind==='river')check(['in','out'].includes(edge.connector.flow)&&other.connector?.flow!==edge.connector.flow&&['in','out'].includes(other.connector?.flow),`${t.id}: river flow mismatch`);
 }
 const reached=new Set();const pending=tiles.length?[tiles[0]]:[];
 while(pending.length){const t=pending.pop();if(reached.has(t.id))continue;reached.add(t.id);for(let i=0;i<6;i++){const n=byPos.get(neighbor(t.position.column,t.position.row,i).join(','));if(n&&!reached.has(n.id))pending.push(n);}}
 check(reached.size===tiles.length,'example map tiles must form one connected component');
 for(const x of read(index.gameplay.quests).items)for(const id of x.targetTileIds)check(ids.has(id),`${x.id}: unknown target tile ${id}`);
 const tilesById=new Map(tiles.map(t=>[t.id,t]));
 const adjacent=(a,b)=>{const t=tilesById.get(a),u=tilesById.get(b);return !!t&&!!u&&directions.some((_,i)=>neighbor(t.position.column,t.position.row,i).join(',')===[u.position.column,u.position.row].join(','));};
 for(const rule of read(index.gameplay.reveal).items){if(!rule.tileIds)continue;for(const id of rule.tileIds)check(ids.has(id),`${rule.id}: unknown reveal tile ${id}`);
  if(rule.mode==='ordered-path')check(rule.tileIds.slice(1).every((id,i)=>adjacent(rule.tileIds[i],id)),`${rule.id}: reveal path must use adjacent tiles`);
  if(rule.requiredConnector){
   check(['road','river'].includes(rule.requiredConnector),`${rule.id}: unknown required connector`);
   const follows=rule.tileIds.slice(1).every((id,i)=>{
    const t=tilesById.get(rule.tileIds[i]),u=tilesById.get(id);if(!t||!u)return false;
    const world=directions.findIndex((_,j)=>neighbor(t.position.column,t.position.row,j).join(',')===[u.position.column,u.position.row].join(','));
    if(world<0)return false;
    const local=((world-t.orientationSteps)%6+6)%6;
    return t.sides[directions[local]].connector?.kind===rule.requiredConnector;
   });
   check(follows,`${rule.id}: reveal path must follow ${rule.requiredConnector} connectors`);
  }
  if(rule.mode==='connected-patch'){const seen=new Set(),queue=rule.tileIds.slice(0,1);while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);for(const next of rule.tileIds)if(!seen.has(next)&&adjacent(id,next))queue.push(next);}check(seen.size===rule.tileIds.length,`${rule.id}: reveal patch must be connected`);}
  check(rule.revealsFogOnly===true&&rule.triggersOnEnterDiscoveries===false&&rule.marksVisited===false,`${rule.id}: reward reveal must affect fog only`);
 }
 const runtime=read(index.runtimeExample);for(const id of runtime.claimedRewardIds??[])ref('rewards',id,'runtime claimedRewardIds');check(runtime.mapId===map.id,'runtime map mismatch');check(new Set(runtime.tiles.map(x=>x.tileId)).size===runtime.tiles.length,'duplicate runtime tile');for(const t of runtime.tiles)check(ids.has(t.tileId),`runtime unknown tile ${t.tileId}`);
 errors.push(...validateMapComponents(componentData,tiles,runtime));
 return {errors,documents:docs.size,tiles:tiles.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const result=validate(process.argv[2]);console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;}
