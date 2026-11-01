// SMITH_FIT_BASE=http://127.0.0.1:8080/ PLAYWRIGHT_MODULE=/path/to/playwright node tests/smith-confirm-fit.browser.mjs
// Opens the Core rest Smith, selects the first item and opens "Upgrade <item>?" at three hosts: it
// must not scroll, change text sits on the row's right edge, and no row wraps its words.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SMITH_FIT_BASE || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[390, 844], [1366, 768], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    await page.goto(`${base}index.html?shot=rest&gameProfile=core&shotRestState=wounded&shotSeed=3&shotRestPoints=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.rest-door').waitFor();
    await page.locator('#smith-opt').click();
    await page.locator('.smith-candidate-card').first().click();
    await page.locator('.smith-confirm').click();
    const modal = page.locator('.confirmation-modal');
    await modal.waitFor();
    const m = await page.evaluate(() => {
      const root = document.querySelector('.confirmation-modal');
      const box = root.getBoundingClientRect();
      const rows = [...root.querySelectorAll('.smith-confirm-row')].map((row) => {
        const r = row.getBoundingClientRect(); const v = row.querySelector('.sr-vals').getBoundingClientRect();
        const n = row.querySelector('.sr-name');
        return { gap: Math.round(r.right - v.right), clipped: n.scrollWidth > n.clientWidth + 1, h: Math.round(r.height), text: row.textContent };
      });
      return { fits: root.scrollHeight <= root.clientHeight + 1 && box.bottom <= innerHeight && box.top >= 0, rows, none: root.querySelector('.rest-recovery-none, .rest-recovery-row') ? true : false,
        requirement: root.querySelector('.smith-confirm-requirements')?.textContent };
    });
    assert.ok(m.fits, `${width}x${height}: the confirmation fits the viewport without scrolling`);
    assert.ok(m.rows.length >= 2, 'stat rows drawn');
    for (const row of m.rows) {
      assert.ok(row.gap <= 12, `${width}: change is right-justified (${row.gap}px from the edge): ${row.text}`);
      assert.ok(row.h < 40, `${width}: row stays one line (${row.h}px): ${row.text}`);
    }
    assert.match(m.requirement, /Requirements\s*None$/, 'single None, no wrapped NON/E');
    await page.close();
  }
  console.log('Smith confirmation fit probe passed');
} finally { await browser.close(); }
