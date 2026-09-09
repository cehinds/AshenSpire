import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser, resolveBrowser } from '../../tools/browser.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createSession } from '../../tools/session.mjs';
import { createRegistries } from '../../src/model/registries.js';
import { contentBundle } from '../../src/content/index.js';
const base='http://127.0.0.1:4293',out='art/readiness-poses/inspection';mkdirSync(out,{recursive:true});
const browser=await launchBrowser({prefix:'readiness-',browser:resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']),timeoutMs:20000});
const ws=new WebSocket(browser.wsUrl),pending=new Map(),errors=[],checks=[];let serial=0;
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j)});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const call=(m,p)=>send(m,p,sessionId);await call('Runtime.enable');await call('Page.enable');
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const ready=async expression=>{for(let i=0;i<400;i++){if(await evaluate(expression))return;await wait(100)}throw Error('Timed out: '+expression)};
  const shot=async name=>{await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))');const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${out}/${name}.png`,Buffer.from(r.data,'base64'));};
  if (!process.argv.includes('--review-only')) {
  if (!process.argv.includes('--combat-only')) {
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:base+'/art/readiness-poses/preview.html'});await ready('!!window.readinessPreview');
  const stageChecks=await evaluate(`(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)};let decoded=0;
    for(const entry of window.readinessPreview){const card=document.querySelector('[data-class="'+entry.classId+'"]');
      for(const option of card.querySelector('select').options){card.querySelector('select').value=option.value;entry.mount();const stage=entry.stage;
        await Promise.all(stage.warmed.map(i=>i.decode()));decoded+=stage.warmed.length;const expected=stage.rest;
        for(const action of ['attack','cast','hit','shieldGuard','parry']){assert(stage.play(action,120),'play '+action);await sleep(520);assert(stage.pose===expected,entry.classId+' return '+action);}
        stage.setRestPose('idle',{immediate:true});stage.setRestPose(expected);assert(stage.pose===expected+'Transition','authored entry');const entryTime=stage.presentation.transition.startedAt;await sleep(80);stage.setRestPose(expected);assert(stage.presentation.transition.startedAt===entryTime,'same state does not restart');await sleep(350);assert(stage.pose===expected,'entry completes');stage.setRestPose('idle');assert(stage.pose===expected+'Transition','authored exit');assert(stage.el.querySelector('.combat-pose-aura').dataset.motif,'exit retains motif while fading');await sleep(400);assert(stage.pose==='idle','exit completes');assert(stage.el.querySelector('.combat-pose-aura').dataset.motif==='','exit clears aura');stage.setRestPose(expected,{immediate:true});stage.play('attack',600);stage.settle();await sleep(650);assert(stage.pose===expected,'canceled timer');
        document.body.classList.add('reduced-motion');assert(stage.play('attack')===false,'reduced motion');assert(stage.pose===expected,'reduced rest');document.body.classList.remove('reduced-motion');
        stage.setRestPose('guard');stage.play('attack',500);stage.setRestPose(expected);await sleep(550);assert(stage.pose===expected,'changed rest overrides timer');
      }
      card.querySelector('select').value='default';entry.mount();
    }
    return {outfits:12,decoded,returns:'attack, cast, hit, shield guard, parry',cancel:true,reducedMotion:true,authoredEntryExit:true,sameStateKeepsTransitionTime:true};
  })()`);checks.push(stageChecks);await shot('readiness-desktop');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  for(const cls of ['rogue','starseer','herald']){await evaluate(`document.querySelector('[data-class="${cls}"]').scrollIntoView({block:'start'})`);await shot(`${cls}-preview-phone`);}
  }
  // Exercise cards through the shipped combat screen. The query fixture only
  // seeds the fight; all status application/consumption uses normal card clicks.
  for(const standalone of [false,true])for(const [classId,cardId,statusId,pose] of [['rogue','smokePellet','prepared','prepared'],['starseer','crystalBarrier','starstoneCharge','starstoneCharge'],['herald','stigmataCard','stigmata','bloodRite']])for(const width of [1440,390]){
    if(process.argv.includes('--starseer-only') && classId!=='starseer')continue;
    await call('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    console.log({classId,standalone,width});
    await call('Page.navigate',{url:base+'/'+(standalone?'AshenSpire.html':'')+'?shot=combat&shotClass='+classId});await ready('!!window.__combat && !!window.__renderCombatForShot');
    await evaluate(`(()=>{const c=window.__combat;c.player.energy=9;c.player.mana=9;c.player.stamina=9;c.player.statuses={};c.player.stanceId=null;c.piles.hand.unshift({instanceId:'readiness-card',cardId:'${cardId}',upgraded:false});window.__renderCombatForShot();})()`);
    await evaluate(`document.querySelector('.hand [data-instance-id="readiness-card"]').click();document.querySelector('.combatant.player').click()`);
    await ready(`document.querySelector('.player-zone .painted-stage')?.dataset.rest==='${pose}' && !!window.__combat.player.statuses['${statusId}']`);await wait(1400);
    assert.equal(await evaluate(`document.querySelector('.player-zone .painted-stage').dataset.pose`),pose);
    assert.equal(await evaluate('window.__combatRunForShot.class'),classId);
    await evaluate('window.__combat.player.energy=1;window.__renderCombatForShot()');
    const bounded=await evaluate(`(async()=>{const {READINESS_POSE_ART}=await import('/src/content/readinessPoseArt.js');const s=document.querySelector('.player-zone .painted-stage'),b=READINESS_POSE_ART[s.dataset.poseClass][s.dataset.pose].box,r=s.querySelector('.pose-frame').getBoundingClientRect(),hud=document.querySelector('.combat-hud').getBoundingClientRect();return r.left+b.x0/640*r.width>=0&&r.left+(b.x1+1)/640*r.width<=innerWidth&&r.top+b.y0/640*r.height>=hud.bottom})()`);
    if (!bounded) { console.log(await evaluate(`JSON.stringify({width:innerWidth,stage:document.querySelector('.player-zone .painted-stage').getBoundingClientRect(),image:document.querySelector('.player-zone .pose-frame').getBoundingClientRect(),hud:document.querySelector('.combat-hud').getBoundingClientRect()})`)); await shot('bounds-failure'); }
    assert.equal(bounded,true,`${classId} ${standalone?'standalone':'source'} ${width} complete silhouette inside viewport below HUD`);
    await shot(`${classId}-${standalone?'standalone':'game'}-${width}`);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    assert.equal(await evaluate('[...document.images].filter(i=>i.getBoundingClientRect().width>0).every(i=>i.complete&&i.naturalWidth>0)'),true);
    if(classId==='rogue'){
      await evaluate(`(()=>{window.__combat.piles.hand.unshift({instanceId:'consume-ready',cardId:'quickCut',upgraded:false});window.__renderCombatForShot();document.querySelector('.hand [data-instance-id="consume-ready"]').click();document.querySelector('.combatant.enemy').click()})()`);
      await ready(`!window.__combat.player.statuses.prepared`);await wait(1500);
      assert.notEqual(await evaluate(`document.querySelector('.player-zone .painted-stage').dataset.rest`),'prepared');
    }
    checks.push({classId,standalone,width,realCard:cardId,pose,images:true,overflow:false});
  }
  }
  const host=createSession({registries:createRegistries(contentBundle),seedString:'READINESSUI'});
  for(const [id,classId] of [['p1','rogue'],['p2','starseer'],['p3','herald']])host.addMember({id,name:classId,classId,spriteStyle:'animated'});
  host.start();for(const id of ['p1','p2','p3'])host.chooseNode(id,host.session.mapGraph.startIds[0]);
  const snapshots=[structuredClone(host.snapshot())];
  for(const [id,cardId] of [['p1','smokePellet'],['p2','crystalBarrier'],['p3','stigmataCard']]){
    const p=host.live.combat.players.get(id);p.entity.energy=9;p.entity.mana=9;p.entity.stamina=9;
    p.piles.hand.push({instanceId:cardId,cardId,upgraded:false});const result=host.combatPlay(id,cardId);assert.ok(result.ok,result.error);snapshots.push(structuredClone(host.snapshot()));
  }
  for(const width of [1440,390]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await call('Page.navigate',{url:base+'/art/readiness-poses/coop-fixture.html?shot=title'});await ready('!!document.querySelector(".title-menu")');
    await evaluate(`(async()=>{const {mountCoop}=await import('/src/ui/screens/coop.js');const {createRegistries}=await import('/src/model/registries.js');const {contentBundle}=await import('/src/content/index.js');const conn={open:false,setHandlers(h){window.coopHandlers=h},send(){},close(){}};mountCoop(document.querySelector('#app'),{registries:createRegistries(contentBundle),conn,myId:'p1',meta:{settings:{reducedMotion:true}},onSettingsChange(){},onLeave(){}})})()`);
    for(const snapshot of snapshots){await evaluate(`window.coopHandlers.onMessage({t:'state',snapshot:${JSON.stringify(snapshot)}})`);await wait(600);}
    const poses=await evaluate(`[...document.querySelectorAll('.coop-seat .painted-stage')].map(e=>e.dataset.rest)`);
    assert.deepEqual(poses,['prepared','starstoneCharge','bloodRite']);await shot(`coop-snapshot-${width}`);
    if(width===390){
      const fits=await evaluate(`(async()=>{const {READINESS_POSE_ART}=await import('/src/content/readinessPoseArt.js');const edge=document.querySelector('.combat-hud').getBoundingClientRect().bottom;return [...document.querySelectorAll('.coop-seat .painted-stage')].every(s=>{const b=READINESS_POSE_ART[s.dataset.poseClass][s.dataset.pose].box,r=s.querySelector('.pose-frame').getBoundingClientRect();return r.left+b.x0/640*r.width>=0&&r.left+(b.x1+1)/640*r.width<=innerWidth&&r.top+b.y0/640*r.height>=edge})})()`);
      assert.equal(fits,true,'all three phone silhouettes fit below HUD and inside viewport');
    }
    await evaluate(`window.coopHandlers.onMessage({t:'state',snapshot:${JSON.stringify(snapshots.at(-1))}})`);await wait(600);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.coop-seat .painted-stage')].map(e=>e.dataset.pose)`),poses);
    checks.push({coopRenderer:width,authoritativeSnapshots:true,poses,duplicateReceipt:true,transport:'snapshot replay, not sockets'});
  }
  const offline=resolve('../..','outputs/Combat-pose-preview.html');
  await call('Page.navigate',{url:pathToFileURL(offline).href});await ready('!!window.readinessPreview');
  await evaluate('Promise.all(window.readinessPreview.flatMap(e=>e.stage.warmed).map(i=>i.decode()))');
  const reaction=await evaluate(`(async()=>{const s=window.readinessPreview[2].stage;s.react('hp');s.react('heal');const first=s.el.dataset.poseReaction;await new Promise(r=>setTimeout(r,290));const second=s.el.dataset.poseReaction;await new Promise(r=>setTimeout(r,290));return[first,second,s.el.dataset.poseReaction]})()`);
  assert.deepEqual(reaction,['hp','heal','']);checks.push({offlineGallery:true,queuedReactions:reaction});
  assert.deepEqual(errors,[]);writeFileSync(`${out}/${process.argv.includes('--combat-only') ? 'combat-checks' : process.argv.includes('--review-only') ? 'review-checks' : process.argv.includes('--starseer-only') ? 'starseer-checks' : 'checks'}.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{ws.close();await browser.close();}
