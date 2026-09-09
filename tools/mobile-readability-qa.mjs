import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8212/index.html';
const out = resolve('outputs/mobile-readability');
mkdirSync(out, {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const results = [];
try {
  for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
    const context = await browser.newContext({viewport,hasTouch:viewport.width===390});
    const page = await context.newPage();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}?shot=combat&shotScene=cinder-reach-4`);
    await page.locator('.combatant .meters').first().waitFor();
    await page.waitForTimeout(1400);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.evaluate(() => {
      window.flashSamples=[]; window.flashSampling=true;
      const sample=()=>{
        window.flashSamples.push({phase:document.querySelector('.combat')?.dataset.turn,
          widths:[...document.querySelectorAll('.combatant .meters')].map(e=>e.getBoundingClientRect().width)});
        if(window.flashSampling)requestAnimationFrame(sample);
      }; sample();
    });
    await page.locator('.end-turn').hover(); await page.mouse.down();
    await page.waitForTimeout(1800); await page.mouse.up();
    await page.waitForFunction(()=>document.querySelector('.combat').dataset.turn==='enemy',null,{timeout:10000});
    await page.screenshot({path:resolve(out,`combat-${viewport.width}-enemy.png`)});
    await page.waitForFunction(()=>document.querySelector('.combat').dataset.turn==='player',null,{timeout:60000});
    await page.waitForTimeout(700);
    const samples=await page.evaluate(()=>{window.flashSampling=false;return window.flashSamples;});
    const first=samples[0].widths;
    assert.ok(samples.some(s=>s.phase==='enemy'));
    assert.ok(samples.every(s=>s.widths.length===first.length && s.widths.every((w,i)=>Math.abs(w-first[i])<1)), 'meters keep their fitted width in every sampled frame');
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    await page.screenshot({path:resolve(out,`combat-${viewport.width}-player.png`)});
    // Add enough real effects to exercise overflow without changing game content.
    const before=await page.locator('.player .meters').first().boundingBox();
    await page.evaluate(()=>{
      for(const id of ['strength','dexterity','weak','vulnerable','frail','regen'])
        window.__combat.player.statuses[id]={stacks:2,duration:3};
      window.__renderCombatForShot();
    });
    await page.waitForTimeout(100);
    const after=await page.locator('.player .meters').first().boundingBox();
    assert.ok(Math.abs(after.y-before.y)<1,'status changes do not move vitality');
    const overflow=page.locator('.player .status-overflow summary').first();
    if(await overflow.count()) {
      assert.equal(await page.locator('.player .status-overflow-list').isVisible(),false);
      await overflow.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.player .status-overflow-list').isVisible(),true);
      await page.screenshot({path:resolve(out,`statuses-${viewport.width}.png`)});
      await page.keyboard.press('Enter');
    } else await page.screenshot({path:resolve(out,`statuses-${viewport.width}.png`)});
    results.push({viewport,frames:samples.length,meterWidths:first,maxWidth:Math.max(...samples.flatMap(s=>s.widths)),statusOverflow:await overflow.count()});
    for(const profile of ['wanderer','expedition']) {
      await page.goto(`${base}?shot=atlas&shotProfile=${profile}`);
      await page.locator('.atlas-node').first().waitFor(); await page.waitForTimeout(600);
      assert.equal(await page.locator('.atlas-node:not(.map-node)').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:resolve(out,`map-${profile}-${viewport.width}.png`),fullPage:true});
      await page.locator('[data-atlas-inspect-current]').click();
      await page.locator('.atlas-dialog').waitFor();
      await page.screenshot({path:resolve(out,`location-${profile}-${viewport.width}.png`)});
    }
    assert.deepEqual(errors,[]); results.at(-1).errors=errors;
    await context.close();
    console.log('PASS mobile readability',viewport.width,JSON.stringify(results.at(-1)));
  }
  writeFileSync(resolve(out,'readability-checks.json'),JSON.stringify(results,null,2));
} finally {await browser.close();}
