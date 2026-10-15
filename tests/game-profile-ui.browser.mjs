// Run after source integration: PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/usr/bin/chromium node tests/game-profile-ui.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.GAME_PROFILE_UI_OUT || '/tmp/ashen-game-profile-ui';
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', headless: true });
const base = server.url;
const errors = [];
async function pageFor(query) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}index.html?${query}`);
  await page.waitForTimeout(700);
  return page;
}
async function openNew(page) {
  await page.locator('#new-game').click();
  await page.locator('.title-slot-pick').nth(1).click();
  await page.getByRole('button', { name: 'Create character', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
}
try {
  for (const profile of ['core', 'current']) {
    const page = await pageFor(`shot=title&gameProfile=${profile}`);
    assert.deepEqual(await page.locator('.title-menu [data-title-action]').evaluateAll(rows => rows.map(row => row.dataset.titleAction)), ['continue', 'new', 'load', 'settings', 'quit']);
    assert.equal(await page.locator('.title-screen .game-profile-selector').count(), 0);
    await page.screenshot({ path: resolve(output, `${profile}-title.png`) });
    await openNew(page);
    const selector = page.getByLabel('New game configuration');
    assert.equal(await selector.inputValue(), profile);
    if (profile === 'core') {
      const imported = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: { routes: { prebossNodes: 5, restFloors: [2, 4] } } };
      await page.getByLabel('Import game configuration JSON').setInputFiles({ name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
      await page.waitForTimeout(100);
      assert.equal(await selector.inputValue(), 'imported');
      await selector.selectOption('current'); await selector.selectOption('imported');
      await page.getByRole('button', { name: 'Choose class', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Starseer · Locked', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Begin the climb', exact: true }).click();
      assert.equal(await page.locator('.map-node').count(), 6, 'imported route override changes real map generation');
    }
    await page.close();
  }
  for (const profile of ['core', 'current']) {
    const page = await pageFor(`shot=map&gameProfile=${profile}&shotSeed=3`);
    await page.locator('.map-node.reachable').first().click({ force: true });
    await page.locator('#map-enter').click({ force: true });
    await page.waitForSelector('.end-turn');
    assert.ok(await page.locator('.hand .card').count() > 0);
    await page.screenshot({ path: resolve(output, `${profile}-combat.png`) });
    await page.close();
  }
  const fallback = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: { cards: false, art: false, routes: false } };
  const page = await pageFor(`shot=combat&wb.gameProfile=${encodeURIComponent(JSON.stringify(fallback))}`);
  assert.equal(await page.locator('.foundation-attack').count(), 1);
  assert.ok(await page.locator('.foundation-standin').count() >= 2);
  const before = await page.evaluate(() => window.__combat.enemies[0].hp);
  await page.locator('.foundation-attack').click(); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => window.__combat.enemies[0].hp) < before);
  await page.close();
  assert.deepEqual(errors, []);
  console.log(`game-profile-ui browser: PASS; screenshots ${output}`);
} finally {
  await browser.close(); server.server.close();
}
