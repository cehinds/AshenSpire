// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/card-modal-fit.browser.mjs
// The card reading modal fits one screen: no element inside it scrolls at
// 1920x1080, 1366x768 and 390x844, the card is about 62% of its old height, and
// the chips are one per distinct label. Real Chromium; not part of the fast checks.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
let checks = 0;
try {
  for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(10000);
    await page.goto(`${server.url}index.html?shot=reward`);
    await page.getByText('Choose one of 3').click();
    await page.locator('.reward-choice-button').nth(1).click({ force: true });
    await page.locator('.modal .as-btn', { hasText: /^Inspect$/ }).click({ force: true });
    await page.locator('.card-inspection-modal').waitFor();
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const modal = document.querySelector('.card-inspection-modal');
      const scrolling = [...modal.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY));
      const card = modal.querySelector('.card-inspection-art > .card').getBoundingClientRect();
      const zoom = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
      const inspectW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w-inspect')) || 320;
      const labels = [...modal.querySelectorAll('.inspection-tag')].map((e) => e.textContent.trim().toLowerCase());
      return { scrolling: scrolling.map((e) => e.className), cardH: card.height / zoom, oldH: inspectW * 1.5, labels };
    });
    assert.deepEqual(m.scrolling, [], `${width}x${height}: nothing scrolls`);
    assert.ok(m.cardH <= m.oldH * 0.66, `${width}x${height}: card ${m.cardH} is within 66% of ${m.oldH}`);
    assert.equal(new Set(m.labels).size, m.labels.length, `${width}x${height}: chips are distinct`);
    checks += 3;
    await page.close();
  }
  console.log(`card-modal-fit: ${checks} checks passed`);
} finally {
  await browser.close();
  server.server?.close?.();
}
