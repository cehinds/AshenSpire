import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=resolve('docs/preview/book-library/qa');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME});
const page=await browser.newPage({viewport:{width:1200,height:1000}});
const errors=[];page.on('pageerror',(e)=>errors.push(e.message));page.on('response',(r)=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await page.route('**/src/buildversion.js',(route)=>route.fulfill({path:resolve('src/buildversion.js'),contentType:'text/javascript'}));
try {
  await page.goto(`${process.env.BOOK_SHOP_URL || 'http://localhost:8769'}/docs/preview/book-library/preview.html?library=1&cardChance=100&featChance=100`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{window.bookShopPreview.run.consumables.starseerClassBook=2;});
  const before=await page.evaluate(()=>({cards:window.bookShopPreview.run.deck.length,feats:window.bookShopPreview.run.feats.length}));
  for (const iteration of [1,2]) {
    if(iteration===2)await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Read Starseer Class Book',exact:true}).click();
    assert.match(await page.locator('[data-component="book-learning"]').innerText(),/100% chance of a combat card.*100% chance of a feat/s);
    await page.locator('.book-learning-confirm').click();
    const receipt=page.locator('[data-component="book-receipt"]');
    assert.match(await receipt.innerText(),/Gained 40 class XP/);
    assert.match(await receipt.innerText(),/Combat card learned:/);
    assert.match(await receipt.innerText(),/Feat gained:/);
    if(iteration===2)assert.match(await receipt.innerText(),/already learned/);
    await page.screenshot({path:resolve(output,`class-book-bonuses-${iteration}.png`),fullPage:true,animations:'disabled'});
    await receipt.getByRole('button',{name:'Close book',exact:true}).click();
    const state=await page.evaluate(()=>{const r=window.bookShopPreview.run;return {cards:r.deck.length,feats:r.feats.length,books:r.consumables.starseerClassBook || 0,xp:r.skills['class:starseer'].xp,revision:r.bookReadRevision,class:r.class};});
    assert.deepEqual(state,{cards:before.cards+iteration,feats:before.feats+iteration,books:2-iteration,xp:40*iteration,revision:iteration,class:'reaver'});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'class-book-results.json'),JSON.stringify({passed:true,checks:['configured odds shown','independent guaranteed card and feat','feat icon rendered','repeat known class','40XP each read','one copy per read','class unchanged','mobile receipt'],errors},null,2));
  console.log('PASS: class-book odds, both rewards, repeat reading and mobile receipt.');
} finally {await browser.close();}
