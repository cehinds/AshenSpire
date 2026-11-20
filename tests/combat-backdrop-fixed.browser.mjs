// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-backdrop-fixed.browser.mjs
// Owner 2026-11-20: "When combat begins, the background should be fixed (like a solid image). Sometimes when an
// enemy is defeated, the layers shift position." The combat box can settle after the first formation pass (the
// display settings land after a shot mounts the fight), and the formation gate does not watch it. The backdrop
// follows the combat box on its own, so:
//   1. A change of the combat box alone (the field's box pinned, no formation pass) refits the backdrop.
//   2. A later death relays out the figures and leaves every backdrop box where it was.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const BACKDROP = '.environment-backdrop, .environment-backdrop [data-layer-index], .alternative-backdrop svg, .alternative-backdrop image';

const settle = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 300)))));
const read = page => page.evaluate(selector => {
  const combat = document.querySelector('.combat');
  return {
    epoch: document.querySelector('[data-layout-epoch]').dataset.layoutEpoch,
    environmentHeight: combat.style.getPropertyValue('--environment-height'),
    boxes: [...document.querySelectorAll(selector)].map(node => { const box = node.getBoundingClientRect(); return [box.left, box.top, box.width, box.height].map(v => Math.round(v * 10) / 10).join(','); }),
  };
}, BACKDROP);

try {
  for (const [width, height, profile] of [[390, 844, ''], [1280, 800, '&gameProfile=core']]) {
    const label = `${width}x${height}${profile}`;
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(`${server.url}index.html?shot=combat&shotEnemyCount=3&shotSeed=4${profile}`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForSelector('.combatant.enemy .sprite');
    await page.waitForTimeout(2500);
    const settled = await read(page);
    assert.ok(settled.boxes.length > 1, `${label}: a backdrop is drawn`);

    await page.evaluate(() => {
      const field = document.querySelector('[data-layout-epoch]');
      field.style.height = `${field.offsetHeight}px`;
      field.style.flex = 'none';
      const combat = document.querySelector('.combat');
      combat.style.height = `${combat.offsetHeight - 40}px`;
    });
    await settle(page);
    const shrunk = await read(page);
    assert.equal(shrunk.epoch, settled.epoch, `${label}: the combat box change runs no formation pass`);
    assert.notEqual(shrunk.environmentHeight, settled.environmentHeight, `${label}: the backdrop follows the combat box`);
    assert.notDeepEqual(shrunk.boxes, settled.boxes, `${label}: and refits its layers`);

    await page.evaluate(() => { const enemy = window.__combat.enemies.find(e => e.alive); enemy.hp = 0; enemy.alive = false; window.__renderCombatForShot(); });
    await settle(page);
    const afterDeath = await read(page);
    assert.notEqual(afterDeath.epoch, shrunk.epoch, `${label}: the death relays out the figures`);
    assert.deepEqual(afterDeath.boxes, shrunk.boxes, `${label}: a death leaves every backdrop box where it was`);
    assert.equal(afterDeath.environmentHeight, shrunk.environmentHeight);
    await page.close();
    console.log(`ok ${label}`);
  }
} finally {
  await browser.close();
  server.close?.();
}
process.exit(0);
