import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
import {SEQUENCES,DURATIONS} from './sequences.mjs';
const require=createRequire(import.meta.url),sharp=require('sharp'),{chromium}=require('playwright'),root='art/combined-reference/transitions';
await mkdir(`${root}/inspection`,{recursive:true});
for(const id of Object.keys(SEQUENCES)){
 const layers=[];
 for(let i=0;i<7;i++){
  const path=`${root}/frames/${id}/${i}.png`,m=await sharp(path).metadata();assert.equal(m.width,600);assert.equal(m.height,560);assert.ok(m.hasAlpha);
  layers.push({input:await sharp(path).resize(240,224).png().toBuffer(),left:i*240,top:0});
 }
 await sharp({create:{width:1680,height:224,channels:4,background:'#303030'}}).composite(layers).png().toFile(`${root}/inspection/${id}-strip.png`);
}
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),page=await browser.newPage({viewport:{width:1380,height:1000}}),errors=[],failed=[],playback=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
try{
 await page.goto('http://127.0.0.1:4291/transition-reference-preview.html');
 for(const id of Object.keys(SEQUENCES)){
  await page.locator(`[data-id="${id}"]`).click();await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('#frames button').count(),7);assert.equal(await page.locator('#frames .bridge').count(),3);
  for(let i=0;i<7;i++){await page.locator(`[data-frame="${i}"]`).click();assert.equal(await page.evaluate(()=>window.transitionReference.frame),i);await page.locator('#current').evaluate(img=>img.decode());}
  await page.locator('[data-frame="0"]').click();await page.locator('#back').click();assert.equal(await page.evaluate(()=>window.transitionReference.frame),6);await page.locator('#next').click();assert.equal(await page.evaluate(()=>window.transitionReference.frame),0);
  await page.locator('#play').click();const seen=new Set();for(let t=0;t<30;t++){await page.waitForTimeout(50);seen.add(await page.evaluate(()=>window.transitionReference.frame));}assert.equal(seen.size,7,`${id}: playback visits every frame`);await page.locator('#play').click();
  await page.locator('[data-frame="0"]').click();await page.locator('#speed').selectOption('0.25');await page.locator('#play').click();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.transitionReference.frame),0);await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>window.transitionReference.frame),1);await page.locator('#play').click();await page.locator('#speed').selectOption('1');
  await page.locator('[data-frame="2"]').click();await page.locator('#onion').check();assert.equal(await page.locator('#previous').evaluate(el=>getComputedStyle(el).display),'block');await page.locator('#onion').uncheck();
  await page.screenshot({path:`${root}/inspection/${id}-desktop.png`,fullPage:true});playback.push({id,framesSeen:[...seen].sort(),quarterSpeed:true});
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${root}/inspection/phone.png`,fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto('http://127.0.0.1:4291/transition-reference-preview.html?class=invalid');assert.equal(await page.evaluate(()=>window.transitionReference.id),'reaver');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(`${root}/inspection/check.json`,JSON.stringify({frames:42,playback,durationMs:DURATIONS.reduce((a,b)=>a+b),mobileOverflow:false,errors,failed},null,2)+'\n');console.log('42 sprites: playback, quarter speed, stepping, loop, onion overlay, image loading and phone layout pass.');
}finally{await browser.close()}
