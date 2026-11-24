// Real Chromium regression: modal actions retain their mounted parent and list context.
// Browser plugin not available; uses the repository's Playwright + browser launcher.
// SHOT_DIR=<outside-repo path> [PAGE_TIMEOUT_MS=60000] node tests/menu-context.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '../tools/serve.mjs';
import { launchBrowser } from '../tools/browser.mjs';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.BASE_URL || server.url;
const launched = await launchBrowser({ prefix: 'ctx-', headless: '--headless=new' });
const browser = await chromium.connectOverCDP(launched.wsUrl);
const shotDir = process.env.SHOT_DIR;
if (shotDir) mkdirSync(shotDir, { recursive: true });
const errors = [];
let checks = 0;
async function capture(page, name) {
  if (shotDir) await page.screenshot({ path: join(shotDir, `${name}.png`) });
}
async function remember(page, selectors) {
  await page.evaluate(selectors => {
    window.__contextNodes = selectors.map(selector => [selector, document.querySelector(selector)]);
  }, selectors);
}
async function retained(page, label) {
  const lost = await page.evaluate(() => window.__contextNodes
    .filter(([selector, node]) => !node || !node.isConnected || document.querySelector(selector) !== node)
    .map(([selector]) => selector));
  assert.deepEqual(lost, [], `${label}: parent and unaffected nodes stay mounted`);
  checks++;
}
async function confirm(page) {
  await page.locator('.confirmation-confirm').waitFor({ state: 'visible' });
  await page.locator('.confirmation-confirm').click();
  await page.locator('.confirmation-confirm').waitFor({ state: 'detached' });
}
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const suffix = viewport.width === 390 ? 'mobile' : 'desktop';
    const page = await browser.newPage({ viewport });
    // A cold unbuilt page without the art packs can take longer than 15 s to load; PAGE_TIMEOUT_MS raises it.
    page.setDefaultTimeout(Number(process.env.PAGE_TIMEOUT_MS) || 15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}index.html?shot=shop&shotSeed=1`, { waitUntil: 'load' });
    await page.locator('.merchant-workspace:not(.blacksmith-workspace)').waitFor();
    assert.match(await page.title(), /Ashen Spire/);
    assert((await page.locator('#app').innerText()).includes('Merchant'));
    checks++;
    await page.locator('[data-shop-category="combatCards"]').click();
    const selectors = ['.merchant-workspace', '.shop-frame', '.shop-pane', '.shop-offers',
      '[data-shop-shelf="combatCards"]', '[data-shop-shelf="relics"] .merchant-thumbnail'];
    await remember(page, selectors);
    const before = await page.evaluate(() => window.__rewardStateForShot().live);
    await page.locator('[data-shop-shelf="combatCards"] [data-shop-action="buy"]:enabled').first().click();
    if (await page.locator('.confirmation-confirm').count()) await confirm(page);
    await page.locator('#shop-buy-keep').waitFor();
    await retained(page, 'purchase');
    await page.locator('#shop-buy-primary').click();
    await page.locator('#shop-buy-primary').waitFor({ state: 'detached' });
    await retained(page, 'add purchased card to deck');
    const after = await page.evaluate(() => window.__rewardStateForShot().live);
    assert.equal(after.deckIDs.length, before.deckIDs.length + 1);
    assert(after.cinders < before.cinders);
    assert.equal(await page.locator('.merchant-workspace').getAttribute('data-shop-content'), 'combatCards');
    checks++;
    await capture(page, `merchant-buy-${suffix}`);
    // Build a genuinely scrolling sale list through the real purchase flow.
    for (let i = 0; i < 7; i++) {
      await page.locator('[data-shop-shelf="combatCards"] [data-shop-action="buy"]:enabled').first().click();
      if (await page.locator('.confirmation-confirm').count()) await confirm(page);
      await page.locator('#shop-buy-keep').click();
    }
    await page.locator('[data-shop-category="sell"]').click();
    await remember(page, ['.merchant-workspace', '.shop-frame', '.shop-offers', '[data-shop-shelf="sell"]']);
    const saleCount = await page.locator('[data-shop-shelf="sell"] .merchant-offer').count();
    const sale = page.locator('[data-shop-shelf="sell"] [data-shop-action="sell"]:enabled').nth(5);
    await sale.scrollIntoViewIfNeeded();
    const saleScroll = await page.locator('.shop-offers').evaluate(node => node.scrollTop);
    assert(saleScroll > 0, 'fixture genuinely scrolls merchant sales');
    await sale.click();
    if (await page.locator('.confirmation-cancel').count()) {
      await page.locator('.confirmation-cancel').click();
      await retained(page, 'cancel sale');
      assert.equal(await page.locator('[data-shop-shelf="sell"] .merchant-offer').count(), saleCount);
      await sale.click();
      await confirm(page);
    }
    await retained(page, 'sale');
    assert.equal(await page.locator('[data-shop-shelf="sell"] .merchant-offer').count(), saleCount - 1);
    const remainingScroll = await page.locator('.shop-offers').evaluate(node => node.scrollTop);
    assert(Math.abs(remainingScroll - saleScroll) <= 2, `sale scroll stays put: ${saleScroll} -> ${remainingScroll}`);
    checks++;
    await capture(page, `merchant-sell-${suffix}`);

    // A posed library supplies enough distinct cards to genuinely overflow the list.
    // It uses production models, editor and input, while the real shop stays underneath.
    await page.evaluate(async () => {
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const { createRunState } = await import('/src/model/state.js');
      const { mountDeckEditor } = await import('/src/ui/screens/deckEditor.js');
      const registries = createRegistries(contentBundle);
      const run = createRunState({ seed: 19, classId: 'reaver', registries, combatExpansionVersion: 1 });
      run.sideboard.push(...registries.cards.all().filter(card => card.type !== 'curse').slice(0, 45)
        .map((card, i) => ({ cardId: card.id, instanceId: `context:${i}`, upgraded: false })));
      // The collection lists deck cards first (playtest 2026-11-17 item 45b): a copy of each of the first 30 library
      // cards is in the deck too, so adding another copy keeps its tile where it stands in the scrolled list.
      run.deck.push(...run.sideboard.filter(card => card.instanceId.startsWith('context:')).slice(0, 30)
        .map(card => ({ ...card, instanceId: `context-deck:${card.instanceId.slice(8)}` })));
      window.__contextRun = run;
      window.__contextEditor = mountDeckEditor(document.body, { registries, run, settings: { deckMinSize: 1 }, search: true });
    });
    await page.locator('.deck-editor').waitFor();
    await remember(page, ['.merchant-workspace', '.deck-editor', '.deck-editor-panes',
      '[data-pane="collection"]', '[data-pane="collection"] .deck-editor-list',
      '[data-pane="collection"] .deck-editor-search']);
    const target = page.locator('[data-pane="collection"] .deck-editor-tile[data-in-deck="true"]:has(.deck-editor-step[data-action="add"]:enabled)').nth(10);
    await target.scrollIntoViewIfNeeded();
    const add = target.locator('[data-action="add"]').last();
    await add.scrollIntoViewIfNeeded();
    const scrollBefore = await page.locator('[data-pane="collection"] .deck-editor-list').evaluate(node => node.scrollTop);
    assert(scrollBefore > 0, 'fixture genuinely scrolls the collection');
    const deckBefore = await page.evaluate(() => window.__contextRun.deck.length);
    await add.click();
    await retained(page, 'deck add');
    assert.equal(await page.evaluate(() => window.__contextRun.deck.length), deckBefore + 1);
    const scrollAfter = await page.locator('[data-pane="collection"] .deck-editor-list').evaluate(node => node.scrollTop);
    assert(Math.abs(scrollAfter - scrollBefore) <= 2, `deck list scroll stays put: ${scrollBefore} -> ${scrollAfter}`);
    checks++;
    await capture(page, `deck-edit-${suffix}`);
    // Discard confirmation Cancel / Keep editing changes no parent component.
    await page.locator('#deck-editor-cancel').click();
    await page.locator('.confirmation-cancel').click();
    await retained(page, 'keep editing');
    await page.locator('#deck-editor-done').click();
    await page.locator('.deck-editor').waitFor({ state: 'detached' });
    assert(await page.locator('.merchant-workspace').isVisible());
    checks++;

    await page.goto(`${base}index.html?shot=blacksmith&shotSeed=1`, { waitUntil: 'load' });
    await page.locator('.blacksmith-workspace').waitFor();
    await page.locator('[data-shop-category="armaments"]').click();
    await remember(page, ['.blacksmith-workspace', '.shop-frame', '.shop-pane', '.shop-offers',
      '[data-shop-shelf="armaments"]', '[data-shop-shelf="armaments"] .merchant-thumbnail']);
    const smithBefore = await page.evaluate(() => window.__rewardStateForShot().live.cinders);
    await page.locator('[data-shop-shelf="armaments"] .merchant-offer-action:enabled').last().click();
    // Every Blacksmith buy asks first (owner, 2026-11-19; secondbeat 'smithBuy').
    await confirm(page);
    await page.locator('#what-changed-continue').waitFor();
    await retained(page, 'Blacksmith purchase');
    await page.locator('#what-changed-continue').click();
    await page.locator('#shop-buy-keep').waitFor();
    assert(await page.locator('.shop-buy-choice').evaluate(node => node.contains(document.activeElement)),
      'closing receipt restores focus inside the purchase choice');
    await page.locator('#shop-buy-keep').click();
    await retained(page, 'Blacksmith keep in inventory');
    assert((await page.evaluate(() => window.__rewardStateForShot().live.cinders)) < smithBefore);
    const nextBalance = await page.evaluate(() => window.__rewardStateForShot().live.cinders);
    await page.locator('[data-shop-shelf="armaments"] .merchant-offer-action:enabled').last().click();
    await confirm(page);
    await page.locator('#what-changed-continue').click();
    await page.locator('#shop-buy-keep').click();
    await retained(page, 'Blacksmith repeated purchase');
    assert((await page.evaluate(() => window.__rewardStateForShot().live.cinders)) < nextBalance);
    checks++;
    await capture(page, `blacksmith-${suffix}`);

    await page.goto(`${base}index.html?shot=map&shotSeed=1`, { waitUntil: 'load' });
    await page.locator('.mapscreen').waitFor();
    await remember(page, ['.mapscreen', '.mapscreen .map-node']);
    await page.locator('#open-armoury').click();
    await page.locator('.armoury').waitFor();
    await page.locator('.armoury-close').click();
    await retained(page, 'Armoury close returns to mounted map');
    await page.goto(`${base}index.html?shot=rest&shotSeed=1`, { waitUntil: 'load' });
    await page.locator('.rest-screen').waitFor();
    await remember(page, ['.rest-screen', '.rest-door', '#deck-opt']);
    await page.locator('#deck-opt').click();
    await page.locator('.deck-editor').waitFor();
    await page.locator('#deck-editor-cancel').click();
    await page.locator('.deck-editor').waitFor({ state: 'detached' });
    await retained(page, 'deck cancel returns to mounted Shrine');
    await page.close();
  }
  assert.deepEqual(errors, [], 'no JavaScript page errors');
  console.log(`PASS ${checks} menu context checks; desktop 1280x800 and phone 390x844; no page errors`);
} finally {
  await browser.close();
  await launched.close();
  if (server) await new Promise(resolve => server.server.close(resolve));
}
