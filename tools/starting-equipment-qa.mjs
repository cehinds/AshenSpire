import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_URL || 'http://localhost:8318';
const out = resolve(process.env.QA_OUTPUT || 'docs/preview/starting-equipment'); mkdirSync(out,{recursive:true});
const browser = await chromium.launch({headless:true, ...(process.env.QA_BROWSER ? {executablePath:process.env.QA_BROWSER} : {channel:'msedge'})});
const checks=[], errors=[];
function check(ok,label){assert.ok(ok,label);checks.push(label);}
const snapshot = async(page,name)=>{await page.mouse.move(0,0);await page.waitForTimeout(550);await page.screenshot({path:join(out,`${name}.png`)});};
async function open(page,cls='reaver') {
  await page.goto(`${base}/index.html?shot=customize&shotClass=${cls}`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-face=equipment]').click();await page.locator('[data-face=rightHand]').click();
}
try {
  for (const [name,width,height] of [['desktop',1440,1000],['tablet',1024,1000],['phone',390,844]]) {
    const page=await browser.newPage({viewport:{width,height},...(name==='phone'?{isMobile:true,hasTouch:true}:{})});
    page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
    for(const cls of ['reaver','starseer','rogue','herald']) {
      await open(page,cls);
      for(const slot of ['rightHand','leftHand']) {
        if(slot==='leftHand')await page.locator(`[data-face=${slot}]`).click();
        const panel=page.locator(`[data-equipment-section=${slot}]`);
        const ids=await panel.locator('[data-armament-id]').evaluateAll(es=>es.map(e=>e.dataset.armamentId));
        check(ids.includes('empty-hand'),`${name}/${cls}/${slot} offers Empty Hand`);
        for(const id of ids) {
          const choice=panel.locator(`[data-armament-id=${id}]`);
          await choice.locator('.equipment-choose').click();
          check(await panel.locator('.poker-equipment-choice.on').count()===1,`${name}/${cls}/${slot}/${id}: one selected choice`);
          check(await panel.locator('.cc-equipment-details').getAttribute('data-preview-item')===id,`${name}/${cls}/${slot}/${id}: matching details`);
          check(await choice.locator('.equipment-choose').getAttribute('aria-pressed')==='true',`${name}/${cls}/${slot}/${id}: pressed state`);
          check(await panel.isVisible(),`${name}/${cls}/${slot}/${id}: waits for Continue`);
          check(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${name}/${cls}/${slot}/${id}: contained panel`);
        }
        await panel.locator('[data-armament-id=empty-hand] .equipment-choose').click();
      }
      check((await page.locator('[data-face=rightHand]').innerText()).includes('Empty Hand')&&(await page.locator('[data-face=leftHand]').innerText()).includes('Empty Hand'),`${name}/${cls}: both hands remain empty`);
      check(await page.locator('[data-equipment-section=leftHand] .cc-starting-card').count()>=3,`${name}/${cls}: unarmed attack, guard and technique shown`);
    }
    await open(page);
    const main=page.locator('[data-equipment-section=rightHand]');
    const sword=main.locator('[data-armament-id=straightSword] .equipment-poker-card');
    await sword.evaluate(el=>el.dataset.retained='yes');
    await main.locator('[data-armament-id=greatsword] .equipment-choose').click();
    await page.waitForTimeout(230);
    check(await sword.getAttribute('data-retained')==='yes',`${name}: selection retains existing DOM nodes`);
    check(await sword.evaluate(el=>getComputedStyle(el).transform)==='none',`${name}: previous card settles`);
    const selected=main.locator('.choice-focused .equipment-poker-card');
    check(await selected.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).a>1),`${name}: selected card enlarges`);
    check(await selected.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).f<0),`${name}: selected card lifts`);
    check(await selected.evaluate(el=>getComputedStyle(el).transitionDuration.includes('0.18s')),`${name}: short eased animation`);
    await main.evaluate(el=>el.scrollIntoView({block:'start'}));await snapshot(page,`${name}-selected-weapon`);
    await main.locator('.cc-equipment-continue').click();
    check(await page.locator('[data-equipment-section=leftHand]').isVisible(),`${name}: Continue opens Off Hand`);
    const off=page.locator('[data-equipment-section=leftHand]');
    await off.locator('[data-armament-id=greatsword] .equipment-choose').click();
    check((await page.locator('[data-face=rightHand]').innerText()).includes('Empty Hand'),`${name}: moving the weapon empties its previous hand`);
    await off.locator('[data-armament-id=empty-hand] .equipment-choose').click();
    await off.locator('.cc-equipment-details').evaluate(el=>el.scrollIntoView({block:'start'}));await snapshot(page,`${name}-unarmed-cards`);
    const grid=off.locator('.cc-starting-card-grid');
    // Add a fourth representative card only to measure four-card capacity; no game state changes.
    await grid.evaluate(el=>el.append(el.firstElementChild.cloneNode(true)));
    const boxes=await grid.locator('.cc-starting-card > .card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width};}));
    check(boxes.length===4&&Math.abs(boxes[0].y-boxes[1].y)<2&&boxes[2].y>boxes[0].bottom&&Math.abs(boxes[2].y-boxes[3].y)<2,`${name}: four cards fit a 2 by 2 grid`);
    check(boxes.every(b=>b.x>=0&&b.right<=width+1),`${name}: grid stays in viewport`);
    check(boxes[3].bottom-boxes[0].y<height-130,`${name}: four-card grid fits available screen height`);
    await grid.evaluate(el=>el.scrollIntoView({block:'center'}));await snapshot(page,`${name}-four-card-capacity`);
    await off.locator('.cc-equipment-continue').click();
    const relic=page.locator('[data-equipment-section=relic]');check(await relic.isVisible(),`${name}: Continue reaches Relic`);
    await relic.locator('.cc-equipment-continue').click();check(await page.locator('#seed-input').isVisible(),`${name}: final Continue reaches Seed`);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: no page overflow`);
    await page.close();console.log(`PASS ${name}: all classes, hand choices, navigation and layout`);
  }
  const page=await browser.newPage({viewport:{width:1024,height:1000}});page.on('pageerror',e=>errors.push(e.message));await open(page);
  const sword=page.locator('[data-hand=rightHand][data-armament-id=straightSword] .equipment-poker-card');
  await sword.focus();await page.keyboard.press('Enter');
  await sword.locator('.card-info-button').click();
  check(await page.locator('.card-inspection-modal').isVisible(),'keyboard Information opens full equipment inspection');
  await page.locator('.card-inspection-modal .inspection-facts .inspection-tag').last().focus();
  await page.keyboard.press('Tab');
  check(await page.evaluate(()=>document.activeElement.matches('.inspection-lore summary')),'Tab reaches the full flavor disclosure');
  await page.keyboard.press('Enter');
  check((await page.locator('.card-inspection-modal .inspection-lore p').innerText()).includes('Honest steel'),'inspection preserves complete flavor');
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('[data-hand=rightHand][data-armament-id=greatsword] .equipment-choose').click();
  check(await page.locator('[data-hand=rightHand].choice-focused .equipment-poker-card').evaluate(e=>getComputedStyle(e).transform)==='none','OS reduced motion suppresses movement');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>document.body.classList.add('reduced-motion'));
  check(await page.locator('[data-hand=rightHand].choice-focused .equipment-poker-card').evaluate(e=>getComputedStyle(e).transform==='none'&&parseFloat(getComputedStyle(e).transitionDuration)<0.001),'game reduced motion suppresses animation');
  const flavor=page.locator('[data-hand=rightHand][data-armament-id=greatsword] .epc-flavor');
  await flavor.evaluate(e=>e.textContent='A very long piece of flavor text that must be truncated with an ellipsis rather than leaking into the footer. '.repeat(3));
  check(await flavor.evaluate(e=>getComputedStyle(e).textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth&&e.scrollHeight<=e.clientHeight+1),'long flavor uses horizontal ellipsis without vertical clipping');
  await page.locator('[data-equipment-section=rightHand]').evaluate(e=>e.scrollIntoView({block:'start'}));await snapshot(page,'reduced-motion-and-flavor');
  await page.close();check(errors.length===0,`no browser errors: ${errors.join('; ')}`);
  writeFileSync(join(out,'qa-results.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
  console.log(`PASS ${checks.length} browser checks; zero page errors`);
} finally { await browser.close(); }
