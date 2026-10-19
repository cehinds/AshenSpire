// Requires real artwork: BASE_URL=... HUD_ENTRY=AshenSpire.html PLAYWRIGHT_MODULE=/path/to/playwright node tests/hud-icon-aspect.browser.mjs
// R12: topbar icon buttons and overhead badges stay square, including short landscape (game-viewport height <= 500px).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[360, 740], [390, 844], [768, 1024], [1280, 800], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(`${process.env.BASE_URL || server.url}${process.env.HUD_ENTRY || 'index.html'}?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForSelector('.target-hud-overhead-meters', { timeout: 60000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const size = e => { const b = e.getBoundingClientRect(); return [b.width, b.height]; };
      return { badges: [...document.querySelectorAll('.target-hud-overhead-meters .combat-health-badge')].map(size),
        // Defense (Block) is the farthest-left badge in every overhead row that has one.
        rows: [...document.querySelectorAll('.target-hud-overhead-meters .combat-health-row')].map(row => [...row.querySelectorAll('.combat-health-badge')].map(n => [n.dataset.defenseKind, n.getBoundingClientRect().left])),
        buttons: [...document.querySelectorAll('.shared-hud .illustrated-hud-button.topbar-btn')].map(size) };
    });
    assert.ok(r.badges.length > 0 && r.buttons.length > 0, `${width}x${height}: badges and buttons render`);
    for (const row of r.rows) if (row.some(([k]) => k === 'shield')) assert.equal([...row].sort((a, b) => a[1] - b[1])[0][0], 'shield', `${width}x${height}: Defense badge is leftmost`);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/hud-${width}x${height}.png` });
    for (const [w, h] of [...r.badges, ...r.buttons]) assert.ok(Math.abs(w - h) <= 0.5, `${width}x${height}: ${w}x${h} is square`);
    await page.close();
  }
  console.log('HUD badges and icon buttons stay square at portrait, desktop and short landscape sizes.');
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await browser.close(); await server?.close?.(); }
// Exit explicitly (the static server can hold the loop open) but keep the failure code.
process.exit(process.exitCode ?? 0);
