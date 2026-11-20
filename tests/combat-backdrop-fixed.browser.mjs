// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/path/to/chrome node tests/combat-backdrop-fixed.browser.mjs
// Owner 2026-11-20: "When combat begins, the background should be fixed (like a solid image). Sometimes when an
// enemy is defeated, the layers shift position." The combat box can settle after the first formation pass (the
// display settings land after a shot mounts the fight), and the formation gate does not watch it. The backdrop
// follows the combat box on its own, so:
//   1. A change of the combat box alone (the field's box pinned, no formation pass) refits the backdrop.
//   2. A later death relays out the figures and leaves every backdrop box where it was.
//   3. Review of #2918: the grid follows the resting cards' top, which moves with the hand's size. Changing the hand,
//      then a death (which relays out the figures with the new grid), leaves every backdrop box where it was.
//   4. A window resize inside the form factor (1280x800 to 1180x760) refits once; a hand change and a death after it
//      leave every backdrop box where the resize put it.
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
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const label = `${width}x${height} core, hand then death`;
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotEnemyCount=3&shotSeed=7&shotHand=5`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForSelector('.combatant.enemy .sprite');
    await page.waitForTimeout(2500);
    const restTop = () => page.evaluate(() => document.querySelector('.combat .hand')?.style.getPropertyValue('--hand-rest-top'));
    const settled = await read(page);
    const fullHandRest = await restTop();
    assert.ok(await page.evaluate(() => document.querySelector('.alternative-backdrop')?.dataset.mobileFloorPaintTop), `${label}: the floored alternative backdrop is drawn`);

    for (const cards of [3, 2]) {
      await page.evaluate(cards => { window.__combat.piles.hand.length = cards; window.__renderCombatForShot(); }, cards);
      await page.waitForTimeout(800);
    }
    assert.equal(await page.evaluate(() => document.querySelectorAll('.combat .hand .card').length), 2, `${label}: the hand holds two cards`);
    // On a phone the resting cards' top moves with the hand's size (5 cards to 2: about 4.5 px here), so the death's
    // pass brings a different grid; a desktop hand keeps its top, and the case still checks the backdrop holds.
    if (width < 600) assert.notEqual(await restTop(), fullHandRest, `${label}: the resting cards' top moved, so the fixture tests something`);
    const handChanged = await read(page);
    assert.deepEqual(handChanged.boxes, settled.boxes, `${label}: a hand change leaves the backdrop`);

    await page.evaluate(() => { const enemy = window.__combat.enemies.find(e => e.alive); enemy.hp = 0; enemy.alive = false; window.__renderCombatForShot(); });
    await settle(page);
    const afterDeath = await read(page);
    assert.notEqual(afterDeath.epoch, handChanged.epoch, `${label}: the death relays out the figures`);
    assert.deepEqual(afterDeath.boxes, settled.boxes, `${label}: and every backdrop box stays where it was`);
    assert.equal(afterDeath.environmentHeight, settled.environmentHeight);
    await page.close();
    console.log(`ok ${label}`);
  }
  {
    const label = '1280x800 to 1180x760 core, resize then hand then death';
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(`${server.url}index.html?shot=combat&gameProfile=core&shotEnemyCount=3&shotSeed=7&shotHand=5`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForSelector('.combatant.enemy .sprite');
    await page.waitForTimeout(2500);
    const before = await read(page);
    await page.setViewportSize({ width: 1180, height: 760 });
    await page.waitForTimeout(1500);
    const resized = await read(page);
    assert.notDeepEqual(resized.boxes, before.boxes, `${label}: the resize refits the backdrop`);
    for (const cards of [3, 2]) {
      await page.evaluate(cards => { window.__combat.piles.hand.length = cards; window.__renderCombatForShot(); }, cards);
      await page.waitForTimeout(800);
    }
    assert.deepEqual((await read(page)).boxes, resized.boxes, `${label}: a hand change leaves the backdrop`);
    await page.evaluate(() => { const enemy = window.__combat.enemies.find(e => e.alive); enemy.hp = 0; enemy.alive = false; window.__renderCombatForShot(); });
    await settle(page);
    const afterDeath = await read(page);
    assert.notEqual(afterDeath.epoch, resized.epoch, `${label}: the death relays out the figures`);
    assert.deepEqual(afterDeath.boxes, resized.boxes, `${label}: and every backdrop box stays where the resize put it`);
    await page.close();
    console.log(`ok ${label}`);
  }
} finally {
  await browser.close();
  server.close?.();
}
process.exit(0);
