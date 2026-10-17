import fs from 'node:fs';
import path from 'node:path';
import {root,repo} from './build-library.mjs';
import {loadStyleLibrary,validateStyleLibrary,validateArtCatalog,checkStyleAsset} from './art-style.mjs';
import {loadArtModules} from '../batch-06-settlements/json-modules.mjs';
import {loadLocationScenes} from '../batch-10-location-streets/scenes.mjs';
import {loadBiomeScenes} from '../batch-09-biome-architecture/scenes.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const library=loadStyleLibrary(),errors=validateStyleLibrary(library);
const moduleRoot=path.resolve(root,'../hex-world-module');
const index=read(path.join(moduleRoot,'index.json'));
const registry=read(path.join(moduleRoot,index.components));
for(const file of [...Object.values(index.art),...Object.values(index.mapArt).filter(Boolean)]){
 const catalog=read(path.join(moduleRoot,file));
 errors.push(...validateArtCatalog(catalog,path.resolve(moduleRoot,catalog.assetBase),{library,mapStyleSetId:registry.artPolicy.requiredStyleSetId}));
}
try{loadArtModules();}catch(error){errors.push(error.message);}
try{loadBiomeScenes({check:true,library});}catch(error){errors.push(error.message);}
try{loadLocationScenes({check:true,library});}catch(error){errors.push(error.message);}
const atmosphereRoot=path.resolve(root,'../batch-04-atmosphere');
const atmosphere=read(path.join(atmosphereRoot,'atmosphere.example.json'));
for(const frame of atmosphere.lightning.frames)errors.push(...checkStyleAsset(library,path.resolve(atmosphereRoot,frame.file),['weather-lightning']));
const counts={};for(const item of library.items)counts[item.review.verdict]=(counts[item.review.verdict]??0)+1;
console.log(JSON.stringify({errors,sources:library.items.length,verdicts:counts,scope:'source coverage, reviewed family/role, hashes, hex catalogs, regional candidate pools/scenes, active lightning frames biome scenes, close-location scenes and intro-map coverage'},null,2));
if(errors.length)process.exitCode=1;
