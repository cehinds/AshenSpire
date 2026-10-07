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
    await page.locator('#shop-cat-select').selectOption(key);
  } else {
    await page.locator(`#shop-cat-${key}`).click();
  }
};
try {
  await open();
  assert.equal(await page.locator('#shop-cat-cards, #shop-cards, #shop-cat-weaponArts, #shop-weapon-arts').count(), 0, 'no direct card sales, even when legacy stock exists');
  assert.ok(await page.evaluate(() => merchantPreview.run.shopStock.cards.length > 0 && merchantPreview.run.shopStock.weaponArts.length > 0), 'fixture retains legacy card stock');
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
  for (const [width, height] of [[1440, 960], [566, 837], [390, 844], [320, 844]]) {
    await page.setViewportSize({ width, height });
    await open('?fourOffers=1');
    for (const key of ['relics', 'skillBooks']) {
      await category(key);
      await page.waitForTimeout(100);
      const bounds = await page.locator(`[data-shop-shelf="${key}"]`).evaluate(shelf => {
        const rows = [...shelf.querySelectorAll('.shop-offer')].map(node => {
          const r = node.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height, overflow: node.scrollWidth - node.clientWidth };
        });
        const port = document.querySelector('.shop-offers').getBoundingClientRect();
        return { rows, top: port.top, bottom: port.bottom, frameBottom: document.querySelector('.shop-frame').getBoundingClientRect().bottom };
      });
      assert.ok(bounds.rows.length >= 5, 'fixture includes an offer beyond the four visible');
      assert.ok(bounds.rows[0].top >= bounds.top && bounds.rows[3].bottom <= bounds.bottom + 1, `${key} four visible at ${width}x${height}: ${JSON.stringify(bounds)}`);
      assert.ok(bounds.frameBottom <= height + 1, 'footer fits viewport');
      assert.ok(bounds.rows.every(row => row.overflow <= 1), 'rows fit horizontally');
      await page.screenshot({ path: resolve(output, `four-${key}-${width}.png`) });
      const thumb = page.locator(`[data-shop-shelf="${key}"] .merchant-thumbnail`).first();
      const purse = await page.evaluate(() => merchantPreview.run.cinders);
      await thumb.focus();
      await page.keyboard.press('Enter');
      await page.locator('.merchant-inspection').waitFor({ state: 'visible' });
      assert.ok((await page.locator('.merchant-inspection > p').innerText()).length > 10, 'complete description in inspection');
      await page.keyboard.press('Escape');
      assert.equal(await thumb.evaluate(node => node === document.activeElement), true, 'inspection returns focus');
      assert.equal(await page.evaluate(() => merchantPreview.run.cinders), purse, 'inspection never spends cinders');
      await page.locator(`[data-shop-shelf="${key}"] .shop-offer`).nth(4).scrollIntoViewIfNeeded();
      assert.ok(await page.locator(`[data-shop-shelf="${key}"] .shop-offer`).nth(4).isVisible(), 'fifth offer reachable');
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await open();
  const legacyStock = await page.evaluate(() => JSON.stringify([merchantPreview.run.shopStock.cards, merchantPreview.run.shopStock.weaponArts]));
  const before = await page.evaluate(() => ({ cinders: merchantPreview.run.cinders, relics: merchantPreview.run.relics.length, cost: merchantPreview.run.shopStock.relics[0].cost, stock: merchantPreview.run.shopStock.relics.length }));
  await page.locator('#shop-relics .merchant-offer-action').first().click();
  await page.locator('.confirmation-modal').waitFor();
  assert.equal(await page.locator('.confirmation-modal').count(), 1);
  await page.locator('.confirmation-cancel').click();
  assert.equal(await page.evaluate(() => merchantPreview.run.cinders), before.cinders);
  await page.locator('#shop-relics .merchant-offer-action').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('.confirmation-confirm').click();
  assert.deepEqual(await page.evaluate(() => ({ cinders: merchantPreview.run.cinders, relics: merchantPreview.run.relics.length, stock: merchantPreview.run.shopStock.relics.length })), { cinders: before.cinders - before.cost, relics: before.relics + 1, stock: before.stock - 1 });
  assert.equal(await page.evaluate(() => JSON.stringify([merchantPreview.run.shopStock.cards, merchantPreview.run.shopStock.weaponArts])), legacyStock, 'legacy card stock is not rewritten or rerolled');
  await open();
  await category('armaments');
  const secondArmament = page.locator('#shop-armaments .merchant-offer').nth(1);
  const secondName = await secondArmament.locator('h3').innerText();
  await secondArmament.locator('.merchant-thumbnail').click();
  await page.keyboard.press('Escape');
  assert.ok(await secondArmament.evaluate(node => node.classList.contains('is-selected')), 'inspecting second armament selects it');
  await page.locator('#shop-primary').click();
  assert.equal(await page.locator('[role="dialog"] .modal-head h2').innerText(), secondName, 'footer opens the selected armament');
  await page.keyboard.press('Escape');
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
  assert.equal(await page.locator('#shop-relics .merchant-offer-action:enabled').count(), 0, 'unaffordable purchases disabled');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ passed: true, geometry, checks: ['all categories at four widths', 'uniform rows', '44px actions', 'cancel', 'keyboard purchase exactly once', 'stock and purse', 'armament inspection', 'book sale', 'smith focus', 'remove service', 'insufficient funds', 'no browser or request errors'] }, null, 2));
  console.log('merchant-offers-browser: PASS');
} finally { await browser.close(); }
