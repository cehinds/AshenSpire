import fs from 'node:fs';
import {gameAsset} from '../paired-game.mjs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {checkStyleAsset,loadStyleLibrary} from '../style-system/art-style.mjs';
export const directory=path.dirname(fileURLToPath(import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const roleProfiles={backdrop:'battlefield-backdrop',prop:'battlefield-prop',ground:'battlefield-ground',filter:'color-filter',particles:'weather-particles'};
export function exportLocationScenes(moduleRoot=path.join(directory,'modules')){
 const index=read(path.join(moduleRoot,'index.json'));
 const {sceneFiles,introMap,timeOfDayFilters,assetBase,...shared}=index;
 return {...shared,assetBase:'.',timeOfDayFilters:read(path.join(moduleRoot,timeOfDayFilters)),scenes:sceneFiles.map(f=>read(path.join(moduleRoot,f))),introMap:read(path.join(moduleRoot,introMap))};
}
export function validateLocationScenes(data,{exists=fs.existsSync,library=null,atlas=null,atlasBytes=null,manifest=[]}={}){
 const errors=[],check=(yes,message)=>{if(!yes)errors.push(message);},bounded=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;
 check(data.styleFamilyId==='ashen-spire-painted-v1','invalid style family');check(data.productionBinding===null,'art module cannot bind production');
 const ids=new Set();
 const inspect=layer=>{
  check(!!roleProfiles[layer.role],`unknown layer role: ${layer.role}`);
  check(typeof layer.asset==='string'&&!path.isAbsolute(layer.asset),`asset path must be relative: ${layer.asset}`);
  if(typeof layer.asset!=='string')return;
  const absolute=path.resolve(data.assetBase,layer.asset);check(exists(absolute),`missing art asset: ${layer.asset}`);
  if(library&&roleProfiles[layer.role])errors.push(...checkStyleAsset(library,absolute,[roleProfiles[layer.role]]));
  const source=manifest.find(a=>path.resolve(data.assetBase,a.file)===absolute);
  if(source)check(source.styleProfileId===roleProfiles[layer.role],`wrong art role: ${layer.asset}`);
  if(layer.opacity!==undefined)check(bounded(layer.opacity,0,1),`invalid opacity: ${layer.asset}`);
  if(layer.previewAmbientGrade)check(bounded(layer.previewAmbientGrade.brightness,0,2)&&bounded(layer.previewAmbientGrade.saturation,0,2),`invalid ambient grade: ${layer.asset}`);
  if(layer.role==='prop'){
   const p=layer.placement??{};check(bounded(p.heightFraction,.01,2)&&(p.mode==='floor-surface'||bounded(p.baseOcclusionPixels,0,256)),`invalid prop size: ${layer.asset}`);
   if(p.mode==='side-framing'){
    check(['left','right'].includes(p.side),`invalid framing side: ${layer.asset}`);
    check(p.intentionalViewportCrop===true,`edge crop must be explicit: ${layer.asset}`);
    check(p.side==='left'?bounded(p.innerEdgeU,0,.4):bounded(p.innerEdgeU,.6,1),`framing prop blocks center: ${layer.asset}`);
   }else if(p.mode==='rear-focal')check(p.intentionalViewportCrop===false&&bounded(p.anchorU,0,1)&&bounded(p.visibleWidthFraction,.01,1),`invalid rear focal prop: ${layer.asset}`);
   else if(p.mode==='floor-surface')check(p.intentionalViewportCrop===false&&bounded(p.anchorU,0,1)&&bounded(p.anchorV,0,1)&&bounded(p.visibleWidthFraction,.01,1),`invalid floor prop: ${layer.asset}`);
   else check(false,`invalid prop placement mode: ${layer.asset}`);
  }
 };
 const filterCatalog=data.timeOfDayFilters;
 check(filterCatalog?.id==='time-of-day-filters','missing time-of-day component module');
 for(const component of Object.values(filterCatalog?.items??{}))inspect(component);
 const order={backdrop:0,prop:1,ground:2,filter:3,particles:4};
 const rank=layer=>layer.role==='prop'&&layer.placement?.mode==='floor-surface'?2.5:order[layer.role];
 for(const scene of data.scenes){
  check(!ids.has(scene.id),`duplicate scene: ${scene.id}`);ids.add(scene.id);check(scene.productionBinding===null,`${scene.id}: cannot bind production`);
  check(scene.backdropType===(scene.interior?'room-shell':'sky-and-distance'),`${scene.id}: incorrect skybox context`);
  check(['day','night','rain','interior'].includes(scene.condition),`${scene.id}: unknown condition`);
  check(scene.layers.filter(l=>l.role==='backdrop').length===1&&scene.layers.filter(l=>l.role==='ground').length===1,`${scene.id}: needs one backdrop and ground`);
  let previous=-1;
  for(const layer of scene.layers){inspect(layer);const source=manifest.find(a=>path.resolve(data.assetBase,a.file)===path.resolve(data.assetBase,layer.asset));if(scene.condition==='night'&&source&&['backdrop','ground'].includes(layer.role))check(source.tags?.lighting?.includes('night'),`${scene.id}: painted night source required`);check(rank(layer)>=previous,`${scene.id}: invalid layer order`);previous=rank(layer);}
  const timeLayers=scene.layers.filter(l=>l.role==='filter'&&l.purpose==='time-of-day');
  check(timeLayers.length<2,`${scene.id}: choose only one time-of-day filter`);
  if(!scene.interior)check(timeLayers.length===1,`${scene.id}: missing time-of-day filter`);
  for(const layer of timeLayers){const component=filterCatalog?.items?.[layer.filterId];check(!!component&&component.asset===layer.asset,`${scene.id}: unknown time-of-day component`);}
  if(scene.interior)check(scene.condition==='interior'&&!scene.layers.some(l=>l.role==='particles'||l.role==='filter'&&l.purpose!=='time-of-day'),`${scene.id}: outdoor weather cannot enter interior`);
 }
 const intro=data.introMap;check(intro.mapId==='local:crownfall'&&intro.ownerNodeId==='crownfall','intro map identity differs');
 const mapped=new Set();
 for(const item of intro.items){check(!mapped.has(item.nodeId),`duplicate intro node: ${item.nodeId}`);mapped.add(item.nodeId);check(ids.has(item.sceneId),`unknown intro scene: ${item.sceneId}`);check(item.productionBinding===null,`${item.nodeId}: cannot bind production`);for(const extra of item.additionalProps??[])inspect(extra);}
 if(atlas){
  const local=atlas.local_map_nodes.filter(n=>n.mapId===intro.mapId),expected=new Set([intro.ownerNodeId,...local.map(n=>n.nodeId)]),byId=new Map(atlas.nodes.map(n=>[n.nodeId,n]));
  check(expected.size===mapped.size&&[...expected].every(id=>mapped.has(id)),'intro node coverage differs from source map');
  for(const item of intro.items){const source=byId.get(item.nodeId),position=local.find(n=>n.nodeId===item.nodeId);check(!!source&&source.displayName===item.displayName&&source.nodeTypeId===item.nodeTypeId,`${item.nodeId}: intro source metadata differs`);if(position)check(item.position?.x===position.x&&item.position?.y===position.y,`${item.nodeId}: intro source position differs`);}
 }
 if(atlasBytes)check(createHash('sha256').update(atlasBytes).digest('hex')===intro.sourceSha256,'intro source fingerprint changed; review mapping');
 for(const camera of data.cameras)check(bounded(camera.x,0,data.canvas.width)&&bounded(camera.y,0,data.canvas.height)&&camera.width>0&&camera.height>0&&camera.x+camera.width<=data.canvas.width&&camera.y+camera.height<=data.canvas.height,`camera exceeds source canvas: ${camera.id}`);
 return errors;
}
export function loadLocationScenes({moduleRoot=path.join(directory,'modules'),check=false,library}={}){
 const data=exportLocationScenes(moduleRoot),index=read(path.join(moduleRoot,'index.json'));data.assetBase=path.resolve(moduleRoot,index.assetBase);
 const manifestFile=path.join(data.assetBase,'manifest.json');data.manifest=fs.existsSync(manifestFile)?read(manifestFile).assets:[];
 if(check){const atlasFile=gameAsset('content/source/worldAtlas.json'),bytes=fs.readFileSync(atlasFile),errors=validateLocationScenes(data,{library:library??loadStyleLibrary(),atlas:JSON.parse(bytes),atlasBytes:bytes,manifest:data.manifest});if(errors.length)throw new Error(errors.join('\n'));}
 return data;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.includes('--check')){const data=loadLocationScenes({check:true});console.log(`Validated ${data.scenes.length} close-up scenes and ${data.introMap.items.length} intro-map art candidates.`);}
 else if(process.argv.includes('--export')){fs.writeFileSync(path.join(directory,'composition.example.json'),JSON.stringify(exportLocationScenes(),null,2)+'\n');console.log('Exported portable close-location scene JSON.');}
 else throw new Error('Usage: node scenes.mjs --check | --export');
}
