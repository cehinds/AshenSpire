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
    // Owner 2026-11-07: no selected target-HUD panel exists. While a card is armed the enemy shows the targeting state on its
    // combatant (target-hud-candidate) and keeps its overhead mini HUD; reading goes through the
    // existing inspect door (a ~650 ms press-and-hold on the figure, combat.js wireCombatantContext).
    const select = async () => {
      await tap(page.locator('.hand .card[data-card-id="core.strike"]').first().locator('.hand-hit-lane'));
      await page.waitForFunction(() => document.querySelector('.hand .card.selected[data-card-id="core.strike"]'));
      await page.locator('.combatant.enemy[data-eid="e1"].target-hud-candidate').waitFor();
    };
    const enemy = page.locator('.combatant.enemy[data-eid="e1"]');
    const mini = enemy.locator(':scope > .target-hud-overhead-meters');
    await select();
    assert.equal(await page.locator('.target-hud-detail.visible').count(), 0, 'no selected panel opens while armed');
    await mini.waitFor({ state: 'visible' });
    const before = await state();
    // The existing inspect door: press and hold the enemy figure. It reads the enemy and leaves the armed card armed.
    const inspector = page.locator('.combatant-inspector-body');
    const figure = await enemy.locator('.sprite').boundingBox(); assert.ok(figure);
    await page.mouse.move(figure.x + figure.width / 2, figure.y + figure.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    await inspector.first().waitFor({ state: 'visible' });
    assert.equal(await inspector.count(), 1, 'exactly one inspector modal opens');
    assert.deepEqual(await state(), before, 'an armed inspect hold reads rather than committing or cancelling the selected card');
    assert.ok((await inspector.innerText()).trim(), 'the combatant inspector shows its reading');
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    assert.deepEqual(await state(), before, 'closing the inspector leaves the card armed');
    await tap(enemy.locator('.sprite'));
    await page.waitForFunction(n => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length === n + 1, before.plays);
    await page.waitForFunction(() => !document.querySelector('.hand')?.inert && !document.querySelector('.hand .card.selected'));
    await select();
    const second = await state();
    await tap(mini.locator('[data-res="hp"], .as-meter, .meters').first());
    await page.waitForFunction(n => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length === n + 1, second.plays);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}x${height}: armed inspect hold explain without committing; figure and mini HUD each commit once`);
    await page.close();
  }
} finally { await browser.close(); server.server.close(); }
