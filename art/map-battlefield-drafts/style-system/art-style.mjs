import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root,repo,buildLibrary} from './build-library.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export const familyId='ashen-spire-painted-v1';
export function loadStyleLibrary(){return read(path.join(root,'library.json'));}
/** Resolve a source by its actual path and require an approved role match. */
export function checkStyleAsset(library,absolutePath,allowedProfiles){
 const item=library.items.find(i=>path.resolve(repo,i.asset)===path.resolve(absolutePath));
 if(!item)return ['unindexed art source: '+absolutePath];
 const errors=[];
 if(item.review.verdict!=='approved'||item.styleFamilyId!==familyId)errors.push('unapproved style source: '+item.assetKey);
 if(!allowedProfiles.includes(item.profileId))errors.push(`art role mismatch: ${item.assetKey} is ${item.profileId}, expected ${allowedProfiles.join('/')}`);
 return errors;
}
export function validateArtCatalog(catalog,assetBase,{library=loadStyleLibrary(),mapStyleSetId='map-icons-painterly-v1'}={}){
 const roles={ground:['battlefield-ground'],props:['battlefield-prop'],skybox:['battlefield-backdrop'],filters:['color-filter'],weather:['weather-field','weather-particles','weather-lightning'],'map-props':['map-icon']}[catalog.id];
 if(!roles)return ['unknown art catalog role: '+catalog.id];
 const errors=[];
 for(const item of catalog.items){
  // The map pool retains inactive source history, filtered by its existing required set.
  if(catalog.id==='map-props'&&item.styleSetId!==mapStyleSetId)continue;
  if(item.styleFamilyId!==familyId)errors.push(item.id+': missing or mismatched art style family');
  const absolute=path.resolve(assetBase,item.asset);
  errors.push(...checkStyleAsset(library,absolute,roles));
  const source=library.items.find(i=>path.resolve(repo,i.asset)===absolute);
  if(source&&source.profileId!==item.styleProfileId)errors.push(item.id+': art style profile differs from reviewed source');
  for(const frame of item.animation?.frames??[])errors.push(...checkStyleAsset(library,path.resolve(assetBase,frame),[item.styleProfileId]));
 }
 return errors;
}
export function validateStyleLibrary(library=loadStyleLibrary()){
 const errors=[],guide=read(path.join(root,'style-guide.json'));
 const profiles=new Set(guide.profiles.map(f=>read(path.join(root,f)).id));
 const keys=new Set(library.items.map(i=>i.assetKey));
 if(keys.size!==library.items.length)errors.push('duplicate style library asset keys');
 const expected=buildLibrary();
 if(JSON.stringify(library)!==JSON.stringify(expected))errors.push('style library export differs from source manifests and review modules');
 for(const item of library.items){
  if(!profiles.has(item.profileId))errors.push(item.assetKey+': unknown style profile');
  if(!['approved','inactive','replace'].includes(item.review.verdict))errors.push(item.assetKey+': missing completed visual review');
  if(item.review.verdict==='approved'&&item.styleFamilyId!==guide.styleFamilyId)errors.push(item.assetKey+': missing style family');
  if(item.review.verdict==='replace'){
   const replacement=library.items.find(i=>i.assetKey===item.replacedBy);
   if(!replacement||replacement.review.verdict!=='approved'||replacement.profileId!==item.profileId)errors.push(item.assetKey+': missing approved replacement of same role');
  }
  const file=path.resolve(repo,item.asset);
  if(!fs.existsSync(file))errors.push(item.assetKey+': missing source PNG');
  else if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==item.sha256)errors.push(item.assetKey+': source hash mismatch');
 }
 return errors;
}
