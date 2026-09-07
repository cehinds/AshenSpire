// Run against tools/serve.mjs; Playwright must be available to Node.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { ARMAMENTS } from '../src/content/equipment.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4281';
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/items-preview.html');
    await page.locator('.collection button').first().waitFor();
    assert.equal(await page.locator('.collection button').count(), ARMAMENTS.length);
    await page.locator('.collection img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode())));
    for (const item of ARMAMENTS) {
      await page.locator(`[data-item="${item.id}"]`).click();
      await page.locator('#detail img').evaluate(img => img.decode());
      assert.match(await page.locator('#detail').innerText(), new RegExp(item.name));
    }
    for (const kind of ['weapon', 'shield', 'staff']) {
      await page.locator('#kind').selectOption(kind);
      assert.equal(await page.locator('.collection button').count(), ARMAMENTS.filter(i => i.kind === kind).length);
    }
    await page.locator('#kind').selectOption('all');
    await page.locator('#search').fill('shortbow');
    assert.equal(await page.locator('.collection button').count(), 1);
    await page.locator('[data-item="shortbow"]').click();
    assert.match(await page.locator('#detail img').getAttribute('src'), /icon_shortbow/);
    await page.locator('#search').fill('no such weapon');
    assert.equal(await page.locator('.collection button').count(), 0);
    await page.locator('#search').fill('');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `art/painted-items-2026-09-07/catalog-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    if (width === 1440) {
      await page.addStyleTag({ content: '.preview-layout{display:block}#detail{display:none}.collection{grid-template-columns:repeat(5,minmax(0,1fr))}.collection .inventory-face{display:flex;flex-direction:column;align-items:center}.collection .inventory-item-art{width:170px!important;height:170px!important}.collection .r-trail{display:none}header,.toolbar,footer{display:none}main{max-width:1440px;padding:12px}' });
      await page.screenshot({ path: 'art/painted-items-2026-09-07/all-armaments-contact.png', fullPage: true });
    }
    console.log(`PASS ${width}px: ${ARMAMENTS.length} images, selection, filters, search and layout`);
    await page.close();
  }
} finally { await browser.close(); }
