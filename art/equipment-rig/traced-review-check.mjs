import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),sharp=require('sharp');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4291/equipment-rig-preview.html?v=traced-motion');await page.waitForFunction(()=>window.rigPreview?.ready);
 const dir='art/equipment-rig/inspection/traced';await mkdir(dir,{recursive:true});
 const evidence=[];
 for(const [cls,setup]of [['reaver','greatsword'],['starseer','focus']]){
  await page.selectOption('#setup',setup);await page.uncheck('#effects');const cells=[];
  for(const speed of ['1','0.25']){
   await page.selectOption('#rigSpeed',speed);await page.click('#play');await page.waitForFunction(()=>Number(document.querySelector('#time').value)<10);
   for(const phase of [22,35,46,69]){
    await page.waitForFunction(p=>Number(document.querySelector('#time').value)>=p,phase);
    const shot=await page.evaluate(cls=>({phase:Number(document.querySelector('#time').value),url:document.getElementById(cls).toDataURL()}),cls);
    const png=Buffer.from(shot.url.split(',')[1],'base64');cells.push({input:await sharp(png).resize(300,300).toBuffer(),left:(cells.length%4)*300,top:Math.floor(cells.length/4)*300});evidence.push({cls,speed,requested:phase,observed:shot.phase});
   }
   await page.waitForFunction(()=>document.querySelector('#play').textContent==='Play animation');assert.equal(await page.locator('#time').inputValue(),'100');
  }
  await sharp({create:{width:1200,height:600,channels:4,background:'#1a1712'}}).composite(cells).png().toFile(dir+'/'+cls+'-playback.png');
 }
 await page.selectOption('#setup','greatsword');await page.locator('#time').fill('46');
 const comparisons=[];for(const model of ['legacy','traced']){await page.selectOption('#motionModel',model);const url=await page.locator('#reaver').evaluate(c=>c.toDataURL());comparisons.push({input:Buffer.from(url.split(',')[1],'base64'),left:comparisons.length*600,top:0});}
 await sharp({create:{width:1200,height:600,channels:4,background:'#1a1712'}}).composite(comparisons).png().toFile(dir+'/overhead-before-after.png');
 assert.deepEqual(errors,[]);await writeFile(dir+'/playback-evidence.json',JSON.stringify(evidence,null,2));console.log('Both revised sequences played at normal and quarter speed; 16 actual playback captures; previous/revised switch passed.');
}finally{await browser.close()}
