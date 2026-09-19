const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8791',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.card').count(),60);
 await page.locator('img').evaluateAll(images=>images.forEach(im=>im.loading='eager'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await page.locator('#pause').click();assert.equal(await page.locator('#pause').textContent(),'Play all');
 await page.locator('#rogue .copy').last().click();assert.match(await page.locator('#selection').inputValue(),/ROGUE.*PORTRAIT/);
 await page.locator('#statusFilter').selectOption('review');assert.equal(await page.locator('#pairs tr').count(),4);
 await page.locator('#classFilter').selectOption('rogue');assert.equal(await page.locator('#pairs tr').count(),1);
 await page.locator('#background').click();assert.equal(await page.locator('.card.light').count(),60);
 await page.locator('#background').click();await page.screenshot({path:path.join(__dirname,'gallery-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(__dirname,'gallery-mobile.png')});
 assert.deepEqual(errors,[]);await browser.close();console.log('Gallery verified: 60 image cards, 4 review groups, labels/copy selection, pause, filters, backgrounds, mobile width, no broken images or script errors.');
})().catch(e=>{console.error(e);process.exit(1)});

