import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from '../../tools/browser.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const out=join(here,'inspection');mkdirSync(out,{recursive:true});
const browser=await launchBrowser({prefix:'animation-review-',browser:resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']),timeoutMs:20000});
const ws=new WebSocket(browser.wsUrl), pending=new Map(),errors=[];let serial=0;
ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);if(msg.id){const pair=pending.get(msg.id);pending.delete(msg.id);msg.error?pair.reject(msg.error):pair.resolve(msg.result);}});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(m,p)=>send(m,p,sessionId);await call('Runtime.enable');await call('Page.enable');const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
await call('Emulation.setDeviceMetricsOverride',{width:1180,height:900,deviceScaleFactor:1,mobile:false});await call('Page.navigate',{url:'http://127.0.0.1:4290/art/combat-effects-2026-09-07/index.html'});await wait(2000);
const result=await ev(`(async()=>{const {playCombatEffect,clearCombatEffects}=await import('/src/ui/combatEffectSprites.js');const {combatEffectFrames}=await import('/src/ui/assets.js');const layer=document.querySelector('#layer'),from={left:20,top:50,width:80,height:100},to={left:450,top:70,width:80,height:100};let decoded=0;const sleep=ms=>new Promise(r=>setTimeout(r,ms)),check=(v,m)=>{if(!v)throw Error(m)};for(const kind of Object.keys((await import('/src/content/combatEffectArt.js')).COMBAT_EFFECT_ART)){for(const src of combatEffectFrames(kind)){const img=new Image();img.src=src;await img.decode();decoded++;}playCombatEffect(layer,from,kind,{to:kind.endsWith('bolt')?to:null,duration:900});check(combatEffectFrames(kind).length===6,'six frames');await sleep(65);for(let frame=1;frame<=6;frame++){check(layer.firstChild?.dataset.frame===String(frame),kind+' phase '+frame);if(frame<6)await sleep(150);}clearCombatEffects(layer);await sleep(220);check(!layer.children.length,'cancel no impact');}document.body.classList.add('reduced-motion');playCombatEffect(layer,from,'ward');check(!layer.children.length,'reduced');document.body.classList.remove('reduced-motion');playCombatEffect(layer,from,'starbolt',{to,duration:150});await sleep(175);check(layer.firstChild?.dataset.effect==='impact','target impact');await sleep(220);check(!layer.children.length,'cleanup');playCombatEffect(layer,from,'slash',{delay:160});check(!layer.children.length,'melee waits for impact');clearCombatEffects(layer);await sleep(220);check(!layer.children.length,'delayed melee canceled');return {decoded,playback:'passed',cancellation:'passed',reducedMotion:'passed'};})()`);
const directional=await ev(`(async()=>{
 const {playCombatEffect,clearCombatEffects}=await import('/src/ui/combatEffectSprites.js');
 const {combatEffectOrientation}=await import('/src/ui/combatEffectDirection.js');
 const layer=document.querySelector('#layer'),select=document.querySelector('#direction');let variants=0;
 const check=(v,m)=>{if(!v)throw Error(m)};
 for(const direction of ['right','left','up','down']){
  select.value=direction;select.dispatchEvent(new Event('change'));
  for(const button of document.querySelectorAll('#buttons button')){
   button.click();const el=layer.firstChild,keyframes=el.getAnimations()[0].effect.getKeyframes();
   check(el.dataset.direction===direction,'direction '+button.dataset.effect);
   check(keyframes.every(k=>k.transform.endsWith(combatEffectOrientation(direction))),'orientation');
   check([...document.querySelectorAll('#frames img')].every(img=>img.style.transform===combatEffectOrientation(direction)),'strip');
   variants++;clearCombatEffects(layer);
  }
 }
 const from={left:100,top:100,width:10,height:10},to={left:0,top:0,width:10,height:10};
 playCombatEffect(layer,from,'starbolt',{to,duration:100});
 check(Number(layer.firstChild.dataset.direction)===-135,'diagonal aim');
 const final=layer.firstChild.getAnimations()[0].effect.getKeyframes().at(-1).transform.replaceAll(' ','');
 check(final.startsWith('translate(-100px,-100px)'),'world travel');
 await new Promise(r=>setTimeout(r,120));check(Number(layer.firstChild.dataset.direction)===-135,'impact aim');clearCombatEffects(layer);
 playCombatEffect(layer,to,'slash',{direction:'up',delay:30,duration:300});await new Promise(r=>setTimeout(r,50));check(layer.firstChild.dataset.direction==='up','delayed aim');clearCombatEffects(layer);
 return {variants,diagonal:'passed',delayed:'passed'};
})()`);
writeFileSync(join(out,'direction-checks.json'),JSON.stringify(directional,null,2));
const statusPlayback=await ev(`(async()=>{
 const {applyStatus}=await import('/src/engine/statuses.js');const {createRegistries}=await import('/src/model/registries.js');const {contentBundle}=await import('/src/content/index.js');
 const {animateEvents}=await import('/src/ui/fx.js');const {clearCombatEffects}=await import('/src/ui/combatEffectSprites.js');
 const layer=document.querySelector('#layer'),anchor=document.querySelector('#target'),events=[],reg=createRegistries(contentBundle);
 const entity={id:'victim',kind:'player',alive:true,maxHp:100,hp:100,statuses:{}};
 const ctx={registries:reg,emit:(type,payload)=>events.push({type,...payload}),enqueue:()=>{}};
 applyStatus(ctx,entity,'bleed',7);applyStatus(ctx,entity,'frost',10);applyStatus(ctx,entity,'venom',2);
 const seen=new Set(),poll=setInterval(()=>layer.querySelectorAll('.painted-combat-effect').forEach(e=>seen.add(e.dataset.effect)),4);
 await new Promise(done=>animateEvents([...events,{type:'enemyStaggered',targetId:'victim'}],{layer,anchorFor:()=>anchor,combatEl:document.querySelector('#stage')},done));
 await new Promise(r=>setTimeout(r,300));clearInterval(poll);clearCombatEffects(layer);return {seen:[...seen],remaining:layer.querySelectorAll('.painted-combat-effect').length};
})()`);
for(const kind of ['bloodAura','bloodLoss','frostAura','frostbite','poisoned','staggerBreak'])assert.ok(statusPlayback.seen.includes(kind),JSON.stringify(statusPlayback));
assert.equal(statusPlayback.remaining,0);writeFileSync(join(out,'status-playback.json'),JSON.stringify(statusPlayback,null,2));
for(const direction of ['left','up']){
 await ev(`document.querySelector('#direction').value='${direction}';document.querySelector('#direction').dispatchEvent(new Event('change'));document.querySelector('[data-effect="starbolt"]').click()`);await wait(300);
 const shot=await call('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'direction-'+direction+'.png'),Buffer.from(shot.data,'base64'));
}
await ev(`document.querySelector('#card-style').value='bloodPact';document.querySelector('#card-style').dispatchEvent(new Event('change'))`);assert.ok((await ev(`document.querySelector('#status').textContent`)).includes('focus motes'));
for(const kind of ['arcaneWard','barrier','frostAura','frostbite','staggerBreak']){await ev(`document.querySelector('[data-effect="${kind}"]').click()`);await wait(300);const art=await call('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,kind+'-desktop.png'),Buffer.from(art.data,'base64'));}
await ev(`document.querySelector('[data-effect="ward"]').click()`);await wait(300);const shot=await call('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'ward-desktop.png'),Buffer.from(shot.data,'base64'));
await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));const mobile=await call('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'effects-phone.png'),Buffer.from(mobile.data,'base64'));
await call('Page.navigate',{url:'http://127.0.0.1:4290/AshenSpire.html?shot=combat&shotClass=starseer'});await wait(4500);
const gameplay=await ev(`(async()=>{const c=window.__combat;window.__combatRunForShot.class='starseer';c.player.energy=99;c.player.mana=99;c.piles.hand.push({instanceId:'effect-check',cardId:'starstonePebble',upgraded:false});window.__renderCombatForShot();const seen=new Set();const poll=setInterval(()=>document.querySelectorAll('.painted-combat-effect').forEach(e=>seen.add(e.dataset.effect)),4);document.querySelector('[data-instance-id="effect-check"]').click();document.querySelector('.enemy:not(.dead)').click();await new Promise(r=>setTimeout(r,1800));clearInterval(poll);const spell=[...seen];seen.clear();c.player.stamina=99;c.piles.hand.push({instanceId:'melee-check',cardId:'strike',profileId:'bladeAttack',upgraded:false});window.__renderCombatForShot();const meleePoll=setInterval(()=>document.querySelectorAll('.painted-combat-effect').forEach(e=>seen.add(e.dataset.effect)),4);document.querySelector('[data-instance-id="melee-check"]').click();document.querySelector('.enemy:not(.dead)').click();await new Promise(r=>setTimeout(r,1800));clearInterval(meleePoll);return {seen:spell,melee:[...seen],remaining:document.querySelectorAll('.painted-combat-effect').length};})()`);assert.ok(gameplay.seen.includes('starbolt'),JSON.stringify(gameplay));assert.ok(gameplay.melee.includes('slash'),JSON.stringify(gameplay));assert.equal(gameplay.remaining,0);assert.deepEqual(errors,[]);writeFileSync(join(out,'checks.json'),JSON.stringify({result,gameplay,errors},null,2));console.log({result,gameplay,errors});
const expansion=await ev(`(async()=>{
 const c=window.__combat,seen=new Set();c.player.energy=99;c.player.stamina=99;c.player.mana=99;
 const poll=setInterval(()=>document.querySelectorAll('.painted-combat-effect').forEach(e=>seen.add(e.dataset.effect)),4);
 for(const [id,cardId,profileId,targeted]of [['shield-check','strike','shieldAttack',true],['parry-check','defend','weaponGuard',false],['bind-check','disorient',null,true],['soft-guard-check','evasiveGuard','unarmedGuard',false],['step-check','quickstep',null,false],['arcane-guard-check','defend','sceptreGuard',false],['magic-guard-check','defend','staffGuard',false],['barrier-check','crystalBarrier',null,false]]){
  c.piles.hand.push({instanceId:id,cardId,...(profileId?{profileId}:{}),upgraded:false});window.__renderCombatForShot();
  document.querySelector('[data-instance-id="'+id+'"]').click();if(targeted)document.querySelector('.enemy:not(.dead)').click();else document.querySelector('.combatant.player').click();await new Promise(r=>setTimeout(r,1400));
 }
 clearInterval(poll);return [...seen];
})()`);
for(const kind of ['shieldBash','parry','bind','guardPulse','dustStep','arcaneWard','magicGuard','barrier'])assert.ok(expansion.includes(kind),JSON.stringify(expansion));
assert.deepEqual(errors,[]);writeFileSync(join(out,'expansion-gameplay.json'),JSON.stringify({expansion,errors},null,2));
}finally{ws.close();await browser.close();}
