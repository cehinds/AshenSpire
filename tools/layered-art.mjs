import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {artPath, addDisplayRecord} from './art-source.mjs';
export const layeredManifest='assets-display/layered/manifest.json';
// One verified export set feeds both portable data URIs and web pack objects.
export function readLayeredArt(root,opts={}){
 const file=path.resolve(root,layeredManifest);
 const catalogFile=path.resolve(root,'src/content/layeredEnvironments.js');
 if(!fs.existsSync(file)){if(fs.existsSync(catalogFile))throw Error('Layered art manifest missing for runtime catalog');return [];}
 const data=JSON.parse(fs.readFileSync(file));
 if(data.schema!==1||!data.assets||typeof data.assets!=='object'||Array.isArray(data.assets))throw Error('Invalid layered art manifest');
 if(fs.existsSync(catalogFile)){
  const source=fs.readFileSync(catalogFile,'utf8'),sceneExport=source.match(/^export const LAYERED_SCENES = (.+);$/m);
  if(!sceneExport)throw Error('Malformed layered scene catalog');
  const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(key==='asset'&&typeof item==='string'&&!Object.hasOwn(data.assets,item))throw Error('Unpacked layered art reference '+item);visit(item);}};
  const hashes=source.match(/^export const LAYERED_EXPORT_HASHES = (.+);$/m);
  if(hashes){const expected=JSON.parse(hashes[1]);if(Object.keys(expected).length!==Object.keys(data.assets).length||Object.entries(expected).some(([id,sha])=>data.assets[id]?.sha256!==sha))throw Error('Layered catalog hashes differ from shipping manifest');}
  for(const match of source.matchAll(/^export const (?:LAYERED_SCENES|INTRO_LAYERED_SCENES|LAYERED_TIME_FILTERS|LAYERED_WEATHER_FILTERS) = (.+);$/gm))visit(JSON.parse(match[1]));
 }
 return Object.entries(data.assets).map(([id,record])=>{
  if(!/^assets-display\/layered\/[a-zA-Z0-9-]+\.webp$/.test(id))throw Error('Invalid layered art path '+id);
  const bytes=fs.readFileSync(artPath(id,{...opts,root})),sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==record.sha256||bytes.length!==record.bytes)throw Error('Layered art hash mismatch '+id);
  if(![record.width,record.height].every(n=>Number.isInteger(n)&&n>0))throw Error('Invalid layered art dimensions '+id);
  return {id,bytes,sha256,record};
 });
}
export function withLayeredArt(manifest,root,opts={}){
 const assets={...manifest.assets};
 for(const {id,bytes,sha256}of readLayeredArt(root,opts)){
  addDisplayRecord(assets,id,{path:id,bytes:bytes.length,sha256});
 }
 return {...manifest,count:Object.keys(assets).length,assets};
}
