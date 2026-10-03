// Real renderer, real purchase plan/commit, disposable visit (no user saves).
// PLAYWRIGHT_MODULE can point to a shared Playwright installation; CHROME to a browser.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BOOK_SHOP_URL || 'http://localhost:8768';
const output = resolve(process.env.BOOK_SHOP_OUTPUT || 'art/manual-shop-2026-10-02/qa');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const report = [];
const open = async (query = '') => {
  console.log('Opening', query || 'default', page.viewportSize());
  await page.goto(`${base}/art/manual-shop-2026-10-02/preview.html${query}`);
  console.log('Loaded');
  await page.locator('.shop-book-offer').first().waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.shop-book-art')].map((img) => img.decode())); });
};
try {
  for (const width of [1200, 593, 390, 320]) {
    console.log('Resizing', width);
    await page.setViewportSize({ width, height: 844 });
    await open();
    const geometry = await page.locator('.shop-book-offer').evaluateAll((rows) => rows.map((row) => {
      const rect = row.getBoundingClientRect();
      const children = [...row.children].map((child) => { const r = child.getBoundingClientRect(); return { x: r.x, right: r.right, y: r.y, bottom: r.bottom }; });
      return { width: rect.width, height: rect.height, x: rect.x, right: rect.right, children, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth };
    }));
    assert.equal(geometry.length, 2);
    assert.ok(Math.abs(geometry[0].height - geometry[1].height) < 1, `${width}: row heights match`);
    assert.ok(Math.abs(geometry[0].width - geometry[1].width) < 1, `${width}: row widths match`);
    for (const row of geometry) {
      assert.ok(row.scrollWidth <= row.clientWidth + 1, `${width}: no row overflow`);
      assert.ok(row.x >= 0 && row.right <= width + 1, `${width}: row fits viewport`);
      assert.ok(row.children[0].right <= row.children[1].x && row.children[1].right <= row.children[2].x, `${width}: book, details, Buy stay ordered`);
    }
    await page.screenshot({ path: resolve(output, `shop-${width}.png`), fullPage: true });
    if (width === 593) await page.locator('#shop-skillBooks').screenshot({ path: resolve(output, 'shop-detail.png') });
    report.push({ viewport: width, geometry });
  }
  await page.setViewportSize({ width: 1200, height: 844 });
  await open('?xp=73');
  assert.match(await page.locator('[data-book-id="shieldManual"]').innerText(), /73 XP/);
  await page.locator('[data-book-id="bladeManual"] .shop-book-buy').click();
  await page.locator('.confirmation-modal').waitFor();
  assert.match(await page.locator('.confirmation-modal').innerText(), /Blade Manual/);
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.cinders), 999, 'opening review spends nothing');
  await page.locator('.confirmation-cancel').click();
  assert.equal(await page.locator('.shop-book-offer').count(), 2, 'cancel retains stock');
  await page.locator('[data-book-id="bladeManual"] .shop-book-buy').focus();
  await page.keyboard.press('Enter');
  await page.locator('.confirmation-modal').waitFor();
  await page.locator('.confirmation-confirm').click();
  await page.waitForFunction(() => window.bookShopPreview.run.consumables.bladeManual === 1);
  assert.equal(await page.evaluate(() => window.bookShopPreview.run.cinders), 819, 'buy spends exactly 180');
  assert.equal(await page.locator('.shop-book-offer').count(), 1, 'bought row leaves stock');
  assert.equal(await page.locator('.shop-workspace').getAttribute('data-shop-content'), 'skillBooks');
  await open('?cinders=100&all=1');
  assert.equal(await page.locator('.shop-book-buy:disabled').count(), 4, 'all unaffordable books disabled');
  await page.screenshot({ path: resolve(output, 'shop-unaffordable.png'), fullPage: true });
  await open('?all=1');
  assert.equal(await page.locator('.shop-book-art').count(), 4);
  assert.equal(await page.locator('#shop-primary').count(), 0, 'no duplicate footer Buy');
  assert.equal(errors.length, 0, errors.join('\n'));
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ passed: true, checks: ['equal sizes at 4 widths', 'column order and no overflow', 'all artwork decoded', 'configured XP', 'cancel', 'keyboard purchase', 'exact inventory/cinders/stock', 'category retained', 'insufficient funds', 'all four books', 'no runtime or network errors'], report }, null, 2));
  console.log('skill-book-shop-browser: PASS — layout at 1200/593/390/320, purchases, disabled states, live XP, all four books; no runtime/network errors');
} finally { await browser.close(); }
