// Reproduce BEFORE-only captures using unchanged production modules and pinned art.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { serve } from '../../../../tools/serve.mjs';
import { artPath } from '../../../../tools/art-source.mjs';
const modulePath=process.env.PLAYWRIGHT_MODULE;
if(!modulePath)throw new Error('Set PLAYWRIGHT_MODULE to an existing playwright module; no dependency install required.');
const {chromium}=createRequire(import.meta.url)(modulePath);
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceHashes=JSON.parse(readFileSync(new URL('../measurements/source-hashes.json',import.meta.url)));
const rasterHashes=JSON.parse(readFileSync(new URL('../measurements/raster-hashes.json',import.meta.url)));
if(sourceHashes.baseline!=='49eca254d795d06266aa23941cb2b31fe77b27bf'||rasterHashes.release!=='ashenspire-hd-assets-v30')throw new Error('Unexpected retained baseline metadata');
for(const file of sourceHashes.files){
 const actual=digest(readFileSync(join(root,file.path),'utf8').replace(/\r\n/g,'\n'));
 if(actual!==file.lfNormalizedSha256)throw new Error(`Source differs from recorded baseline: ${file.path}`);
}
const retainedRasterRows=Object.values(rasterHashes.assets).flat();
for(const file of retainedRasterRows){
 if(!file.exists)continue;
 const bytes=readFileSync(join(root,'.art-cache',rasterHashes.release,file.pack,file.path));
 if(bytes.length!==file.bytes||digest(bytes)!==file.sha256)throw new Error(`Pinned raster differs from retained baseline: ${file.pack}/${file.path}`);
}
console.log(`Baseline guards passed: ${sourceHashes.files.length} owning source files, ${retainedRasterRows.length} retained raster rows`);
const server=await serve({root,port:8338,host:'127.0.0.1',open:false,quiet:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
const record={sourceBaseline:'49eca254d795d06266aa23941cb2b31fe77b27bf',artTag:'ashenspire-hd-assets-v30',capturedAt:new Date().toISOString(),kind:'Before-only diagnostic posed states, not a playthrough',browser:browser.version(),clockMethod:'Production stage methods with synthetic performance.now/RAF; each sampled stage RAF queue is frozen before advancing another stage. No production code or source pixels changed.',captures:[],errors:[]};
try{
 for(const [width,height] of [[1280,800],[390,844]]){
  for(const cls of ['reaver','starseer']){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference',deviceScaleFactor:1});
   page.on('pageerror',error=>{record.errors.push(`${cls}/${width}: ${error.message}`);console.log('PAGE ERROR',error.message);});
   const url=server.url+`docs/planning/player-sprite-cleanup-2026-11-26/verification/runtime-baseline.html?case=${cls}`;
   await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>window.captureReady,null,{timeout:30000,polling:100});
   const file=`runtime-${cls}-${width}-before.png`;
   await page.screenshot({path:fileURLToPath(new URL(file,import.meta.url)),fullPage:width===390});
   const receipts=await page.evaluate(()=>window.receipts);
   for(const receipt of receipts){
    const id=new URL(receipt.src).pathname.slice(1),filePath=artPath(id,{root});
    const response=await fetch(receipt.src),bytes=Buffer.from(await response.arrayBuffer());
    receipt.assetId=id;receipt.loadedImageHttpStatus=response.status;
    receipt.loadedByteSha256=createHash('sha256').update(bytes).digest('hex');
    receipt.cacheByteSha256=createHash('sha256').update(readFileSync(filePath)).digest('hex');
    receipt.cachePath=filePath;receipt.loadedBytesMatchCache=receipt.loadedByteSha256===receipt.cacheByteSha256;
    const retained=retainedRasterRows.find(row=>row.sha256===receipt.loadedByteSha256&&filePath.replaceAll('\\','/').endsWith('/'+row.pack+'/'+row.path));
    if(!retained||!receipt.loadedBytesMatchCache||response.status!==200)throw new Error(`Loaded bytes differ from recorded pinned baseline: ${id}`);
    receipt.loadedBytesMatchRetainedBaseline=true;receipt.pack=retained.pack;
   }
   const pngBytes=readFileSync(new URL(file,import.meta.url));
   record.captures.push({file,bytes:pngBytes.length,sha256:createHash('sha256').update(pngBytes).digest('hex'),url,viewport:[width,height],reducedMotion:false,effects:'off',sharedDiagnosticZoom:0.52,profile:cls==='reaver'?'reaver-greatsword-pilot':'class-smash-starseer',receipts});
   console.log(file,receipts.map(x=>`${x.pose}: ${x.drawCanvas[3].toFixed(3)}`).join(' | '));await page.close();
  }
 }
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference'});
 page.on('pageerror',error=>record.errors.push('game: '+error.message));
 for(const cls of process.env.CAPTURE_FULL_GAME==='0'?[]:['reaver']){
  const url=server.url+`index.html?shot=combat&gameProfile=core&shotClass=${cls}&shotSeed=SPRITE-AUDIT-20261126&shotEnemyCount=1`;
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt,null,{timeout:15000});
   await page.waitForTimeout(2000);
   const file=`combat-${cls}-1280-before.png`;
   await page.screenshot({path:fileURLToPath(new URL(file,import.meta.url))});
   record.captures.push({file,url,viewport:[1280,800],kind:'Full-game developer shot=combat forced baseline, not playthrough'});
   console.log(file);
  }catch(error){record.errors.push(`full-game ${cls}: ${error.message}`);console.log('full-game limitation',cls,error.message.slice(0,200));}
 }
}finally{
 writeFileSync(new URL('runtime-capture-record.json',import.meta.url),JSON.stringify(record,null,2)+'\n');
 await browser.close();await new Promise(resolve=>server.server.close(resolve));
}
