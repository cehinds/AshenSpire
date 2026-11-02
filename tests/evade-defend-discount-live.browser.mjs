// Owner bug 2026-11-02 (build 0.7.3.50): in Core combat, in Defend stance, Evade+ kept showing 2 SP and refused with 1 SP
// left ("Not enough stamina"), though the engine already charged 1 (Adept cut, floor 1). The hand repaint after a play was
// skipped, so the card kept the pre-play quote taken for the animation. This drives the real UI: tap Defend, then read the
// painted cost and tap Evade+ with exactly 1 SP left.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/evade-defend-discount-live.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  const settings = encodeURIComponent(JSON.stringify({ oneTapPlay: true }));
  await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotClass=reaver&shotSettings=${settings}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__combat);
  // Memory-only pose: an upgraded Evade (cost step, so 2 SP) and a Defend, with exactly 2 SP to spend.
  await page.evaluate(() => {
    const combat = window.__combat;
    combat.piles.draw.push(...combat.piles.hand);
    combat.piles.hand = [{ cardId: 'core.evade', instanceId: 'q.ev', upgraded: true, upgradeSteps: [{ k: 'cost', pool: 'sp' }] },
      { cardId: 'core.defend', instanceId: 'q.df', upgraded: false }];
    combat.player.energy = combat.player.stamina = combat.player.maxStamina = combat.player.energyMax = 2;
    window.__renderCombatForShot();
  });
  const painted = id => page.locator(`.hand .card[data-instance-id="${id}"] .card-cost, .hand .card[data-instance-id="${id}"]`).first()
    .evaluate(node => node.innerText.split('\n').map(line => line.trim()).filter(Boolean));
  assert.ok((await painted('q.ev')).includes('2'), 'before Defend, Evade+ is painted at 2 SP');
  await page.locator('.hand .card[data-instance-id="q.df"]').click();
  await page.waitForFunction(() => window.__combat.player.combatStance?.maneuver === 'defend' && !window.__combat.piles.hand.some(card => card.instanceId === 'q.df'));
  // The card-play animation paints from the pre-play quotes; the repaint lands when it ends.
  await page.waitForFunction(() => !/(^|\n)2(\n|$)/.test(document.querySelector('.hand .card[data-instance-id="q.ev"]')?.innerText || '2'), null, { timeout: 6000 }).catch(() => {});
  assert.equal(await page.evaluate(() => window.__combat.player.stamina), 1, 'Defend cost 1 SP, leaving 1');
  const after = await painted('q.ev');
  assert.ok(after.includes('1') && !after.includes('2'), `in Defend stance Evade+ is repainted at 1 SP (got ${after.join('|')})`);
  await page.locator('.hand .card[data-instance-id="q.ev"]').click();
  await page.waitForFunction(() => !window.__combat.piles.hand.some(card => card.instanceId === 'q.ev'), null, { timeout: 4000 });
  assert.equal(await page.evaluate(() => window.__combat.player.stamina), 0, 'Evade+ was paid at 1 SP');
  assert.deepEqual(errors, []);
  console.log('evade-defend-discount-live: ok');
} finally { await browser.close(); server?.close?.(); }
process.exit(0);
