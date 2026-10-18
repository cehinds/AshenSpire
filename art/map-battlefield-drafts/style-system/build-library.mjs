import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=path.dirname(fileURLToPath(import.meta.url));
export const repo=path.resolve(root,'../../..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function profile(asset){
 const file=asset.file??asset.png,name=path.basename(file);
 if(asset.png||path.basename(name).startsWith('map-'))return 'map-icon';
 if(name.includes('ground'))return 'battlefield-ground';
 if(name.includes('props')||name.includes('prop-'))return 'battlefield-prop';
 if(name.includes('sky')||name.includes('backdrop'))return 'battlefield-backdrop';
 if(name.includes('filter-'))return 'color-filter';
 if(name.includes('lightning'))return 'weather-lightning';
 if(file.startsWith('particles/'))return 'weather-particles';
 if(name.includes('fog'))return 'weather-field';
 throw new Error('Unclassified source '+name);
}
export function buildLibrary(){
 const catalog=read(path.resolve(root,'../catalog.json'));
 const reviews=new Map();
 for(const file of ['audit-map-icons.json','audit-grounds.json','audit-props.json','audit-atmosphere.json','audit-corrections-ground.json','audit-corrections-atmosphere.json','audit-biome-architecture.json','audit-location-streets.json','audit-floor-props.json'])if(fs.existsSync(path.join(root,file)))for(const item of read(path.join(root,file)).items)reviews.set(item.assetKey,item);
 const manifests=catalog.batches.map(b=>({id:b.id,file:path.resolve(root,'..',b.manifest)}));
 manifests.push({id:'technical-map-icons',file:path.resolve(repo,'art/map-battlefield-drafts/technical-map-icons/manifest.json')});
 const replacements=fs.existsSync(path.join(root,'replacements.json'))?read(path.join(root,'replacements.json')).items:[];
 const items=manifests.flatMap(batch=>read(batch.file).assets.map(asset=>{
  const assetKey=batch.id+'/'+asset.id,profileId=profile(asset),review=reviews.get(assetKey);
  const historical=profileId==='map-icon'&&['technical-map-icons','batch-01','batch-02','batch-03'].includes(batch.id);
  const verdict=historical?'inactive':review?.sha256===asset.sha256?review.verdict:'pending';
  return {assetKey,replacedBy:replacements.find(r=>r.assetKey===assetKey)?.replacementAssetKey??null,asset:path.relative(repo,path.resolve(path.dirname(batch.file),asset.file??asset.png)),sourceManifest:path.relative(root,batch.file),sourceAssetId:asset.id,sha256:asset.sha256??createHash('sha256').update(fs.readFileSync(path.resolve(path.dirname(batch.file),asset.file??asset.png))).digest('hex'),profileId,styleFamilyId:verdict==='approved'?'ashen-spire-painted-v1':null,review:{verdict,reason:historical?'Historical icon excluded by matching collection policy.':review?.sha256===asset.sha256?review.reason:'Awaiting visual review of this exact source hash.'}};
 }));
 return {formatVersion:1,status:'draft-art-direction-library',assetBase:'../../..',styleGuide:'style-guide.json',items};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const library=buildLibrary();fs.writeFileSync(path.join(root,'library.json'),JSON.stringify(library,null,2)+'\n');
 console.log(`Indexed ${library.items.length} original sources.`);
}
