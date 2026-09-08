// Actual selected-card inspection and hold-to-use flows, desktop and touch.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=resolve(process.env.CARD_USE_OUT || 'docs/preview/card-use'); mkdirSync(output,{recursive:true});
const server=await serve({root:process.cwd(),port:0,open:false});
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=`http://localhost:${server.server.address().port}`;
let checks=0;
const check=(yes,label)=>{assert.ok(yes,label);checks++;console.log('PASS '+label)};
try {
for(const phone of [false,true]) {
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:1000},isMobile:phone,hasTouch:phone});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+(process.argv.includes('--standalone')?'/AshenSpire.html':'/index.html')+'?shot=combat');
 await page.waitForSelector('.hand .card'); await page.waitForTimeout(700);
 const name=phone?'phone':'desktop';
 check(await page.locator('.hand .card-info-button:visible').count()===0,name+' info hidden before selection');
 await page.evaluate(()=>{window.__qaBlock={...window.__combat.piles.hand[1]};window.__qaAttack={...window.__combat.piles.hand[0]}});
 const fixture=async(kind,id,energy=10)=>{
  await page.evaluate(({kind,id,energy})=>{const c=window.__combat;c.phase='player';c.player.energy=energy;c.player.mana=10;c.player.stamina=10;c.piles.hand=[{...(kind==='attack'?window.__qaAttack:window.__qaBlock),instanceId:id}];window.__renderCombatForShot()},{kind,id,energy});
  await page.waitForTimeout(250);
 };
 const select=async()=>{const card=page.locator('.hand .card').last(); if(phone)await card.tap({position:{x:50,y:90}});else await card.click({position:{x:50,y:90}});await page.waitForTimeout(150);return card};
 const plays=id=>page.evaluate(id=>window.__combat.eventLog.filter(e=>e.type==='cardPlayed'&&e.cardInstanceId===id).length,id);
 await fixture('block','qa-modal');const card=await select();const info=card.locator('.card-info-button');
 check(await info.isVisible(),name+' selection reveals info');
 const g=await card.evaluate(c=>{const r=c.getBoundingClientRect(),b=c.querySelector('.card-info-button').getBoundingClientRect();return {circle:Math.abs(b.width-b.height)<1,above:b.bottom<r.top,center:Math.abs(b.x+b.width/2-r.x-r.width/2)<1}});
 check(g.circle&&g.above&&g.center,name+' circular information floats centered above card');
 check(await plays('qa-modal')===0,name+' tap selects without playing');
 await page.screenshot({path:resolve(output,name+'-selected.png')});
 await info.click();await page.locator('.card-inspection-modal').waitFor();
 check(await page.locator('.card-inspection-play').isEnabled(),name+' playable card has enabled action');
 await page.screenshot({path:resolve(output,name+'-modal.png')});
 await page.locator('.card-inspection-play').click();await page.waitForTimeout(1800);
 check(await plays('qa-modal')===1,name+' modal plays exactly once');
 await fixture('block','qa-poor',0);await select();await page.locator('.hand .card-info-button').click();
 check(await page.locator('.card-inspection-play').isDisabled(),name+' unaffordable action disabled');
 check((await page.locator('.card-inspection-modal').innerText()).includes('Not enough resources'),name+' disabled reason visible');
 await page.keyboard.press('Escape');
 await fixture('attack','qa-target');await select();await page.locator('.hand .card-info-button').click();await page.locator('.card-inspection-play').click();
 check(await plays('qa-target')===0 && await page.locator('.hand .card.selected').count()===1,name+' target card enters targeting without spending');
 await page.keyboard.press('Escape');
 await fixture('block','qa-hold');const held=await select();
 const bounds=await held.boundingBox();const pt={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height*.55};
 const cdp=await context.newCDPSession(page);
 const down=async()=>phone?cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]}):(await page.mouse.move(pt.x,pt.y),page.mouse.down());
 const up=async()=>phone?cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):page.mouse.up();
 await down();await page.waitForTimeout(160);
 check(await held.evaluate(c=>c.dataset.hold==='holding'&&Number(c.dataset.holdProgress)>0),name+' hold paints progress');
 check(await held.evaluate(c=>c.dataset.inspect!=='open'),name+' hold does not open zoom inspector');
 await up();await page.waitForTimeout(200);check(await plays('qa-hold')===0,name+' early release does not play');
 await down();await page.waitForTimeout(100);
 if(phone) await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 else { await held.dispatchEvent('pointercancel',{pointerId:1}); await page.mouse.up(); }
 await page.waitForTimeout(600);check(await plays('qa-hold')===0,name+' cancelled hold does not play');
 await down();await page.waitForTimeout(800);await up();await page.waitForTimeout(1700);
 check(await plays('qa-hold')===1,name+' completed hold plays exactly once');
 await fixture('block','qa-drag');const dragCard=await select();const r=await dragCard.boundingBox();const field=await page.locator('.field').boundingBox();
 const from={x:r.x+r.width/2,y:r.y+r.height*.55},to={x:field.x+field.width*.45,y:field.y+field.height*.5};
 if(phone){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();}
 await page.waitForTimeout(1800);check(await plays('qa-drag')===1,name+' drag cancels hold and plays exactly once');
 check(errors.length===0,name+' no runtime errors '+errors.join(';'));
 await context.close();
}
console.log(`card-use: ${checks} passed`);
}finally{await browser.close();server.server.closeAllConnections?.();server.server.close()}
