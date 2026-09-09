// Real browser evidence for the refreshed registry, gallery and card activations.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.POSE_STUDIO_PLAYWRIGHT?pathToFileURL(process.env.POSE_STUDIO_PLAYWRIGHT).href:'playwright');
const out=process.env.POSE_STUDIO_EVIDENCE;if(!out)throw Error('Set POSE_STUDIO_EVIDENCE outside the repository');await mkdir(out,{recursive:true});
const origin=process.env.POSE_STUDIO_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),errors=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:1200}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/art/card-effect-refresh-2026-09-09/index.html');await page.locator('.effect-card').last().waitFor();
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));assert.equal(await page.locator('.frame').count(),24);
 await page.screenshot({path:path.join(out,'comparison-desktop.png'),fullPage:true});
 for(const direction of ['left','up','down','right']){await page.locator('#direction').selectOption(direction);const transform=await page.locator('.after').first().evaluate(el=>getComputedStyle(el).transform);assert.ok(transform!=='none');}
 for(let i=0;i<6;i++){await page.locator(`[data-kind="slash"] [data-frame="${i}"]`).click();assert.equal(await page.locator('#position').textContent(),`${i+1} / 6`);for(const kind of ['slash','shieldBash','starbolt','bloodSlash'])assert.match(await page.locator(`[data-kind="${kind}"] .after`).getAttribute('src'),new RegExp(`/combat-effects/${kind}${i+1}\\.webp$`));}
 await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#position').textContent!=='6 / 6');await page.locator('#play').click();checks.push('24 decoded frames, shared registry, synchronized scrubbing/playback and four directions');
 await page.locator('[data-kind="bloodSlash"] [data-frame="3"]').click();await page.locator('#light').check();await page.screenshot({path:path.join(out,'comparison-light.png'),fullPage:true});await page.locator('#light').uncheck();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'comparison-phone.png'),fullPage:true});checks.push('dark/light matte inspection and 390px responsive gallery');
 await page.setViewportSize({width:1440,height:1100});await page.goto(origin+'/pose-studio/index.html');await page.locator('.effect').first().waitFor();
 const studioPaths=await page.evaluate(async()=>{const {effectFrames}=await import('/pose-studio/catalog.mjs');return ['slash','shieldBash','starbolt','bloodSlash'].map(k=>effectFrames[k]);});assert.ok(studioPaths.flat().every(p=>p.startsWith('assets/combat-effects/')));
 await page.locator('[data-cue="contact"]').click();await page.screenshot({path:path.join(out,'studio-refreshed.png'),fullPage:true});checks.push('Pose Studio consumes the same 24 refreshed frames');
 const activations=[];
 for(const [cardId,kind,actor] of [['strike','slash','reaver'],['shieldBash','shieldBash','reaver'],['starstonePebble','starbolt','starseer'],['gorefireSlash','bloodSlash','herald']]){
  await page.goto(origin+`/AshenSpire.html?shot=combat&shotClass=${actor}`);await page.waitForFunction(()=>window.__combat&&window.__renderCombatForShot);
  const result=await page.evaluate(async({cardId,kind})=>{const c=window.__combat;c.player.energy=99;c.player.mana=99;c.player.stamina=99;c.piles.hand=[{instanceId:'art-check',cardId,upgraded:false}];window.__renderCombatForShot();
   const seen=new Set(),poll=setInterval(()=>document.querySelectorAll('.painted-combat-effect').forEach(el=>{if(el.dataset.effect===kind)seen.add(el.src);}),2);
   document.querySelector('[data-instance-id="art-check"]').click();document.querySelector('.enemy:not(.dead)').click();await new Promise(r=>setTimeout(r,1500));clearInterval(poll);
   const hash=async url=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(url)).arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const expected=await Promise.all(Array.from({length:6},(_,i)=>hash(`/assets/combat-effects/${kind}${i+1}.webp`))),observed=await Promise.all([...seen].map(hash));
   return {cardId,kind,framesObserved:observed.length,allFramesMatch:observed.every(h=>expected.includes(h)),remaining:document.querySelectorAll('.painted-combat-effect').length};
  },{cardId,kind});assert.ok(result.framesObserved>=1,JSON.stringify(result));assert.ok(result.allFramesMatch,JSON.stringify(result));assert.equal(result.remaining,0);activations.push(result);
 }
 checks.push('four real card activations use refreshed artwork and clean up');
 // Hold a real runtime frame for a reviewable screenshot; mechanics stay untouched.
 await page.evaluate(async()=>{const {playCombatEffect}=await import('/src/ui/combatEffectSprites.js'),{anchorLocalBox}=await import('/src/ui/fx.js');const layer=document.querySelector('.fx-layer'),target=document.querySelector('.enemy:not(.dead)');window.__stopArt=playCombatEffect(layer,anchorLocalBox(layer,target),'bloodSlash',{duration:5000,size:180});});
 await page.waitForFunction(()=>document.querySelector('[data-effect="bloodSlash"]')?.dataset.frame==='4');await page.screenshot({path:path.join(out,'game-blood-slash.png'),fullPage:true});await page.evaluate(()=>window.__stopArt());
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'checks.json'),JSON.stringify({checks,activations,errors},null,2));console.log(JSON.stringify({checks,activations,errors},null,2));
}finally{await browser.close();}
