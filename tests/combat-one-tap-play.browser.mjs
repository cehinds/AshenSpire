// One tap plays a card when its target is unambiguous (owner, 2026-10-18):
//   - a self card plays on one tap, whatever the enemy count;
//   - a single-target attack plays on its one tap when exactly one enemy lives;
//   - with two living enemies the first tap SELECTS and plays nothing.
// Run: PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-one-tap-play.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];

// Seed 4 deals Defend (self), Strike (one enemy), Smash, Counter, Strike.
async function board(enemyCount) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotSeed=4&shotEnemyCount=${enemyCount}&shotHand=5`, { waitUntil: 'networkidle' });
  return page;
}
const state = page => page.evaluate(() => ({
  hand: window.__combat.piles.hand.map(card => card.cardId),
  energy: window.__combat.player.energy,
  enemyHp: window.__combat.enemies.map(enemy => enemy.hp),
}));
const tapCard = async (page, cardId) => {
  const card = page.locator(`.hand .card[data-card-id="${cardId}"]`).first();
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

try {
  {
    const page = await board(1);
    const before = await state(page);
    await tapCard(page, 'core.strike');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.equal(after.hand.length, before.hand.length - 1, '1v1: one tap on Strike played it');
    assert.ok(after.energy < before.energy, '1v1: and spent its cost');
    assert.ok(after.enemyHp[0] < before.enemyHp[0], '1v1: on the one living enemy');
    await page.close();
  }
  {
    const page = await board(2);
    const before = await state(page);
    await tapCard(page, 'core.strike');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.deepEqual(after, before, '2 enemies: one tap on Strike plays nothing');
    assert.ok(await page.locator('.hand .card.selected[data-card-id="core.strike"]').count() > 0, '2 enemies: it selects, and the player chooses the target');
    await page.close();
  }
  {
    const page = await board(2);
    const before = await state(page);
    await tapCard(page, 'core.defend');
    await page.waitForTimeout(900);
    const after = await state(page);
    assert.equal(after.hand.length, before.hand.length - 1, 'self card: one tap played Defend even with two enemies');
    assert.ok(after.energy < before.energy, 'self card: and spent its cost');
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS combat-one-tap-play');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  server?.close?.();
  process.exit(process.exitCode || 0);
}
