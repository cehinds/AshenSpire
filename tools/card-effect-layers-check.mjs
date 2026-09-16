import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.POSE_STUDIO_PLAYWRIGHT?pathToFileURL(process.env.POSE_STUDIO_PLAYWRIGHT).href:'playwright');
const out=process.env.POSE_STUDIO_EVIDENCE;if(!out)throw Error('Set POSE_STUDIO_EVIDENCE');await mkdir(out,{recursive:true});
const origin=process.env.POSE_STUDIO_URL||'http://127.0.0.1:4321';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true}),errors=[],checks=[],activations=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1200}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/art/card-effect-refresh-2026-09-09/index.html');await page.waitForFunction(()=>document.querySelectorAll('.combatant-effect-layer').length===8&&[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth));
 assert.equal(await page.locator('#card-preview').isChecked(),false);
 for(const host of await page.locator('.combatant-preview .pose-layer').all()){
  assert.equal(await host.evaluate(el=>getComputedStyle(el).isolation),'isolate');
  const planes=await host.evaluate(el=>['behind','front'].map(p=>Number(getComputedStyle(el.querySelector(`[data-plane="${p}"]`)).zIndex)));assert.deepEqual(planes,[-1,2]);
 }
 const initial=await page.locator('[data-kind="slash"] .combatant-effect-layer').first().evaluate(el=>[el.style.left,el.style.top]);
 await page.locator('[data-kind="slash"] button[data-frame="2"]').click();const raised=await page.locator('[data-kind="slash"] .combatant-effect-layer').first().evaluate(el=>[el.style.left,el.style.top]);assert.notDeepEqual(initial,raised,'Sword attachment follows the raised blade');
 for(let frame=0;frame<6;frame++){await page.locator(`[data-kind="slash"] button[data-frame="${frame}"]`).click();assert.equal(await page.locator(`.combatant-effect-layer[data-frame="${frame+1}"]`).count(),8);}
 await page.locator('#opacity').fill('50');assert.equal(await page.locator('[data-plane="front"]').first().evaluate(el=>getComputedStyle(el).opacity),'0.41');
 await page.locator('#effect-size').fill('150');assert.equal(await page.locator('#size-value').textContent(),'150%');
 await page.locator('#front-layer').uncheck();assert.equal(await page.locator('[data-plane="front"]:visible').count(),0);assert.equal(await page.locator('[data-plane="behind"]:visible').count(),4);await page.locator('#front-layer').check();
 await page.locator('#behind-layer').uncheck();assert.equal(await page.locator('[data-plane="behind"]:visible').count(),0);await page.locator('#behind-layer').check();
 await page.locator('#direction').selectOption('left');assert.equal(await page.locator('.combatant-preview').first().evaluate(el=>getComputedStyle(el).transform),'matrix(-1, 0, 0, 1, 0, 0)');await page.locator('#direction').selectOption('right');
 await page.locator('#card-preview').check();assert.equal(await page.locator('.card-stage:visible').count(),4);await page.locator('#card-preview').uncheck();
 for(const outfit of await page.locator('#outfit option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean))){await page.locator('#outfit').selectOption(outfit);for(const f of [0,2,3,5]){await page.locator(`[data-kind="slash"] button[data-frame="${f}"]`).click();assert.equal(await page.locator('.combatant-effect-layer:not([hidden])').count(),8);}await page.waitForFunction(()=>[...document.querySelectorAll('.combatant-preview .pose-frame:not(.pose-previous)')].every(i=>i.complete&&i.naturalWidth));}
 await page.locator('#outfit').selectOption('');await page.locator('#opacity').fill('72');await page.locator('#effect-size').fill('100');await page.locator('[data-kind="slash"] button[data-frame="3"]').click();
 await page.screenshot({path:path.join(out,'combatant-desktop.png'),fullPage:true});await page.locator('[data-kind="slash"]').screenshot({path:path.join(out,'sword-attachment.png')});await page.locator('#anchors').check();await page.locator('#front-layer').uncheck();await page.screenshot({path:path.join(out,'combatant-behind-only.png'),fullPage:true});await page.locator('#front-layer').check();await page.locator('#anchors').uncheck();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'combatant-phone.png'),fullPage:true});checks.push('16 outfits, pose-following attachments, back/art/front stacking, six effect frames, facing, size, opacity, visibility and 390px layout');
 await page.setViewportSize({width:1440,height:1100});
 async function fixture(actor='reaver'){await page.goto(origin+`/AshenSpire.html?shot=combat&shotClass=${actor}`);await page.waitForFunction(()=>window.__combat&&window.__renderCombatForShot);}
 async function activate(cardId){return page.evaluate(async cardId=>{
  const c=window.__combat;c.player.energy=99;c.player.mana=99;c.player.stamina=99;c.piles.hand=[{instanceId:'layer-check',cardId,upgraded:false}];window.__renderCombatForShot();
  const planes=new Set(),effects=new Set(),frames=new Set(),poses=new Set(),origins=[];let flightSeen=false;
  const poll=setInterval(()=>{flightSeen ||=!!document.querySelector('.card-flight');document.querySelectorAll('.painted-combat-effect,.combatant-effect-layer').forEach(el=>{effects.add(el.dataset.effect);if(el.classList.contains('combatant-effect-layer')){planes.add(el.dataset.plane);frames.add(el.dataset.frame);poses.add(el.dataset.pose);}if(el.dataset.effect==='starbolt'&&!origins.length){origins.push({left:parseFloat(el.style.left),top:parseFloat(el.style.top),size:parseFloat(el.style.width)});}});},2);
  document.querySelector('[data-instance-id="layer-check"]').click();document.querySelector('.enemy:not(.dead)').click();await new Promise(r=>setTimeout(r,1600));clearInterval(poll);
  return {flightSeen,planes:[...planes].sort(),effects:[...effects],frames:[...frames],poses:[...poses],origins,remaining:document.querySelectorAll('.card-flight,.combatant-effect-layer,.painted-combat-effect').length};
 },cardId);}
 for(const [cardId,kind,actor]of [['strike','slash','reaver'],['shieldBash','shieldBash','reaver'],['starstonePebble','starbolt','starseer'],['gorefireSlash','bloodSlash','herald']]){
  await fixture(actor);const result=await activate(cardId);assert.equal(result.flightSeen,false,cardId);assert.deepEqual(result.planes,['behind','front'],cardId);assert.ok(result.effects.includes(kind),JSON.stringify(result));assert.ok(result.frames.length>=(kind==='starbolt'?1:4),JSON.stringify(result));assert.equal(result.remaining,0,cardId);activations.push({cardId,...result});
 }
 checks.push('Four accepted card plays preserve effect selection with card flight OFF; attached planes follow live poses and clean up');
 await fixture();await page.locator('#combat-menu').click();await page.locator('[data-tab="settings"][role="menuitem"]').click();const toggle=page.locator('[data-key="showPlayedCard"]');assert.equal(await toggle.getAttribute('aria-checked'),'false');await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'true');
 await page.keyboard.press('Escape');const enabled=await activate('strike');assert.equal(enabled.flightSeen,true,'Live opt-in applies to the next play');await page.locator('#combat-menu').click();await page.locator('[data-tab="settings"][role="menuitem"]').click();await page.locator('[data-key="showPlayedCard"]').click();await page.keyboard.press('Escape');assert.equal((await activate('strike')).flightSeen,false);checks.push('Actual Settings switch opts card flight in and out without disabling character effects');
 // Shot boots intentionally use an ephemeral save store. Check serialization
 // with the real persistent profile API in this isolated browser context.
 await page.evaluate(async()=>{const {createSaveManager}=await import('/src/engine/save.js');const save=createSaveManager(localStorage),meta=save.loadMeta();meta.settings.showPlayedCard=true;const result=save.saveMeta(meta);if(result?.ok===false)throw Error('Preference save failed');});
 await fixture();assert.equal(await page.evaluate(async()=>{const {createSaveManager}=await import('/src/engine/save.js');return createSaveManager(localStorage).loadMeta().settings.showPlayedCard;}),true);checks.push('The profile save API preserves the preference across reloads; shot fixtures remain ephemeral');
 // Shared adapter in a live scene: cancellation, transformed source geometry,
 // outcome filtering and accessibility do not require invented game outcomes.
 await page.evaluate(async()=>{
  const {playCombatEffectPlan,clearCombatEffects}=await import('/src/ui/combatEffectSprites.js');const {combatantEmissionBox}=await import('/src/ui/combatantEffectLayers.js');const {anchorLocalBox}=await import('/src/ui/fx.js');
  const actor=document.querySelector('.combatant.player .sprite'),layer=document.querySelector('.fx-layer');const from=anchorLocalBox(layer,actor),target=anchorLocalBox(layer,document.querySelector('.enemy:not(.dead)'));
  const plan={kind:'slash',at:'target',targetEvent:'damageDealt'};
  const start=targets=>playCombatEffectPlan(layer,from,plan,{actor,localBox:anchorLocalBox,targets,duration:1000});
  start([]);await new Promise(r=>setTimeout(r,300));if(document.querySelector('.combatant-effect-layer'))throw Error('No recipient invented a swing');
  start([target]);await new Promise(r=>setTimeout(r,300));if(document.querySelectorAll('.combatant-effect-layer').length!==2)throw Error('Missing shared adapter layers');clearCombatEffects(layer);if(document.querySelector('.combatant-effect-layer'))throw Error('Canceled actor layers survived');
  const before=combatantEmissionBox(actor,'hand',anchorLocalBox,layer);actor.style.transform='translateX(30px) scaleX(-1)';const after=combatantEmissionBox(actor,'hand',anchorLocalBox,layer);if(before.left===after.left)throw Error('Emission ignored actor transform');actor.style.transform='';
  document.body.classList.add('reduce-flashes');start([target]);await new Promise(r=>setTimeout(r,300));if(document.querySelector('.combatant-effect-layer,.painted-combat-effect'))throw Error('Reduce flashes ignored');document.body.classList.remove('reduce-flashes');
 });
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(async()=>{const {playCombatantEffectLayers}=await import('/src/ui/combatantEffectLayers.js');if(playCombatantEffectLayers(document.querySelector('.combatant.player .sprite'),'slash'))throw Error('Reduced motion ignored');});checks.push('Shared solo/co-op adapter: no invented recipients, cancel cleanup, transformed emission point, Reduce flashes and reduced motion');
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'layer-checks.json'),JSON.stringify({checks,activations,errors},null,2));console.log(JSON.stringify({checks,activations,errors},null,2));
}finally{await browser.close();}
