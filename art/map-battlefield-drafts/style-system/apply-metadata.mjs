import fs from 'node:fs';
import path from 'node:path';
import {root,repo} from './build-library.mjs';
import {loadStyleLibrary,validateStyleLibrary} from './art-style.mjs';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const library=loadStyleLibrary(),errors=validateStyleLibrary(library);
if(errors.length)throw new Error(errors.join('\n'));
const catalog=read(path.resolve(root,'../catalog.json'));
for(const batch of catalog.batches){
 const file=path.resolve(root,'..',batch.manifest),manifest=read(file);
 manifest.styleSystem={guide:'../style-system/style-guide.json',library:'../style-system/library.json'};
 for(const asset of manifest.assets){
  const item=library.items.find(i=>i.assetKey===batch.id+'/'+asset.id);
  asset.styleProfileId=item.profileId;asset.styleFamilyId=item.styleFamilyId;
  asset.styleReview={verdict:item.review.verdict,replacedBy:item.replacedBy};
 }
 write(file,manifest);
}
const moduleRoot=path.resolve(root,'../hex-world-module');
for(const file of fs.readdirSync(path.join(moduleRoot,'art')).filter(f=>f.endsWith('.json'))){
 const absolute=path.join(moduleRoot,'art',file),data=read(absolute);
 for(const item of data.items){
  const source=library.items.find(i=>path.resolve(repo,i.asset)===path.resolve(moduleRoot,data.assetBase,item.asset));
  if(!source)throw new Error('Unindexed catalog asset '+item.asset);
  if(source.review.verdict==='approved'){item.styleFamilyId=source.styleFamilyId;item.styleProfileId=source.profileId;}
  else if(data.id!=='map-props')throw new Error('Unapproved active catalog asset '+item.asset);
 }
 write(absolute,data);
}
console.log(`Applied reviewed style metadata to ${catalog.batches.length} batch manifests and six component catalogs.`);
