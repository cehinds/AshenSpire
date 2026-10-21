// Real touch regression; TARGET_GAME_FILE=/absolute/standalone.html also tests
// the packaged cascade, without importing or remounting any game source.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, basename, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const file = process.env.TARGET_GAME_FILE && resolve(process.env.TARGET_GAME_FILE);
const server = await serve({ root: file ? dirname(file) : process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = [];
const captures = process.env.TARGET_QA_OUT;
if (captures) mkdirSync(captures, { recursive: true });
const settings = { oneTapPlay: false, holdConfirm: 'off', animSpeed: 'instant', combatSpeed: 8, seenTutorial: true };
const count = page => page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length);
async function selectStrike(page) {
  const card = page.locator('.hand .card[data-card-id="core.strike"]').first();
  const lane = await card.locator('.hand-hit-lane').boundingBox();
  assert.ok(lane);
  await page.touchscreen.tap(lane.x + lane.width / 2, lane.y + lane.height * .4);
  await page.waitForFunction(() => document.querySelector('.hand .card.selected[data-card-id="core.strike"]'));
  await page.locator('.target-hud-detail[data-role="enemy"].visible:not(.leaving)').first().waitFor();
}
async function point(page, id, selector) {
  return page.locator(`.target-hud-detail[data-eid="${id}"].visible:not(.leaving) ${selector}`).evaluate(node => {
    const box = node.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    return { x, y, owner: document.elementFromPoint(x, y)?.closest('.target-hud-detail')?.dataset.eid };
  });
}
async function expectPlay(page, before, target) {
  await page.waitForFunction(n => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length > n, before);
  await page.waitForFunction(() => !document.querySelector('.hand')?.inert && !document.querySelector('.hand .card.selected'));
  const plays = await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').map(event => ({ targetId: event.targetId, cardId: event.cardId })));
  assert.equal(plays.length, before + 1, 'a target gesture commits exactly one card');
  assert.equal(plays.at(-1).targetId, target, 'the visible target owns the committed engine action');
}
async function holdAndDismiss(page, id, before) {
  const at = await point(page, id, '.target-hud-name');
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y }] });
    await page.locator('.combatant-inspector-body').waitFor({ state: 'visible' });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await count(page), before, 'holding to inspect and releasing never commits a card');
    const close = await page.locator('.combatant-door .modal-close').boundingBox();
    assert.ok(close);
    await page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
    await page.locator('.combatant-inspector-body').waitFor({ state: 'detached' });
  } finally { await cdp.detach(); }
}
try {
  for (const [width, height] of [[375, 667], [390, 844], [412, 915]]) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      // Observe the authored hold callback without changing its behavior. The
      // <700ms assertion guards against restoring the former global cooldown;
      // suppression itself now belongs to the originating pointer.
      window.__targetHoldProbe = { fired: null, activations: [] };
      const timeout = window.setTimeout;
      window.setTimeout = function (callback, delay, ...args) {
        if (typeof callback === 'function' && Number(delay) === 500 && callback.toString().includes('inspectionPointer')) {
          const original = callback;
          callback = function (...params) { window.__targetHoldProbe.fired = performance.now(); return original.apply(this, params); };
        }
        return timeout.call(this, callback, delay, ...args);
      };
      for (const type of ['click', 'keydown']) document.addEventListener(type, event => {
        const target = event.target.closest?.('.target-hud-detail');
        if (target) window.__targetHoldProbe.activations.push({ type, id: target.dataset.eid,
          time: performance.now(), trusted: event.isTrusted, key: event.key });
      }, true);
    });
    const url = new URL(file ? basename(file) : 'index.html', server.url);
    url.search = new URLSearchParams({ shot: 'combat', gameProfile: 'core', shotSeed: '3', shotEnemyCount: '3', shotHand: '5', shotSettings: JSON.stringify(settings) });
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('.hand .card[data-card-id="core.strike"]', { timeout: 90000 });
    await selectStrike(page);
    // Every visible name has its own native hit owner, including the lower pair
    // that used to overlap on an iPhone SE-sized viewport.
    for (const id of ['e1', 'e2', 'e3']) {
      const at = await point(page, id, '.target-hud-name');
      assert.equal(at.owner, id, `${width}: ${id} name remains reachable`);
    }
    const layout = await page.locator('.target-hud-detail[data-role="enemy"].visible:not(.leaving) .target-hud-panel').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
    for (const a of layout) {
      assert.ok(a.height >= 43.9, 'compact target remains at least 44 physical pixels high');
      for (const b of layout) if (a !== b) assert.ok(a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1, 'compact target panels do not overlap');
    }
    const before = await count(page);
    if (captures) await page.screenshot({ path: resolve(captures, `targeting-${width}.png`) });
    await holdAndDismiss(page, 'e2', before);
    const target = width === 390 ? 'e1' : 'e2';
    const name = await point(page, target, '.target-hud-name');
    assert.equal(name.owner, target, 'the fresh gesture reaches the intended target');
    const activationStart = await page.evaluate(() => performance.now());
    if (width === 412) {
      await page.locator(`.target-hud-detail[data-eid="${target}"].visible:not(.leaving) .target-hud-name`).focus();
      await page.keyboard.press('Enter');
    } else {
      await page.touchscreen.tap(name.x, name.y);
    }
    const timing = await page.evaluate(({ target, keyboard, since }) => {
      const probe = window.__targetHoldProbe;
      const activation = probe.activations.find(event => event.time >= since && event.id === target
        && event.type === (keyboard ? 'keydown' : 'click') && event.trusted);
      return { fired: probe.fired, activation, elapsed: activation ? activation.time - probe.fired : null };
    }, { target, keyboard: width === 412, since: activationStart });
    assert.notEqual(timing.fired, null, 'the actual inspection hold callback was observed');
    assert.ok(timing.activation && timing.elapsed >= 0 && timing.elapsed < 700,
      `fresh activation must stay inside the former cooldown interval, observed ${JSON.stringify(timing)}`);
    if (width === 375) await page.touchscreen.tap(name.x, name.y);
    await expectPlay(page, before, target);
    // After actual playback settles, the remaining Strike and its live target
    // layer must still work; HP has tooltip listeners and formerly ate this tap.
    await selectStrike(page);
    const hp = await point(page, 'e1', '.target-hud-meters .as-meter[data-res="hp"]');
    assert.equal(hp.owner, 'e1');
    await page.touchscreen.tap(hp.x, hp.y);
    await expectPlay(page, before + 1, 'e1');
    assert.equal(await page.locator('.combatant-inspector-body').count(), 0, 'target taps never open inspection');
    assert.deepEqual(errors, [], 'no runtime errors during native targeting and playback');
    if (width === 375) {
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForSelector('.hand .card[data-card-id="core.strike"]', { timeout: 90000 });
      const cdp = await page.context().newCDPSession(page);
      const lane = await page.locator('.hand .card[data-card-id="core.strike"]').first().locator('.hand-hit-lane').boundingBox();
      const start = { x: lane.x + lane.width / 2, y: lane.y + lane.height * .4 };
      const dragBefore = await count(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - 50 }] });
      await page.locator('.target-hud-detail[data-eid="e2"][data-targeting="true"].visible:not(.leaving)').waitFor();
      const destination = await point(page, 'e2', '.target-hud-name');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: destination.x, y: destination.y }] });
      await page.waitForTimeout(700); // a stationary drop, independently of flick speed
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expectPlay(page, dragBefore, 'e2');
      await cdp.detach();
      assert.deepEqual(errors, []);
    }
    results.push({ width, height, freshActivation: { target, keyboard: width === 412, elapsed: timing.elapsed },
      checks: ['native name hit ownership', '44px nonoverlapping compact panels', 'hold release never plays',
        'fresh activation within 700ms', 'name commits correct enemy', 'post-playback HP commits correct enemy'], errors });
    await page.close();
  }
  console.log(JSON.stringify({ file: file || 'source index.html', results }, null, 2));
} finally { await browser.close(); server.server.close(); }
