// D15 in a real browser: Core disables the deck and equipment buttons until the fight resolves, and the Armoury glows blue for a new item.
// Screenshots go to SHOT_DIR when it is set; nothing is tracked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = `${(process.env.BASE_URL || server.url).replace(/\/$/, '')}/`;
const shots = process.env.SHOT_DIR; if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
const errors = [];
try {
  for (const profile of ['core', 'current']) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}index.html?shot=combat&gameProfile=${profile}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__combat);
    const locked = profile === 'core';
    const state = () => page.evaluate(() => {
      const a = document.querySelector('#combat-armoury'), d = document.querySelector('.combat-deck-edit');
      return { armoury: a?.getAttribute('aria-disabled'), deck: d ? d.getAttribute('aria-disabled') : null, glow: a?.dataset.armouryNew || null };
    });
    let s = await state();
    assert.equal(s.armoury, String(locked), `${profile}: Armoury button aria-disabled during combat`);
    if (s.deck !== null) assert.equal(s.deck, String(locked), `${profile}: deck button aria-disabled during combat`);
    if (locked) {
      // A pending reaction is still combat.
      await page.evaluate(() => { window.__combat.pendingReaction = { id: 'qa', options: [] }; });
      await page.click('#combat-armoury', { force: true });
      assert.equal(await page.locator('.armoury-overlay, .armoury').count(), 0, 'locked Armoury button opens nothing');
      await page.keyboard.press('r');
      assert.equal(await page.locator('.armoury-overlay, .armoury').count(), 0, 'the R key opens nothing in combat');
      await page.evaluate(() => { window.__combat.pendingReaction = null; });
      if (shots) await page.screenshot({ path: `${shots}/combat-hud-locked.png` });
      // New item: blue glow, even while locked.
      await page.evaluate(() => { window.__combatRunForShot.loadout.storage.push('qa-new-item'); window.__renderCombatForShot(); });
      assert.equal((await state()).glow, 'true', 'new item glows');
      if (shots) await page.screenshot({ path: `${shots}/armoury-glow-locked.png`, clip: { x: 0, y: 0, width: 1024, height: 200 } });
      // Resolved: buttons enable and the Armoury opens, which marks the item seen.
      await page.evaluate(() => { window.__combat.result = 'win'; window.__renderCombatForShot(); });
      s = await state();
      assert.equal(s.armoury, 'false', 'enabled once the fight is resolved');
      if (s.deck !== null) assert.equal(s.deck, 'false');
      await page.click('#combat-armoury');
      await page.waitForSelector('.armoury');
      assert.equal(await page.evaluate(() => window.__combatRunForShot.armorySeen.includes('qa-new-item')), true, 'opening the Armoury marks the item seen');
    } else {
      assert.equal(s.glow, null, 'Current never glows');
    }
    await page.close();
  }
  assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
  console.log('core-noncombat-editing browser: ok');
} finally { await browser.close(); await server?.close?.(); process.exit(process.exitCode || 0); }
