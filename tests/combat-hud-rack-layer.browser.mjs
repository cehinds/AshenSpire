// The overhead HUD rack paints above every sprite and the fade, but below floaters, reading panels and the toolbar.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true, host: '127.0.0.1' });
const browser = await chromium.launch();
try {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: 'reduce' });
    await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemies=wanderingSoldier,wyrmAspirant,fellWarden&shotHand=5`);
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForTimeout(1600);
    const z = await page.evaluate(() => {
      const num = n => { const v = parseInt(getComputedStyle(n).zIndex, 10); return Number.isNaN(v) ? null : v; };
      const combat = document.querySelector('.combat');
      // The floater layer only exists while a number is flying, so mount an empty one when absent.
      if (!combat.querySelector(':scope > .combat-floater-layer')) { const f = document.createElement('div'); f.className = 'combat-floater-layer'; combat.append(f); }
      // Reading selection raises a sprite to the highest layer a figure can reach.
      document.querySelector('.combat .combatant.player')?.classList.add('context-selected');
      const first = sel => { const n = document.querySelector(sel); return n ? num(n) : null; };
      return {
        layout: combat.dataset.layout, targetHud: combat.dataset.targetHud,
        racks: [...document.querySelectorAll('.combat .combatant > .target-hud-overhead-meters')].map(num),
        sprites: [...document.querySelectorAll('.combat .combatant .sprite')].map(num),
        floaters: first('.combat > .combat-floater-layer'), hudLayer: first('.target-hud-layer'), tools: first('.combat-tools'),
      };
    });
    const tag = `${width}`;
    assert.equal(z.layout, 'formation', `${tag}: formation layout`);
    assert.equal(z.targetHud, 'true', `${tag}: target HUD on`);
    assert.ok(z.racks.length >= 2 && z.racks.every(Number.isFinite), `${tag}: overhead racks have a z-index (${z.racks})`);
    assert.ok(z.sprites.length >= 2 && z.sprites.every(Number.isFinite), `${tag}: sprites have a z-index`);
    const rack = Math.min(...z.racks), top = Math.max(...z.racks), maxSprite = Math.max(...z.sprites);
    assert.ok(rack > maxSprite, `${tag}: rack ${rack} above every sprite (${maxSprite})`);
    for (const k of ['floaters', 'hudLayer', 'tools']) {
      assert.ok(Number.isFinite(z[k]), `${tag}: ${k} layer present with a z-index`);
      assert.ok(top < z[k], `${tag}: rack ${top} below ${k} (${z[k]})`);
    }
    await page.close();
  }
  console.log('PASS: overhead HUD rack sits above sprites and below floaters, HUD layer and toolbar');
} finally { await browser.close(); server.server.close(); }
