// PLAYWRIGHT_MODULE=/path/to/playwright VIEW_PRESETS_BASE=http://localhost:8765/ node tests/view-presets.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.VIEW_PRESETS_OUT || '/tmp/ashen-settings-update');
mkdirSync(output, { recursive: true });
const server = process.env.VIEW_PRESETS_BASE ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = process.env.VIEW_PRESETS_BASE || server.url;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const errors = [];
const hosts = { desktop: [1440,900], wide: [1920,1080], tablet: [1024,768], mobile: [390,844] };
const presets = { desktop: [1440,900], mobile: [390,844], widescreen: [1920,1080], tablet: [1024,768] };
async function pageFor(profile, shot, host = 'desktop') {
  const [width,height] = hosts[host];
  const page = await browser.newPage({ viewport: { width,height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}${process.env.VIEW_PRESETS_ENTRY || 'index.html'}?shot=${shot}&gameProfile=${profile}&shotSeed=3`);
  return page;
}
async function choose(page, preset) {
  const select = page.locator('select[data-key="viewPreset"]');
  await select.click();
  await select.selectOption(preset);
  await select.press('Tab');
  await page.waitForFunction(value => document.documentElement.dataset.viewPreset === value, preset);
  const dimensions = await page.evaluate(() => {
    const root = document.documentElement;
    const box = root.getBoundingClientRect();
    return { logical: { width: parseFloat(root.style.getPropertyValue('--view-width')), height: parseFloat(root.style.getPropertyValue('--view-height')) }, width: box.width, height: box.height, scale: Number(root.dataset.viewScale), host: [innerWidth,innerHeight] };
  });
  if (presets[preset]) {
    const [width,height] = presets[preset];
    assert.equal(dimensions.logical.width, width);
    assert.equal(dimensions.logical.height, height);
    assert.ok(dimensions.width <= dimensions.host[0] + 2, `${preset} fits host width`);
    assert.ok(dimensions.height <= dimensions.host[1] + 2, `${preset} fits host height`);
    assert.ok(dimensions.scale > 0);
  }
  assert.ok(await select.isVisible(), `Settings reachable in ${preset}`);
  await page.waitForFunction(() => {
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'));
    return document.querySelector('[data-applied="uiScale"]')?.textContent.includes(`Showing ${zoom.toFixed(2)}×`);
  });
}
async function openCombatSettings(page) {
  await page.locator('#combat-menu').click();
  const settings = page.locator('[data-settings-host]');
  if (!await settings.count()) await page.locator('.qn-row[data-tab="settings"]').click();
  await settings.waitFor();
  await page.locator('[data-general-select]').selectOption('Display');
}
function liveSnapshot() {
  const run = window.__combatRunForShot;
  const combat = window.__combat;
  return JSON.stringify({ runHP: run.hp, deck: run.deck, round: combat.turn, playerHP: combat.player.hp, phase: combat.phase });
}
try {
  if (!process.env.VIEW_PRESETS_CAPTURE_ONLY) {
  for (const profile of ['core','current']) {
    const page = await pageFor(profile, 'combat');
    await page.locator('.end-turn').waitFor();
    await page.evaluate(() => { window.__qaCombatIdentity = window.__combat; });
    const before = await page.evaluate(liveSnapshot);
    await openCombatSettings(page);
    for (const preset of [...Object.keys(presets), 'auto']) {
      await choose(page, preset);
      if (profile === 'core' && preset === 'mobile') {
        await page.locator('select[data-key="viewPreset"]').scrollIntoViewIfNeeded();
        await page.screenshot({ path:resolve(output, 'desktop-mobile-preset.png') });
      }
      assert.equal(await page.evaluate(() => window.__qaCombatIdentity === window.__combat), true, 'view change preserves live combat object');
      assert.equal(await page.evaluate(liveSnapshot), before, 'view change preserves HP, deck, round and phase');
    }
    await page.locator('#ov-close').click();
    const target = page.locator('.combatant[data-eid]').last();
    await target.click();
    await page.locator('.end-turn').hover();
    await page.locator('[role="tooltip"]').first().waitFor();
    const targetBox = await target.boundingBox();
    assert.ok(targetBox, 'combat target remains reachable after preset changes');
    if (profile === 'core') {
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    } else await page.locator('.nm-inspect').last().click();
    await page.locator('.combatant-inspector-body').waitFor();
    await page.keyboard.press('Escape');
    await openCombatSettings(page);
    await page.setViewportSize({ width:390,height:844 });
    await choose(page, 'desktop');
    await choose(page, 'auto');
    console.log(`Combat preset checks passed: ${profile}`);
    await page.close();
  }
  const map = await pageFor('core', 'map', 'mobile');
  await map.locator('.mapscreen').waitFor();
  // The shot setting boots the same in-document preset used by Settings.
  await map.goto(`${base}${process.env.VIEW_PRESETS_ENTRY || 'index.html'}?shot=map&gameProfile=core&shotSeed=3&shotSettings=${encodeURIComponent(JSON.stringify({ viewPreset:'desktop', mapFreePan:true }))}`);
  await map.locator('.map-scroll').waitFor();
  for (let i = 0; i < 3; i++) await map.locator('#zoom-in').click();
  const pan = map.locator('.map-scroll');
  const initial = await pan.evaluate(node => {
    node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
    return { top:node.scrollTop, max:node.scrollHeight-node.clientHeight, scale:node.getBoundingClientRect().width/node.offsetWidth };
  });
  assert.ok(initial.max > 20, 'zoomed map has camera travel');
  const port = await pan.boundingBox();
  const distance = Math.min(20, port.height / 4);
  await map.mouse.move(port.x + 4, port.y + port.height / 2);
  await map.mouse.down();
  await map.mouse.move(port.x + 4, port.y + port.height / 2 - distance, { steps:5 });
  await map.mouse.up();
  const finalTop = await pan.evaluate(node => node.scrollTop);
  const expected = Math.min(initial.max, initial.top + distance / initial.scale);
  assert.ok(Math.abs(finalTop - expected) < 5, 'scaled map drag follows pointer distance in map coordinates');
  assert.equal(await pan.evaluate(node => node.classList.contains('grabbing')), false);
  await map.close();
  }
  for (const host of Object.keys(hosts).filter(host => !process.env.VIEW_PRESETS_CAPTURE_HOST || host === process.env.VIEW_PRESETS_CAPTURE_HOST)) {
    const page = await pageFor('core', 'title', host);
    await page.locator('.title-menu').waitFor();
    const widths = await page.locator('.title-menu [data-title-action]').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
    assert.ok(Math.max(...widths) - Math.min(...widths) < 1, 'title actions have equal width');
    await page.screenshot({ path: resolve(output, `${host}-title.png`) });
    await page.locator('#settings').click();
    await page.locator('[data-general-select]').selectOption('Game rules');
    await page.getByLabel('New game configuration', { exact:true }).waitFor();
    assert.equal(await page.getByLabel('Import game configuration JSON').count(), 1);
    await page.screenshot({ path: resolve(output, `${host}-rules.png`) });
    await page.locator('[data-general-select]').selectOption('Display');
    await page.locator('select[data-key="viewPreset"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `${host}.png`) });
    if (host === 'desktop') {
      await choose(page, 'mobile');
      await page.locator('select[data-key="viewPreset"]').scrollIntoViewIfNeeded();
      await page.screenshot({ path:resolve(output, 'desktop-mobile-preset.png') });
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(`${process.env.VIEW_PRESETS_CAPTURE_ONLY ? 'Responsive Settings captures' : 'View preset state preservation and responsive Settings checks'} passed. Captures: ${output}`);
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.server.close(resolve));
}
