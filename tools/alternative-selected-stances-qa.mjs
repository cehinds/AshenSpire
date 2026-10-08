import {createRequire}from'node:module';import assert from'node:assert/strict';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {alternativeSelectedStances} from '../src/content/alternativeSelectedStances.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=(process.env.STANCE_QA_OUT || 'outputs/stance-qa')+'/'; mkdirSync(out,{recursive:true});
const base=process.env.STANCE_GAME_URL || 'http://127.0.0.1:4393/index.html';
const manifest=JSON.parse(readFileSync(new URL('../art-manifest.json',import.meta.url),'utf8'));
// Existing audio deliberately probes these optional samples before retaining
// its procedural recipe. A newly shipped sample must pass the normal gate.
const optionalSamples=new Set(['cardPlay','hit_light','hit_medium','block','relic'].filter(id=>!manifest.assets['assets/sfx/'+id+'.ogg']));
const optionalSample=url=>optionalSamples.has(String(url).match(/\/assets\/sfx\/([\w]+)\.ogg$/)?.[1]);
const b=await chromium.launch({headless:true,...(process.env.CHROME ? {executablePath:process.env.CHROME} : {})}),errors=[],httpErrors=[],optionalAudioRequests=[],browserNotices=[],results=[];
function watch(page){
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'){
  if(m.text().startsWith('Blocked call to navigator.vibrate'))browserNotices.push(m.text());
  else if(!optionalSample(m.location().url))errors.push(m.text());
 }});
 page.on('response',r=>{if(r.status()>=400)(r.status()===404&&optionalSample(r.url())?optionalAudioRequests:httpErrors).push({url:r.url(),status:r.status()});});
}
try{
 for(const actor of ['reaver','rogue','starseer','herald']){
  const p=await b.newPage({viewport:{width:1440,height:1000}});watch(p);
  await p.goto(base+'?shot=combat&shotClass='+actor);await p.waitForSelector('.hand .card');
  await p.waitForSelector('.alternative-card-stage[data-pose]');
  for(const [cardId,stance]of [['strike','offensive'],['defend','defensive'],['starstonePebble','casting']]){
   // A held pose can paint before the final effects release combat input.
   await p.waitForFunction(()=>document.querySelector('.end-turn')?.disabled===false);
   await p.evaluate(({cardId})=>{const c=window.__combat;c.phase='player';c.player.energy=20;c.player.mana=40;c.player.stamina=40;c.player.statuses={};for(const e of c.enemies){e.hp=1000;e.maxHp=1000;e.alive=true;}c.piles.hand=[{cardId,instanceId:'qa-'+cardId,upgraded:false}];window.__renderCombatForShot();},{cardId});
   await p.keyboard.press('1');
   if(cardId==='defend')await p.locator('.combatant.player').click();else await p.keyboard.press('1');
   await p.waitForFunction(stance=>document.querySelector('.alternative-card-stage')?.dataset.pose==='stance-'+stance,stance,{timeout:15000});
   assert.ok(await p.evaluate(id=>window.__combat.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId==='qa-'+id),cardId));
   await p.screenshot({path:out+actor+'-'+stance+'-game.png'});results.push(actor+':'+stance);
  }
  await p.close();
  const phone=await b.newPage({viewport:{width:390,height:844},hasTouch:true});watch(phone);
  const mobileFrame=alternativeSelectedStances.classes[actor].frames.casting;
  let mobileLoaded=false;
  phone.on('response',r=>{if(r.ok()&&(r.url().includes(mobileFrame.liteSha256)||r.url().endsWith(mobileFrame.lite)))mobileLoaded=true;});
  await phone.goto(base+'?shot=combat&shotClass='+actor);await phone.waitForSelector('.hand .card');
  await phone.evaluate(()=>{
   const c=window.__combat;c.player.energy=20;c.player.mana=40;c.player.stamina=40;
   c.piles.hand=[{cardId:'starstonePebble',instanceId:'qa-phone-cast',upgraded:false}];window.__renderCombatForShot();
  });
  await phone.keyboard.press('1');await phone.keyboard.press('1');
  await phone.waitForFunction(()=>document.querySelector('.alternative-card-stage')?.dataset.pose==='stance-casting');
  await phone.screenshot({path:out+actor+'-casting-game-phone.png'});
  assert.ok(mobileLoaded,actor+' must load its selected Lite artwork on a fresh phone viewport');
  results.push(actor+':phone-lite');await phone.close();
 }
 const coop=await b.newPage({viewport:{width:1440,height:1000}});
 watch(coop);
 await coop.goto(base+'?shot=coop&shotSeats=2');
 await coop.waitForSelector('.alternative-card-stage[data-pose]');
 for(const [seq,playerId,cardId,cardType]of [[1,'p1','starstonePebble','spell'],[2,'p2','defend','skill']]){
  await coop.evaluate(({seq,playerId,cardId,cardType})=>{
   const s=structuredClone(window.__coopSnapshotForShot);
   s.scene.receiptSeq=seq;s.scene.events=[{type:'cardPlayed',playerId,cardId,cardType,cardInstanceId:'qa-'+seq,targetId:cardId==='defend'?playerId:'e1'}];
   window.__receiveCoopSnapshotForShot(s);
  },{seq,playerId,cardId,cardType});
  await coop.waitForFunction(({actor,stance})=>document.querySelector(`[data-animation-set="class-cards-${actor}"]`)?.dataset.pose==='stance-'+stance,{actor:playerId==='p1'?'starseer':'reaver',stance:playerId==='p1'?'casting':'defensive'});
 }
 assert.equal(await coop.locator('[data-animation-set="class-cards-starseer"]').getAttribute('data-pose'),'stance-casting');
 assert.equal(await coop.locator('[data-animation-set="class-cards-reaver"]').getAttribute('data-pose'),'stance-defensive');
 await coop.screenshot({path:out+'coop-selected-game.png'});
 await coop.evaluate(()=>{
  const s=structuredClone(window.__coopSnapshotForShot);s.scene.receiptSeq=3;
  s.scene.events=[{type:'playerTurnStart',playerId:'p1'}];window.__receiveCoopSnapshotForShot(s);
 });
 await coop.waitForFunction(()=>document.querySelector('[data-animation-set="class-cards-starseer"]')?.dataset.pose==='ready');
 assert.equal(await coop.locator('[data-animation-set="class-cards-reaver"]').getAttribute('data-pose'),'stance-defensive');
 await coop.setViewportSize({width:390,height:844});await coop.screenshot({path:out+'coop-selected-game-phone.png'});
 results.push('coop:independent-seats','coop:own-turn-reset');await coop.close();
 writeFileSync(out+'game-qa.json',JSON.stringify({base,results,errors,httpErrors,optionalAudioRequests,browserNotices,viewports:['1440x1000','390x844']},null,2));console.log(JSON.stringify({results,errors,httpErrors,optionalAudioRequests,browserNotices}));assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
}finally{await b.close();}


