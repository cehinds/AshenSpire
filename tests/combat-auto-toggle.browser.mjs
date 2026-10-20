// Auto switch in the combat footer: toggles the live autoCombat setting at phone and desktop sizes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = `${(process.env.BASE_URL || server.url).replace(/\/$/, '')}/`;
const out = process.env.AUTO_TOGGLE_OUT || '';
if (out) mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
try {
  for (const [profile, width, height] of [['core', 390, 844], ['core', 1280, 800], ['current', 390, 844], ['current', 1280, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 600 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}index.html?shot=combat&gameProfile=${profile}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__combat);
    const auto = page.locator('[data-combat-tool="auto"]'), reaction = page.locator('[data-combat-tool="reaction"]');
    assert.equal(await auto.count(), 1, `${profile} ${width}: Auto switch present`);
    const a = await auto.boundingBox(), r = await reaction.boundingBox();
    assert.ok(a.x >= 0 && a.x + a.width <= width, `${profile} ${width}: Auto inside the viewport`);
    assert.ok(a.x + a.width <= r.x || r.x + r.width <= a.x, `${profile} ${width}: Auto does not overlap Reaction`);
    assert.ok(Math.abs((a.y + a.height / 2) - (r.y + r.height / 2)) < 14, `${profile} ${width}: same row`);
    assert.equal(await auto.getAttribute('aria-checked'), 'false');
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.combat-tools [data-combat-tool], .combat-tools [data-combat-tool] span')]
      .filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className || node.dataset.combatTool));
    assert.deepEqual(clipped, [], `${profile} ${width}: no footer text is clipped`);
    if (width <= 480) {
      for (const sw of ['auto', 'reaction']) assert.equal(await page.locator(`[data-combat-tool="${sw}"] .reaction-switch-value`).isVisible(), false, `${sw} state text hidden on phone`);
    } else assert.equal(await auto.locator('.reaction-switch-value').isVisible(), true, 'state text kept on desktop');
    if (out) await page.screenshot({ path: `${out}/${profile}-${width}x${height}-off.png` });
    await auto.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-combat-tool="auto"]').getAttribute('aria-checked') === 'true');
    assert.equal(await auto.getAttribute('aria-label'), 'Auto combat enabled');
    if (out) await page.screenshot({ path: `${out}/${profile}-${width}x${height}-on.png` });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.combatTool), 'auto', 'focus stays on Auto after a toggle');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('[data-combat-tool="auto"]').getAttribute('aria-checked') === 'false');
    console.log('done', profile, width);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('combat auto toggle browser: ok');
} catch (error) { console.error(error); errors.push(String(error)); }
finally { await browser.close(); await server?.close?.(); process.exit(errors.length ? 1 : 0); }
