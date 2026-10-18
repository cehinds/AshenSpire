// Real-browser regression for one-press inspection (owner, 2026-10-13: a visible
// "i" opens inspection on the first press, on touch, mouse and keyboard; on
// main@2026-10-03 the enemy "i" needed two presses). Guards the hand card's
// Inspect control (.hand-info-portal) and the enemy's Inspect control
// (.combatant-info) on a desktop mouse shape and a phone touch shape.
// Run: node tools/inspect-one-click-browser.mjs
// Prints "inspect-one-click: OK n/n checks" and exits 0, or names the failed
// check and exits 1. Screenshots go to docs/preview/inspect-one-click/.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
} catch {
  playwright = require('/opt/node-tools/node_modules/playwright-core');
}
const { chromium } = playwright;

const output = resolve('docs/preview/inspect-one-click');
mkdirSync(output, { recursive: true });

const shapes = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, phone: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, phone: true },
];

const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = `http://localhost:${server.server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
});

let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };

// A human-length press: touch on phone, mouse move + down + up on desktop.
async function press(page, cdp, phone, x, y) {
  if (phone) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(x, y, { steps: 8 });
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.up();
  }
}

// Escape up to three times, 300 ms apart, until the inspector is gone.
async function closeWithEscape(page, inspector) {
  for (let i = 0; i < 3 && await inspector.count() > 0; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

async function centre(locator) {
  const b = await locator.boundingBox();
  assert.ok(b, 'element has a bounding box');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
}

async function openFresh(context) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}?shot=combat&shotSeed=INSPECT1`);
  await page.waitForSelector('.hand .card');
  await page.waitForTimeout(1500);
  return { page, errors };
}

try {
  for (const shape of shapes) {
    const context = await browser.newContext({
      viewport: shape.viewport,
      isMobile: shape.phone,
      hasTouch: shape.phone,
    });
    const { page, errors } = await openFresh(context);
    const cdpPage = await context.newCDPSession(page);
    const label = shape.name;

    // HAND CARD: the Inspect "i" lives in .hand-info-portal in the hand's parent,
    // not inside the card.
    const handCard = page.locator('.hand .card').nth(1);
    const hb = await handCard.boundingBox();
    assert.ok(hb, `${label}: hand card has a box`);
    await press(page, cdpPage, shape.phone, hb.x + hb.width / 2, hb.y + 60);
    const portal = page.locator('.hand-info-portal').first();
    await portal.waitFor({ state: 'visible', timeout: 5000 });
    const handCount = await page.locator('.hand .card').count();
    const hp = await centre(portal);
    await press(page, cdpPage, shape.phone, hp.x, hp.y);
    await page.waitForTimeout(500);
    check(await page.locator('.card-inspection-modal').count() === 1, `${label} hand card: one press opens`);
    check(await page.locator('.hand .card').count() === handCount, `${label} hand card: did not play the card`);
    await page.screenshot({ path: resolve(output, `${label}-card.jpg`), type: 'jpeg', quality: 70 });
    await page.keyboard.press('Escape');
    check(await page.locator('.card-inspection-modal').count() === 0, `${label} hand card: escape closes`);

    // ENEMY: reload to start clean (a selected hand card would play on enemy press).
    await page.goto(`${base}?shot=combat&shotSeed=INSPECT1`);
    await page.waitForSelector('.hand .card');
    await page.waitForTimeout(1500);
    const enemy = page.locator('.combatant.enemy').first();
    const eb = await enemy.boundingBox();
    assert.ok(eb, `${label}: enemy has a box`);
    await press(page, cdpPage, shape.phone, eb.x + eb.width / 2, eb.y + eb.height * 0.3);
    await page.waitForTimeout(800);
    check(await enemy.evaluate(e => e.classList.contains('context-selected')), `${label} enemy: press selects`);
    const info = enemy.locator('.combatant-info');
    check(await info.isVisible(), `${label} enemy: info control visible after select`);
    const ip = await centre(info);
    await press(page, cdpPage, shape.phone, ip.x, ip.y);
    await page.waitForTimeout(600);
    // The combatant inspector is the only dialog with the combatant-door class.
    const inspector = page.locator('[role=dialog].combatant-door:visible');
    check(await inspector.count() === 1, `${label} enemy: one press opens`);
    await page.screenshot({ path: resolve(output, `${label}-enemy.jpg`), type: 'jpeg', quality: 70 });
    await closeWithEscape(page, inspector);
    check(await inspector.count() === 0, `${label} enemy: inspector closes with Escape`);

    // KEYBOARD (desktop only): focus the enemy "i" and press Enter.
    if (!shape.phone) {
      await page.goto(`${base}?shot=combat&shotSeed=INSPECT1`);
      await page.waitForSelector('.hand .card');
      await page.waitForTimeout(1500);
      const kEnemy = page.locator('.combatant.enemy').first();
      const kb = await kEnemy.boundingBox();
      await press(page, cdpPage, false, kb.x + kb.width / 2, kb.y + kb.height * 0.3);
      await page.waitForTimeout(800);
      await kEnemy.locator('.combatant-info').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);
      const keyboardInspector = page.locator('[role=dialog].combatant-door:visible');
      check(await keyboardInspector.count() === 1, `${label} keyboard: Enter opens`);
      await closeWithEscape(page, keyboardInspector);
      check(await keyboardInspector.count() === 0, `${label} keyboard: inspector closes with Escape`);
    }

    check(errors.length === 0, `${label}: no pageerror (${errors.join('; ')})`);
    await context.close();
  }
  console.log(`inspect-one-click: OK ${checks}/${checks} checks`);
} catch (error) {
  console.error(`inspect-one-click: FAILED after ${checks} checks: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.server.close();
}
