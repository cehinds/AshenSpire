import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const snapshot=JSON.parse(await readFile('/tmp/enemy-back-static/static-api/snapshot.json','utf8'));
const galleryEntry=snapshot.snap.library.body.entries.find(e=>e.id==='enemy-rear-proposals');assert.ok(galleryEntry);assert.notEqual(galleryEntry.external,true,'Mirrored gallery must remain a local Workbench route');
const canonical=JSON.parse(await readFile('pose-studio/enemy-back-proposals/manifest.json','utf8'));const resetActor=canonical.actors.find(a=>!a.proposals.length)||canonical.actors[1];
for(const id of ['wyrmAspirant','courtDuelist','wyrmLord']){const pilot=canonical.actors.find(a=>a.id===id)?.proposals.find(p=>p.id==='v01');assert.equal(pilot?.animations?.attack?.frames.length,4);assert.equal(pilot?.animations?.evade?.frames.length,4);assert.equal(Object.keys(pilot?.reactions||{}).length,2);}
const root=resolve('.'),output='/tmp/enemy-back-module-qa';
await mkdir(output,{recursive:true});
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=name.startsWith('/qa/workbench/')?'/tmp/enemy-back-static':root,relative=name.startsWith('/qa/workbench/')?name.slice('/qa/workbench'.length):name,file=resolve(base,'.'+relative);if(!file.startsWith(base+'/'))throw Error('Invalid path');const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port+'/pose-studio/enemy-back-proposals/index.html';
const embedTarget='pose-studio/enemy-back-proposals/embedded-check.html';
await writeFile(embedTarget,'<!doctype html><html><body><h1>Embedding test host</h1></body></html>');
execFileSync(process.execPath,['pose-studio/enemy-back-proposals/embed-gallery.mjs',embedTarget],{stdio:'inherit'});
const policy="default-src 'none'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; base-uri 'none'; form-action 'none'";
const embedBytes=await readFile(embedTarget,'utf8');
const sandboxTarget='pose-studio/enemy-back-proposals/sandbox-check.html';
await writeFile(sandboxTarget,'<!doctype html><meta http-equiv="Content-Security-Policy" content="'+policy.replaceAll('"','&quot;')+'"><iframe id="preview" sandbox="allow-scripts allow-pointer-lock allow-popups" style="width:100vw;height:95vh"></iframe><script>document.getElementById("preview").srcdoc='+JSON.stringify(embedBytes).replaceAll('<','\\u003c')+';</script>');
const browser=await chromium.launch({headless:true}),records=[];
try{
 for(const [name,width,height] of [['mobile',390,844],['tablet',820,1180],['desktop',1440,900],['wide',1920,1080]]){
  const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);console.log('viewport start',name);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#grid .card').first().waitFor();
  assert.equal(await page.locator('#actor option').count(),13);
  for(const candidate of canonical.actors.filter(a=>a.proposals.length)){
   console.log(name,'checking actor',candidate.id);await page.selectOption('#actor',candidate.id);await page.selectOption('#stance','neutral');
   await page.waitForFunction(()=>document.querySelectorAll('#grid img').length===10&&[...document.querySelectorAll('#grid img')].every(img=>img.complete&&img.naturalWidth===512),null,{timeout:30000});
   const pilot=candidate.proposals.find(p=>p.id==='v01');
   if(name==='desktop'&&pilot.animations?.attack?.frames?.length){
    for(const held of Object.keys(pilot.stances)){await page.selectOption('#stance',held);await page.waitForFunction(asset=>{const img=document.querySelector('#grid [data-version="v01"] img');return img?.dataset.asset===asset&&img.complete&&img.naturalWidth===512;},pilot.stances[held].frames[0].asset,{timeout:30000});}
    for(const action of ['attack','evade']){
     const expected=pilot.animations[action].frames;assert.deepEqual(expected.map(f=>f.durationMs),action==='attack'?[180,90,150,200]:[140,90,130,200]);
     await page.selectOption('#stance',action);await page.locator('#motion').check();
     await page.waitForFunction(action=>document.querySelector('#grid [data-version="v01"] img')?.dataset.asset?.includes('/motion/'+action+'-'),action,{timeout:30000});
     const observed=await page.evaluate(()=>new Promise(resolve=>{const seen=new Set(),timer=setInterval(()=>(()=>{const img=document.querySelector('#grid [data-version="v01"] img');if(img?.complete&&img.naturalWidth===512)seen.add(img.dataset.asset);})(),10);setTimeout(()=>{clearInterval(timer);resolve([...seen].filter(Boolean));},1800);}));
     assert.deepEqual(observed.sort(),expected.map(f=>f.asset).sort(),'All four actual '+action+' assets must play');
     assert.equal(await page.locator('#grid [data-version="v02"]').count(),0,'Unbuilt version must not receive a neutral/front fallback');
     assert.equal(await page.locator('#grid .missing').count(),9);
     console.log('clip verified',candidate.id,action,observed.length);await page.locator('#motion').uncheck();
    }
    for(const reaction of ['hurt','defeated']){await page.selectOption('#reaction',reaction);await page.waitForFunction(asset=>{const img=document.querySelector('#grid [data-version="v01"] img');return img?.dataset.asset===asset&&img.complete&&img.naturalWidth===512;},pilot.reactions[reaction].frames[0].asset,{timeout:30000});}
    await page.selectOption('#reaction','');await page.selectOption('#stance','smash');await page.locator('#motion').check();assert.equal(await page.locator('#grid img').count(),0,'Missing smash clip must not use a held pose');assert.equal(await page.locator('#grid .missing').count(),10);await page.locator('#motion').uncheck();await page.selectOption('#stance','neutral');
   }
  }
  await page.selectOption('#actor','wyrmAspirant');await page.selectOption('#stance','neutral');
  assert.equal(await page.locator('#stance option').count(),9);
  await page.locator('#grid details').first().locator('summary').click();
  assert.match(await page.locator('#grid details').first().innerText(),/Source SHA-256/);
  await page.locator('#grid details').first().locator('summary').click();
  assert.equal(await page.locator('#grid .card').count(),10);
  await page.selectOption('#reaction','hurt');
  assert.equal(await page.locator('#grid .missing').count(),canonical.actors.find(a=>a.id==='wyrmAspirant').proposals.filter(p=>!p.reactions?.hurt?.frames?.length).length);
  await page.selectOption('#reaction','');
  assert.equal(await page.locator('#grid img').count(),10);
  await page.waitForFunction(()=>[...document.querySelectorAll('#grid img')].every(img=>img.complete&&img.naturalWidth===512),null,{timeout:30000});
  assert.match(await page.locator('#notice').innerText(),/provisional draft design: v01/);
  await page.selectOption('#stance','evade');
  assert.equal(await page.locator('#grid .missing').count(),canonical.actors.find(a=>a.id==='wyrmAspirant').proposals.filter(p=>!p.stances?.evade?.frames?.length).length);
  await page.locator('[data-pick="v01"]').check();await page.locator('[data-pick="v02"]').check();
  assert.equal(await page.locator('#compare article').count(),2);
  await page.locator('[data-pick="v03"]').check();
  assert.equal(await page.locator('#compare article').count(),2);
  assert.equal(await page.locator('[data-pick="v01"]').isChecked(),false);
  await page.selectOption('#actor',resetActor.id);
  assert.equal(await page.locator('#compare article').count(),0);
  assert.ok((await page.locator('#notice').innerText()).includes('default stance: '+(resetActor.defaultStance||'unselected')));
  const downloadEvent=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadEvent;
  assert.equal(download.suggestedFilename(),'enemy-back-proposals.json');
  const target=output+'/'+name+'-manifest.json';await download.saveAs(target);const exported=JSON.parse(await readFile(target,'utf8'));
  assert.equal(exported.actors.length,13);
  if(!resetActor.proposals.length)assert.equal(await page.locator('#grid img').count(),0,'Missing rear art must not receive front fallback');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  assert.equal(overflow,false,'No horizontal viewport overflow');
  await page.selectOption('#actor','wyrmAspirant');await page.selectOption('#stance','neutral');
  await page.locator('#anchors').check();
  await page.locator('[data-pick="v01"]').check();await page.locator('[data-pick="v02"]').check();
  await page.waitForFunction(()=>[...document.querySelectorAll('#grid img,#compare img')].every(img=>img.complete&&img.naturalWidth===512),null,{timeout:30000});
  await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
  await page.goto('http://127.0.0.1:'+server.address().port+'/qa/workbench/game/pose-studio/enemy-back-proposals/index.html');
  await page.waitForFunction(()=>document.querySelectorAll('#grid img').length===10&&[...document.querySelectorAll('#grid img')].every(img=>img.complete&&img.naturalWidth===512),null,{timeout:30000});
  assert.equal(await page.getByText('Asset Gallery',{exact:true}).getAttribute('href'),'/qa/workbench/index.html#mod=assets');
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+embedTarget);
  await page.locator('#enemy-rear-review-open').click();
  const embedded=page.frameLocator('iframe');
  await embedded.locator('#grid .card').first().waitFor();
  assert.equal(await embedded.locator('#grid img').count(),10);
  await embedded.locator('#grid img').first().waitFor({state:'visible'});
  assert.equal(await embedded.locator('#grid img').first().evaluate(img=>img.complete&&img.naturalWidth===512),true);
  await page.getByText('Close review',{exact:true}).click();
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+sandboxTarget);
  const sandbox=page.frameLocator('#preview');await sandbox.locator('#enemy-rear-review-open').click();
  const nested=sandbox.frameLocator('iframe');
  await nested.locator('#grid .card').first().waitFor();
  await nested.locator('#grid img').first().waitFor({state:'visible'});
  await nested.locator('#grid img').first().evaluate(img=>img.decode());
  assert.equal(await nested.locator('#grid img').first().evaluate(img=>img.naturalWidth),512);
  await sandbox.getByText('Close review',{exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('viewport passed',name);records.push({name,width,height,url,status:'passed'});await page.close();
 }
 await writeFile(output+'/capture-record.json',JSON.stringify({sourceCommit:process.env.GITHUB_SHA,date:new Date().toISOString(),note:'Real browser captures of production gallery with ten normalized Wyrm Aspirant neutral rear designs; 130 rear designs and three elite pilots; other motion sets remain explicitly unbuilt.',records},null,2));
 console.log(JSON.stringify(records));
}finally{await browser.close();server.close();}
