// Native regression for the HUD's reading surfaces while a card is selected.
// TARGET_GAME_FILE also exercises a packaged game without source imports.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, basename, resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const file = process.env.TARGET_GAME_FILE && resolve(process.env.TARGET_GAME_FILE);
const server = await serve({ root: file ? dirname(file) : process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const settings = { oneTapPlay: false, holdConfirm: 'off', animSpeed: 'instant', combatSpeed: 8, seenTutorial: true };
try {
  for (const [width, height] of [[390, 844], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width === 390, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const url = new URL(file ? basename(file) : 'index.html', server.url);
    // This existing pre-mount shot fixture gives the real enemy Crimson Blight.
    // One target keeps its full detailed intent visible on compact phones too.
    url.search = new URLSearchParams({ shot: 'combat', gameProfile: 'core', shotSeed: '3', shotEnemyCount: '1', shotHand: '5', shotEnemyContext: 'status', shotSettings: JSON.stringify(settings) });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('.hand .card[data-card-id="core.strike"]', { timeout: 90000 });
    const state = () => page.evaluate(() => ({
      plays: window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length,
      flasks: window.__combat.eventLog.filter(event => event.type === 'flaskUsed').length,
      stamina: window.__combat.player.stamina,
      hand: window.__combat.piles.hand.map(card => card.instanceId),
      selected: document.querySelector('.hand .card.selected')?.dataset.instanceId,
    }));
    const tap = async locator => {
      const box = await locator.boundingBox(); assert.ok(box);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      assert.ok(await locator.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), { x, y }), 'the native tap reaches the intended detail');
      await page.touchscreen.tap(x, y);
    };
    const select = async () => {
      await tap(page.locator('.hand .card[data-card-id="core.strike"]').first().locator('.hand-hit-lane'));
      await page.waitForFunction(() => document.querySelector('.hand .card.selected[data-card-id="core.strike"]'));
      await page.locator('.target-hud-detail[data-eid="e1"][data-targeting="true"].visible:not(.leaving)').waitFor();
    };
    const panel = page.locator('.target-hud-detail[data-eid="e1"].visible:not(.leaving)');
    const tooltip = page.locator('#tooltip[data-open="true"]');
    await select();
    const before = await state();
    await tap(panel.locator('.target-hud-statuses .status-icon[data-status-id="crimsonBlight"]'));
    assert.deepEqual(await state(), before, 'an armed status tap preserves selected card, resources, piles and action counts');
    await tooltip.waitFor({ state: 'visible' });
    assert.match(await tooltip.innerText(), /Crimson Blight/i, 'the real status tooltip remains usable');
    await page.keyboard.press('Escape');
    // Escape closes the reading tooltip without changing the armed card.
    assert.deepEqual(await state(), before);
    await tap(panel.locator('.target-hud-intent'));
    assert.deepEqual(await state(), before, 'a detailed intent tap reads rather than committing the selected card');
    await tooltip.waitFor({ state: 'visible' });
    assert.ok((await tooltip.innerText()).trim(), 'the authored detailed intent tooltip is displayed');
    await page.keyboard.press('Escape');
    assert.deepEqual(await state(), before);
    await tap(panel.locator('.target-hud-name'));
    await page.waitForFunction(n => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length === n + 1, before.plays);
    await page.waitForFunction(() => !document.querySelector('.hand')?.inert && !document.querySelector('.hand .card.selected'));
    await select();
    const second = await state();
    await tap(panel.locator('.target-hud-meters .as-meter[data-res="hp"]'));
    await page.waitForFunction(n => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length === n + 1, second.plays);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}x${height}: armed status/intent explain without committing; name/HP each commit once`);
    await page.close();
  }
} finally { await browser.close(); server.server.close(); }
