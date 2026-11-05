// Owner 2026-11-05: the player's selected HUD panel sits right of the player on a phone too (PR #2522 missed it:
// the authored body's left/right were the whole transparent pose canvas, so the anchor ran far off-screen left).
// Requires real artwork: PLAYWRIGHT_MODULE=/path/to/playwright node tests/player-hud-right-of-player.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
try {
  for (const [name, viewport, mobile] of [['phone', { width: 360, height: 800 }, true], ['desktop', { width: 1366, height: 768 }, false]]) {
    for (const enemies of [1, 2, 3]) {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.BASE_URL || server.url}${process.env.HUD_ENTRY || 'index.html'}?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=${enemies}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt?.body);
      const box = await page.locator('.combatant.player .sprite').boundingBox();
      if (mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.locator('.target-hud-detail[data-eid="player"].visible').waitFor({ state: 'visible' });
      await page.waitForTimeout(700);
      const g = await page.evaluate(() => {
        const r = node => node.getBoundingClientRect().toJSON();
        return { vw: innerWidth, vh: innerHeight, panel: r(document.querySelector('.target-hud-detail[data-eid="player"]')),
          sprite: r(document.querySelector('.combatant.player .sprite')),
          enemies: [...document.querySelectorAll('.combatant:not(.player) .sprite')].map(r),
          hand: [...document.querySelectorAll('.hand .card')].map(r) };
      });
      const label = `${name}/${enemies} enemies`, p = g.panel;
      assert.ok(p.left >= g.sprite.right - 4, `${label}: panel left ${p.left} is right of the player sprite edge ${g.sprite.right}`);
      assert.ok(p.top < g.sprite.bottom && p.bottom > g.sprite.top, `${label}: panel overlaps the player vertically`);
      assert.ok(p.left >= 0 && p.top >= 0 && p.right <= g.vw && p.bottom <= g.vh, `${label}: panel is on screen`);
      assert.ok(!g.enemies.some(enemy => overlap(p, enemy)), `${label}: panel covers no enemy sprite`);
      assert.ok(!g.hand.some(card => overlap(p, card)), `${label}: panel covers no hand card`);
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  console.log('player HUD right of the player: ok');
} finally { await browser.close(); server?.close?.(); }
process.exit(0);
