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
const report = { base, scenes: [], layouts: [], play: [], errors: [], httpErrors: [], optionalSourceRequests: [] };
const checkArt = async (page, { verifyGround = false } = {}) => {
  await page.waitForSelector('.alternative-backdrop[data-device]');
  await page.waitForFunction(() => [...document.querySelectorAll('.alternative-figure img')].every(i => i.complete && i.naturalWidth));
  await page.evaluate(async () => {
    for (const node of document.querySelectorAll('.alternative-scene image')) {
      const image = new Image(); image.src = node.getAttribute('href'); await image.decode();
    }
  });
  if (verifyGround) await page.waitForFunction(() => {
    const frames = [...document.querySelectorAll('.combatant:has(.alternative-figure)')];
    return frames.length && frames.every(frame => {
      const field = frame.closest('.field').getBoundingClientRect();
      const ground = field.top + Number(frame.dataset.groundRatio) * field.height;
      return Math.abs(frame.querySelector('.alternative-figure').getBoundingClientRect().bottom - ground) < 1.5;
    });
  }, null, { timeout: 10000 }).catch(async error => {
    console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.combatant:has(.alternative-figure)')].map(frame => ({
      data: { ...frame.dataset },
      boxes: [frame.closest('.field'), frame, frame.querySelector('.combatant-stack'), frame.querySelector('.combatant-card'), frame.querySelector('.sprite'), frame.querySelector('.alternative-figure')].map(node => {
        const c = getComputedStyle(node); return { class: node.className, rect: node.getBoundingClientRect().toJSON(), style: node.getAttribute('style'), zoom:c.zoom, scale:c.scale, transform:c.transform, padding:c.padding, margin:c.margin, height:c.height };
      }),
    })))));
    await page.screenshot({ path: resolve(out, 'ground-failure.png') });
    throw error;
  });
  const grounding = await page.evaluate(async sceneLayers => {
    const images = [...document.querySelectorAll('.alternative-scene image')];
    const sections = images.map(i => sceneLayers[i.dataset.layer].kind);
    const ground = images.find(i => sceneLayers[i.dataset.layer].kind === 'ground');
    const image = new Image(); image.src = ground.getAttribute('href'); await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
    const inverse = ground.getScreenCTM().inverse();
    const feet = [...document.querySelectorAll('.combatant:has(.alternative-figure)')].map(frame => {
      const figure = frame.querySelector('.alternative-figure').getBoundingClientRect();
      // Screen entrance motion can move the whole field after layout. Measure
      // its current rectangle rather than a cached viewport coordinate.
      const field = frame.closest('.field').getBoundingClientRect();
      const groundY = field.top + Number(frame.dataset.groundRatio) * field.height;
      const point = new DOMPoint((figure.left + figure.right) / 2, figure.bottom).matrixTransform(inverse);
      const x = Math.floor((point.x - ground.x.baseVal.value) / ground.width.baseVal.value * canvas.width);
      const y = Math.floor((point.y - ground.y.baseVal.value) / ground.height.baseVal.value * canvas.height);
      const alpha = x >= 0 && y >= 0 && x < canvas.width && y < canvas.height ? context.getImageData(x, y, 1, 1).data[3] : 0;
      return { id: frame.querySelector('.alternative-figure').dataset.alternativeSprite,
        bottom: figure.bottom, groundY,
        baselineError: Math.abs(figure.bottom - groundY), groundAlpha: alpha };
    });
    return { sections, feet };
  }, catalog.sceneLayers);
  assert.deepEqual(grounding.sections, ['far', 'landmark', 'ground']);
  assert(grounding.feet.length > 0, 'visible combatants must have measured feet');
  // Attack/recoil animation may deliberately leave the resting baseline.
  // Enforce ground contact on idle scene, co-op and resize mounts only.
  for (const foot of verifyGround ? grounding.feet : []) {
    if (foot.baselineError >= 1.5 || foot.groundAlpha < 128) {
      console.log(JSON.stringify(grounding));
      await page.screenshot({ path: resolve(out, 'ground-failure.png') });
    }
    assert(foot.baselineError < 1.5, `${foot.id}: sprite misses its formation ground by ${foot.baselineError}px`);
    assert(foot.groundAlpha >= 128, `${foot.id}: no opaque ground layer beneath sprite`);
  }
  return page.evaluate(grounding => ({
    grounding,
    scene: document.querySelector('.alternative-backdrop').dataset.scene,
    device: document.querySelector('.alternative-backdrop').dataset.device,
    layers: [...document.querySelectorAll('.alternative-scene image')].map(i => i.dataset.layer),
    actors: [...document.querySelectorAll('.alternative-figure')].map(e => ({
      id: e.dataset.alternativeSprite, source: e.querySelector('img').currentSrc.slice(0, 100),
      mobileSelected: e.querySelector('img').currentSrc === new URL(e.querySelector('source').srcset, document.baseURI).href,
    })),
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }), grounding);
};
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const device = viewport.width < 600 ? 'phone' : 'desktop';
    if (process.env.COMBAT_ART_DEVICE && process.env.COMBAT_ART_DEVICE !== device) continue;
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
      for (const id of process.argv.includes('--layout-only') ? [] : Object.keys(catalog.scenes)) {
        await page.goto(`${base}?shot=combat&shotScene=${id}`, { waitUntil: 'networkidle' });
        const observation = await checkArt(page, { verifyGround: true });
        assert.equal(observation.scene, id);
        assert.equal(observation.device, device);
        assert.equal(observation.overflow, false, `${id}/${device} overflow`);
        assert.deepEqual(observation.layers, catalog.scenes[id].devices[device].layers.filter(l => catalog.sceneLayers[l.id].kind !== 'foreground').map(l => l.id));
        if (device === 'phone') assert(observation.actors.every(a => a.mobileSelected), 'phone actor tier');
        await page.screenshot({ path: resolve(out, `${device}-${id}.png`) });
        report.scenes.push(observation);
        console.log(`${device}: ${id}`);
      }
      // The co-op mount uses the same selector and fitting, with actual seat input.
      await page.goto(`${base}?shot=coop&shotSeats=2`, { waitUntil: 'networkidle' });
      report.layouts.push({ phase: 'coop', viewport: device, ...await checkArt(page, { verifyGround: true }) });
      await page.keyboard.press('Tab');
      await page.screenshot({ path: resolve(out, `${device}-coop.png`) });
      // Resize a mounted scene: independent phone/desktop transforms must switch.
      await page.setViewportSize({ width: device === 'phone' ? 1440 : 390, height: 844 });
      await page.waitForFunction(expected => document.querySelector('.alternative-backdrop')?.dataset.device === expected, device === 'phone' ? 'desktop' : 'phone');
      report.layouts.push({ phase: 'resize', from: device, ...await checkArt(page, { verifyGround: true }) });
      await page.setViewportSize(viewport);
    }
    if (!process.argv.includes('--scenes-only') && !process.argv.includes('--layout-only')) {
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
