// Owner 2026-11-05: "Disable the unselected player character HUD and keep the selected character HUD."
// An unselected player shows no overhead HP bar (the top bar keeps the 71/71); selecting shows the panel; deselecting hides it.
// Requires real artwork: PLAYWRIGHT_MODULE=/path/to/playwright node tests/player-hud-selected-only.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const [name, viewport, mobile] of [['phone', { width: 360, height: 800 }, true], ['desktop', { width: 1366, height: 768 }, false]]) {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=2`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt?.body);
    await page.waitForTimeout(500);
    const state = () => page.evaluate(() => {
      const shown = node => !!node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
      const bar = document.querySelector('.combatant.player .target-hud-overhead-meters > .meters');
      const enemyBar = document.querySelector('.combatant:not(.player) .target-hud-overhead-meters > .meters');
      return { bar: shown(bar), enemyBar: shown(enemyBar), panel: !!document.querySelector('.target-hud-detail[data-eid="player"].visible'),
        block: !!document.querySelector('.combatant.player .sprite'), topHp: document.body.textContent.includes('71/71') };
    });
    const tapPlayer = async () => {
      const box = await page.locator('.combatant.player .sprite').boundingBox();
      if (mobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(900);
    };
    let s = await state();
    assert.deepEqual([s.bar, s.panel, s.enemyBar, s.topHp], [false, false, true, true], `${name}: unselected player shows no HUD, enemies keep theirs, the top bar keeps HP`);
    await tapPlayer();
    s = await state();
    assert.deepEqual([s.panel, s.bar], [true, false], `${name}: selecting shows the panel (the overhead bar stays folded into it)`);
    // Escape clears the reading selection; blur releases the frame's focus.
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1200);
    s = await state();
    assert.deepEqual([s.panel, s.bar], [false, false], `${name}: deselecting hides the panel and shows no idle HUD`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('player HUD selected only: ok');
} finally { await browser.close(); server?.close?.(); }
process.exit(0);
