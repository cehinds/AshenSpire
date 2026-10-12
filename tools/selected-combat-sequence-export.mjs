// Production export from approved review rasters. No image generation or body refitting.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const recipePath='pose-studio/stances/update-stances/sequence-production.json';
const recipe=JSON.parse(readFileSync(resolve(root,recipePath)));
const reviewBytes=readFileSync(resolve(root,recipe.reviewManifest));
const review=JSON.parse(reviewBytes),reviewDir=dirname(resolve(root,recipe.reviewManifest));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalogPath=resolve(root,'src/content/alternativeSelectedStances.js');
const match=readFileSync(catalogPath,'utf8').match(/^export const alternativeSelectedStances = (.+);\r?$/m);
if(!match)throw new Error('Missing selected stances catalog');
const catalog=JSON.parse(match[1]),previous=catalog.weaponProfiles[recipe.id];
const preserved=new Map();
for(const choice of recipe.choices.filter(choice=>choice.preserve)){
 const frame=previous.frames[choice.role];
 for(const [path,expected]of [[frame.path,frame.sha256],[frame.lite,frame.liteSha256]]){
  if(sha(readFileSync(resolve(root,path)))!==expected)throw new Error('Preserved source changed: '+path);
 }
 preserved.set(choice.role,frame);
}
const inputs=recipe.choices.filter(choice=>!choice.preserve&&!choice.aliasOf).map(choice=>{
 const preview=review.frames[choice.previewId],bytes=readFileSync(resolve(reviewDir,preview.imagePath));
 if(sha(bytes)!==preview.sha256)throw new Error('Approved preview changed: '+choice.previewId);
 const original=choice.role==='attack-3'?recipe.legacyAttack3Source:preview.source;
 const originalPath=original.path||original.source;
 if(sha(readFileSync(resolve(root,originalPath)))!==original.sha256)throw new Error('Original approved source changed: '+originalPath);
 return {choice,preview,bytes,dataUrl:'data:image/webp;base64,'+bytes.toString('base64')};
});
const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{})});
let encoded;
try{
 const page=await browser.newPage();
 encoded=await page.evaluate(async inputs=>{
  const result=[];
  for(const {choice,preview,dataUrl}of inputs){
   const image=new Image();image.src=dataUrl;await image.decode();
   if(image.width!==preview.size[0]||image.height!==preview.size[1])throw new Error('Unexpected approved raster size: '+choice.role);
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let x0=canvas.width,y0=canvas.height,x1=0,y1=0;
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32){
    x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
   }
   const mobile=document.createElement('canvas'),factor=Math.min(1,256/Math.max(image.width,image.height));
   mobile.width=Math.round(image.width*factor);mobile.height=Math.round(image.height*factor);
   const mc=mobile.getContext('2d');mc.imageSmoothingEnabled=true;mc.imageSmoothingQuality='high';
   mc.drawImage(image,0,0,mobile.width,mobile.height);
   result.push({role:choice.role,bounds:[x0,y0,x1,y1],mobileSize:[mobile.width,mobile.height],mobile:mobile.toDataURL('image/webp',.84).split(',')[1]});
  }
  return result;
 },inputs.map(({choice,preview,dataUrl})=>({choice,preview,dataUrl})));
}finally{await browser.close();}
for(const frame of Object.values(previous.frames))for(const path of [frame.path,frame.lite]){
 const file=path.replace('assets-display/alternative/','');delete catalog.hashes[file];delete catalog.filePaths[file];
}
const frames={},outputs=[];
function register(frame){
 for(const [path,hash]of [[frame.path,frame.sha256],[frame.lite,frame.liteSha256]]){
  const file=path.replace('assets-display/alternative/','');catalog.hashes[file]=hash;catalog.filePaths[file]=path;
 }
}
for(const choice of recipe.choices){
 if(choice.aliasOf){
  if(!frames[choice.aliasOf])throw new Error('Alias base missing: '+choice.role);
  frames[choice.role]={...frames[choice.aliasOf],aliasOf:choice.aliasOf};continue;
 }
 if(choice.preserve){
  const frame=preserved.get(choice.role),offset=choice.drawOffset;
  frames[choice.role]={...frame,drawOffset:offset,stageAnchor:recipe.stageAnchor,
   stageBounds:frame.bounds.map((v,i)=>v+offset[i%2]),approvedPreviewId:choice.previewId||null};
  register(frames[choice.role]);outputs.push({role:choice.role,mode:'preserved-original-both-tiers',path:frame.path,sha256:frame.sha256,lite:frame.lite,liteSha256:frame.liteSha256});continue;
 }
 const input=inputs.find(item=>item.choice.role===choice.role),generated=encoded.find(item=>item.role===choice.role),preview=input.preview;
 const path='assets-display/alternative/'+recipe.id+'-'+choice.role+'.webp';
 const lite='assets-display/alternative/'+recipe.id+'-'+choice.role+'-mobile.webp';
 const mobile=Buffer.from(generated.mobile,'base64');
 mkdirSync(dirname(resolve(root,path)),{recursive:true});
 writeFileSync(resolve(root,path),input.bytes);writeFileSync(resolve(root,lite),mobile);
 const source=preview.source;
 const original=choice.role==='attack-3'?recipe.legacyAttack3Source:
  {path:source.source,width:source.size[0],height:source.size[1],sha256:source.sha256,
   sourceBounds:source.sourceBounds,cropBounds:source.cropBounds,scale:source.scale};
 const offset=preview.drawOffset;
 frames[choice.role]={path,lite,size:preview.size,rasterSize:preview.size,mobileRasterSize:generated.mobileSize,
  bounds:generated.bounds,anchor:recipe.stageAnchor,drawOffset:offset,stageAnchor:recipe.stageAnchor,
  stageBounds:generated.bounds.map((v,i)=>v+offset[i%2]),sha256:sha(input.bytes),liteSha256:sha(mobile),
  sourceOption:choice.sourceOption,source:{path:original.path,width:original.width,height:original.height,sha256:original.sha256},
  sourceBounds:original.sourceBounds,cropBounds:original.cropBounds,scale:original.scale,
  approvedPreview:{id:choice.previewId,path:recipe.reviewManifest,manifestSha256:sha(reviewBytes),imagePath:preview.imagePath,sha256:preview.sha256},
  bodyRegistration:{method:'reviewed pelvis projection; no weapon-bounds scale fit',sourceAnchor:source.sourceAnchor,pelvisLandmark:source.pelvisLandmark,stageAnchor:recipe.stageAnchor},
  sourceTreatment:source.sourceTreatment||'Existing owner-selected source pixels; approved crop, uniform scale and translation only'};
 register(frames[choice.role]);outputs.push({role:choice.role,mode:'approved-preview-bytes-full; resized-mobile',path,sha256:sha(input.bytes),lite,liteSha256:sha(mobile)});
}
catalog.weaponProfiles[recipe.id]={...previous,selections:recipePath,canvas:recipe.canvas,stageAnchor:recipe.stageAnchor,frames,
 approvedSequences:recipe.sequences,sourceReview:recipe.reviewManifest};
writeFileSync(catalogPath,'// Owner-selected held poses and weapon-specific pose profiles, exported from unchanged comparison artwork.\nexport const alternativeSelectedStances = '+JSON.stringify(catalog)+';\n');
writeFileSync(resolve(root,'pose-studio/stances/update-stances/sequence-production-provenance.json'),JSON.stringify({
 schemaVersion:1,tool:'tools/selected-combat-sequence-export.mjs',recipe:recipePath,
 recipeSha256:sha(readFileSync(resolve(root,recipePath))),approvedReview:recipe.reviewManifest,approvedReviewSha256:sha(reviewBytes),
 geometry:{canvas:recipe.canvas,stageAnchor:recipe.stageAnchor,note:'Logical frame height and draw offsets retain the approved body scale; Mobile raster dimensions do not change geometry.'},
 preservedRoles:[...preserved.keys()],outputs
},null,2)+'\n');
console.log('Exported '+Object.keys(frames).length+' logical frames, '+outputs.length+' unique sources; original Smash/Guard-break bytes preserved.');
