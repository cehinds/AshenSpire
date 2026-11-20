// Native interaction smoke: PLAYWRIGHT_MODULE=/path/to/playwright node tests/target-hud-interaction.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.BASE_URL || server.url, entry = process.env.HUD_ENTRY || 'index.html';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
// Owner 2026-11-07: no selected target-HUD panel opens for any combatant; the overhead mini HUD stays.
const shown = page => page.evaluate(() => [...document.querySelectorAll('.target-hud-selected, .target-hud-focused, .target-hud-detail.visible')].length);
const miniOk = page => page.evaluate(() => [...document.querySelectorAll('.combatant.enemy:not(.dead)')].every(f => f.querySelector(':scope > .target-hud-overhead-meters .intent') && f.querySelector(':scope > .target-hud-overhead-meters .as-meter, :scope > .target-hud-overhead-meters [data-meter-row="hp"], :scope > .target-hud-overhead-meters .meters')));
try {
  for (const [width, height] of [[390, 844], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}${entry}?shot=combat&gameProfile=core&shotEnemyCount=3&shotEnemyContext=status`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.combat').getAttribute('data-target-hud'), 'true');
    const enemy = page.locator('.combatant.enemy .sprite').first();
    await enemy.hover(); await page.waitForTimeout(700);
    assert.equal(await shown(page), 0, `${width} hover opens no selected panel`);
    assert.equal(await miniOk(page), true, 'mini HUDs stay');
    await page.mouse.move(4, 4);
    const card = page.locator('.hand .card[data-card-id="core.strike"]').first(), box = await card.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(300);
    assert.ok(await page.locator('.combatant.target-hud-candidate').count() >= 1, 'targeting still marks candidates');
    await page.waitForTimeout(750);
    assert.equal(await shown(page), 0, `${width} targeting opens no selected panel`);
    assert.equal(await miniOk(page), true, 'mini HUDs stay while targeting');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.mouse.move(4, 4);
    // Inspect via the existing figure hold (~650 ms): one inspector modal only.
    const fb = await enemy.boundingBox();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    await page.locator('.combatant-inspector-body').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('.combatant-inspector-body').count(), 1, `${width} one inspector modal`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('No selected target HUD at any size; mini HUDs stay.');
} finally { await browser.close(); server?.server.close(); }
