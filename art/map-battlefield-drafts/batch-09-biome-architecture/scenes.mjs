import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkStyleAsset,loadStyleLibrary} from '../style-system/art-style.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const profiles={backdrop:'battlefield-backdrop',prop:'battlefield-prop',ground:'battlefield-ground',filter:'color-filter',particles:'weather-particles'};
/** Portable JSON data; the absolute assetBase is provided only in the loaded result. */
export function exportBiomeScenes(moduleDirectory=path.join(directory,'modules')){
 const index=read(path.join(moduleDirectory,'index.json'));
 return {...index,assetBase:'.',biomes:index.biomes.map(b=>({id:b.id})),conditions:read(path.join(moduleDirectory,index.conditions)),mountains:read(path.join(moduleDirectory,index.mountains)),pools:index.biomes.flatMap(b=>read(path.join(moduleDirectory,b.pools))),presets:index.biomes.flatMap(b=>read(path.join(moduleDirectory,b.scenes)))};
}
export function validateBiomeScenes(data,{exists=fs.existsSync,manifestAssets=[],library=null}={}){
 const errors=[],ids=new Set();
 if(data.styleFamilyId!=='ashen-spire-painted-v1')errors.push('invalid styleFamilyId');
 const bounded=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
 const unique=(items,kind)=>{ids.clear();for(const item of items){if(ids.has(item.id))errors.push(`duplicate ${kind} id: ${item.id}`);ids.add(item.id);}};
 unique(data.presets,'scene');unique(data.pools,'pool');unique(data.mountains,'mountain');
 const inspect=layer=>{
  if(layer.opacity!==undefined&&!bounded(layer.opacity,0,1))errors.push(`invalid opacity: ${layer.asset}`);
  if(layer.role==='prop'&&('anchorU' in layer||'visibleWidthFraction' in layer||'maxHeightFraction' in layer||'baseOcclusionPixels' in layer)){
   if(!bounded(layer.anchorU,0,1)||!bounded(layer.visibleWidthFraction,.01,1)||!bounded(layer.maxHeightFraction,.01,1)||!bounded(layer.baseOcclusionPixels,0,256))errors.push(`invalid prop geometry: ${layer.asset}`);
  }
  if(layer.previewAmbientGrade&&(!bounded(layer.previewAmbientGrade.brightness,0,2)||!bounded(layer.previewAmbientGrade.saturation,0,2)))errors.push(`invalid ambient grade: ${layer.asset}`);
  if(!profiles[layer.role]){errors.push(`invalid role: ${layer.role}`);return;}
  if(path.isAbsolute(layer.asset)){errors.push(`absolute asset path: ${layer.asset}`);return;}
  const absolute=path.resolve(data.assetBase,layer.asset);
  if(!exists(absolute))errors.push(`missing asset: ${layer.asset}`);
  const entry=manifestAssets.find(a=>path.resolve(data.assetBase,a.file)===absolute);
  if(entry&&entry.styleProfileId!==profiles[layer.role])errors.push(`role mismatch: ${layer.asset} expected ${profiles[layer.role]}, got ${entry.styleProfileId}`);
  if(library)errors.push(...checkStyleAsset(library,absolute,[profiles[layer.role]]));
 };
 for(const pool of data.pools)for(const item of pool.items)inspect({...item,role:pool.role});
 for(const mountain of data.mountains)inspect(mountain);
 for(const scene of data.presets){
  const order={backdrop:0,prop:1,ground:2,filter:3,particles:4};let previous=-1;
  for(const layer of scene.layers){if(layer.role==='prop'&&layer.anchorU===undefined)errors.push(`${scene.id}: invalid prop geometry: missing anchorU`);inspect(layer);if(order[layer.role]<previous)errors.push(`${scene.id}: invalid layer order`);previous=order[layer.role];}
  const ground=scene.layers.find(l=>l.role==='ground');
  if(!ground||!scene.layers.some(l=>l.role==='backdrop'))errors.push(`${scene.id}: requires backdrop and ground`);
  if(scene.interior){if(scene.condition!=='local-ambient'||!scene.timeIndependent||scene.precipitation!=='none'||scene.layers.some(l=>['filter','particles'].includes(l.role)))errors.push(`${scene.id}: indoor weather or time dependence`);}
  else {
   if(!ground?.asset.endsWith(`ground-street-${scene.condition}.png`))errors.push(`${scene.id}: wrong ground condition`);
   if(!scene.layers.some(l=>l.role==='backdrop'&&l.asset.endsWith(`backdrop-${scene.condition}.png`)))errors.push(`${scene.id}: wrong backdrop condition`);
   if(scene.condition==='night'&&scene.location==='town'&&!scene.layers.some(l=>l.role==='prop'&&l.asset===`${scene.biome}/prop-town-night.png`))errors.push(`${scene.id}: painted town night prop required`);
   if(scene.condition==='night'&&['city','castle','dungeon-entrance'].includes(scene.location)&&!scene.layers.some(l=>l.role==='prop'&&l.previewAmbientGrade?.brightness===.48&&l.previewAmbientGrade?.saturation===.65))errors.push(`${scene.id}: explicit night ambient grade required`);
  }
 }
 for(const biome of data.biomes)for(const condition of data.conditions)for(const location of ['city','town','castle','dungeon-entrance'])if(!data.presets.some(s=>s.biome===biome.id&&s.condition===condition.id&&s.location===location))errors.push(`missing coverage: ${biome.id}/${location}/${condition.id}`);
 return errors;
}
export function loadBiomeScenes({moduleDirectory=path.join(directory,'modules'),check=false,library}={}){
 const data=exportBiomeScenes(moduleDirectory);data.assetBase=path.resolve(moduleDirectory,read(path.join(moduleDirectory,'index.json')).assetBase);
 const manifestFile=path.join(data.assetBase,'manifest.json');
 const manifestAssets=fs.existsSync(manifestFile)?read(manifestFile).assets:[];
 for(const scene of data.presets)for(const layer of scene.layers){const source=manifestAssets.find(a=>a.file===layer.asset);if(source)layer.sourceMetrics=Object.fromEntries(['width','height','visibleBoundsAt32','medianCenterHorizonY'].filter(k=>source[k]!==undefined).map(k=>[k,source[k]]));}
 if(check){const errors=validateBiomeScenes(data,{manifestAssets,library:library??loadStyleLibrary()});if(errors.length)throw new Error(errors.join('\n'));}
 return data;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--check')){const data=loadBiomeScenes({check:true});console.log(`Validated ${data.presets.length} scenes, ${data.pools.length} pools, ${data.mountains.length} mountains.`);}
