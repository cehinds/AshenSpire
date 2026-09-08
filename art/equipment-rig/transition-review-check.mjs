import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {TRANSITION_SEQUENCE} from './transition-joints.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),sharp=require('sharp');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],dir='art/equipment-rig/inspection/transitions';page.on('pageerror',e=>errors.push(e.message));await mkdir(dir,{recursive:true});
 await page.goto('http://127.0.0.1:4291/joint-reference-preview.html?v=transitions');await page.waitForFunction(()=>window.sourceReview?.ready);
 assert.equal(await page.locator('#sourceKeys button').count(),11);assert.equal(await page.locator('.joint-gallery figure').count(),20);
 for(const cls of ['reaver','starseer']){
  const cells=[];
  for(const [i,key]of TRANSITION_SEQUENCE.entries()){
   const png=Buffer.from((await page.evaluate(({cls,t})=>{const c=document.createElement('canvas');c.width=800;c.height=600;window.sourceReview.drawSource(c,cls,t);return c.toDataURL()},{cls,t:key.t})).split(',')[1],'base64');
   await writeFile(`${dir}/${cls}-${key.pose}-joints.png`,png);cells.push({input:await sharp(png).resize(400,300).toBuffer(),left:i*400,top:0});
  }
  await sharp({create:{width:2000,height:300,channels:4,background:'#211e19'}}).composite(cells).png().toFile(`${dir}/${cls}-joint-strip.png`);
 }
 await page.locator('#sourceTime').fill('57.5');assert.match(await page.locator('#readout').innerText(),/between3/);assert.match(await page.locator('#reaverAudit').innerText(),/Reference only/);assert.match(await page.locator('#starseerAudit').innerText(),/Guides/);
 for(const speed of ['1','0.25']){await page.selectOption('#speed',speed);await page.click('#sourcePlay');await page.waitForFunction(()=>document.querySelector('#sourcePlay').textContent==='Play key poses');assert.equal(await page.locator('#sourceTime').inputValue(),'100');}
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:1000});
 await page.goto('http://127.0.0.1:4291/equipment-rig-preview.html?v=transitions');await page.waitForFunction(()=>window.rigPreview?.ready);await page.uncheck('#effects');
 const evidence=[];
 for(const [cls,setup]of [['reaver','greatsword'],['starseer','focus']]){
  await page.selectOption('#setup',setup);const cells=[];
  for(const speed of ['1','0.25']){
   await page.selectOption('#rigSpeed',speed);await page.click('#play');
   for(const key of TRANSITION_SEQUENCE){
    await page.waitForFunction(p=>Number(document.querySelector('#time').value)>=p,key.t*100);
    const shot=await page.evaluate(cls=>({phase:Number(document.querySelector('#time').value),url:document.getElementById(cls).toDataURL()}),cls);
    cells.push({input:await sharp(Buffer.from(shot.url.split(',')[1],'base64')).resize(300,300).toBuffer(),left:(cells.length%5)*300,top:Math.floor(cells.length/5)*300});evidence.push({cls,speed,requested:key.t*100,observed:shot.phase});
   }
   await page.waitForFunction(()=>document.querySelector('#play').textContent==='Play animation');assert.equal(await page.locator('#time').inputValue(),'100');
  }
  await sharp({create:{width:1500,height:600,channels:4,background:'#1a1712'}}).composite(cells).png().toFile(`${dir}/${cls}-playback.png`);
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/playback-evidence.json',JSON.stringify(evidence,null,2));console.log('20 mapped poses; 10 new references; decimal phase controls; both source and rig playback at normal/quarter speed; no browser errors. Visual acceptance remains separate.');
}finally{await browser.close()}
