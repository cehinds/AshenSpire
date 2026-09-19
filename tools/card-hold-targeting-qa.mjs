#!/usr/bin/env node
// Rendered regression for issue #1171: hold a targeted card, then choose the
// target through the combat screen's existing selected-card route.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.CARD_HOLD_OUT || resolve(tmpdir(), 'ashenspire-card-hold-targeting'));
const root = resolve(process.env.CARD_HOLD_ROOT || process.cwd());
const entry = process.env.CARD_HOLD_ENTRY || 'index.html';
mkdirSync(output, { recursive: true });
const server = await serve({ root, port: 0, open: false });
// Edge on the owner's machine; CHROME=<executable> elsewhere, as ui-sweep takes it.
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, headless: true } : { channel: 'msedge', headless: true });
const base = `http://127.0.0.1:${server.server.address().port}`;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; console.log(`PASS ${label}`); };

try {
  for (const phone of [false, true]) {
    const name = phone ? 'phone' : 'desktop';
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: phone,
      hasTouch: phone,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`${message.location().url || ''}: ${message.text()}`);
    });
    const cdp = await context.newCDPSession(page);
    const poseCard = async () => {
      await page.goto(`${base}/${entry}?shot=combat&shotSettings=${encodeURIComponent('{"holdConfirm":"normal"}')}`);
      await page.waitForSelector('.hand .card');
      await page.evaluate(() => {
        const combat = window.__combat;
        const instanceId = combat.piles.hand[0].instanceId;
        combat.phase = 'player';
        combat.player.energy = 10;
        combat.player.mana = 10;
        combat.player.stamina = 10;
        combat.piles.hand = [{ instanceId, cardId: 'riposte', upgraded: false }];
        window.__holdTargetCard = instanceId;
        window.__renderCombatForShot();
      });
      await page.waitForFunction(() => document.querySelectorAll('.hand .card').length === 1);
      const card = page.locator('.hand .card');
      const box = await card.boundingBox();
      const point = { x: box.x + box.width / 2, y: box.y + box.height * 0.55 };
      return {
        card,
        point,
        down: async () => phone
          ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
          : (await page.mouse.move(point.x, point.y), page.mouse.down()),
        move: async (x, y) => phone
          ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
          : page.mouse.move(x, y),
        up: async () => phone
          ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
          : page.mouse.up(),
      };
    };

    let gesture = await poseCard();
    await gesture.down();
    await page.waitForTimeout(100);
    await gesture.up();
    check(await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === window.__holdTargetCard).length === 0),
      `${name} early release preserves tap-to-select without playing the card`);

    gesture = await poseCard();
    await gesture.down();
    await gesture.move(gesture.point.x + 40, gesture.point.y);
    await gesture.up();
    check(await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === window.__holdTargetCard).length === 0),
      `${name} moving beyond hold slop cancels without playing the card`);

    gesture = await poseCard();
    const { card, down, up } = gesture;

    const holdMs = await card.evaluate(element => Number(element.dataset.holdMs));
    check(holdMs > 0, `${name} card reads the configured hold duration`);
    await down();
    await page.waitForTimeout(150);
    check(await card.evaluate(element => element.dataset.hold === 'holding' && Number(element.dataset.holdProgress) > 0),
      `${name} hold gives immediate visible progress`);
    await page.screenshot({ path: resolve(output, `${name}-hold-progress.png`) });

    await page.waitForTimeout(Math.max(0, holdMs - 100));
    await page.waitForFunction(() => document.querySelector('.hand .card.selected'));
    await up();
    check(await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === window.__holdTargetCard).length === 0),
      `${name} completed hold arms the targeted card without playing it`);
    check(await card.evaluate(element => element.classList.contains('selected')),
      `${name} targeted card remains visibly selected after release`);
    check(await page.locator('.enemy.targetable:not(.dead)').count() === await page.evaluate(() => window.__combat.enemies.filter(enemy => enemy.alive).length),
      `${name} completed hold exposes every legal living target`);
    await page.screenshot({ path: resolve(output, `${name}-target-selected.png`) });

    // A player taps the enemy's sprite: in the formation layout the combatant
    // frame itself takes no pointer events, and on a phone its centre sits in
    // the overhead space above the sprite.
    await page.locator('.enemy.targetable:not(.dead) .sprite').first().click();
    await page.waitForFunction(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === window.__holdTargetCard).length === 1);
    check(await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === window.__holdTargetCard).length === 1),
      `${name} choosing a legal target plays the held card exactly once`);

    const relevantErrors = errors.filter(error => !error.includes('favicon.ico') && !/assets\/sfx\//.test(error));
    check(relevantErrors.length === 0, `${name} interaction has no relevant runtime errors: ${relevantErrors.join('; ')}`);
    await context.close();
  }
  console.log(`PASS — ${checks}/${checks} card-hold targeting checks`);
  console.log(`Screenshots: ${output}`);
} finally {
  await browser.close();
  server.server.closeAllConnections?.();
  server.server.close();
}
