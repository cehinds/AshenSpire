import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';

// Optional external Playwright installation; the project-owned launcher owns the browser profile.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executable = [process.env.CHROME, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
assert.ok(executable, 'Set CHROME to a Chromium browser');
const port=Number(process.env.ART_TEST_DEBUG_PORT || 9337);
const launched = await launchBrowser({prefix:'equipment-animation-',browser:executable,headless:'--headless=new',awaitEndpoint:false,pinTmp:false,args:[`--remote-debugging-port=${port}`,'--mute-audio','--disable-extensions','--disable-component-extensions-with-background-pages','--disable-background-networking'],timeoutMs:15000});
let browser;
const origin=process.env.ART_TEST_URL || 'http://127.0.0.1:8792';
const out=resolve('scratch/equipment-animation');mkdirSync(out,{recursive:true});
const errors=[];
try {
 for(let i=0;i<100;i++){try{const response=await fetch(`http://127.0.0.1:${port}/json/version`);if(response.ok)break;}catch{}await new Promise(done=>setTimeout(done,100));}
 browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const context=await browser.newContext({viewport:{width:1000,height:800}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/animation-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="background:#222;color:white"></body>'}));
 await page.goto(origin+'/animation-test.html');
 const result=await page.evaluate(async()=>{
  const {selectEquipmentAnimation,animationClip}=await import('/src/model/equipmentAnimation.js');
  const {createPaintedStage,paintedPortraitUrl,paintedPresentation}=await import('/src/ui/paintedOutfits.js');
  const animation=selectEquipmentAnimation({classId:'reaver',rightId:'greatsword'});
  const stage=createPaintedStage('reaver','default',{animation});
  stage.el.style.cssText='width:300px;height:400px;position:relative;margin:30px auto;';
  document.body.append(stage.el);
  const observed=[];
  const observer=new MutationObserver(records=>records.filter(r=>r.attributeName==='data-pose').forEach(r=>observed.push(r.target.dataset.pose)));
  observer.observe(stage.el,{attributes:true});
  const timing=stage.actionTiming('attack');
  stage.play('attack',timing.totalMs);
  await new Promise(done=>setTimeout(done,timing.totalMs+50));
  observer.disconnect();
  const expected=animationClip(animation,'attack').frames;
  const checks={set:stage.animationSetId,observed:observed.slice(0,expected.length),expected,settled:stage.pose,timing,portrait:paintedPortraitUrl('reaver','default',animation),conversation:paintedPresentation('reaver','default','conversation',animation).src};
  stage.play('power',100);checks.buff=stage.pose;stage.settle();
  stage.setPose('hit');checks.hurt=stage.pose;
  stage.setRestPose('bulwark');checks.stanceStart=stage.pose;
  await new Promise(done=>setTimeout(done,400));checks.stanceEnd=stage.pose;
  stage.play('attack',90);
  await new Promise(done=>setTimeout(done,120));checks.stanceAfterAttack=stage.pose;
  stage.setRestPose('idle',{immediate:true});
  stage.play('attack',900);stage.dispose();const stopped=stage.pose;
  await new Promise(done=>setTimeout(done,150));checks.disposed=stage.pose===stopped;
  document.body.classList.add('reduced-motion');checks.reducedPlayed=stage.play('attack',900);document.body.classList.remove('reduced-motion');
  return checks;
 });
 assert.equal(result.set,'reaverGreatsword');assert.deepEqual(result.observed,result.expected);assert.equal(result.settled,'STANCE-READY');
 assert.deepEqual(result.timing,{totalMs:900,impactMs:500});assert.equal(result.buff,'BUFF');assert.equal(result.hurt,'hit');
 assert.equal(result.stanceStart,'BUFF');assert.equal(result.stanceEnd,'STANCE-DEFENSIVE');assert.equal(result.stanceAfterAttack,'STANCE-DEFENSIVE');assert.ok(result.disposed);assert.equal(result.reducedPlayed,false);
 assert.match(result.portrait,/greatsword-v2\/PORTRAIT.webp$/);assert.match(result.conversation,/greatsword-v2\/STANCE-READY.webp$/);
 // Real combat renderer: load the screenshot fixture, change equipped hands, cause a render, then play a card.
 await page.goto(origin+'/?shot=combat');await page.waitForFunction(()=>window.__combat&&document.querySelector('.combatant.player'));
 const fixture=await page.evaluate(()=>Object.keys(window.__combat));
 writeFileSync(resolve(out,'fixture-keys.json'),JSON.stringify(fixture));
 await page.evaluate(()=>{
   const l=window.__combatRunForShot.loadout;for(const [slot,id] of [['rightHand','greatsword'],['leftHand',null],['armor','default']])l.sets[slot][l.active[slot]||0]=id;
 });
 // The live fixture exposes render for review tools; use an ordinary settings UI event if absent.
 await page.evaluate(()=>window.__renderCombatForShot());
 await page.waitForFunction(()=>document.querySelector('.player [data-animation-set="reaverGreatsword"]'),{},{timeout:15000});
 const live=await page.evaluate(async()=>{
  const {stageFor}=await import('/src/ui/services/PoseAnimator.js');
  const stage=stageFor(document.querySelector('.player .sprite'));
  const timing=stage.actionTiming('attack');
  stage.play('attack',timing.totalMs);
  await new Promise(done=>setTimeout(done,550));
  const impact=stage.pose;stage.settle();
  const l=window.__combatRunForShot.loadout;l.sets.leftHand[l.active.leftHand||0]='buckler';window.__renderCombatForShot();
  const swappedAway=!document.querySelector('.player [data-animation-set="reaverGreatsword"]');
  l.sets.leftHand[l.active.leftHand||0]=null;window.__renderCombatForShot();
  return {impact,swappedAway,restored:Boolean(document.querySelector('.player [data-animation-set="reaverGreatsword"]'))};
 });
 assert.deepEqual(live,{impact:'ATK-05',swappedAway:true,restored:true});
 await page.screenshot({path:resolve(out,'combat-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:resolve(out,'combat-mobile.png')});
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2));
 console.log('PASS equipment animation browser: exact nine steps, timing, buff/hurt/stance, portrait/conversation, disposal, reduced motion and live equipped combat.');
 await context.close();
} finally { if(browser){try{const cdp=await browser.newBrowserCDPSession();await cdp.send('Browser.close');}catch{}await browser.close();}await launched.close(); }
