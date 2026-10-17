import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const moduleRoot=path.dirname(fileURLToPath(import.meta.url));
const read=(root,file)=>JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8'));
const matches=(rule,tags)=>rule.all.every(t=>tags.includes(t))&&(!rule.any.length||rule.any.some(t=>tags.includes(t)))&&!rule.exclude.some(t=>tags.includes(t));

export function loadMapComponents(root=moduleRoot){
 const index=read(root,'index.json');
 const registry=read(root,index.components);
 const modules=registry.componentModules.map(file=>({file,data:read(root,file)}));
 return {root,index,registry,modules,components:modules.flatMap(m=>m.data.items),art:read(root,index.mapArt.props),objects:read(root,index.objects),discoveries:read(root,index.gameplay.discoveries)};
}

export function mapArtVariants(data,componentId){
 const component=data.components.find(c=>c.id===componentId);
 if(!component)throw new Error(`Unknown map component: ${componentId}`);
 const pool=data.art.pools.find(p=>p.id===component.artPoolId);
 if(!pool)throw new Error(`Missing art pool: ${component.artPoolId}`);
 return data.art.items.filter(i=>pool.itemIds.includes(i.id));
}
/** Apply the collection style before tag predicates or placeholder preferences. */
export function mapArtStyleVariants(data,componentId){
 const required=data.registry.artPolicy.requiredStyleSetId;
 return mapArtVariants(data,componentId).filter(i=>required&&i.styleSetId===required);
}
/** Return eligible art choices; a caller still owns the seeded weighted choice. */
export function mapArtCandidates(data,componentId,tags=[],allowPlaceholders=data.registry.artPolicy.allowTechnicalPlaceholders){
 const items=mapArtStyleVariants(data,componentId).filter(i=>matches(i.selection,tags));
 const painted=items.filter(i=>i.variantRole==='painted-draft');
 return painted.length?painted:allowPlaceholders?items.filter(i=>i.variantRole==='technical-placeholder'):[];
}

export function resolvedObjectGameplay(tile,component,overrides={}){
 const result={...tile.gameplay};
 for(const [key,value]of Object.entries(component.gameplayDefaults)){
  if(Array.isArray(value))result[key]=[...new Set([...(result[key]??[]),...value])];
  else if(value!==null)result[key]=value;
 }
 const resolved={...result,...overrides};
 if(overrides.encounterPoolId===null)resolved.encounterChance=0;
 return resolved;
}

export function optionalComponentCandidates(data,rule,tile){
 if(!rule.eligibleTileIds.includes(tile.id))return [];
 const byId=new Map(data.components.map(c=>[c.id,c]));
 if(data.registry.placementDefaults.excludeAuthoredLandmarks&&data.objects.instances.some(o=>o.tileId===tile.id&&byId.get(o.componentId)?.placement.occupiesLandmarkSlot))return [];
 const pool=data.discoveries.items.find(p=>p.id===rule.discoveryPoolId);if(!pool)return [];
 const tileMap=read(data.root,data.index.map),byTile=new Map(tileMap.tiles.map(f=>{const t=read(data.root,f);return [t.id,t];}));
 const distance=(a,b)=>{const aq=a.column-(a.row-(a.row%2))/2,bq=b.column-(b.row-(b.row%2))/2,dq=aq-bq,dr=a.row-b.row;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));};
 return pool.entries.filter(entry=>{
  const c=byId.get(entry.componentId);if(!c||c.placement.mode!=='optional'||c.links.required)return false;
  if(tile.tags.includes('safe')&&c.category==='encounter')return false;
  const spacing=c.placement.minSpacing??data.registry.placementDefaults.minimumDistanceSameType;
  if(data.objects.instances.some(o=>o.componentId===c.id&&byTile.has(o.tileId)&&distance(tile.position,byTile.get(o.tileId).position)<spacing))return false;
  return matches(c.placement.selection,tile.tags)&&c.placement.requiresConnectorKinds.every(kind=>Object.values(tile.sides).some(s=>s.connector?.kind===kind));
 }).map(entry=>({componentId:entry.componentId,weight:entry.weight,gameplayOverrides:{[{trainer:'trainerId',rest:'restSpotId',loot:'lootTableId'}[entry.kind]]:entry.refId}}));
}

