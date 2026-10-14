// Actual paid UI plays in the unpatched compiled game; Shot Kit sets the fixture.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {launchBrowser} from './browser.mjs';
import {classSmashAnimations} from '../src/content/classSmashAnimations.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.QA_BUILD_URL || 'http://127.0.0.1:4402/dist/AshenSpire.html';
const out=resolve(process.env.QA_OUTPUT || '/tmp/class-smash-qa');mkdirSync(out,{recursive:true});
const html=await (await fetch(url)).text();
const build={ordinal:html.match(/const ORDINAL = '(\d+)'/)?.[1],digest:html.match(/const SOURCE = '([a-f0-9]+)'/)?.[1]};
assert.ok(build.ordinal&&build.digest,'compiled candidate must be stamped');
const owner=await launchBrowser({prefix:'class-smash-',browser:process.env.CHROME || '/usr/bin/chromium'});
const browser=await chromium.connectOverCDP(owner.wsUrl),results=[],errors=[];
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const eq=(value,wanted,label)=>{assert.deepEqual(value,wanted,label);checks++;};
try{
 for(const [actor,right,left]of [['rogue','dagger','buckler'],['starseer','ashStaff',''],['herald','boneSceptre','']]){
  ok(classSmashAnimations.classes[actor],actor+' production registry present');
  for(const mode of ['desktop-cold','phone','reduced','instant']){
   const phone=mode==='phone',staticMode=['reduced','instant'].includes(mode);
   const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:1000},isMobile:phone,hasTouch:phone,reducedMotion:mode==='reduced'?'reduce':'no-preference'});
   const page=await context.newPage();page.on('pageerror',e=>errors.push({actor,mode,message:e.message}));
   const params=new URLSearchParams({shot:'combat',shotKit:'1',shotClass:actor,shotMainHand:right,shotOffHand:left,shotSeed:'B',shotSettings:JSON.stringify({animSpeed:mode==='instant'?'instant':'normal'})});
   await page.goto(url+'?'+params,{waitUntil:'domcontentloaded'});await page.waitForSelector('.end-turn:not([disabled])');
   const prepared=await page.evaluate(async()=>{
    const c=window.__combat,e=c.enemies[0];e.hp=e.maxHp=1000;e.alive=true;e.block=0;e.statuses={};e.ratings={ar:0,dr:0,pr:0,poise:0,ward:0};c.enemies=[e];c.player.energy=c.player.stamina=c.player.mana=30;
    const card=c.piles.hand.find(row=>row.cardId==='bashingBlow');if(!card)throw Error('canonical starter Smash missing');c.piles.hand=[card];window.__renderCombatForShot();
    const el=document.querySelector('.combatant.player .alternative-card-stage');await el.__poseStage.ready;
    window.__classSmashTrace=[];window.__fx.trace=[];let previous='';
    const record=()=>{const pose=el.dataset.pose;if(pose!==previous){previous=pose;window.__classSmashTrace.push({pose,at:performance.now()});}};
    const observer=new MutationObserver(record);observer.observe(el,{attributes:true,attributeFilter:['data-pose']});record();window.__stopClassSmashTrace=()=>observer.disconnect();
    return {instanceId:card.instanceId,timing:el.__poseStage.actionTiming('smash'),title:document.title};
   });
   eq(prepared.timing,{totalMs:195,impactMs:117},actor+' '+mode+' authored Normal cadence');
   const shot=!staticMode?page.waitForFunction(()=>document.querySelector('.combatant.player .alternative-card-stage')?.dataset.pose==='class-smash-impact',{},{polling:'raf',timeout:15000}).then(()=>page.screenshot({path:resolve(out,actor+'-'+mode+'.png')})):null;
   const card=page.locator('.hand .card[data-instance-id='+JSON.stringify(prepared.instanceId)+']');
   if(phone)await card.tap();else await card.click();
   if(phone)await page.locator('.combatant.enemy').first().tap();else await page.locator('.combatant.enemy').first().click();
   let stress=null;
   if(mode==='desktop-cold')stress=await page.evaluate(()=>{const start=performance.now();const trace=window.__fx.trace;const swing=trace.findLast(t=>t[1]==='swing');const already=trace.some(t=>t[1]==='contact'&&t[0]>=(swing?.[0]||0));while(performance.now()-start<220){}return {start,end:performance.now(),already};});
   await page.waitForFunction(id=>window.__combat.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId===id),prepared.instanceId);
   await page.waitForSelector('.end-turn:not([disabled])');if(shot)await shot;
   if(staticMode)await page.screenshot({path:resolve(out,actor+'-'+mode+'.png')});
   const actual=await page.evaluate(frames=>{
    window.__stopClassSmashTrace();const el=document.querySelector('.combatant.player .alternative-card-stage'),stage=el.__poseStage,canvas=el.querySelector('canvas'),box=canvas.getBoundingClientRect();
    // Production coordinates are in the common stage world; canvas padding is
    // recovered from the actual currently drawn registered held frame.
    const f=frames.held,art=stage.currentArt,pad=[art.left-f.drawOffset[0],art.top-f.drawOffset[1]],sx=box.width/canvas.width,sy=box.height/canvas.height;
    return {trace:window.__classSmashTrace,fx:window.__fx.trace,paid:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'),pose:stage.pose,stance:stage.stance,
     bounds:Object.entries(frames).map(([key,v])=>({key,left:box.left+(v.stageBounds[0]+pad[0])*sx,right:box.left+(v.stageBounds[2]+pad[0])*sx,top:box.top+(v.stageBounds[1]+pad[1])*sy,bottom:box.top+(v.stageBounds[3]+pad[1])*sy})),
     viewport:[innerWidth,innerHeight],overflow:document.documentElement.scrollWidth>innerWidth,title:document.title};
   },classSmashAnimations.classes[actor].frames);
   ok(actual.title&&prepared.title===actual.title,actor+' '+mode+' page identity');eq(actual.paid.length,1,actor+' '+mode+' one paid card');eq(actual.pose,'stance-smash',actor+' '+mode+' held origin restored');eq(actual.overflow,false,actor+' '+mode+' no document overflow');
   if(staticMode)eq(actual.trace.some(row=>row.pose?.startsWith('class-smash-')),false,actor+' '+mode+' static origin');
   else{
    let cursor=0;const expected=['class-smash-takeoff','class-smash-airborne','class-smash-impact'];for(const row of actual.trace)if(row.pose===expected[cursor])cursor++;eq(cursor,3,actor+' '+mode+' ordered painted action slots');
    ok(actual.fx.some(row=>row[1]==='contact'),actor+' '+mode+' actual effect contact');
   }
   if(stress)eq(stress.already,false,actor+' cold workload began before actual contact');
   if(phone)for(const f of actual.bounds){ok(f.left>=0&&f.right<=390,actor+' '+f.key+' complete horizontal reach');ok(f.top>=0&&f.bottom<=844,actor+' '+f.key+' complete vertical reach');}
   results.push({actor,mode,stress,...actual});await context.close();
  }
 }
 eq(errors,[],'no application exceptions');writeFileSync(resolve(out,'results.json'),JSON.stringify({build,checks,results,errors},null,2));console.log(JSON.stringify({build,checks,cases:results.length,errors,out}));
}finally{await browser.close();await owner.close();}
