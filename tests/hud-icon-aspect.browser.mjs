// Requires real artwork: BASE_URL=... HUD_ENTRY=AshenSpire.html PLAYWRIGHT_MODULE=/path/to/playwright node tests/hud-icon-aspect.browser.mjs
// R12: topbar icon buttons and overhead badges stay square, including short landscape (game-viewport height <= 500px).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[360, 740], [768, 1024], [1280, 800], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(`${process.env.BASE_URL || server.url}${process.env.HUD_ENTRY || 'index.html'}?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('.target-hud-overhead-meters', { timeout: 60000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const size = e => { const b = e.getBoundingClientRect(); return [b.width, b.height]; };
      return { badges: [...document.querySelectorAll('.target-hud-overhead-meters .combat-health-badge')].map(size),
        buttons: [...document.querySelectorAll('.shared-hud .illustrated-hud-button.topbar-btn')].map(size) };
    });
    assert.ok(r.badges.length > 0 && r.buttons.length > 0, `${width}x${height}: badges and buttons render`);
    for (const [w, h] of [...r.badges, ...r.buttons]) assert.ok(Math.abs(w - h) <= 0.5, `${width}x${height}: ${w}x${h} is square`);
    await page.close();
  }
  console.log('HUD badges and icon buttons stay square at portrait, desktop and short landscape sizes.');
} finally { await browser.close(); await server?.close?.(); }
