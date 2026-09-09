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
  const ready=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await wait(100)}throw Error('Timed out: '+expression)};
  const shot=async name=>{await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))');const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`${out}/${name}.png`,Buffer.from(r.data,'base64'));};

  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1150,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:base+'/art/readiness-poses/preview.html'});await ready('!!window.readinessPreview');
  const result=await evaluate(`(async()=>{
    const {createPaintedStage}=await import('/src/ui/paintedOutfits.js');
    const sleep=ms=>new Promise(r=>setTimeout(r,ms)),assert=(v,m)=>{if(!v)throw Error(m)};
    const checks=[];
    for(const entry of window.readinessPreview){
      const rest=entry.stage.rest;let stage=entry.stage;
      await Promise.all(stage.warmed.map(i=>i.decode()));
      stage.setRestPose('idle',{immediate:true});stage.setRestPose(rest);await sleep(95);
      const before=stage.presentation;assert(before.auraOpacity>0&&before.auraOpacity<1,'entry fades');assert(before.pose===rest+'Transition','intermediate enters');
      const next=createPaintedStage(entry.classId);stage.el.replaceWith(next.el);stage.dispose();stage=next;stage.setRestPose(rest,{resume:before});assert(stage.presentation.transition.startedAt===before.transition.startedAt,'entry time survives redraw');await sleep(320);assert(stage.pose===rest,'redrawn entry completes');
      stage.setRestPose('idle');await sleep(95);const leaving=stage.presentation;assert(leaving.auraOpacity>0&&leaving.auraOpacity<1,'exit fades');assert(leaving.pose===rest+'Transition','intermediate leaves');
      const last=createPaintedStage(entry.classId);stage.el.replaceWith(last.el);stage.dispose();stage=last;stage.setRestPose('idle',{resume:leaving});assert(stage.el.querySelector('.combat-pose-aura').dataset.motif,'redraw retains departing motif');await sleep(320);assert(stage.pose==='idle'&&!stage.el.querySelector('.combat-pose-aura').dataset.motif,'redrawn exit completes');
      stage.setRestPose(rest);await sleep(60);stage.setRestPose('idle');await sleep(60);stage.setRestPose(rest);await sleep(430);assert(stage.pose===rest,'rapid reversal keeps newest pose');
      document.body.classList.add('reduced-motion');stage.setRestPose('idle');stage.setRestPose(rest);assert(stage.pose===rest&&!stage.presentation.transition,'reduced motion immediate');assert(stage.el.querySelector('svg').getAnimations().length===0,'reduced motion steady');document.body.classList.remove('reduced-motion');
      checks.push({classId:entry.classId,enterAlpha:before.auraOpacity,leaveAlpha:leaving.auraOpacity,redrawEntry:true,redrawExit:true,reversal:true,reducedMotion:true});stage.dispose();entry.mount();
    }
    const still=createPaintedStage('herald','default',{still:true});document.body.append(still.el);still.setRestPose('bloodRite');assert(still.el.querySelector('.painted-stage').dataset.pose==='bloodRite','still presentation immediate');still.dispose();still.el.remove();
    return checks;
  })()`);checks.push(...result);
  await wait(450);await evaluate("document.querySelectorAll('details.frames').forEach(d=>d.open=true)");await shot('transition-sprites-desktop');
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await evaluate("(()=>{const s=window.readinessPreview[0].stage;s.setRestPose('idle');s.setRestPose('prepared');return s.pose==='prepared'&&!s.presentation.transition&&s.el.querySelector('svg').getAnimations().length===0})()"),true);
  assert.deepEqual(errors,[]);writeFileSync(out+'/transition-checks.json',JSON.stringify({checks,osReducedMotion:true,errors},null,2));console.log(JSON.stringify(checks));
}finally{ws.close();await browser.close();}
