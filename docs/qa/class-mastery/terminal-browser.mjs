import {createRequire} from 'node:module'; import {writeFileSync} from 'node:fs'; import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out=process.env.MASTERY_QA_OUT || 'docs/qa/class-mastery';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const errors=[],checks=[];
try { for (const failing of ['slot','profile']) {
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}); const page=await ctx.newPage(); page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.MASTERY_QA_URL || 'http://127.0.0.1:8328') + '/',{waitUntil:'networkidle',timeout:60000}); await page.keyboard.press('Enter');
 await page.locator('[data-title-action="quick-start"]').click(); await page.locator('.class-mastery-node').first().click(); await page.locator('.map-node.reachable').first().waitFor();
 const receipt=await page.evaluate(()=> { const key='sote_run_v1';const run=JSON.parse(localStorage.getItem(key)); run.hp=0;run.pendingFinish={victory:false,id:run.classMasteryState.receiptId};localStorage.setItem(key,JSON.stringify(run));return run.pendingFinish.id; });
 await page.reload({waitUntil:'networkidle'});
 await page.evaluate(failing=>{ const real=Storage.prototype.setItem; window.__restoreStorage=()=>{Storage.prototype.setItem=real;};Storage.prototype.setItem=function(key,value){if(key===(failing==='slot'?'sote_run_v1':'sote_meta_v1'))throw new Error('simulated terminal '+failing+' quota');return real.call(this,key,value);};},failing);
 await page.keyboard.press('Enter'); await page.locator('[data-title-action="continue"]').click();
 await page.locator('.gameover').waitFor(); await page.locator('.confirmation-confirm').waitFor(); assert.equal(await page.locator('#retry-finish').count(),1);
 assert.equal(await page.evaluate(()=>!!localStorage.getItem('sote_run_v1')),true);await page.screenshot({path:out+`/terminal-${failing}-failure.png`});
 await page.locator('.confirmation-cancel').click(); await page.evaluate(()=>window.__restoreStorage()); await page.locator('#retry-finish').click();
 await page.waitForFunction(()=>localStorage.getItem('sote_run_v1')===null); assert.equal(await page.locator('#retry-finish').count(),0);
 const results=await page.evaluate(id=>JSON.parse(localStorage.getItem('sote_meta_v1')).results.filter(r=>r.finishId===id).length,receipt);assert.equal(results,1);
 checks.push({failing,retained:true,retry:true,results});console.log('passed',failing); await ctx.close();
 } assert.deepEqual(errors,[]);writeFileSync(out+'/terminal-result.json',JSON.stringify({checks,errors},null,2));console.log('Actual terminal storage failure browser checks passed',checks);
} finally {await browser.close();}
