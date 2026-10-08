import {createRequire}from'node:module';import assert from'node:assert/strict';import{writeFileSync,mkdirSync}from'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=(process.env.STANCE_QA_OUT || 'outputs/stance-qa')+'/'; mkdirSync(out,{recursive:true});
const base=process.env.STANCE_GAME_URL || 'http://127.0.0.1:4393/index.html';
const b=await chromium.launch({headless:true,...(process.env.CHROME ? {executablePath:process.env.CHROME} : {})}),errors=[],httpErrors=[],browserNotices=[],results=[];
try{
 for(const actor of ['reaver','rogue','starseer','herald']){
  const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'){if(m.text().startsWith('Blocked call to navigator.vibrate'))browserNotices.push(m.text());else errors.push(m.text());}});
  p.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
  await p.goto(base+'?shot=combat&shotClass='+actor);await p.waitForSelector('.hand .card');
  await p.waitForSelector('.alternative-card-stage[data-pose]');
  for(const [cardId,stance]of [['strike','offensive'],['defend','defensive'],['starstonePebble','casting']]){
   await p.evaluate(({cardId})=>{const c=window.__combat;c.phase='player';c.player.energy=20;c.player.mana=40;c.player.stamina=40;c.player.statuses={};for(const e of c.enemies){e.hp=1000;e.maxHp=1000;e.alive=true;}c.piles.hand=[{cardId,instanceId:'qa-'+cardId,upgraded:false}];window.__renderCombatForShot();},{cardId});
   await p.keyboard.press('1');
   if(cardId==='defend')await p.locator('.combatant.player').click();else await p.keyboard.press('1');
   await p.waitForFunction(stance=>document.querySelector('.alternative-card-stage')?.dataset.pose==='stance-'+stance,stance,{timeout:15000});
   assert.ok(await p.evaluate(id=>window.__combat.eventLog.some(e=>e.type==='cardPlayed'&&e.cardInstanceId==='qa-'+id),cardId));
   await p.screenshot({path:out+actor+'-'+stance+'-game.png'});results.push(actor+':'+stance);
  }
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:out+actor+'-casting-game-phone.png'});

  await p.close();
 }
 writeFileSync(out+'game-qa.json',JSON.stringify({results,errors,httpErrors,browserNotices,viewports:['1440x1000','390x844']},null,2));console.log(JSON.stringify({results,errors,httpErrors,browserNotices}));assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
}finally{await b.close();}


