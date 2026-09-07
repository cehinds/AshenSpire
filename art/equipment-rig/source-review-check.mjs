import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),sharp=require('sharp');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4291/joint-reference-preview.html');await page.waitForFunction(()=>window.sourceReview?.ready);
 const dir='art/equipment-rig/inspection/source-maps';await mkdir(dir,{recursive:true});
 const cells=[];
 for(const [row,cls]of ['reaver','starseer'].entries())for(const [col,t]of [0,.22,.46,.69,.86].entries()){
  const url=await page.evaluate(({cls,t})=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;window.sourceReview.drawSource(canvas,cls,t);return canvas.toDataURL()}, {cls,t});
  const png=Buffer.from(url.split(',')[1],'base64');await writeFile(`${dir}/${cls}-${col}.png`,png);cells.push({input:await sharp(png).resize(400,300).toBuffer(),left:col*400,top:row*300});
 }
 await sharp({create:{width:2000,height:600,channels:4,background:'#211e19'}}).composite(cells).png().toFile(dir+'/all-joints.png');
 await page.check('#rigOverlay');await page.locator('#sourceTime').fill('46');assert.match(await page.locator('#reaverAudit').innerText(),/needs revision/);await page.screenshot({path:dir+'/comparison.png',fullPage:true});
 for(const speed of ['1','0.25']){await page.selectOption('#speed',speed);await page.click('#sourcePlay');await page.waitForFunction(()=>document.querySelector('#sourcePlay').textContent==='Play key poses');assert.equal(await page.locator('#sourceTime').inputValue(),'100');assert.match(await page.locator('#readout').innerText(),/Return to guard/);}
 await page.uncheck('#rigOverlay');await page.check('#jointLabels');await page.locator('#sourceTime').fill('22');await page.uncheck('#sourceOverlay');await page.check('#sourceOverlay');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:dir+'/phone.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('10 source maps captured; normal/quarter-speed playback returns to guard; comparison, overlays and 390px layout pass. Visual approval remains separate.');
}finally{await browser.close()}
