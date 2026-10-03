import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const executable = [process.env.CHROME, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
assert.ok(executable, 'Set CHROME to a Chromium browser');
const port = Number(process.env.ART_TEST_DEBUG_PORT || 9338);
const launched = await launchBrowser({ prefix:'sword-shield-animation-', browser:executable, headless:'--headless=new', awaitEndpoint:false, pinTmp:false, args:[`--remote-debugging-port=${port}`, '--mute-audio', '--disable-extensions', '--disable-background-networking'], timeoutMs:15000 });
const server=process.env.ART_TEST_URL ? null : await serve({root:process.cwd(),port:0,open:false});
const origin = process.env.ART_TEST_URL || `http://127.0.0.1:${server.server.address().port}`;
const out = resolve('scratch/sword-shield-animation');
mkdirSync(out,{recursive:true});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`)).ok)break;}catch{}await new Promise(done=>setTimeout(done,100));}
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 const context=await browser.newContext({viewport:{width:1100,height:800}});
 const page=await context.newPage();
 page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/sword-shield-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="background:#222;color:white"></body>'}));
 await page.goto(origin+'/sword-shield-test.html');
 const result=await page.evaluate(async()=>{
  const {selectEquipmentAnimation,animationClip,animationTiming}=await import('/src/model/equipmentAnimation.js');
  const {createPaintedStage,paintedPresentation}=await import('/src/ui/paintedOutfits.js');
  const {ARMOUR}=await import('/src/content/equipment.js');
  const seen=new Set(),rows=[];
  for(const outfit of ARMOUR){
   const right=selectEquipmentAnimation({classId:outfit.classId,armourId:outfit.id,rightId:'straightSword',leftId:'buckler'});
   const left=selectEquipmentAnimation({classId:outfit.classId,armourId:outfit.id,rightId:'towerShield',leftId:'katana'});
   if(!right||right.setId!==left?.setId)throw new Error('Missing ordered binding: '+outfit.classId+'/'+outfit.id);
   if(!seen.has(right.setId)){
    await Promise.all(Object.values(right.frames).map(async frame=>{const img=new Image();img.src=frame.file;try{await img.decode();}catch(error){throw new Error('Cannot decode '+frame.file+': '+error.message);}}));
    seen.add(right.setId);
   }
   const stage=createPaintedStage(outfit.classId,outfit.id,{animation:right});
   document.body.append(stage.el);
   if(!stage.play('attack',90))throw new Error('Unplayable set '+right.setId);
   rows.push({classId:outfit.classId,armourId:outfit.id,set:right.setId,profile:right.motionProfile,authored:right.authoredEquipment});
   stage.dispose();stage.el.remove();
  }
  const component=selectEquipmentAnimation({classId:'reaver',rightId:'straightSword',leftId:'buckler'});
  const stage=createPaintedStage('reaver','default',{animation:component});document.body.append(stage.el);
  const observed=[];const observer=new MutationObserver(records=>records.filter(r=>r.attributeName==='data-pose').forEach(r=>observed.push(r.target.dataset.pose)));
  observer.observe(stage.el,{attributes:true});stage.play('attack',1100);await new Promise(done=>setTimeout(done,1150));observer.disconnect();
  const poses={};for(const role of ['guard','hit','cast','power']){stage.play(role,100);poses[role]=stage.pose;stage.settle();}
  stage.setRestPose('bulwark',{immediate:true});poses.stance=stage.pose;
  const portrait=paintedPresentation('reaver','default','portrait',component);document.body.append(portrait);await portrait.decode();
  const conversation=paintedPresentation('reaver','default','conversation',component);document.body.append(conversation);await conversation.decode();
  stage.dispose();
  return {rows,appearances:seen.size,observed:observed.slice(0,11),expected:animationClip(component,'attack').frames,timing:animationTiming(component,'attack'),poses,portrait:portrait.src,conversation:conversation.src};
 });
 assert.equal(result.rows.length,35);assert.equal(result.appearances,32);
 assert.ok(result.rows.every(row=>row.profile==='swordShield'&&row.authored.rightGroup==='sword'&&row.authored.leftGroup==='shield'));
 const transitions=frames=>frames.filter((pose,index)=>index===0||pose!==frames[index-1]);
 assert.deepEqual(transitions(result.observed),transitions(result.expected));assert.deepEqual(result.timing,{totalMs:1100,impactMs:700});
 assert.deepEqual(result.poses,{guard:'DEFEND',hit:'HURT',cast:'CAST',power:'BUFF',stance:'STANCE-DEFENSIVE'});
 assert.match(result.portrait,/PORTRAIT.webp$/);assert.match(result.conversation,/STANCE-READY.webp$/);
 await page.goto(origin+'/art/sword-shield-outfits-2026-09-19/index.html');
 await page.locator('#pause').click();
 await page.evaluate(()=>window.ART_READY);
 assert.equal(await page.locator('.card').count(),35);
 await page.evaluate(async()=>{await Promise.all([...document.images].map(img=>img.decode()));});
 assert.equal(await page.locator('.card .portrait').count(),35);
 await page.screenshot({path:resolve(out,'gallery-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(out,'gallery-phone.png')});
 await page.setViewportSize({width:1100,height:800});
 await page.goto(origin+'/index.html?shot=combat&shotKit=1&shotMainHand=straightSword&shotOffHand=buckler',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.player [data-animation-set="reaverSwordShield"]');
 const swaps=await page.evaluate(()=>{
  const loadout=window.__combatRunForShot.loadout;
  const equip=(right,left)=>{loadout.sets.rightHand[loadout.active.rightHand||0]=right;loadout.sets.leftHand[loadout.active.leftHand||0]=left;window.__renderCombatForShot();return document.querySelector('.player [data-animation-set]')?.dataset.animationSet||null;};
  return [equip('buckler','straightSword'),equip('greatsword',null),equip('straightSword',null),equip('straightSword','buckler')];
 });
 assert.deepEqual(swaps,['reaverSwordShield','reaverGreatsword',null,'reaverSwordShield']);
 await page.screenshot({path:resolve(out,'combat-sword-shield.png')});
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2));
 console.log('PASS sword/shield: 35 armor rows, 32 decoded suites, both ordered hands, configured eleven-step aura-free attack/timing, defense/hurt/cast/buff/stance, portrait/conversation, gallery and live equipped combat swaps.');
 await context.close();
} finally {
 if(browser){try{await(await browser.newBrowserCDPSession()).send('Browser.close');}catch{}await browser.close();}
 await launched.close();
 server?.server.closeAllConnections?.();server?.server.close();
}
