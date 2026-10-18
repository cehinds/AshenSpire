// Paid plays in a controlled registered-card encounter; no renderer/timeline patches.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {launchBrowser} from './browser.mjs';
import {optionalClassSmashAudioProbe,classSmashConsoleNotice} from './lib/class-smash-qa-notices.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.QA_BUILD_URL||'http://127.0.0.1:4403/AshenSpire.html';
const out=resolve(process.env.QA_OUTPUT||'/tmp/default-weapons-qa');mkdirSync(out,{recursive:true});
const html=await(await fetch(url)).text(),build={ordinal:html.match(/const ORDINAL = '(\d+)'/)?.[1],digest:html.match(/const SOURCE = '([a-f0-9]+)'/)?.[1],runtimeSource:process.env.QA_RUNTIME_SOURCE};
const owner=await launchBrowser({prefix:'default-weapons-',browser:process.env.CHROME||'/usr/bin/chromium'});
const browser=await chromium.connectOverCDP(owner.wsUrl),results=[],errors=[],notices=[];let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};const ok=(v,label)=>{assert.ok(v,label);checks++;};
const cases=[['reaver','shortbow','buckler','bashingBlow','smash','pilot-smash-impact'],
 ['reaver','straightSword','buckler','strike','attack','pilot-attack-4'],
 ['reaver','shortbow','buckler','strike','ranged','ranged-release'],
 ['rogue','greatsword','','bashingBlow','smash','class-smash-impact'],
 ['starseer','dagger','buckler','bashingBlow','smash','class-smash-impact'],
 ['herald','straightSword','katana','bashingBlow','smash','class-smash-impact']];
try{
 for(const [actor,right,left,cardId,action,impact] of cases){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push({actor,message:e.message}));
  page.on('response',r=>{if(r.status()>=400){const row={actor,url:r.url(),status:r.status()};if(optionalClassSmashAudioProbe(r.url(),r.status(),url))notices.push(row);else errors.push(row);}});
  page.on('console',m=>{if(m.type()==='error'){if(classSmashConsoleNotice(m.text()))notices.push({actor,message:m.text()});else errors.push({actor,console:m.text()});}});
  const params=new URLSearchParams({shot:'combat',shotKit:'1',shotClass:actor,shotMainHand:right,shotOffHand:left,shotSeed:'B',shotSettings:JSON.stringify({animSpeed:'normal'})});
  await page.goto(url+'?'+params,{waitUntil:'domcontentloaded'});await page.waitForSelector('.end-turn:not([disabled])');
  const prepared=await page.evaluate(async({cardId,action})=>{
   const c=window.__combat,e=c.enemies[0];e.hp=e.maxHp=1000;e.alive=true;e.block=0;e.statuses={};e.ratings={ar:0,dr:0,pr:0,poise:0,ward:0};c.enemies=[e];c.player.energy=c.player.stamina=c.player.mana=30;
   const definition=c.registries.cards.get(cardId);if(!definition)throw Error('Missing registered card '+cardId);
   const card=Object.values(c.piles).filter(Array.isArray).flat().find(row=>row.cardId===cardId)||{cardId,instanceId:'qa:default:'+cardId,upgraded:false};
   for(const [key,pile]of Object.entries(c.piles))if(Array.isArray(pile))c.piles[key]=pile.filter(row=>row.instanceId!==card.instanceId);c.piles.hand=[card];window.__renderCombatForShot();
   const stage=document.querySelector('.combatant.player .alternative-card-stage').__poseStage;await stage.ready;
   const trace=[];let last='';const record=()=>{const pose=document.querySelector('.combatant.player .alternative-card-stage')?.dataset.pose;if(pose!==last){last=pose;trace.push({pose,at:performance.now()});}};
   const observer=new MutationObserver(record);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-pose']});record();window.__defaultTrace=trace;window.__defaultObserver=observer;
   return {instanceId:card.instanceId,loadout:structuredClone(window.__combatRunForShot.loadout),definition:structuredClone(definition),timing:stage.actionTiming(action),poses:stage.poses,energy:c.player.stamina};
  },{cardId,action});
  ok(JSON.stringify(prepared.loadout).includes(right),actor+' actual nondefault main hand retained');
  if(left)ok(JSON.stringify(prepared.loadout).includes(left),actor+' actual nondefault offhand retained');
  eq(prepared.poses.some(p=>p.startsWith('weapon:')),false,actor+' no alternate family dispatch');
  const screenshot=page.waitForFunction(p=>document.querySelector('.combatant.player .alternative-card-stage')?.dataset.pose===p,impact,{polling:'raf',timeout:15000}).then(()=>page.screenshot({path:resolve(out,actor+'-'+action+'.png')})).catch(async error=>{console.error(JSON.stringify(await page.evaluate(()=>({trace:window.__defaultTrace,events:window.__combat.eventLog.slice(-8).map(e=>({type:e.type,cardId:e.cardId,cardTags:e.cardTags})),pose:document.querySelector('.combatant.player .alternative-card-stage')?.dataset.pose}))));throw error;});
  await page.locator('.hand .card[data-instance-id='+JSON.stringify(prepared.instanceId)+']').click();
  await page.locator('.enemy-target-button').first().click();
  await page.waitForFunction(id=>window.__combat.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId===id),prepared.instanceId);
  await page.waitForSelector('.end-turn:not([disabled])');await screenshot;
  const actual=await page.evaluate(cardId=>{window.__defaultObserver.disconnect();const c=window.__combat,s=document.querySelector('.combatant.player .alternative-card-stage').__poseStage;return {loadout:structuredClone(window.__combatRunForShot.loadout),definition:structuredClone(c.registries.cards.get(cardId)),trace:window.__defaultTrace,paid:c.eventLog.filter(e=>e.type==='cardPlayed'),damage:c.eventLog.filter(e=>e.type==='damageDealt'),stamina:c.player.stamina,enemyHp:c.enemies[0].hp,pose:s.pose};},cardId);
  eq(actual.loadout,prepared.loadout,actor+' authoritative loadout unchanged by painting');
  eq(actual.definition,prepared.definition,actor+' registered equipped card effects unchanged');
  ok(actual.paid.some(e=>e.cardInstanceId===prepared.instanceId),actor+' genuine paid event');
  ok(actual.stamina<prepared.energy,actor+' actual card cost paid');ok(actual.enemyHp<1000,actor+' actual card damage resolved');
  ok(actual.trace.some(r=>r.pose===impact),actor+' class default impact painted');
  results.push({actor,right,left,cardId,action,prepared,actual});await context.close();
 }
 writeFileSync(resolve(out,'results.json'),JSON.stringify({build,checks,results,errors,notices},null,2));
 eq(errors,[],'zero application or unknown asset errors');
 console.log(JSON.stringify({build,cases:results.length,checks,errors,out}));
}finally{await browser.close();await owner.close();}
