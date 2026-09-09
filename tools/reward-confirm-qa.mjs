import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.TEMP || '.', 'reward-confirm-qa');
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
try {
  for (const phone of [false, true]) {
    const context = await browser.newContext({ viewport: phone ? {width:390,height:844} : {width:1440,height:1000}, hasTouch:phone, isMobile:phone });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://localhost:${server.server.address().port}/index.html?shot=reward`);
    await page.locator('[data-kind="card"]').waitFor();
    await page.evaluate(async () => {
      const {mountRewards} = await import('/src/ui/screens/reward.js');
      const {contentBundle} = await import('/src/content/index.js');
      const {createRegistries} = await import('/src/model/registries.js');
      const run = {cinders:0,deck:[],flasks:[],relics:[],loadout:{storage:[]}};
      const checkpoint = {states:{},chosenCardId:null};
      window.rewardQA = {run,checkpoint,fail:true,writes:0};
      mountRewards(document.querySelector('#app'), {registries:createRegistries(contentBundle),run,checkpoint,rewards:{cardIds:['frostNova','starstoneArc','scholarsInsight']},onDone(){},onPersist(){window.rewardQA.writes++;return !window.rewardQA.fail;}});
    });
    await page.locator('[data-kind="card"]').click();
    check(await page.locator('#reward-card-confirm').isDisabled(), 'Confirm requires selection');
    const card = page.locator('.reward-row .card').first();
    if (phone) await card.tap({position:{x:40,y:80}}); else await card.click({position:{x:40,y:80}});
    check(await page.locator('#reward-card-confirm').isEnabled(), 'first real press enables Confirm');
    check(await page.evaluate(() => window.rewardQA.run.deck.length === 0), 'selection does not collect');
    await page.locator('#reward-back').click();
    await page.locator('[data-kind="card"]').click();
    check(await page.locator('.reward-selected').count() === 1, 'Back keeps selection');
    await page.locator('#reward-card-confirm').click();
    check(await page.locator('.reward-confirm-status').isVisible(), 'failed save explains retry');
    check(await page.evaluate(() => window.rewardQA.run.deck.length === 0 && !window.rewardQA.checkpoint.states.card), 'failed save rolls back');
    await page.screenshot({path:resolve(output, `${phone?'phone':'desktop'}-retry.png`)});
    await page.evaluate(() => {window.rewardQA.fail=false;window.oldRewardConfirm=document.querySelector('#reward-card-confirm');});
    await page.locator('#reward-card-confirm').click();
    await page.evaluate(() => window.oldRewardConfirm.click());
    check(await page.evaluate(() => window.rewardQA.run.deck.length === 1 && window.rewardQA.writes === 2 && window.rewardQA.checkpoint.states.card === 'taken'), 'retry and trailing activation collect once');
    check(errors.length === 0, `no runtime errors: ${errors.join('; ')}`);
    await context.close();
  }
  console.log(`PASS ${checks} reward browser checks`);
} finally {
  await browser.close(); server.server.close();
}
