// Real touch gestures against the authored starting hand. No combat state is
// injected: attack cards are reached by ending turns through the visible UI.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.COMBAT_QA_OUT || '.codex/mobile-touch';
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [width, height] of [[288, 513], [320, 568], [390, 844]].filter(([w]) => !process.env.QA_WIDTH || w === Number(process.env.QA_WIDTH))) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = { width, height, steps: [], errors };
    results.push(result);
    const save = () => writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
    const tap = async selector => {
      const at = await page.evaluate(selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        const owns = (x, y) => {
          const top = document.elementFromPoint(x, y);
          return top && (top === node || node.contains(top)) && !top.closest('.card-info-button');
        };
        const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        if (owns(center.x, center.y)) return center;
        for (let y = Math.max(3, r.top + 5); y < Math.min(innerHeight - 3, r.bottom - 3); y += 4)
          for (let x = Math.max(3, r.left + 5); x < Math.min(innerWidth - 3, r.right - 3); x += 4)
            if (owns(x, y)) return { x, y };
        return null;
      }, selector);
      assert(at, `${width}: no visible touch surface for ${selector}`);
      await page.touchscreen.tap(at.x, at.y);
      await page.waitForTimeout(450);
    };
    const cardSelector = id => `.hand .card[data-instance-id=${JSON.stringify(id)}]`;
    const hand = () => page.evaluate(() => window.__combat.piles.hand.map(card => card.instanceId));
    const assertConsumed = async (id, route) => {
      await page.waitForFunction(id => !window.__combat.piles.hand.some(card => card.instanceId === id), id, { timeout: 10000 });
      result.steps.push({ route, consumed: id }); save();
      await page.waitForTimeout(2200);
    };
    const nextTurn = async () => {
      const turn = await page.evaluate(() => window.__combat.turn);
      await tap('.end-turn');
      const end = Date.now() + 25000;
      while (Date.now() < end) {
        if (await page.locator('.confirmation-confirm').count()) await tap('.confirmation-confirm');
        const back = page.locator('.reaction-choice').getByRole('button', { name: 'Back', exact: true }).last();
        if (await back.isVisible().catch(() => false)) await back.tap();
        if (await page.evaluate(turn => window.__combat.turn > turn && window.__combat.phase === 'player', turn)) {
          await page.waitForTimeout(1800);
          result.steps.push({ route: 'end-turn', turn: turn + 1 }); save(); return;
        }
        await page.waitForTimeout(200);
      }
      throw new Error(`${width}: End Turn did not return to player phase`);
    };
    try {
      const url = new URL(process.env.COMBAT_QA_URL || 'http://localhost:8338/?preview=rear-player');
      url.searchParams.set('shot', 'combat');
      await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
      result.url = page.url(); result.title = await page.title();
      await page.waitForSelector('.hand .card', { timeout: 120000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${width}-initial.png` });
      await tap('[data-combat-tool="log"]');
      assert(await page.locator('#combat-log').isVisible(), 'combat log opens on touch');
      await tap('[data-combat-tool="log"]');
      assert(!(await page.locator('#combat-log').isVisible()), 'combat log closes on touch');
      const reactions = await page.getAttribute('[data-combat-tool="reaction"]', 'aria-checked');
      await tap('[data-combat-tool="reaction"]');
      assert.notEqual(await page.getAttribute('[data-combat-tool="reaction"]', 'aria-checked'), reactions);
      await tap('[data-combat-tool="reaction"]');
      assert.equal(await page.getAttribute('[data-combat-tool="reaction"]', 'aria-checked'), reactions);
      result.steps.push({ route: 'combat-tools', logOpened: true, reactionToggled: true }); save();
      await tap('.player .combatant-mini-hud [data-res="hp"]');
      assert(await page.locator('.player.context-selected').count(), 'player HP tap selects its character');
      assert(await page.locator('.player .combatant-mini-hud [data-meter-row="name"]').isVisible(), 'selected character reveals its name');
      assert(await page.locator('.player .combatant-mini-hud [data-meter-row="resource"]').first().isVisible(), 'selected character reveals its resource details');
      await page.locator('.player[data-inspect-ready="true"] .combatant-info').waitFor({ state: 'visible' });
      await page.waitForTimeout(100);
      const details = await page.evaluate(() => {
        const panel = document.querySelector('.player .combatant-mini-hud').getBoundingClientRect();
        const obstacles = [...document.querySelectorAll('.combat-tools, .enemy .sprite, .enemy .combatant-card > .nm, .enemy .combatant-card > .meters')]
          .map(node => ({ label: node.className, rect: node.getBoundingClientRect().toJSON() })).filter(({ rect }) => rect.width && rect.height);
        const resources = [...document.querySelectorAll('.player .combatant-mini-hud [data-meter-row="resource"]')].map(row => {
          const range = document.createRange(); range.selectNodeContents(row.querySelector('.m-plate') || row);
          return { label: row.textContent, rect: range.getBoundingClientRect().toJSON() };
        }).filter(({ rect }) => rect.width && rect.height);
        const enemies = [...document.querySelectorAll('.enemy:not(.dead)')].map(enemy => ({ id: enemy.dataset.eid,
          body: enemy.querySelector('.sprite').getBoundingClientRect().toJSON(),
          name: enemy.querySelector('.nm').getBoundingClientRect().toJSON() }));
        const inspect = document.querySelector('.player .combatant-info').getBoundingClientRect().toJSON();
        const playerSprite = document.querySelector('.player .sprite');
        // Check the visible character, excluding transparent sprite padding.
        // Scan the rendered image independently, so this also checks packaged
        // builds without importing their source geometry implementation.
        const art = [...playerSprite.querySelectorAll('img, canvas')].filter(image => {
          if ((image.tagName === 'IMG' && (!image.complete || !image.naturalWidth)) || !image.getBoundingClientRect().width) return false;
          for (let node = image; node && node !== playerSprite; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          }
          return true;
        }).map(image => {
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] < 40) continue;
            x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          }
          const r = image.getBoundingClientRect(), scale = Math.min(r.width / canvas.width, r.height / canvas.height);
          return { left: r.left + (r.width - canvas.width * scale) / 2 + x0 * scale,
            right: r.left + (r.width - canvas.width * scale) / 2 + (x1 + 1) * scale,
            top: r.top + (r.height - canvas.height * scale) / 2 + y0 * scale,
            bottom: r.top + (r.height - canvas.height * scale) / 2 + (y1 + 1) * scale };
        });
        const playerBody = art.length ? { left: Math.min(...art.map(r => r.left)), right: Math.max(...art.map(r => r.right)),
          top: Math.min(...art.map(r => r.top)), bottom: Math.max(...art.map(r => r.bottom)) } : playerSprite.getBoundingClientRect().toJSON();
        return { panel: panel.toJSON(), obstacles, resources, enemies, inspect, playerBody };
      });
      const overlaps = (a, b) => a.left < b.right - .5 && a.right > b.left + .5 && a.top < b.bottom - .5 && a.bottom > b.top + .5;
      result.steps.push({ route: 'player-details', revealed: true, geometry: details }); save();
      const covered = details.obstacles.filter(obstacle => overlaps(details.panel, obstacle.rect));
      assert.equal(covered.length, 0, `${width}: selected character details overlap ${covered.map(obstacle => obstacle.label).join(', ')}`);
      assert(details.resources.every((resource, index) => details.resources.slice(index + 1)
        .every(other => !overlaps(resource.rect, other.rect))), `${width}: selected character resource labels overlap`);
      assert(details.enemies.every(enemy => enemy.name.top >= enemy.body.bottom - .5), `${width}: enemy nameplates cover their own bodies`);
      assert(Math.abs((details.inspect.left + details.inspect.right) / 2 - (details.playerBody.left + details.playerBody.right) / 2) <= 2,
        `${width}: player Inspect is not centered over its body`);
      assert(!overlaps(details.inspect, details.panel), `${width}: player Inspect overlaps character details`);
      await page.screenshot({ path: `${out}/${width}-details.png` });
      await tap('.enemy:not(.dead) .nm');
      await page.locator('.combatant-door').waitFor();
      result.steps.push({ route: 'enemy-footer-inspection', opened: true }); save();
      await page.locator('.combatant-door').getByRole('button', { name: 'Close', exact: true }).tap();
      await page.waitForTimeout(350);
      // The real starting hand has defensive cards. A tap selects; a second
      // touch on the player's HP panel must spend that card exactly once.
      const self = (await hand())[0];
      await tap(cardSelector(self));
      assert(await page.locator(`${cardSelector(self)}.selected`).count(), 'trailing touch click must retain card selection');
      const cardInspect = page.locator('.card-info-button:visible').filter({ visible: true });
      await cardInspect.first().waitFor({ state: 'visible' });
      const cardInspectGeometry = await page.evaluate(() => {
        const tools = document.querySelector('.combat-tools').getBoundingClientRect().toJSON();
        const info = [...document.querySelectorAll('.card-info-button')].filter(node => {
          const r = node.getBoundingClientRect(), style = getComputedStyle(node);
          return r.width && r.height && style.visibility === 'visible' && style.display !== 'none';
        }).map(node => ({ rect: node.getBoundingClientRect().toJSON(), ownsCenter: (() => {
          const r = node.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return top === node || node.contains(top);
        })() }));
        return { tools, info };
      });
      assert(cardInspectGeometry.info.length > 0, 'selected card exposes Inspect');
      assert(cardInspectGeometry.info.every(info => !overlaps(info.rect, cardInspectGeometry.tools) && info.ownsCenter),
        `${width}: card Inspect overlaps toolbar or its center is blocked`);
      result.steps.push({ route: 'card-inspect-clearance', ...cardInspectGeometry }); save();
      await page.screenshot({ path: `${out}/${width}-card-selected.png` });
      await tap('.player .combatant-mini-hud [data-res="hp"]');
      await assertConsumed(self, 'player-hp');
      let enemyPlays = 0;
      for (let turns = 0; enemyPlays < 2 && turns < 5; turns++) {
        for (const id of await hand()) {
          await tap(cardSelector(id));
          if (await page.getAttribute('.combat', 'data-target-layer') !== 'armed') continue;
          const selector = enemyPlays === 0 ? '.enemy:not(.dead) .intent' : '.enemy-target-button:not(:disabled)';
          await tap(selector);
          await assertConsumed(id, enemyPlays === 0 ? 'enemy-intent' : 'enemy-target');
          enemyPlays++;
          if (enemyPlays === 2) break;
        }
        if (enemyPlays < 2) await nextTurn();
      }
      assert.equal(enemyPlays, 2, 'natural turn draws must allow intent and body-target touch routes');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${width}-played.png` });
      result.passed = true; save();
    } catch (error) {
      result.failure = error.message;
      result.body = await page.locator('body').innerText();
      save(); await page.screenshot({ path: `${out}/${width}-failure.png` });
      throw error;
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
assert(results.length > 0, 'QA_WIDTH must select a supported mobile viewport');
console.log(`PASS ${results.length} mobile touch runs: player HP, enemy intent, enemy target, and End Turn; no state injection`);
