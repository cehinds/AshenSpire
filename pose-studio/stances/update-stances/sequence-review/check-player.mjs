import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, serveDir } from '../../../../tools/browser.mjs';
const require=createRequire(import.meta.url);let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const server=await serveDir(dirname(fileURLToPath(import.meta.url)));
const launcher=await launchBrowser({prefix:'seq-check-',args:['--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0'],browser:process.env.CHROME});
const browser=await chromium.connectOverCDP(launcher.wsUrl);const context=await browser.newContext({viewport:{width:1160,height:1100}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));let checks=0;
try{
  await page.goto(server.url('index.html'));await page.waitForFunction(()=>window.__sequenceReview?.ready);
  const state=()=>page.evaluate(()=>({state:window.__sequenceReview.state,codes:window.__sequenceReview.steps().map(step=>step.code),slots:document.querySelectorAll('.slot').length}));
  assert.deepEqual((await state()).codes,['D','V','G','H','C','D']);checks++;
  for(const mode of process.env.ONLY_GUARD?['guard']:['guard','counter']){
    await page.evaluate(mode=>{window.__sequenceReview.select('P',mode);document.getElementById('context').checked=true;window.__sequenceReview.seek(window.__sequenceReview.steps().length-1);},mode);
    await page.locator('#context').uncheck();const after=await state();assert.equal(after.state.index,0);assert.equal(after.slots,after.codes.length);checks+=2;
    // Reproduce the same length transition while the playback timer is active.
    await page.locator('#context').check();await page.evaluate(()=>window.__sequenceReview.seek(window.__sequenceReview.steps().length-2));await page.locator('#play').click();await page.locator('#context').uncheck();assert.equal((await state()).state.playing,false);checks++;
  }
  if(!process.env.ONLY_GUARD){
    for(const mode of ['guard','attack','smash','evade','counter'])for(const origin of ['T','S','C','D','E','W']){
      await page.evaluate(({mode,origin})=>window.__sequenceReview.select('P',mode,origin),{mode,origin});const {codes}=await state();assert.equal(codes[0],origin);assert.equal(codes.at(-1),origin);checks+=2;
    }
    for(const [variant,order]of[['P',['D','V','G','H','C','D']],['A',['C','V','D','H','G','C']],['B',['C','V','H','D','G','C']]]){
      await page.evaluate(v=>{window.__sequenceReview.select(v,'guard');document.getElementById('context').checked=false;window.__sequenceReview.seek(0);},variant);assert.deepEqual((await state()).codes,order);checks++;
    }
  }
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);checks++;
  assert.deepEqual(errors,[]);checks++;console.log(`${checks} player assertions passed; ${process.env.ONLY_GUARD?'primary defense only':'all modes/origins'}.`);
}finally{await context.close();await browser.close();await launcher.close();await server.close();}
