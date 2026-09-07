import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from '../../../tools/browser.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const out=join(here,'inspection');mkdirSync(out,{recursive:true});
const browser=await launchBrowser({prefix:'animation-review-',browser:resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']),timeoutMs:20000});
const ws=new WebSocket(browser.wsUrl), pending=new Map(),errors=[];let serial=0;
ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);if(msg.id){const pair=pending.get(msg.id);pending.delete(msg.id);msg.error?pair.reject(msg.error):pair.resolve(msg.result);}});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

try {
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(m,p)=>send(m,p,sessionId);
 await call('Runtime.enable');await call('Page.enable');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const standalone=process.argv.includes('--standalone');
 await call('Page.navigate',{url:'http://127.0.0.1:4290/'+(standalone?'AshenSpire.html':'')+'?shot=combat&shotClass=reaver'});await wait(5000);
 const gameplay=await evaluate(`(async()=>{
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));const assert=(v,m)=>{if(!v)throw Error(m)};
 const c=window.__combat;c.player.energy=99;c.player.stamina=999;
 c.piles.hand.push({instanceId:'test-bash',cardId:'shieldBash',upgraded:false});
 window.__renderCombatForShot();
 const stage=()=>document.querySelector('.player-zone .painted-stage');
 document.querySelector('.hand [data-card-id="defend"]').click();document.querySelector('.combatant.player').click();await sleep(1800);
 assert(stage().dataset.rest==='shieldGuard'&&stage().dataset.pose==='shieldGuard3','live guard persistence');
 const observed=[];const timer=setInterval(()=>observed.push(stage()?.dataset.pose),8);
 document.querySelector('.hand [data-instance-id="test-bash"]').click();document.querySelector('.enemy:not(.dead)').click();await sleep(1800);clearInterval(timer);
 assert(c.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId==='test-bash'),'bash accepted');
 assert(observed.includes('shieldBash1')&&observed.includes('shieldBash2'),'live bash playback: '+[...new Set(observed)]);
 assert(stage().dataset.pose==='shieldGuard3','live bash restores guard');
 return {guard:'held',bashFrames:[...new Set(observed)]};
 })()`);console.log({gameplay});
 if(standalone) assert.ok(await evaluate(`document.querySelector('.player-zone .painted-stage img').src.startsWith('data:image/webp')`),'standalone embeds technique art');
 const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(join(out,standalone?'standalone-shield-guard.png':'game-shield-guard.png'),Buffer.from(screenshot.data,'base64'));
 const payments=await evaluate(`(async()=>{
 const c=window.__combat;c.player.mana=999;const samples={};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 for(const [cardId,resource] of [['bloodPact','hp'],['urgentHeal','mana']]){
 c.piles.hand.push({instanceId:'aura-'+cardId,cardId,upgraded:false});window.__renderCombatForShot();
 const seen=[];const timer=setInterval(()=>seen.push(document.querySelector('.player-zone .painted-stage')?.dataset.aura),5);
 document.querySelector('[data-instance-id="aura-'+cardId+'"]').click();document.querySelector('.combatant.player').click();await sleep(1800);clearInterval(timer);
 if(!seen.includes(resource))throw Error('Missing live '+resource+' aura: '+seen);samples[resource]='observed on accepted card';
 }return samples;
 })()`);gameplay.payments=payments;
 await evaluate(`window.__combat.player.mana=999;window.__combat.piles.hand.push({instanceId:'test-power',cardId:'thornHaloCard',upgraded:false});window.__renderCombatForShot();document.querySelector('[data-instance-id="test-power"]').click();document.querySelector('.combatant.player').click()`);await wait(1800);
 assert.equal(await evaluate(`document.querySelector('.player-zone .painted-stage').dataset.rest`),'cast','consumed Power holds cast');
 const end=await evaluate(`(()=>{const r=document.querySelector('.end-turn').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...end});await wait(1700);await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...end});await wait(4500);
 assert.ok(await evaluate(`window.__combat.eventLog.filter(e=>e.type==='playerTurnStart').length>1`),'next turn accepted');
 assert.equal(await evaluate(`document.querySelector('.player-zone .painted-stage').dataset.rest`),'idle','owner turn clears held stance');
 gameplay.power='cast held after consumption';gameplay.ownerTurn='idle restored';
 const report=await evaluate(`(async()=>{
 const {PAINTED_OUTFITS}=await import('/src/content/paintedOutfits.js');
 const {createPaintedStage}=await import('/src/ui/paintedOutfits.js');
 const assert=(v,m)=>{if(!v)throw Error(m)};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));let decoded=0;
 for(const id of Object.keys(PAINTED_OUTFITS)){
 const [cls,armour='default']=id.split('-');const stage=createPaintedStage(cls,armour);
 for(const pose of stage.poses){assert(stage.setPose(pose),id+pose);await stage.el.querySelector('img').decode();decoded++;}
 stage.setRestPose('shieldGuard');assert(stage.pose==='shieldGuard3','held guard');
 assert(stage.el.querySelector('img').style.filter.includes('0.26'),'faded guard outline');
 stage.play('shieldBash',900,['stamina']);assert(stage.el.querySelector('img').style.filter.includes('88, 225, 131') || stage.el.querySelector('img').style.filter.includes('88,225,131'),'green bash outline');assert(stage.pose==='shieldBash1','bash windup');
 await sleep(330);assert(stage.pose==='shieldBash2','bash impact');
 await sleep(330);assert(stage.pose==='shieldBash3','bash recovery');
 await sleep(330);assert(stage.pose==='shieldGuard3','restore guard');
 stage.setRestPose('parry');stage.play('hit',60);await sleep(90);assert(stage.pose==='parry3','hit returns parry');
 for(const resource of ['stamina','mana','hp'])for(const pose of stage.poses){stage.play(pose,90,[resource]);assert(stage.el.dataset.aura===resource,id+' resource on '+pose);assert(stage.el.querySelector('img').style.filter!=='none','outline');}
 stage.play('power',900,['mana']);const filters=[stage.el.querySelector('img').style.filter];assert(stage.pose==='power1','power gather');await sleep(330);assert(stage.pose==='power2','power flare');filters.push(stage.el.querySelector('img').style.filter);await sleep(330);assert(stage.pose==='power3','power settle');filters.push(stage.el.querySelector('img').style.filter);assert(new Set(filters).size===3,'distinct power phases');stage.settle();
 stage.setRestPose('cast');assert(stage.pose==='idle'&&stage.rest==='cast','Power idle');
 document.body.classList.add('reduced-motion');stage.setRestPose('shieldGuard');stage.play('shieldBash');assert(stage.pose==='shieldGuard3','reduced rest');document.body.classList.remove('reduced-motion');stage.dispose();
 }
 return {outfits:16,decoded,playback:'passed'};
 })()`);
 console.log(report);assert.deepEqual(errors,[]);writeFileSync(join(out,standalone?'standalone-techniques-checks.json':'game-techniques-checks.json'),JSON.stringify({gameplay,report,errors},null,2));
}finally{ws.close();await browser.close();}
