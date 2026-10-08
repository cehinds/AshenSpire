import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8346/';
const out = resolve(process.env.COMBAT_QA_OUT || 'outputs/combat-option-c');
mkdirSync(out, { recursive: true });
console.log('Launching combat browser');
const browser = await chromium.launch({ channel: 'msedge', headless: true, timeout: 30000 });
const errors = [], requests = [], reports = [];
try {
  for (const [width,height] of [[390,844],[1440,900],[320,640],[844,390]]) {
    if (process.env.QA_WIDTH && width !== Number(process.env.QA_WIDTH)) continue;
    const page = await browser.newPage({ viewport: { width,height }, hasTouch:width<600 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if(response.status()>=400) requests.push({url:response.url(),status:response.status()}); });
    console.log('Loading combat',width,height);
    await page.goto(`${base}?shot=combat${process.env.QA_SCENE ? `&shotScene=${process.env.QA_SCENE}` : ''}`, {waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(() => window.__renderCombatForShot, null, {timeout:120000});
    await page.waitForTimeout(1800);
    await page.screenshot({path:resolve(out,`combat-${width}.png`)});
    const enemy=page.locator('.combatant.enemy').first();
    await enemy.focus(); await enemy.dispatchEvent('gpfocus');
    await enemy.locator('.combatant-info').waitFor({state:'visible',timeout:10000});
    await page.screenshot({path:resolve(out,`selected-${width}.png`)});
    const geometry=await page.locator('.combatant.enemy').evaluateAll(es=>es.map(e=>{
      const rect=e.getBoundingClientRect(),sprite=e.querySelector('.sprite').getBoundingClientRect();
      const intent=e.querySelector('.intent'),badge=intent.getBoundingClientRect();
      const plate=getComputedStyle(e,'::after'), style=getComputedStyle(intent);
      const zoom=rect.width/e.offsetWidth;
      return {id:e.dataset.eid,badge:badge.toJSON(),sprite:sprite.toJSON(),
        centerDelta:Math.abs((sprite.left+sprite.width/2)-(badge.left+badge.width/2)),
        selectionCenterDelta:Math.abs(rect.left+parseFloat(plate.left)*zoom-(badge.left+badge.width/2)),
        selected:e.classList.contains('context-selected'),plateWidth:parseFloat(plate.width)*zoom,
        plateBorder:plate.borderTopColor,intentBorder:style.borderTopColor,
        plateStyle:plate.borderTopStyle,intentStyle:style.borderTopStyle,text:intent.textContent};
    }));
    reports.push({width,height,geometry});
    writeFileSync(resolve(out,'report.json'),JSON.stringify({errors,requests,reports},null,2));
    for(const actor of geometry) {
      assert(actor.badge.left>=-1 && actor.badge.right<=width+1,'intent stays within viewport');
      assert(actor.centerDelta<2,`intent centered on ${actor.id}: ${actor.centerDelta}`);
      assert(actor.selectionCenterDelta<2,`selection centered on ${actor.id}: ${actor.selectionCenterDelta}`);
      if(actor.selected) {
        assert(Math.abs(actor.plateWidth-actor.badge.width)<2,'selection and intent share width');
        assert.equal(actor.plateBorder,actor.intentBorder,'selection shares intent color');
        assert.equal(actor.plateStyle,actor.intentStyle,'selection shares intent outline');
      }
    }
    const info=enemy.locator('.combatant-info');
    assert(await info.isVisible(),'selected enemy exposes inspection');
    await info.click(); await page.locator('.combatant-door').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.combatant-door').waitFor({state:'hidden'});
    await page.waitForTimeout(150); // Modal focus restoration completes before the next command.
    await page.mouse.move(0,height-1);
    // Restored Inspect focus can own a tooltip scope above reading selection.
    for (let scope=0;scope<2 && await page.locator('.combatant.context-selected').count();scope++) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    }
    assert.equal(await page.locator('.combatant.context-selected').count(),0,'Escape clears selection');
    console.log('PASS layout and selection',width,height);
    await page.close();
  }
  assert.deepEqual(errors,[],'no page errors');
  assert.deepEqual(requests,[],'no failed HTTP responses');
} finally {
  writeFileSync(resolve(out,'report.json'),JSON.stringify({errors,requests,reports},null,2));
  await browser.close();
}
