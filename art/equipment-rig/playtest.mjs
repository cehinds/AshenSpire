import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';const require=createRequire(import.meta.url),{chromium}=require('playwright'),sharp=require('sharp');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4291/equipment-rig-preview.html');await page.waitForFunction(()=>window.rigPreview?.ready);
const dir='art/equipment-rig/inspection';await mkdir(dir,{recursive:true});
for(const setup of ['sword','greatsword','shield','focus','mixed','dualCast','dual','newWeapon']){
 await page.selectOption('#setup',setup);for(const phase of ['0','22','46','69','100']){await page.locator('#time').fill(phase);assert.match(await page.locator('#status').innerText(),/0.0 px/)}
}
// Review both puppets through representative weapon-family moments.
for(const id of ['reaver','starseer']){
 const cells=[];let index=0;
 for(const [setup,action] of [['greatsword','attack'],['shield','guard'],['focus','cast'],['newWeapon','attack']])for(const t of [.22,.46,.69]){
  const url=await page.evaluate(({id,setup,action,t})=>{window.rigPreview.render(id,setup,action,t);return document.getElementById(id).toDataURL()}, {id,setup,action,t});
  const png=Buffer.from(url.split(',')[1],'base64');const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});let edge=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if((x<2||y<2||x>=info.width-2||y>=info.height-2)&&data[(y*info.width+x)*4+3]>0)edge++;if(edge)await writeFile(dir+'/clipped.png',png);assert.equal(edge,0,`${id}/${setup}/${t} clipped`);
  cells.push({input:await sharp(png).resize(270,270).toBuffer(),left:(index%3)*270,top:Math.floor(index/3)*270});index++;
 }
 await sharp({create:{width:810,height:1080,channels:4,background:'#191712'}}).composite(cells).png().toFile(dir+'/'+id+'-motions.png');
}
await page.click('#casterPreset');await page.waitForFunction(()=>document.querySelector('#referenceTitle').textContent.includes('Starseer'));await page.waitForFunction(()=>document.querySelectorAll('#references button').length===3);await page.locator('#references button').first().click();assert.equal(await page.locator('#time').inputValue(),'22');
await page.click('#reaverPreset');await page.waitForFunction(()=>document.querySelector('#referenceTitle').textContent.includes('Reaver'));await page.locator('#time').fill('46');await page.screenshot({path:dir+'/desktop.png',fullPage:true});
await page.locator('#debug').check();await page.screenshot({path:dir+'/joints.png',fullPage:true});await page.locator('#debug').uncheck();await page.locator('#effects').uncheck();await page.locator('#effects').check();
await page.click('#play');await page.waitForFunction(()=>document.querySelector('#play').textContent==='Play animation');assert.equal(await page.locator('#time').inputValue(),'100');
await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.selectOption('#setup','dualCast');await page.locator('#time').fill('69');await page.screenshot({path:dir+'/phone.png',fullPage:true});
assert.deepEqual(errors,[]);await writeFile(dir+'/checks.json',JSON.stringify({setups:8,classes:2,phasesPerSetup:5,visualFrames:24,clippedFrames:0,browserErrors:errors,viewports:[1280,390],playback:'completed',tooling:'Edge via Playwright'},null,2));await browser.close();console.log('8 setups, 24 inspected-frame captures, controls, playback, desktop and mobile passed.');

