// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/service-portrait-placement.browser.mjs
// The Blacksmith and Merchant portraits stand below the top HUD bar and above
// the service panel (narrow), or beside it (wide). A ?shot= boot, real layout.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const shot of ['blacksmith', 'shop']) {
    for (const [w, h] of [[360, 800], [390, 844], [1280, 800]]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
      await p.goto(`${server.url}index.html?shot=${shot}`, { waitUntil: 'load' });
      await p.waitForSelector('.service-portrait img');
      await p.waitForTimeout(1500);
      const m = await p.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const hud = r('main > .shared-hud'), fig = r('.service-portrait'), frame = r('.shop-frame');
        return { hudBottom: hud.bottom, top: fig.top, bottom: fig.bottom, frameTop: frame.top, frameLeft: frame.left, right: fig.right, vh: innerHeight };
      });
      const at = `${shot} ${w}x${h}`;
      assert.ok(m.top >= m.hudBottom - 1, `${at}: portrait top ${m.top} under HUD bottom ${m.hudBottom}`);
      assert.ok(m.bottom <= m.vh + 1, `${at}: portrait bottom ${m.bottom} below viewport`);
      if (w < 600 && shot === 'blacksmith') assert.ok(m.bottom <= m.frameTop + 4, `${at}: portrait ${m.bottom} overlaps panel ${m.frameTop}`);
      await p.close();
    }
  }
  console.log('service-portrait-placement ok');
} finally { await b.close(); server.close?.(); }
process.exit(0);
