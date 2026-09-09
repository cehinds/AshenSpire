// Browser plugin unavailable: production screens exercised with Playwright.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://localhost:4357';
const output = process.env.QA_OUTPUT || join(tmpdir(), 'ashen-card-flick-qa');
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
const check = (value, label) => { assert.ok(value, label); results.push(label); console.log('PASS', label); };
try {
  for (const [shape, viewport, touch, settings] of [
    ['phone', { width: 390, height: 844 }, true, {}],
    ['phone-xl', { width: 390, height: 844 }, true, { textSize: 'XL' }],
    ['desktop', { width: 1440, height: 1000 }, false, {}],
  ]) {
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const route = '/AshenSpire.html?shot=combat&shotSettings=' + encodeURIComponent(JSON.stringify({ ...settings, touchFlickDistance: 160 }));
    await page.goto(base + route);
    await page.locator('.hand .card').first().waitFor(); await page.waitForTimeout(1000);
    check((await page.title()).includes('Ashen') && await page.locator('.hand .card').count() > 0, shape + ': built game loaded');
    const card = page.locator('.hand .card').first();
    const state = () => page.evaluate(() => JSON.stringify(window.__combat));
    const before = await state();
    if (touch) await card.tap({ position: { x: 20, y: 55 } }); else await card.click({ position: { x: 20, y: 55 } });
    check(await card.evaluate(el => el.classList.contains('selected')), shape + ': selection retained');
    check(await card.locator('.card-info-button').isVisible(), shape + ': information button visible');
    check(await page.locator('.enemy.aiming').count() > 0 && await state() === before, shape + ': target preview without playing');
    await page.screenshot({ path: join(output, shape + '-selected.png') });
    if (touch) await card.locator('.card-info-button').tap(); else await card.locator('.card-info-button').click();
    await page.locator('.card-inspection-modal').waitFor();
    check(await state() === before, shape + ': information does not play');
    await page.keyboard.press('Escape');
    const cdp = await context.newCDPSession(page);
    const flick = async (distance, finish = 'release', side = 0) => {
      const b = await card.boundingBox(); const x = b.x + b.width / 2, y = Math.min(viewport.height - 25, b.y + b.height * .65);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let n = 1; n <= 5; n++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + side * n / 5, y: y - distance * n / 5 }] });
        await page.waitForTimeout(10);
      }
      const drop = await page.locator('.drop-verdict').textContent();
      if (finish === 'pause') await page.waitForTimeout(180);
      if (finish === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (finish === 'capture') await page.evaluate(() => {
        const card = document.querySelector('.hand .drag-source');
        for (let id = 0; id < 30; id++) if (card?.hasPointerCapture(id)) card.releasePointerCapture(id);
      });
      if (finish === 'modal') await page.evaluate(() => {
        const veil = document.createElement('div'); veil.className = 'modal-veil'; veil.id = 'qa-blocking-modal'; document.body.append(veil);
      });
      if (finish === 'return') await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 10 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: finish === 'cancel' ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(150);
      if (finish === 'modal') await page.locator('#qa-blocking-modal').evaluate(el => el.remove());
      return drop;
    };
    if (touch) {
      await flick(80);
      check(await state() === before, shape + ': long distance rejects a short flick');
    }
    // Real in-combat settings path, including replacing the settings object in main.
    await page.locator('#combat-menu').click();
    await page.getByText('Settings', { exact: true }).last().click();
    await page.getByRole('tab', { name: 'Accessibility', exact: true }).click();
    const field = page.locator('.set-num[data-key="touchFlickDistance"]');
    await field.fill('64'); await field.dispatchEvent('change');
    check(await page.locator('.set-num-slider').inputValue() === '64', shape + ': typed distance synchronizes slider');
    await page.locator('.set-num-slider').fill('96');
    check(await field.inputValue() === '96', shape + ': slider synchronizes numeric field');
    await page.locator('.set-num-reset').click();
    check(await field.inputValue() === '64', shape + ': reset restores default');
    await page.locator('[data-flick-practice]').scrollIntoViewIfNeeded();
    if (touch) {
      const b = await page.locator('[data-flick-practice]').boundingBox();
      const x = b.x + b.width / 2, y = b.y + b.height - 30;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let n = 1; n <= 5; n++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - n * 16 }] });
        await page.waitForTimeout(10);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      check((await page.locator('[data-flick-practice] output').innerText()).includes('Flick accepted'), shape + ': practice uses the flick recognizer');
      check(await state() === before, shape + ': practice never spends a card');
    }
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), shape + ': settings fit viewport');
    await page.screenshot({ path: join(output, shape + '-settings.png') });
    await page.keyboard.press('Escape');
    await page.locator('#combat-menu').click();
    await page.getByText('Settings', { exact: true }).last().click();
    check(await field.inputValue() === '64', shape + ': settings survive closing and reopening');
    await page.keyboard.press('Escape');
    if (touch) {
      for (const action of ['cancel', 'blur', 'capture', 'modal', 'return', 'pause']) {
        await flick(80, action);
        check(await state() === before, shape + ': ' + action + ' never plays');
      }
      const original = await page.evaluate(() => ({ hand: window.__combat.piles.hand.length, energy: window.__combat.player.energy, hp: window.__combat.enemies.map(e => e.hp) }));
      const drop = await flick(80);
      await page.waitForTimeout(1500);
      const after = await page.evaluate(() => ({ hand: window.__combat.piles.hand.length, energy: window.__combat.player.energy, hp: window.__combat.enemies.map(e => e.hp) }));
      check(drop === 'FLICK TO PLAY' && after.hand === original.hand - 1 && after.energy === original.energy - 1, shape + ': short flick plays exactly once with live settings');
      check(after.hp[0] < original.hp[0] && after.hp.slice(1).every((hp, i) => hp === original.hp[i + 1]), shape + ': nearest valid enemy receives attack');
      await page.screenshot({ path: join(output, shape + '-played.png') });
    } else {
      const b = await card.boundingBox(), target = await page.locator('.enemy:not(.dead)').first().boundingBox();
      const count = await page.evaluate(() => window.__combat.piles.hand.length);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(1500);
      check(await page.evaluate(() => window.__combat.piles.hand.length) === count - 1, 'desktop: direct drag still plays once');
    }
    check(errors.length === 0, shape + ': no page errors');
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  for (const scenario of [
    { cardId: 'defend', label: 'self card', block: true },
    { cardId: 'crimsonCleave', label: 'area attack', all: true },
    { cardId: 'strike', label: 'disabled flick', disabled: true },
    { cardId: 'strike', label: 'no living targets', dead: true },
  ]) {
    await page.goto(base + '/index.html?shot=combat');
    await page.locator('.hand .card').first().waitFor();
    await page.evaluate(async scenario => {
      const { mountCombat } = await import('/src/ui/screens/combat.js');
      const { createRunState } = await import('/src/model/state.js');
      const combat = window.__combat, registries = combat.registries;
      const run = createRunState({ seed: 671, classId: 'reaver', registries });
      combat.piles.hand = [{ instanceId: 'qa-flick', cardId: scenario.cardId, upgraded: false }];
      if (scenario.dead) combat.enemies.forEach(enemy => { enemy.alive = false; enemy.hp = 0; });
      mountCombat(document.querySelector('#app'), { registries, run, combat, meta: { settings: { touchFlickPlay: !scenario.disabled } }, onEnd() {} });
    }, scenario);
    await page.waitForTimeout(500);
    const before = await page.evaluate(() => ({ count: window.__combat.piles.hand.length, block: window.__combat.player.block, energy: window.__combat.player.energy, hp: window.__combat.enemies.map(e => e.hp) }));
    const b = await page.locator('.hand .card').boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height * .65;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let n = 1; n <= 5; n++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 16 * n }] });
      await page.waitForTimeout(10);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(1600);
    const after = await page.evaluate(() => ({ count: window.__combat.piles.hand.length, block: window.__combat.player.block, energy: window.__combat.player.energy, hp: window.__combat.enemies.map(e => e.hp) }));
    check(scenario.disabled || scenario.dead ? JSON.stringify(before) === JSON.stringify(after)
      : scenario.block ? after.count === 0 && after.block > before.block
      : after.count === 0 && after.hp.every((hp, i) => hp < before.hp[i]), scenario.label + ': correct target and commitment');
  }
  await page.goto(base + '/index.html?shot=shop');
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    const { contentBundle } = await import('/src/content/index.js');
    const { createRegistries } = await import('/src/model/registries.js');
    const { createRunState } = await import('/src/model/state.js');
    const { createRng } = await import('/src/engine/rng.js');
    const { buildShopStock } = await import('/src/engine/encounters.js');
    const { mountShop } = await import('/src/ui/screens/shop.js');
    const { stampDeck } = await import('/src/model/loadout.js');
    const registries = createRegistries(contentBundle), run = createRunState({ seed: 671, classId: 'reaver', registries });
    run.cinders = 200; run.shopStock = buildShopStock(registries, createRng(671), run);
    window.removalQA = run;
    mountShop(document.querySelector('#app'), { registries, run, meta: { settings: { holdConfirm: 'off' } }, onLeave() {}, onChanged() { stampDeck(registries, run); } });
  });
  await page.locator('[data-face="bar:remove"]').click();
  await page.locator('#remove-opt').click();
  const strike = page.locator('#remove-grid .card[data-card-id="strike"]').first();
  check(await strike.count() === 1, 'merchant lists basic Strikes');
  await strike.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(output, 'phone-remove-strikes.png') });
  await strike.tap();
  await page.getByRole('button', { name: /BURN IT/i }).click();
  check(await page.evaluate(() => window.removalQA.removedAttackSlotIds?.length === 1 && window.removalQA.cinders === 125), 'merchant charges once and retires the selected basic Strike');
  await context.close();
  writeFileSync(join(output, 'results.json'), JSON.stringify({ results, checks: results.length }, null, 2));
} finally { await browser.close(); }
