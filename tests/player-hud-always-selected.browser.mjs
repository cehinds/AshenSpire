// Owner 2026-11-05: the player's selected HUD panel is on at all times; the mini overhead bar never shows for the player.
// Requires real artwork: PLAYWRIGHT_MODULE=/path/to/playwright node tests/player-hud-always-selected.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
try {
  for (const [name, viewport, mobile] of [['portrait phone', { width: 390, height: 844 }, true], ['desktop', { width: 1280, height: 800 }, false]]) {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=2`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.combatant.player .pose-stage')?.__poseStage?.currentArt?.body);
    await page.locator('.target-hud-detail[data-eid="player"].visible').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
      const shown = node => !!node && getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().width > 0;
      return { panel: !!document.querySelector('.target-hud-detail[data-eid="player"].visible'),
        playerBar: shown(document.querySelector('.combatant.player .target-hud-overhead-meters > .meters .combat-health-meter')),
        enemyBars: [...document.querySelectorAll('.combatant:not(.player) .target-hud-overhead-meters > .meters .combat-health-meter')].map(shown),
        glow: getComputedStyle(document.querySelector('.combatant.player .sprite')).filter, pinned: document.querySelector('.combatant.player').dataset.hudPinned,
        enemyPanels: document.querySelectorAll('.target-hud-detail:not([data-eid="player"]).visible').length };
    });
    assert.deepEqual([s.panel, s.playerBar, s.enemyPanels], [true, false, 0], `${name}: player panel on with no selection, no mini bar, no enemy panel`);
    assert.deepEqual([s.pinned, s.glow], ['true', 'none'], `${name}: the pinned player has no selected glow`);
    assert.ok(s.enemyBars.length && s.enemyBars.every(Boolean), `${name}: enemies keep their mini bar`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('player HUD always selected: ok');
} finally { await browser.close(); server?.close?.(); }
process.exit(0);
