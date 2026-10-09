import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { openCombatQa } from './rear-qa-runtime.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
import { serve } from './serve.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const running = process.env.COMBAT_QA_URL ? null : await serve({root:process.cwd(),port:8276,open:false});
const base = process.env.COMBAT_QA_URL || `http://localhost:${running.port}/`;
const browser=await chromium.launch({channel:'msedge',headless:true});
const phone=process.argv.includes('--phone');
const page=await browser.newPage({viewport:phone?{width:390,height:844}:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const dir=process.env.COMBAT_QA_OUT || '.codex/rear-card-stability'+(phone?'-phone':'');mkdirSync(dir,{recursive:true});
try {
 await openCombatQa(page,base);await page.waitForTimeout(1200);
 if(await page.locator('.startup-gate').count()) await page.keyboard.press('Enter');
 await page.locator('[data-title-action="quick-start"]').waitFor();
 await page.evaluate(()=>{const real=Math.random;Math.random=()=>{Math.random=real;return 1.5/0xffffffff;};});
 await page.locator('[data-title-action="quick-start"]').click();await page.waitForTimeout(1000);
 if(await page.locator('.prologue-screen').count()) await page.getByRole('button',{name:/skip/i}).click();
 if(await page.locator('.class-mastery-node').count()) await page.locator('.class-mastery-node').first().click();
 await page.locator('.map-node.monster.reachable').first().click();
 for(let i=0;i<15&&!await page.locator('.hand .card').count();i++) {const b=page.locator('.confirmation-modal .confirmation-confirm,.map-tray [data-map-action="enter"]:not([disabled]),.map-enter:not([disabled])').first();if(await b.count())await b.click();else await page.waitForTimeout(300);}
 await page.locator('.hand .card').first().waitFor();await page.waitForTimeout(2000);
 if(await page.locator('.tut-skip').count())await page.locator('.tut-skip').click();
 const geometry=()=>page.evaluate(()=>[...document.querySelectorAll('.combatant')].map(f=>{const s=f.querySelector('.sprite');const r=s.getBoundingClientRect();return {id:f.dataset.eid,x:r.x,y:r.y,width:r.width,height:r.height,scale:f.dataset.baseSpriteScale,ground:f.dataset.groundY,pose:s.querySelector('.pose-stage')?.dataset.pose,classes:s.className};}));
 const records=[];
 records.push({state:'before',geometry:await geometry(),hand:await page.locator('.hand .card').evaluateAll(es=>es.map(e=>({id:e.dataset.cardId,text:e.textContent.slice(0,60)})))});
 await page.screenshot({path:dir+'/before.png'});
 for(let i=0;i<3;i++) {
  const card=page.locator('.hand .card:not(.unaffordable)').first();if(!await card.count())break;
  const id=await card.getAttribute('data-card-id');await card.evaluate(e=>e.dataset.probeCard='true');const pt=await page.evaluate(pointerTargetExpression('[data-probe-card="true"]'));await page.mouse.click(pt.x,pt.y);
  await page.waitForTimeout(150);records.push({state:'selected '+id,geometry:await geometry()});
  await page.evaluate(()=>{window.__samples=[];let until=performance.now()+1400;const take=()=>{const s=document.querySelector('.combatant.player .sprite'),r=s.getBoundingClientRect(),cs=getComputedStyle(s);window.__samples.push({x:r.x,y:r.y,w:r.width,h:r.height,transform:cs.transform,translate:cs.translate,action:s.dataset.actionMotion});if(performance.now()<until)requestAnimationFrame(take);};take();});
  const sel=await page.locator('.combatant.player.armed').count()?'.combatant.player.armed':'.combatant.enemy.targetable';
  if(await page.locator(sel).count()){const tp=await page.evaluate(pointerTargetExpression(sel));await page.mouse.click(tp.x,tp.y);}
  await page.waitForTimeout(1800);records.push({state:'after '+id,geometry:await geometry(),samples:await page.evaluate(()=>window.__samples),count:await page.evaluate(()=>window.__combat?.player?.counters?.cardsPlayedThisCombat)});
 }
 const families=await page.evaluate(()=>{
  const s=document.querySelector('.combatant.player .sprite'),base=s.getBoundingClientRect();
  const result=[];
  for(const motion of ['sweep','lunge','impact','release','cast','brace','sidestep']){
   s.dataset.actionMotion=motion;s.classList.add(['sweep','lunge','impact','release'].includes(motion)?'act-attack':'act-move');
   const animation=s.getAnimations().find(a=>a.effect.target===s);if(!animation){if(!['cast','brace'].includes(motion))throw Error('no animation for '+motion);const r=s.getBoundingClientRect();if(r.x!==base.x||r.width!==base.width||r.height!==base.height)throw Error('moved stationary '+motion);result.push({motion,stationary:true});s.classList.remove('act-attack','act-move');continue;}
   animation.pause();const duration=animation.effect.getTiming().duration;const samples=[];
   for(const fraction of [0,.22,.35,.55,.7,1]){animation.currentTime=duration*fraction;const r=s.getBoundingClientRect();samples.push({t:fraction,x:r.x,w:r.width,h:r.height});}
   if(samples.some(r=>Math.abs(r.w-base.width)>.05||Math.abs(r.h-base.height)>.05))throw Error('resized '+motion);
   if(!['sweep','lunge','impact'].includes(motion)&&samples.some(r=>Math.abs(r.x-base.x)>.05))throw Error('moved '+motion);
   if(Math.abs(samples.at(-1).x-base.x)>.05)throw Error('did not return '+motion);
   result.push({motion,samples});animation.cancel();s.classList.remove('act-attack','act-move');
  }return result;
 });
 assert.deepEqual(errors,[]);
 assert.equal(records.at(-1).count,3,'three accepted card plays');
 const baseline=records[0].geometry.find(g=>g.id==='player');
 for(const record of records) for(const key of ['x','y','width','height']) assert(Math.abs(record.geometry.find(g=>g.id==='player')[key]-baseline[key])<.25,`resting ${key} drift`);
 await page.screenshot({path:dir+'/after.png'});writeFileSync(dir+'/results.json',JSON.stringify({records,families,errors},null,2));console.log(JSON.stringify({records:records.map(({samples,...r})=>({...r,...(samples?{range:{w:[Math.min(...samples.map(s=>s.w)),Math.max(...samples.map(s=>s.w))],h:[Math.min(...samples.map(s=>s.h)),Math.max(...samples.map(s=>s.h))],x:[Math.min(...samples.map(s=>s.x)),Math.max(...samples.map(s=>s.x))],translations:[...new Set(samples.map(s=>s.translate))]}}:{})})),families:families.map(f=>f.motion),errors},null,2));
} finally {await browser.close();running?.server.closeAllConnections();running?.server.close();}
