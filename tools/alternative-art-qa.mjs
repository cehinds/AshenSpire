// Production combat, including actual input; output belongs outside tracked source.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = resolve(process.env.COMBAT_ART_OUT || 'outputs/combat-art');
mkdirSync(out, { recursive: true });
const served = await serve({ port: 4296, open: false });
const base = process.env.COMBAT_ART_URL || `http://localhost:${served.port}/${process.argv.includes('--pack') ? 'build/AshenSpire.html' : ''}`;
const launched = await launchBrowser({ prefix: 'artqa-', browser: process.env.CHROME, timeoutMs: 60000 });
const browser = await chromium.connectOverCDP(launched.wsUrl);
const report = { base, scenes: [], play: [], errors: [], httpErrors: [], optionalSourceRequests: [] };
const checkArt = async page => {
  await page.waitForSelector('.alternative-backdrop[data-device]');
  await page.waitForFunction(() => [...document.querySelectorAll('.alternative-figure img')].every(i => i.complete && i.naturalWidth));
  await page.evaluate(async () => {
    for (const node of document.querySelectorAll('.alternative-scene image')) {
      const image = new Image(); image.src = node.getAttribute('href'); await image.decode();
    }
  });
  return page.evaluate(() => ({
    scene: document.querySelector('.alternative-backdrop').dataset.scene,
    device: document.querySelector('.alternative-backdrop').dataset.device,
    layers: [...document.querySelectorAll('.alternative-scene image')].map(i => i.dataset.layer),
    actors: [...document.querySelectorAll('.alternative-figure')].map(e => ({ id: e.dataset.alternativeSprite, source: e.querySelector('img').currentSrc.slice(0, 100) })),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
};
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const device = viewport.width < 600 ? 'phone' : 'desktop';
    const context = await browser.newContext({ viewport, hasTouch: device === 'phone' });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.setDefaultNavigationTimeout(180000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', response => {
      if (response.status() < 400) return;
      const failure = { status: response.status(), url: response.url() };
      // Source preview probes the optional LAN service and recorded SFX before
      // its synthesized fallback. Keep those visible, separate from required art.
      const optional = !base.startsWith('file:') && response.status() === 404
        && /\/(api\/lan\/info|assets\/sfx\/[A-Za-z0-9_-]+\.ogg)$/.test(new URL(response.url()).pathname);
      (optional ? report.optionalSourceRequests : report.httpErrors).push(failure);
    });
    if (!process.argv.includes('--play-only')) {
      for (const id of Object.keys(catalog.scenes)) {
        await page.goto(`${base}?shot=combat&shotScene=${id}`, { waitUntil: 'networkidle' });
        const observation = await checkArt(page);
        assert.equal(observation.scene, id);
        assert.equal(observation.device, device);
        assert.equal(observation.overflow, false, `${id}/${device} overflow`);
        assert.deepEqual(observation.layers, catalog.scenes[id].devices[device].layers.map(l => l.id));
        if (device === 'phone') assert(observation.actors.every(a => a.source.includes('-mobile.webp')), 'phone actor tier');
        await page.screenshot({ path: resolve(out, `${device}-${id}.png`) });
        report.scenes.push(observation);
        console.log(`${device}: ${id}`);
      }
      // The co-op mount uses the same selector and fitting, with actual seat input.
      await page.goto(`${base}?shot=coop&shotSeats=2`, { waitUntil: 'networkidle' });
      await checkArt(page);
      await page.keyboard.press('Tab');
      await page.screenshot({ path: resolve(out, `${device}-coop.png`) });
      // Resize a mounted scene: independent phone/desktop transforms must switch.
      await page.setViewportSize({ width: device === 'phone' ? 1440 : 390, height: 844 });
      await page.waitForFunction(expected => document.querySelector('.alternative-backdrop')?.dataset.device === expected, device === 'phone' ? 'desktop' : 'phone');
      await checkArt(page);
      await page.setViewportSize(viewport);
    }
    if (!process.argv.includes('--scenes-only')) {
      await page.goto(base, { waitUntil: 'networkidle' });
      if (await page.locator('.startup-gate').count()) await page.keyboard.press('Enter');
      await page.locator('[data-title-action="quick-start"]').click();
      await page.waitForSelector('.class-mastery-node, .map-node.reachable');
      if (await page.locator('.class-mastery-node').count()) await page.locator('.class-mastery-node').first().click();
      await page.locator('.map-node.monster.reachable').first().click();
      for (let i = 0; i < 4 && !await page.locator('.hand .card').count(); i++) {
        const enter = page.locator('.confirmation-confirm, [data-map-action="enter"]:not([disabled]), .map-enter:not([disabled])').first();
        if (await enter.count()) await enter.click();
        await page.waitForTimeout(300);
      }
      await checkArt(page);
      await page.waitForSelector('.hand .card:not(.unaffordable)');
      const tutorial = page.locator('.tut-skip');
      if (await tutorial.isVisible()) await tutorial.click();
      const attack = page.locator('.hand .card.type-attack:not(.unaffordable)').first();
      const card = await attack.count() ? attack : page.locator('.hand .card:not(.unaffordable)').first();
      await card.click();
      const target = page.locator('.enemy.targetable .sprite, .combatant.player.armed .sprite').first();
      await target.click();
      await page.waitForFunction(() => (window.__combat?.player?.counters?.cardsPlayedThisCombat || 0) >= 1);
      await page.screenshot({ path: resolve(out, `${device}-played.png`) });
      // End turn uses the production hold-confirm contract, then hand retention.
      const end = page.locator('.end-turn');
      await page.waitForFunction(() => document.querySelector('.end-turn')?.disabled === false);
      await end.hover(); await page.mouse.down(); await page.waitForTimeout(1300); await page.mouse.up();
      await page.waitForFunction(() => window.__combat?.turn >= 2 || document.querySelector('.hand-discard-keep'));
      const keep = page.locator('.hand-discard-keep');
      if (await keep.count()) await keep.click();
      await page.waitForFunction(() => window.__combat?.turn >= 2, null, { timeout: 45000 });
      await checkArt(page);
      await page.screenshot({ path: resolve(out, `${device}-turn2.png`) });
      report.play.push({ device, ...(await page.evaluate(() => ({ turn: window.__combat.turn, cardsPlayed: window.__combat.player.counters.cardsPlayedThisCombat }))) });
      console.log(`${device}: real card play and turn 2`);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, [], 'page JavaScript errors');
  assert.deepEqual(report.httpErrors, [], 'HTTP errors');
} finally {
  writeFileSync(resolve(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await launched.close();
  served.server.close();
}
