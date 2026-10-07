import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright` : 'playwright'));
const out = resolve(process.env.STARTING_ABILITIES_OUT || 'outputs/starting-abilities');
mkdirSync(out, { recursive: true });
const { server, port } = await serve({ root: resolve('.'), port: 0, open: false, quiet: true });
const launched = await launchBrowser({ browser: resolveBrowser([chromium.executablePath()]), prefix: 'abilityqa-' });
let browser;
const results = [];
try {
  browser = await chromium.connectOverCDP(launched.wsUrl);
  for (const [width, height] of [[390, 844], [1440, 900]]) for (const [classId, count] of [['reaver',1],['rogue',1],['starseer',2],['herald',2]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/?shot=customize&shotClass=${classId}`);
    await page.waitForSelector('#cz-next');
    await page.locator('#cz-next').click();
    await page.locator('#cz-next').click();
    if (classId === 'reaver') {
      await page.locator('#cz-equipment-section').selectOption('startingAbilities');
      assert.equal(await page.locator('[data-equipment-section="startingAbilities"] [data-card-id="shieldBash"]').count(), 1);
      await page.locator('#cz-equipment-section').selectOption('leftHand');
      await page.locator('[data-hand="leftHand"][data-armament-id="empty-hand"] .equipment-choose').click();
      assert.equal(await page.locator('[data-equipment-section="startingAbilities"] [data-card-id="shieldBash"]').count(), 0, 'changing armament refreshes maneuver requirements');
      // Hidden face uses the same native disclosure click path; production dropdown is exercised below.
      await page.locator('#cz-equipment-section').selectOption('leftHand');
      await page.locator('[data-face="startingAbilities"]').dispatchEvent('click');
      assert.equal(await page.locator('[data-face="startingAbilities"]').evaluate(node => node.closest('details').open), true, 'native fold opens after refreshing');
      await page.locator('[data-face="startingAbilities"]').dispatchEvent('click');
      assert.equal(await page.locator('[data-face="startingAbilities"]').evaluate(node => node.closest('details').open), false, 'native fold still closes');
    }
    // Use the native fold face, including the path whose refreshed pool was missing.
    if (!await page.locator('[data-face="startingAbilities"]').isVisible()) await page.locator('#cz-equipment-section').selectOption('startingAbilities');
    else await page.locator('[data-face="startingAbilities"]').click();
    const area = page.locator('[data-equipment-section="startingAbilities"]');
    await area.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#cz-next').getAttribute('aria-disabled'), 'true', 'incomplete ability count blocks Continue');
    const choose = area.locator('.cc-ability-choose');
    assert.ok(await choose.count() >= count, 'enough legal abilities');
    const ids = [];
    for (let index = 0; index < count; index++) {
      const button = choose.nth(index);
      ids.push(await button.evaluate(node => node.parentElement.dataset.cardId));
      await button.click();
    }
    assert.equal(await area.locator('.cc-ability-choose[aria-pressed="true"]').count(), count);
    assert.notEqual(await page.locator('#cz-next').getAttribute('aria-disabled'), 'true', 'complete count unlocks Continue');
    if (count === 2) assert.equal(await area.locator('.cc-ability-choose:not([aria-pressed="true"]):not([disabled])').count(), 0, 'third spell cannot be chosen');
    await page.screenshot({ path: resolve(out, `${classId}-${width}x${height}.png`) });
    await choose.first().click();
    assert.equal(await page.locator('#cz-next').getAttribute('aria-disabled'), 'true', 'unpick re-blocks Continue');
    await choose.first().click();
    for (let step = 0; step < 8 && await page.locator('#cz-tab-review').getAttribute('aria-selected') !== 'true'; step++) await page.locator('#cz-next').click();
    assert.equal(await page.locator('#cz-tab-review').getAttribute('aria-selected'), 'true');
    assert.notEqual(await page.locator('#cz-start').getAttribute('aria-disabled'), 'true');
    await page.locator('#cz-start').click();
    await page.waitForTimeout(800);
    const decks = await page.evaluate(() => window.__startingAbilities());
    assert.ok(ids.every(id => decks.live.some(inst => inst.cardId === id && inst.abilityRank === 1)), 'actual newRun receives chosen Rank 1 cards');
    assert.deepEqual(decks.saved, decks.live, 'chosen cards survive production save/load in shot memory storage');
    assert.deepEqual(errors, []);
    results.push({ classId, width, height, ids, count, saved: true, errors });
    console.log('PASS', classId, width, ids.join(', '));
    await context.close();
  }
} finally {
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser?.close(); await launched.close(); await new Promise(done => server.close(done));
}
