import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {serve} from '/workspace/AshenSpire/tools/serve.mjs';
const {chromium}=createRequire(import.meta.url)('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const config=JSON.parse(await readFile(process.argv[2],'utf8'));
const server=await serve({root:'/workspace',port:0,open:false,quiet:true,host:'127.0.0.1'});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
const rows=[];
try {
 for(const run of config.runs){
  const artifact=await readFile(run.file),html=artifact.toString(),sha256=createHash('sha256').update(artifact).digest('hex');
  assert.equal(sha256,run.sha256);
  const pin = JSON.parse(html.match(/^const ASSET_PACKS = (.*);$/m)[1]);
  assert.match(html, /^const ASSET_MAP = \{\};$/m, 'pack delivery must not embed the standalone art map');
  const assetBase = JSON.parse(await readFile(resolve(dirname(run.file),'asset-base.json'),'utf8'));
  assert.deepEqual(assetBase,{base:'./'},'each frozen build must resolve its own sibling assets');
  for(const [name,pack] of Object.entries(pin.packs)){
    const index = await readFile(resolve(dirname(run.file),pack.index));
    assert.equal(createHash('sha256').update(index).digest('hex'),pack.sha256,name+' index pin');
  }
  const row={probeVersion:3,delivery:'local pack-shaped; own copied packs and objects',packPins:pin,assetBase,source:run.source||null,instrumentation:'passive rAF timestamps and long-task observer; no per-frame style/geometry reads; CDP Performance counters',label:run.label,file:run.file,sha256,version:'0.7.1.'+html.match(/const ORDINAL = '([^']+)'/)[1],digest:html.match(/const SOURCE = '([^']+)'/)[1],viewport:{width:375,height:667,dpr:3},cpuRate:4,pacing:'fresh shipped defaults; no settings override',actions:[],errors:[]};
  const context=await browser.newContext({viewport:{width:375,height:667},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>row.errors.push(String(e)));
  const ownBase = new URL(run.file.slice('/workspace/'.length),server.url).href.replace(/[^/]+$/,'');
  const assetRequests = new Set(), assetFailures = [], escapedAssetRoutes = [];
  page.on('request',request=>{const url=request.url();if(/\/(?:packs|objects)\/|\/asset-base\.json(?:[?#]|$)/.test(url)){
    assetRequests.add(url);if(!url.startsWith(ownBase))escapedAssetRoutes.push(url);
  }});
  page.on('response',response=>{if(response.status()>=400&&/\/(?:packs|objects)\//.test(response.url()))assetFailures.push({url:response.url(),status:response.status()});});
  await page.goto(server.url+run.file.slice('/workspace/'.length)+'?shot=combat&shotSeed=SHOWCASE&shotClass=reaver',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForSelector('.end-turn:not([disabled])',{timeout:60000});
  await page.waitForFunction(tier=>document.documentElement.dataset.builtInArt===tier,pin.tier,{timeout:60000});
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.field .sprite img,.hand .card img')].map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(1500);
  await page.waitForLoadState('networkidle',{timeout:60000});
  assert.deepEqual(escapedAssetRoutes,[],'asset requests must stay inside their frozen build');
  assert.deepEqual(assetFailures,[],'pack assets must load successfully');
  row.assetDelivery={builtInArt:await page.locator('html').getAttribute('data-built-in-art'),requestedObjects:[...assetRequests].filter(url=>url.includes('/objects/')).length,escapedAssetRoutes,assetFailures};
  const visibleImages=await page.evaluate(()=>[...document.querySelectorAll('.field .sprite img,.hand .card img')].map(image=>({complete:image.complete,width:image.naturalWidth})));
  assert.ok(visibleImages.length>0&&visibleImages.every(image=>image.complete&&image.width>0),'loaded fixture art required');
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x=>[x.name,x.value]));
  const idleBefore=await metrics();await page.waitForTimeout(2500);const idleAfter=await metrics();
  row.idle={seconds:idleAfter.Timestamp-idleBefore.Timestamp,taskSeconds:idleAfter.TaskDuration-idleBefore.TaskDuration,scriptSeconds:idleAfter.ScriptDuration-idleBefore.ScriptDuration,layoutSeconds:idleAfter.LayoutDuration-idleBefore.LayoutDuration,styleSeconds:idleAfter.RecalcStyleDuration-idleBefore.RecalcStyleDuration,layouts:idleAfter.LayoutCount-idleBefore.LayoutCount,styles:idleAfter.RecalcStyleCount-idleBefore.RecalcStyleCount,animations:await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').map(a=>({name:a.animationName,iterations:String(a.effect.getTiming().iterations),target:a.effect.target?.className?.baseVal||a.effect.target?.className}))) };
  const memoryKeys=['Nodes','Documents','JSEventListeners','JSHeapUsedSize','JSHeapTotalSize'];
  row.memoryBefore={connectedElements:await page.evaluate(()=>document.getElementsByTagName('*').length),...Object.fromEntries(memoryKeys.map(key=>[key,idleAfter[key]]))};
  for(const cardId of ['core.defend','core.strike']){
   const before=await page.evaluate(cardId=>{const c=window.__combat,inst=c.piles.hand.find(i=>i.cardId===cardId);if(!inst)throw Error('Fixture missing '+cardId);return {id:inst.instanceId,played:c.player.counters.cardsPlayedThisCombat,events:c.eventLog.length};},cardId);
   const exposed=async()=>page.evaluate(id=>{const n=document.querySelector(`.hand .card[data-instance-id="${id}"]`),r=n.getBoundingClientRect();return [{x:r.left+r.width/2,y:r.top+24},{x:r.left+r.width/2,y:r.top+r.height/2},{x:r.left+12,y:r.top+24},{x:r.right-12,y:r.top+24}].find(p=>n.contains(document.elementFromPoint(p.x,p.y)));},before.id);
   const point=await exposed();assert(point);await page.touchscreen.tap(point.x,point.y);
   await page.waitForSelector(`.hand .card[data-instance-id="${before.id}"].selected`);await page.waitForTimeout(1300);
   const armedBefore=await metrics();await page.waitForTimeout(1500);const armedAfter=await metrics();
   const armedIdle={seconds:armedAfter.Timestamp-armedBefore.Timestamp,taskSeconds:armedAfter.TaskDuration-armedBefore.TaskDuration,styleSeconds:armedAfter.RecalcStyleDuration-armedBefore.RecalcStyleDuration,layoutSeconds:armedAfter.LayoutDuration-armedBefore.LayoutDuration,layouts:armedAfter.LayoutCount-armedBefore.LayoutCount,styles:armedAfter.RecalcStyleCount-armedBefore.RecalcStyleCount};
   let targetId=null,confirm;
   if(cardId==='core.strike'){
    targetId=await page.evaluate(()=>window.__combat.enemies.find(e=>e.alive).id);
    const target=page.locator(`.target-hud-detail[data-eid="${targetId}"].visible:not(.leaving) .target-hud-name`);await target.waitFor({timeout:15000});
    confirm=await target.evaluate(n=>{const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
   }else confirm=await exposed();
   assert(confirm);
   await page.evaluate(()=>{const p=window.__actionSample={inputAt:null,upAt:null,frames:[],longTasks:[],fits:0,active:true};
    document.querySelector('.field').addEventListener('battlefieldgeometrychange',()=>{if(p.active)p.fits++;});
    new PerformanceObserver(list=>{if(p.active)p.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})));}).observe({type:'longtask'});
    addEventListener('pointerdown',e=>p.inputAt=e.timeStamp,{capture:true,once:true});addEventListener('pointerup',e=>p.upAt=e.timeStamp,{capture:true,once:true});
    let last;const frame=t=>{if(!p.active)return;if(last!=null)p.frames.push(t-last);last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const startMetrics=await metrics();await page.touchscreen.tap(confirm.x,confirm.y);
   await page.waitForFunction(({played,id})=>window.__combat.player.counters.cardsPlayedThisCombat===played+1&&!window.__combat.piles.hand.some(c=>c.instanceId===id)&&!document.querySelector('.hand').inert&&!document.querySelector('.end-turn').disabled,{played:before.played,id:before.id},{timeout:90000,polling:100});
   const state=await page.evaluate(({events,id})=>{const p=window.__actionSample;p.active=false;const c=window.__combat,tail=c.eventLog.slice(events);return {readyMs:performance.now()-p.inputAt,inputAt:p.inputAt,upAt:p.upAt,played:tail.filter(e=>e.type==='cardPlayed'&&e.cardInstanceId===id).map(e=>({cardId:e.cardId,cardInstanceId:e.cardInstanceId,targetId:e.targetId,energySpent:e.energySpent,manaSpent:e.manaSpent,staminaSpent:e.staminaSpent})),resolved:tail.filter(e=>e.type==='cardResolved'&&e.cardInstanceId===id).length,events:tail.map(e=>e.type),handInert:document.querySelector('.hand').inert,endTurnDisabled:document.querySelector('.end-turn').disabled,fits:p.fits,maxFrameMs:Math.max(...p.frames),longTaskTotalMs:p.longTasks.filter(e=>e.start+e.duration>=p.inputAt).reduce((s,e)=>s+Math.max(0,e.start+e.duration-Math.max(e.start,p.inputAt)),0)};},before);
   const endMetrics=await metrics();state.renderMetrics=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,endMetrics[k]-startMetrics[k]]));
   assert.equal(state.played.length,1);assert.equal(state.resolved,1);if(targetId)assert.equal(state.played[0].targetId,targetId);
   row.actions.push({cardId,armedIdle,...state});assert.deepEqual(row.errors,[]);console.log(JSON.stringify({label:row.label,cardId,...state}));
  }
  assert.deepEqual(escapedAssetRoutes,[]);assert.deepEqual(assetFailures,[]);
  const memoryEnd=await metrics();row.memoryAfter={connectedElements:await page.evaluate(()=>document.getElementsByTagName('*').length),...Object.fromEntries(memoryKeys.map(key=>[key,memoryEnd[key]]))};
  await page.screenshot({path:config.output.replace('.json',`-${rows.length+1}-${row.label}.png`)});rows.push(row);await context.close();await writeFile(config.output,JSON.stringify({rows},null,2));
 }
}finally{await writeFile(config.output,JSON.stringify({rows},null,2));await browser.close();server.server.close();}
