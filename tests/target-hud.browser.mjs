// PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://localhost:4475/ node tests/target-hud.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.BASE_URL || server.url, entry = process.env.HUD_ENTRY || 'index.html', out = process.env.HUD_OUT || '/tmp/ashen-target-hud';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const results = [], errors = [];
const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
async function tapCard(page, id) {
  const card = page.locator(`.hand .card[data-card-id="${id}"]`).first();
  const r = await card.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(50);
  assert.equal(await card.getAttribute('aria-pressed'), 'true', `${id} becomes selected`);
  await page.mouse.move(4, 4);
}
try {
  for (const [width, height] of [[1440, 900], [1366, 768], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}${entry}?shot=combat&gameProfile=core&shotEnemyCount=6&shotEnemyContext=status`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.combat').getAttribute('data-target-hud'), 'true');
    const played = await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length);
    await tapCard(page, 'core.strike');
    assert.equal(await page.locator('.combatant.target-hud-candidate').count(), 6);
    await page.waitForTimeout(750);
    const geometry = await page.evaluate(() => ({
      panels: [...document.querySelectorAll('.target-hud-detail.visible:not(.leaving)')].map(node => ({ id: node.dataset.eid, ...node.getBoundingClientRect().toJSON() })),
      sprites: [...document.querySelectorAll('.combatant .sprite')].map(node => node.getBoundingClientRect().toJSON()),
      cards: [...document.querySelectorAll('.hand .card')].map(node => node.getBoundingClientRect().toJSON()),
      played: window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length,
      focused: [...document.querySelectorAll('.target-hud-focused')].map(node => node.dataset.eid),
    }));
    assert.equal(geometry.panels.length, 6); assert.equal(geometry.played, played, 'eligibility previews never play a card');
    for (const a of geometry.panels) {
      assert.ok(a.left >= 0 && a.top >= 0 && a.right <= width && a.bottom <= height);
      for (const b of geometry.panels) if (a !== b) assert.equal(overlap(a, b), false, `${width} panel collision ${a.id}/${b.id}`);
      for (const sprite of geometry.sprites) assert.equal(overlap(a, sprite), false, `${width} panel covers sprite artwork`);
      for (const card of geometry.cards) assert.equal(overlap(a, card), false, `${width} panel covers a card`);
    }
    await page.screenshot({ path: resolve(out, `candidates-${width}.png`) });
    await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    const enemy = page.locator('.combatant.enemy').first();
    await enemy.locator('.sprite').hover(); await page.waitForTimeout(650);
    const panel = page.locator(`.target-hud-detail[data-eid="${await enemy.getAttribute('data-eid')}"]`);
    assert.equal(await panel.isVisible(), true);
    const statuses = panel.locator('.status-icon');
    if (await statuses.count()) {
      await statuses.first().hover(); await page.waitForTimeout(600);
      assert.equal(await panel.isVisible(), true, 'sprite-to-status corridor retains detail');
      // Owner 2026-10-25: a tap anywhere on an unarmed panel, statuses included, inspects.
      await statuses.first().click();
      const inspector = page.locator('.combatant-inspector-body');
      await inspector.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await inspector.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => window.__combat.eventLog.filter(event => event.type === 'cardPlayed').length), played);
    }
    await page.mouse.move(4, 4); await page.waitForTimeout(700);
    await tapCard(page, 'core.counter'); await page.waitForTimeout(750);
    assert.deepEqual(await page.locator('.combatant.target-hud-candidate').evaluateAll(nodes => nodes.map(node => node.dataset.eid)), ['player']);
    assert.equal(await page.locator('.target-hud-detail.visible:not(.leaving)').count(), 1);
    assert.equal(await page.locator('.target-hud-detail.visible:not(.leaving)').getAttribute('data-eid'), 'player');
    results.push({ width, height, geometry }); await page.close();
  }
  for (const [width, height] of [[390, 844], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}${entry}?shot=combat&gameProfile=core`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.combat').getAttribute('data-target-hud'), 'true');
    assert.equal(await page.locator('.target-hud-layer').isVisible(), true); await page.close();
  }
  assert.deepEqual(errors, []);
} finally { writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ results, errors }, null, 2)); await browser.close(); await server?.close(); }
console.log(`Target HUD browser checks passed (${results.length} desktop sizes).`);
