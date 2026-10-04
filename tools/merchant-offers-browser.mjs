// Production merchant renderer and transactions, on a disposable preview visit.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MERCHANT_URL || 'http://localhost:8769';
const output = resolve(process.env.MERCHANT_OUTPUT || 'docs/preview/merchant/qa');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.route('**/src/buildversion.js', route => route.fulfill({ path: resolve('src/buildversion.js'), contentType: 'text/javascript' }));
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
const open = async (query = '') => {
  await page.goto(`${base}/docs/preview/merchant/preview.html${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.merchantPreview);
};
const category = async (key) => {
  if (await page.locator('#shop-cat-select').isVisible()) {
    await page.locator('#shop-cat-select').click();
  }
  await page.locator(`#shop-cat-${key}`).click();
};
try {
  await open();
  const keys = await page.locator('[data-shop-category]').evaluateAll(nodes => nodes.map(node => node.dataset.shopCategory));
  const geometry = [];
  for (const width of [1440, 593, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.waitForTimeout(200); // Allow the shared ResizeObserver to change rail mode.
    for (const key of keys) {
      await category(key);
      const rows = await page.locator(`[data-shop-shelf="${key}"] .merchant-offer`).evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect();
        const button = node.querySelector('.merchant-offer-action');
        const b = button?.getBoundingClientRect();
        return { width: r.width, height: r.height, x: r.x, right: r.right, overflow: node.scrollWidth - node.clientWidth, buttonHeight: b?.height };
      }));
      for (const row of rows) {
        assert.ok(row.overflow <= 1, `${key} at ${width}: row overflow ${row.overflow}`);
        assert.ok(row.x >= 0 && row.right <= width + 1, `${key} at ${width}: fits viewport`);
        if (row.buttonHeight) assert.ok(row.buttonHeight >= 44, `${key} at ${width}: touch target`);
      }
      if (key !== 'services' && rows.length > 1) assert.ok(Math.max(...rows.map(r => r.height)) - Math.min(...rows.map(r => r.height)) < 1, `${key} at ${width}: uniform heights`);
      geometry.push({ width, key, rows });
    }
    await category('relics');
    await page.screenshot({ path: resolve(output, `merchant-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await open();
  const before = await page.evaluate(() => ({ cinders: merchantPreview.run.cinders, cards: merchantPreview.run.deck.length, cost: merchantPreview.run.shopStock.cards[1].cost, stock: merchantPreview.run.shopStock.cards.length }));
  await page.locator('#shop-cards .merchant-offer-action').nth(1).click();
  await page.locator('.confirmation-modal').waitFor();
  assert.equal(await page.locator('.confirmation-modal').count(), 1);
  await page.locator('.confirmation-cancel').click();
  assert.equal(await page.evaluate(() => merchantPreview.run.cinders), before.cinders);
  await page.locator('#shop-cards .merchant-offer-action').nth(1).focus();
  await page.keyboard.press('Enter');
  await page.locator('.confirmation-confirm').click();
  assert.deepEqual(await page.evaluate(() => ({ cinders: merchantPreview.run.cinders, cards: merchantPreview.run.deck.length, stock: merchantPreview.run.shopStock.cards.length })), { cinders: before.cinders - before.cost, cards: before.cards + 1, stock: before.stock - 1 });
  await category('armaments');
  await page.locator('#shop-armaments .merchant-offer-action:enabled').first().click();
  assert.equal(await page.locator('[role="dialog"]:visible').count(), 1, 'one armament inspection');
  await page.keyboard.press('Escape');
  await category('sell');
  const purse = await page.evaluate(() => merchantPreview.run.cinders);
  await page.locator('#shop-sell [data-shop-ref="sell-consumable:shieldManual#0"] .merchant-offer-action').click();
  await page.locator('.confirmation-confirm').click();
  assert.equal(await page.evaluate(() => merchantPreview.run.consumables.shieldManual || 0), 0);
  assert.equal(await page.evaluate(() => merchantPreview.run.cinders), purse + 140);
  await category('services');
  await page.locator('#shop-upgrade .merchant-offer-action').click();
  assert.equal(await page.locator('[role="dialog"]:visible').count(), 1, 'one smith dialog');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'shop-upgrade', 'smith restores focus');
  await page.locator('#remove-opt .merchant-offer-action').click();
  await page.locator('#shop-remove .card').first().waitFor({ state: 'visible' });
  await open('?cinders=0');
  assert.equal(await page.locator('#shop-cards .merchant-offer-action:enabled').count(), 0, 'unaffordable purchases disabled');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ passed: true, geometry, checks: ['all categories at four widths', 'uniform rows', '44px actions', 'cancel', 'keyboard purchase exactly once', 'stock and purse', 'armament inspection', 'book sale', 'smith focus', 'remove service', 'insufficient funds', 'no browser or request errors'] }, null, 2));
  console.log('merchant-offers-browser: PASS');
} finally { await browser.close(); }
