// Native interaction smoke: PLAYWRIGHT_MODULE=/path/to/playwright node tests/target-hud-interaction.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const [width, height] of [[390, 844], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotEnemyCount=3&shotEnemyContext=status`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.combat').getAttribute('data-target-hud'), 'true');
    await page.locator('.combatant.player .sprite').click();
    const panel = page.locator('.target-hud-detail[data-eid="player"].visible:not(.leaving)');
    await panel.waitFor({ state: 'visible' });
    const info = page.locator('.combat > .target-hud-inspect-info[data-eid="player"]');
    assert.equal(await info.evaluate(node => getComputedStyle(node).zIndex), '800');
    await info.click();
    const inspector = page.locator('.combatant-inspector-body');
    await inspector.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    const name = panel.locator('.target-hud-name');
    await name.dblclick();
    await inspector.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    const box = await name.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    assert.equal(await inspector.count(), 0, 'hold does not fire before 500ms');
    await page.waitForTimeout(110);
    await inspector.waitFor({ state: 'visible' });
    await page.mouse.up();
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2);
    await page.waitForTimeout(550);
    await page.mouse.up();
    assert.equal(await inspector.count(), 0, 'moving cancels the inspect hold');
    const pointer = { pointerId: 19, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + 5, clientY: box.y + 5 };
    for (let tap = 0; tap < 2; tap++) {
      await name.dispatchEvent('pointerdown', pointer);
      await name.dispatchEvent('pointerup', pointer);
      if (!tap) await page.waitForTimeout(100);
    }
    await inspector.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    await page.waitForTimeout(750);
    await panel.locator('.as-meter[data-res="hp"]').click();
    await inspector.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    // Owner 2026-10-25: one tap anywhere on a selected panel (padding, statuses) inspects. The panel
    // holds name, HP and stats only now (2026-10-26), so its padding is the part that is always there.
    assert.equal(await panel.locator('.target-hud-intent').count(), 0, 'the panel no longer carries an intent strip');
    for (const [label, press] of [['padding', () => panel.locator('.target-hud-panel').click({ position: { x: 3, y: 3 } })],
      ['status icon', () => panel.locator('.target-hud-statuses .status-icon').first().click()]]) {
      if (label === 'status icon' && !(await panel.locator('.target-hud-statuses .status-icon').count())) continue; // the player carries no status in this fixture
      await page.waitForTimeout(450);
      await press();
      await inspector.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await inspector.waitFor({ state: 'detached' });
    }
    // The game cursor may sit on a hand card while the panel has DOM focus;
    // Enter belongs to the panel and must not also press that card.
    const handState = () => page.evaluate(() => ({
      selected: [...document.querySelectorAll('.hand .card.selected, .hand .card.is-selected, .hand .card.armed')].length,
      candidates: document.querySelectorAll('.combatant.target-hud-candidate').length,
      played: window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length,
    }));
    await page.evaluate(() => { document.querySelector('.gp-focus')?.classList.remove('gp-focus'); document.querySelector('.hand .card')?.classList.add('gp-focus'); });
    const beforeEnter = await handState();
    await panel.locator('.target-hud-panel').focus();
    await page.keyboard.press('Enter');
    await inspector.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await inspector.waitFor({ state: 'detached' });
    assert.deepEqual(await handState(), beforeEnter, 'Enter on the panel leaves the cursor card unpressed');
    if (width === 390) {
      await page.goto(`${process.env.BASE_URL || server.url}index.html?shot=combat&gameProfile=core&shotSeed=3&shotEnemyCount=3&shotHand=5`, { waitUntil: 'networkidle' });
      const strike = page.locator('.hand .card[data-card-id="core.strike"]').first();
      const card = await strike.boundingBox();
      await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
      await page.mouse.move(0, 500);
      await page.waitForFunction(() => document.querySelectorAll('.target-hud-detail.visible:not(.leaving)').length === 3);
      const geometry = await page.evaluate(() => ({
        panels: [...document.querySelectorAll('.target-hud-detail.visible:not(.leaving)')].map(node => {
          const box = node.getBoundingClientRect();
          return { left: box.left - 25, top: box.top, right: box.right, bottom: box.bottom };
        }),
        obstacles: [...document.querySelectorAll('.combatant .sprite, .hand .card')].map(node => node.getBoundingClientRect().toJSON()),
      }));
      const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      for (const panel of geometry.panels) {
        assert.ok(panel.left >= 0 && panel.right <= 390);
        for (const obstacle of geometry.obstacles) assert.equal(overlaps(panel, obstacle), false, 'eligible detail/control group avoids artwork and cards');
        for (const other of geometry.panels) if (panel !== other) assert.equal(overlaps(panel, other), false, 'three mobile detail groups remain separate');
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Native target HUD: info, double-click, hold/cancel, double-tap, and resource tooltip pass at mobile/tablet sizes.');
} finally { await browser.close(); server?.server.close(); }
