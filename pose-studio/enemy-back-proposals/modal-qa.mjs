import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
const root='pose-studio/enemy-back-proposals',original=await readFile(root+'/manifest.json','utf8'),manifest=JSON.parse(original);
for(const actor of manifest.actors){actor.reference=null;delete actor.provisionalDefaultVersion;actor.proposals=actor.id==='wyrmAspirant'?[actor.proposals.find(p=>p.id==='v02')]:[];}manifest.actors[0].provisionalDefaultVersion='v02';manifest.scope='pending';
await mkdir('/tmp/enemy-rear-modal',{recursive:true});
const target='/tmp/enemy-rear-modal/host.html';
await writeFile(target,'<!doctype html><html><head><style>*{margin:0;padding:0;box-sizing:border-box}html{height:100vh;width:100vw;overflow:hidden;container:game-viewport / size}body{height:100%;width:100%;zoom:var(--ui-zoom,1)}html[data-view-preset]{transform:translate(14px,8px) scale(.75);transform-origin:top left}html[data-view-preset] dialog:modal{zoom:.75}</style></head><body><h1>Real game zoom rules fixture</h1></body></html>');
try{await writeFile(root+'/manifest.json',JSON.stringify(manifest));execFileSync(process.execPath,[root+'/embed-gallery.mjs',target],{stdio:'inherit'});}finally{await writeFile(root+'/manifest.json',original);}
const html=await readFile(target),server=createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),browser=await chromium.launch({headless:true});
try{
 for(const [name,width,height,zoom,preset] of [['zoom06',1440,900,.6,false],['zoom1',1440,900,1,false],['zoom12',1440,900,1.2,false],['zoom2',1440,900,2,false],['mobile',390,844,1.2,false],['tablet',820,1180,1.2,false],['wide',1920,1080,1.2,false],['preset',1440,900,2,true]]){
  const page=await browser.newPage({viewport:{width,height}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.evaluate(({zoom,preset})=>{document.documentElement.style.setProperty('--ui-zoom',zoom);if(preset)document.documentElement.dataset.viewPreset='fit';},{zoom,preset});
  await page.locator('#enemy-rear-review-open').click();const frame=page.frameLocator('#enemy-rear-review-frame');await frame.locator('#grid .card').waitFor();
  const boxes=await page.evaluate(()=>{const dialog=document.querySelector('dialog'),close=dialog.querySelector('button'),frame=dialog.querySelector('iframe');return {parent:dialog.parentElement.tagName,dialog:dialog.getBoundingClientRect().toJSON(),close:close.getBoundingClientRect().toJSON(),frame:frame.getBoundingClientRect().toJSON()};});
  assert.equal(boxes.parent,'HTML');for(const key of ['dialog','close','frame']){const b=boxes[key];assert.ok(b.left>=-1&&b.top>=-1&&b.right<=width+1&&b.bottom<=height+1,name+' '+key+' exceeds viewport '+JSON.stringify(b));}assert.ok(boxes.frame.width>width*.9,name+' gallery remains full scale');
  assert.equal(await frame.locator('main').evaluate(main=>main.scrollWidth<=main.clientWidth),true);
  await page.getByText('Close review',{exact:true}).click();assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);await page.locator('#enemy-rear-review-open').click();assert.equal(await page.locator('dialog').evaluate(d=>d.open),true);
  await page.screenshot({path:'/tmp/enemy-rear-modal/'+name+'.png'});assert.deepEqual(errors,[]);console.log(name,zoom,preset,JSON.stringify(boxes));await page.close();
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