export function validateMapComponents(data,tiles,runtime){
 const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
 const {root,registry,components,art,objects}=data;
 try{
  const guide=read(root,registry.artPolicy.styleGuide);
  check(guide.styleSetId===registry.artPolicy.requiredStyleSetId,'map components: style guide differs from required style set');
 }catch{
  errors.push('map components: missing or invalid style guide');
 }
 const byId=new Map(components.map(c=>[c.id,c]));
 check(byId.size===components.length,'map components: duplicate component IDs across modules');
 const pools=new Map(art.pools.map(p=>[p.id,p]));
 const items=new Map(art.items.map(i=>[i.id,i]));
 const manifests=new Map(registry.sourceManifests.map(f=>[f,read(root,f)]));
 const sourceKeys=new Map();
 for(const [file,manifest]of manifests){
  for(const asset of manifest.assets){
   const filename=asset.png??asset.file;
   if(asset.png||path.basename(filename).startsWith('map-'))sourceKeys.set(file+'#'+asset.id,{file:path.resolve(root,path.dirname(file),filename),asset});
  }
 }
 const seenSources=new Set();
 for(const item of art.items){
  check(byId.has(item.componentId),`${item.id}: unknown map component ${item.componentId}`);
  const key=item.sourceManifest+'#'+item.sourceAssetId,source=sourceKeys.get(key);
  check(!!source,`${item.id}: unknown source asset ${key}`);
  check(!seenSources.has(key),`${item.id}: duplicate source mapping ${key}`);seenSources.add(key);
  if(source){
   check(source.file===path.resolve(root,art.assetBase,item.asset),`${item.id}: source asset path mismatch`);
   if(item.styleSetId)check(item.styleSetId===source.asset.styleSetId,`${item.id}: style set differs from source manifest`);
  }
 }
 for(const key of sourceKeys.keys())check(seenSources.has(key),`unmapped source map asset: ${key}`);
 for(const component of components){
  const pool=pools.get(component.artPoolId);
  check(!!pool,`${component.id}: missing component art pool`);
  if(pool){check(pool.itemIds.length>0,`${component.id}: component art pool is empty`);for(const id of pool.itemIds)check(items.get(id)?.componentId===component.id,`${component.id}: art pool crosses component types`);}
  for(const item of art.items.filter(i=>i.componentId===component.id))check(pool?.itemIds.includes(item.id),`${item.id}: mapped variant missing from component pool`);
  if(pool)check(mapArtStyleVariants(data,component.id).some(i=>i.variantRole==='painted-draft'||registry.artPolicy.allowTechnicalPlaceholders&&i.variantRole==='technical-placeholder'),`${component.id}: no art under current style and placeholder policy`);
 }
 const gameplay=new Map(Object.entries(data.index.gameplay).map(([key,file])=>[key,new Set(read(root,file).items.map(i=>i.id))]));
 const scalarRefs={levelBandId:'level-bands',encounterPoolId:'encounter-pools',lootTableId:'loot-tables',restSpotId:'rest-spots',trainerId:'trainers',revealRuleId:'reveal'};
 const validateGameplay=(value,where)=>{
  for(const [key,set]of Object.entries(scalarRefs))if(key in value)check(value[key]===null||gameplay.get(set)?.has(value[key]),`${where}: unknown ${key} ${value[key]}`);
  for(const [key,set]of [['questIds','quests'],['environmentEffectIds','effects']])for(const id of value[key]??[])check(gameplay.get(set)?.has(id),`${where}: unknown ${key} ${id}`);
 };
 for(const component of components)validateGameplay(component.gameplayDefaults,component.id);
 const byTile=new Map(tiles.map(t=>[t.id,t])),byObject=new Map();
 for(const object of objects.instances){check(!byObject.has(object.id),`duplicate map object ${object.id}`);byObject.set(object.id,object);}
 const validatePlacement=(component,tile,where)=>{
  check(matches(component.placement.selection,tile.tags),`${where}: tile tags do not allow component`);
  const connectors=new Set(Object.values(tile.sides).map(s=>s.connector?.kind).filter(Boolean));
  for(const kind of component.placement.requiresConnectorKinds)check(connectors.has(kind),`${where}: requires ${kind} connector`);
 };
 for(const object of objects.instances){
  const component=byId.get(object.componentId),tile=byTile.get(object.tileId);
  check(!!component,`${object.id}: unknown component`);check(!!tile,`${object.id}: unknown tile`);
  if(!component||!tile)continue;
  validatePlacement(component,tile,object.id);validateGameplay(object.gameplayOverrides,object.id);
  check(tile.mapArt.objectIds.includes(object.id),`${object.id}: missing tile object backlink`);
  if(component.orientation.keepUpright)check(object.placement.rotationDegrees===0,`${object.id}: upright object cannot rotate with tile`);
  if(component.links.required){const target=byObject.get(object.linkedInstanceId);check(!!target&&target.id!==object.id&&target.componentId===object.componentId&&target.linkedInstanceId===object.id,`${object.id}: required paired link is missing or not reciprocal`);}
  else check(object.linkedInstanceId===null,`${object.id}: unlinked component cannot have a destination`);
  const resolved=resolvedObjectGameplay(tile,component,object.gameplayOverrides);
  validateGameplay(resolved,object.id);
  check(resolved.encounterChance===0||resolved.encounterPoolId!==null,`${object.id}: positive encounter chance requires pool`);
  if(tile.tags.includes('safe')){
   check(component.category!=='encounter',`${object.id}: enemy component cannot occupy safe tile`);
   if(resolved.restSpotId){const rest=read(root,data.index.gameplay['rest-spots']).items.find(r=>r.id===resolved.restSpotId);check(rest?.encounterRisk===0,`${object.id}: safe tile cannot host risky rest`);}
  }
 }
 for(const tile of tiles){
  for(const id of tile.mapArt.objectIds){const object=byObject.get(id);check(object?.tileId===tile.id,`${tile.id}: missing or mismatched map object ${id}`);}
  const authored=objects.instances.filter(o=>o.tileId===tile.id);
  for(const component of components)check(authored.filter(o=>o.componentId===component.id).length<=component.placement.maxPerTile,`${tile.id}: too many ${component.id} objects`);
  const primary=byObject.get(tile.mapArt.objectIds[0]);
  check(tile.mapArt.propsPoolId===(byId.get(primary?.componentId)?.artPoolId??null),`${tile.id}: primary art pool does not match component mapping`);
 }
 for(const pool of data.discoveries.items)for(const entry of pool.entries){
  const component=byId.get(entry.componentId);check(!!component,`${pool.id}: unknown discovery component ${entry.componentId}`);
  if(component)check(component.placement.mode==='optional'&&!component.links.required,`${pool.id}: discovery component requires authored placement or links`);
 }
 const ruleIds=new Set();
 for(const rule of objects.optionalRules){
  check(!ruleIds.has(rule.id),`duplicate placement rule ${rule.id}`);ruleIds.add(rule.id);
  const discovery=data.discoveries.items.find(p=>p.id===rule.discoveryPoolId);
  check(!!discovery,`${rule.id}: unknown discovery pool`);
  for(const id of rule.eligibleTileIds){
   const tile=byTile.get(id);check(!!tile,`${rule.id}: unknown eligible tile ${id}`);if(!tile)continue;
   check(tile.gameplay.discoveryPoolId===rule.discoveryPoolId,`${rule.id}: tile discovery pool mapping differs`);
   check(optionalComponentCandidates(data,rule,tile).length>0,`${rule.id}: no eligible component for ${tile.id}`);
  }
 }
 for(const outcome of runtime.mapObjectStates??[])check(byObject.has(outcome.objectId),`runtime: unknown map object ${outcome.objectId}`);
 check(new Set((runtime.mapObjectStates??[]).map(x=>x.objectId)).size===(runtime.mapObjectStates??[]).length,'runtime: duplicate map object state');
 return errors;
}

export function buildComponentMapping(root=moduleRoot){
 const data=loadMapComponents(root);
 return {formatVersion:1,status:'generated-proposal-mapping',source:'map-components.json',assetBase:data.art.assetBase,artPolicy:data.registry.artPolicy,components:data.components.map(c=>({...c,activeVariantIds:mapArtStyleVariants(data,c.id).map(a=>a.id),variants:mapArtVariants(data,c.id).map(({id,...a})=>({artItemId:id,...a}))})),authoredObjects:data.objects.instances,optionalPlacementRules:data.objects.optionalRules};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.length!==3||process.argv[2]!=='--export')throw new Error('Usage: node map-components.mjs --export');
 const mapping=buildComponentMapping();fs.writeFileSync(path.join(moduleRoot,'map-component-mapping.json'),JSON.stringify(mapping,null,2)+'\n');
 console.log(`Exported ${mapping.components.length} component mappings and ${mapping.authoredObjects.length} authored objects.`);
}
