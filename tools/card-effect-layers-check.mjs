import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.POSE_STUDIO_PLAYWRIGHT?pathToFileURL(process.env.POSE_STUDIO_PLAYWRIGHT).href:'playwright');
const out=process.env.POSE_STUDIO_EVIDENCE;if(!out)throw Error('Set POSE_STUDIO_EVIDENCE');await mkdir(out,{recursive:true});
const origin=process.env.POSE_STUDIO_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1200}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/art/card-effect-refresh-2026-09-09/index.html');await page.waitForFunction(()=>document.querySelectorAll('.card-effect-layer').length===8&&[...document.images].every(i=>i.complete&&i.naturalWidth));
 for(const host of await page.locator('.card-stage').all()){
  const planes=await host.evaluate(el=>[el.querySelector('[data-plane="behind"]'),el.querySelector('.card'),el.querySelector('[data-plane="front"]')].map(n=>Number(getComputedStyle(n).zIndex)));assert.deepEqual(planes,[0,1,2]);
 }
 await page.locator('#opacity').fill('50');assert.equal(await page.locator('#opacity-value').textContent(),'50%');assert.equal(await page.locator('[data-plane="front"]').first().evaluate(el=>getComputedStyle(el).opacity),'0.33');
 await page.locator('#front-layer').uncheck();assert.equal(await page.locator('[data-plane="front"]:visible').count(),0);assert.equal(await page.locator('[data-plane="behind"]:visible').count(),4);
 await page.screenshot({path:path.join(out,'behind-only.png'),fullPage:true});await page.locator('#front-layer').check();await page.locator('#behind-layer').uncheck();assert.equal(await page.locator('[data-plane="behind"]:visible').count(),0);await page.locator('#behind-layer').check();
 await page.locator('#opacity').fill('72');await page.screenshot({path:path.join(out,'layered-desktop.png'),fullPage:true});
 for(const direction of ['left','up','down','right']){await page.locator('#direction').selectOption(direction);assert.ok((await page.locator('[data-plane="front"]').first().evaluate(el=>getComputedStyle(el).transform)).startsWith('matrix'));}
 await page.locator('[data-kind="slash"] [data-frame="5"]').click();assert.equal(await page.locator('.card-effect-layer[data-frame="6"]').count(),8);
 await page.locator('#card-preview').uncheck();assert.equal(await page.locator('.card-stage:visible').count(),0);assert.equal(await page.locator('.after:visible').count(),4);await page.locator('#card-preview').check();
 await page.locator('[data-kind="slash"] [data-frame="3"]').click();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'layered-phone.png'),fullPage:true});checks.push('true back/face/front stacking, opacity, separate plane toggles, six frames, directions and 390px layout');
 await page.setViewportSize({width:1440,height:1100});
 for(const [cardId,kind]of [['strike','slash'],['shieldBash','shieldBash'],['starstonePebble','starbolt'],['gorefireSlash','bloodSlash']]){
  await page.goto(origin+'/AshenSpire.html?shot=combat');await page.waitForFunction(()=>window.__combat&&window.__renderCombatForShot);
  const result=await page.evaluate(async({cardId})=>{
   const c=window.__combat;c.player.energy=99;c.player.mana=99;c.player.stamina=99;c.piles.hand=[{instanceId:'layer-check',cardId,upgraded:false}];window.__renderCombatForShot();
   const planes=new Set(),effects=new Set(),frames=new Set();let flightSeen=false;const poll=setInterval(()=>{flightSeen ||=!!document.querySelector('.card-flight');document.querySelectorAll('.card-flight .card-effect-layer').forEach(el=>{planes.add(el.dataset.plane);effects.add(el.dataset.effect);frames.add(el.dataset.frame);});},2);
   document.querySelector('[data-instance-id="layer-check"]').click();document.querySelector('.enemy:not(.dead)').click();await new Promise(r=>setTimeout(r,1100));clearInterval(poll);
   return {flightSeen,planes:[...planes].sort(),effects:[...effects],frames:[...frames],remaining:document.querySelectorAll('.card-flight,.card-effect-layer').length};
  },{cardId});assert.ok(result.flightSeen,cardId);assert.deepEqual(result.planes,['behind','front'],cardId);assert.deepEqual(result.effects,[kind],cardId);assert.equal(result.frames.length,6,cardId);assert.equal(result.remaining,0,cardId);
 }
 checks.push('four accepted card plays choose the correct effect from payment receipts; both planes play all six frames and clean up');
 await page.evaluate(async()=>{const {playCardEffectLayers}=await import('/src/ui/cardEffectLayers.js');const host=document.createElement('div');document.body.append(host);const stop=playCardEffectLayers(host,'slash',{duration:1000});if(host.children.length!==2)throw Error('Layers not mounted');stop();if(host.children.length)throw Error('Canceled layers survived');document.body.classList.add('reduce-flashes');playCardEffectLayers(host,'slash');if(host.children.length)throw Error('Reduce flashes ignored');document.body.classList.remove('reduce-flashes');host.remove();});
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(async()=>{const {playCardEffectLayers}=await import('/src/ui/cardEffectLayers.js');const host=document.createElement('div');document.body.append(host);playCardEffectLayers(host,'slash');if(host.children.length)throw Error('Reduced motion ignored');host.remove();});checks.push('cancellation, Reduce flashes and reduced-motion suppress/clear card layers');
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'layer-checks.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
