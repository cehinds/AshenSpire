import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {launchBrowser} from './browser.mjs';
import {serve} from './serve.mjs';
const output=resolve(process.env.RANK_QA_OUT || 'docs/qa/card-rank-layers');
mkdirSync(output,{recursive:true});
const server=await serve({root:process.cwd(),port:0,open:false});
const base='http://localhost:'+server.server.address().port;
const launched=await launchBrowser({prefix:'rank-preview-',browser:process.env.CHROME,args:['--disable-background-mode']});
const browser=await chromium.connectOverCDP(launched.wsUrl);
try{
 const page=await browser.newPage({viewport:{width:1180,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/docs/qa/card-rank-layers/preview.html',{waitUntil:'networkidle',timeout:120000});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
 for(const width of [1180,390]){
  await page.setViewportSize({width,height:1100});await page.evaluate(async()=>{const {scheduleCardFits}=await import('/src/ui/components/card.js');scheduleCardFits(document.querySelectorAll('.card'));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  const geometry=await page.locator('.sample .card').evaluateAll(cards=>cards.map(c=>{const badge=c.querySelector('.card-rank'),panel=c.querySelector('[data-component="panel"]'),trim=c.querySelector('[data-component="panel-trim"]'),rules=c.querySelector('[data-card-binding="rules"]'),rank=badge?.getBoundingClientRect(),box=panel.getBoundingClientRect(),rim=trim.getBoundingClientRect(),rail=c.querySelector('.card-tag-rail')?.getBoundingClientRect(),face=c.querySelector('.illustrated-card-face').getBoundingClientRect();return {expected:Number(c.dataset.exampleRank),label:badge?.textContent||null,center:rank?Math.abs((rank.left+rank.right)/2-(face.left+face.right)/2):0,rankOverlapsPanel:rank?rank.bottom>box.top+1:false,rankOverlapsRail:rank&&rail?rank.top<rail.bottom-1&&rank.right>rail.left+1&&rank.left<rail.right-1:false,clipped:rules.scrollHeight>rules.parentElement.clientHeight+1,trimTracksPanel:Math.abs(box.top-rim.top)<1&&Math.abs(box.height-rim.height)<1,layers:[...c.querySelectorAll('[data-card-layer]')].map(n=>({layer:Number(n.dataset.cardLayer),z:getComputedStyle(n).zIndex}))};}));
  console.log(JSON.stringify({width,geometry}));
  assert.ok(geometry.every(g=>g.label===(g.expected>0?`Rank ${g.expected}`:null)&&g.center<1&&!g.rankOverlapsPanel&&!g.rankOverlapsRail&&!g.clipped&&g.trimTracksPanel));
  assert.ok(geometry.every(g=>g.layers.every(l=>l.z===String(l.layer))),'each declared paint layer owns its stacking order');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:output+(width===1180?'/rank-examples.png':'/rank-phone.png'),fullPage:true});
 }
 await page.locator('.sample .card').nth(1).click();await page.locator('.sample .card').nth(1).locator('.card-info-button').click();await page.locator('.card-inspection-modal').waitFor();
 assert.equal(await page.locator('.card-inspection-modal .card-rank').textContent(),'Rank 1');await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
 console.log('PASS rank preview: desktop, phone, positive rank labels, hidden rank zero, panel alignment, layer z-order, no clipping, inspection.');
}finally{await browser.close();launched.child.stdout?.destroy();launched.child.stderr?.destroy();await launched.close();server.server.closeAllConnections?.();server.server.close();}
