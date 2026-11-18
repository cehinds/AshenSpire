// CREATION_BASE=http://127.0.0.1:8080/ PLAYWRIGHT_MODULE=/path/to/playwright node tests/creation-review-double-tap.browser.mjs
// Item 38 (owner, 2026-11-17): a double tap on Customise must land on the Review step, not skip it to the intro;
// a deliberate Begin from Review then starts the climb. Phone (touch) and desktop (mouse).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CREATION_BASE || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const [width, height, touch] of [[390, 844, true], [1280, 800, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${base}index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await page.mouse.click(width / 2, height * 0.6);
    await page.locator('button:visible', { hasText: 'New Game' }).first().click();
    const customise = page.locator('button:visible', { hasText: 'Customise' }).first();
    await customise.waitFor();
    const box = await customise.boundingBox();
    const press = (x, y) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
    await press(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(80);
    await press(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.prologue-screen').count(), 0, `${width}x${height}: a double tap on Customise does not skip Review`);
    assert.match(await page.locator('body').innerText(), /Review/, `${width}x${height}: the Review step is on screen`);
    const begin = await page.locator('#cz-start').boundingBox();
    await press(begin.x + begin.width / 2, begin.y + begin.height / 2);
    await page.locator('.prologue-screen, .mapscreen').first().waitFor();
    await context.close();
  }
  console.log('creation-review-double-tap: OK');
} finally { await browser.close(); }
