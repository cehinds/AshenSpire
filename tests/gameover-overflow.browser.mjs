// tests/gameover-overflow.browser.mjs — the defeat and victory doors fit a phone.
//   PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/gameover-overflow.browser.mjs
// Real shot-initialized screens (?shot=death, ?shot=victory), measured at phone
// widths: the page never scrolls sideways, the door and its parts stay inside
// the viewport, and the four stat chips sit two by two.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[390, 844], [360, 640]]) {
    for (const state of ['death', 'victory']) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${server.url}index.html?shot=${state}`);
      await page.waitForSelector('.gameover-door', { timeout: 60000 });
      await page.waitForTimeout(1000);
      const m = await page.evaluate(() => {
        const box = (selector) => { const b = document.querySelector(selector).getBoundingClientRect(); return { left: b.left, right: b.right }; };
        const tops = [...document.querySelectorAll('.stats-table .as-chip')].map((chip) => Math.round(chip.getBoundingClientRect().top));
        return {
          innerWidth, scrollWidth: document.documentElement.scrollWidth,
          door: box('.gameover-door'), strip: box('.stats-table'), deck: box('.deck-strip'), choices: box('.as-choicerow'),
          chipRows: new Set(tops).size, chips: tops.length,
        };
      });
      const label = `${state} at ${width}x${height}`;
      assert.ok(m.scrollWidth <= m.innerWidth, `${label}: the page scrolls sideways (${m.scrollWidth} > ${m.innerWidth})`);
      for (const part of ['door', 'strip', 'deck', 'choices']) {
        assert.ok(m[part].left >= 0 && m[part].right <= m.innerWidth, `${label}: ${part} spans ${m[part].left}..${m[part].right} of ${m.innerWidth}`);
      }
      assert.equal(m.chips, 4, `${label}: four stat chips`);
      assert.equal(m.chipRows, 2, `${label}: the chips sit in two rows`);
      await page.close();
    }
  }
  console.log('gameover-overflow: ok');
} finally {
  await browser.close();
  server.close?.();
}
process.exit(0);
