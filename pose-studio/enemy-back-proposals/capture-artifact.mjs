import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const api=p=>JSON.parse(execFileSync('gh',['api',p],{encoding:'utf8',maxBuffer:32*1024*1024}));
const repo='cehinds/AshenSpire',branch='feature/EnemyBackSprites';
const source=api('repos/'+repo+'/branches/'+encodeURIComponent(branch)).commit.sha;
const runs=api('repos/'+repo+'/actions/workflows/feature-preview.yml/runs?branch='+encodeURIComponent(branch)+'&per_page=30').workflow_runs;
const run=runs.find(r=>r.head_sha===source&&r.conclusion==='success');assert.ok(run,'Exact current feature preview must succeed first');
const artifact=api('repos/'+repo+'/actions/runs/'+run.id+'/artifacts').artifacts.find(a=>a.name==='feature-preview-'+source&&!a.expired);assert.ok(artifact);
const dir='/tmp/enemy-rear-published-build';await mkdir(dir,{recursive:true});
execFileSync('gh',['run','download',String(run.id),'--repo',repo,'--name',artifact.name,'--dir',dir],{stdio:'inherit'});
const url='https://cehinds.github.io/AshenSpire/branches/'+branch+'/latest/';
const download=await readFile(dir+'/AshenSpire.html');
const hash=b=>createHash('sha256').update(b).digest('hex'),expectedHash=hash(download);
const bytes=download;
console.log('Capturing exact downloaded artifact; public publication remains pending');
const stamp=JSON.parse(await readFile(dir+'/buildordinal.json','utf8')),version=stamp.release+'.'+stamp.ordinal;
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE);
const out='docs/preview/features/enemy-back-sprites';await mkdir(out,{recursive:true});
const server=createServer((req,res)=>{if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}if(req.url!=='/'&&req.url!=='/AshenSpire.html'){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':'text/html'});res.end(download);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const artifactPage='http://127.0.0.1:'+server.address().port+'/AshenSpire.html';
const browser=await chromium.launch({headless:true}),records=[];let deadline;const overallDeadline=new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Overall eight-minute browser capture deadline exceeded')),480000);});
try{await Promise.race([(async()=>{
 for(const [name,width,height,actor] of [['mobile',390,844,'wyrmAspirant'],['desktop',1440,900,'courtDuelist'],['wide',1920,1080,'wyrmLord'],['tablet',820,1180,'fellWarden']]){
  console.log('Capturing exact artifact viewport',name);const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',error=>console.log('BROWSER PAGE ERROR',error.message));page.on('console',message=>{if(message.type()==='error')console.log('BROWSER CONSOLE ERROR',message.text());});page.on('requestfailed',request=>console.log('BROWSER REQUEST FAILED',request.url().slice(0,150),request.failure()?.errorText));page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(90000);
  await page.goto(artifactPage,{waitUntil:'domcontentloaded',timeout:90000});
  const game=page;await game.locator('#enemy-rear-review-open').click({timeout:90000});
  console.log('HOST FRAMES',await page.locator('iframe').evaluateAll(frames=>frames.map(frame=>({title:frame.title,attributes:[...frame.attributes].map(a=>[a.name,a.value.slice(0,100)]),rect:frame.getBoundingClientRect().toJSON()}))));const gallery=game.frameLocator('dialog iframe');
  await gallery.locator('#grid .card').first().waitFor({state:'attached',timeout:30000});console.log('HOST GEOMETRY',await page.evaluate(()=>[...document.querySelectorAll('dialog,iframe')].map(el=>({tag:el.tagName,open:el.open,title:el.title,rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity,position:getComputedStyle(el).position}))));console.log('GALLERY GEOMETRY',await gallery.locator('#grid .card').first().evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity,ancestors:[...function*(el){for(;el;el=el.parentElement)yield el;}(el)].map(el=>({tag:el.tagName,id:el.id,rect:el.getBoundingClientRect().toJSON(),display:getComputedStyle(el).display}))})));await gallery.locator('#grid .card').first().waitFor({timeout:3000});
  const allChoices=await gallery.locator('#actor option').evaluateAll(opts=>opts.map(o=>o.value));assert.equal(allChoices.length,13);const choices=name==='desktop'?allChoices:[actor];
  for(const candidate of choices){console.log('Checking deployed images',name,candidate);
   await gallery.locator('#actor').selectOption(candidate);await gallery.locator('#stance').selectOption('neutral');
   await gallery.locator('#grid img').first().waitFor();
   await gallery.locator('#grid img').evaluateAll(images=>Promise.race([Promise.all(images.map(img=>img.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('Rear images failed to decode within 30 seconds')),30000))]));
   assert.equal(await gallery.locator('#reference img').count(),1,'Original identity reference is required');await gallery.locator('#reference img').evaluate(img=>Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Source identity image failed to decode')),30000))]));assert.equal(await gallery.locator('#reference img').evaluate(img=>img.naturalWidth>0),true);assert.match(await gallery.locator('#reference').innerText(),/identity reference/);assert.equal(await gallery.locator('#grid img').count(),10);
   assert.equal(await gallery.locator('#grid img').evaluateAll(images=>images.every(img=>img.naturalWidth===512)),true);
  }
  await gallery.locator('#actor').selectOption(actor);await gallery.locator('#stance').selectOption('neutral');
  await gallery.locator('#grid img').evaluateAll(images=>Promise.race([Promise.all(images.map(img=>img.decode())),new Promise((_,reject)=>setTimeout(()=>reject(Error('Selected rear images failed to decode within 30 seconds')),30000))]));
  assert.equal(await gallery.locator('main').evaluate(main=>main.scrollWidth<=main.clientWidth),true);
  await gallery.locator('#grid').evaluate(grid=>window.scrollTo(0,grid.offsetTop-12));await page.screenshot({path:out+'/'+name+'.png',timeout:30000});console.log('VIEWPORT CHECKPOINT',name,out+'/'+name+'.png');
  records.push({name,width,height,actor,sourceCommit:source,version,digest:stamp.digest,playableUrl:url,verifiedActors:choices.length,verifiedNeutralDesigns:choices.length*10});
  await page.close();
 }
})(),overallDeadline]);}catch(error){for(const page of browser.contexts().flatMap(context=>context.pages())){await page.screenshot({path:out+'/failure.png',timeout:10000}).catch(()=>{});console.log('FAILURE FRAMES',await Promise.all(page.frames().map(async frame=>({url:frame.url().slice(0,180),text:await frame.locator('body').innerText({timeout:3000}).then(text=>text.slice(0,1500)).catch(()=>null)}))));}throw error;}finally{clearTimeout(deadline);await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,10000))]);server.closeAllConnections();await Promise.race([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);}
const tiles=await Promise.all(records.map(async(r,i)=>({input:await sharp(out+'/'+r.name+'.png').resize(512,384,{fit:'contain',background:'#111414'}).png().toBuffer(),left:(i%2)*512,top:Math.floor(i/2)*384})));
await sharp({create:{width:1024,height:768,channels:4,background:'#111414'}}).composite(tiles).png().toFile(out+'/contact-sheet.png');
const readme=await readFile('README.md','utf8'),releasePaths=[...readme.matchAll(/docs\/preview\/releases\/([^/]+)\/[^)\s]+/g)].map(m=>m[1]);
const inventoryResponse=await fetch('https://cehinds.github.io/AshenSpire/builds.json',{cache:'no-store',signal:AbortSignal.timeout(60000)});assert.ok(inventoryResponse.ok);
const inventory=await inventoryResponse.json(),release=inventory.branches.find(b=>b.branch==='release')?.builds?.[0];assert.ok(release);
const releaseVersion=release.version&&release.version.endsWith('.'+release.ordinal)?release.version:release.version+'.'+release.ordinal;
assert.ok(releasePaths.length&&releasePaths.every(v=>v===releaseVersion),'Existing release gallery changed; refresh it before README evidence');
const artifactUrl='https://github.com/'+repo+'/actions/runs/'+run.id+'/artifacts/'+artifact.id;
const record={evidenceKind:'exact-artifact-browser-capture',publicVerification:'pending-final-source-publication',feature:'EnemyBackSprites',sourceCommit:source,version,digest:stamp.digest,buildSha256:hash(bytes),buildBytes:bytes.length,capturedAt:new Date().toISOString(),playableUrl:url,workflowRun:run.id,artifactId:artifact.id,artifactUrl,releaseGallery:{version:releaseVersion,status:'verified unchanged'},records};
await writeFile(out+'/capture-record.json',JSON.stringify(record,null,2)+'\n');
const block='<!-- feature-preview:start -->\n## Feature preview — Enemy rear designs\n\n[Open the public feature preview]('+url+') — final source publication is pending; screenshots below verify the exact downloadable artifact.\n\nOpen **Rear designs** to compare 130 neutral rear-view design drafts. v01 remains provisional; stance and motion coverage is labelled separately. Artifact build '+version+' ('+stamp.digest+'), source '+source.slice(0,12)+'. The final public payload has not been verified yet.\n\n[Download this review build]('+artifactUrl+') · [Capture record]('+out+'/capture-record.json)\n\n| Mobile | Desktop | Wide | Tablet |\n| --- | --- | --- | --- |\n| ![Mobile: Wyrm Aspirant rear proposals]('+out+'/mobile.png) | ![Desktop: Court Duelist rear proposals]('+out+'/desktop.png) | ![Wide: Wyrm Lord rear proposals]('+out+'/wide.png) | ![Tablet: Fell Warden rear proposals]('+out+'/tablet.png) |\n<!-- feature-preview:end -->';
const cleaned=readme.replace(/<!-- feature-preview:start -->[\s\S]*?<!-- feature-preview:end -->\s*/,'');
await writeFile('README.md',cleaned.replace(/^(# [^\r\n]+\r?\n)/,'$1\n'+block+'\n\n'));
execFileSync(process.execPath,['tools/feature-preview.mjs','--check'],{stdio:'inherit'});
console.log(JSON.stringify(record));

const box=JSON.parse(await readFile('buildordinal.json','utf8')),changelog=await readFile('CHANGELOG.md','utf8');
const receipt='- **Rear enemy designs have a feature-only review gallery** ([#2071](https://github.com/cehinds/AshenSpire/pull/2071), `'+box.release+'.'+box.ordinal+'`). Compare 130 rear design drafts, original identity references, and three elite pilot sets with nine held poses, attack and evade clips, and static hurt and defeated reactions. Missing clips stay explicit. This draft review is not promoted: runtime alignment, playable unlocks, other motion sets, and external art publication remain pending.\n\n';
if(!changelog.includes('/pull/2071)'))await writeFile('CHANGELOG.md',changelog.replace('## 2026-10-17\n\n','## 2026-10-17\n\n'+receipt));
execFileSync(process.execPath,['tools/receipts.mjs','--check','--pr','2071'],{stdio:'inherit'});
