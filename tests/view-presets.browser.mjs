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
  await page.goto(`${base}index.html?shot=${shot}&gameProfile=${profile}&shotSeed=3`);
  return page;
}
async function choose(page, preset) {
  const select = page.locator('select[data-key="viewPreset"]');
  await select.click();
  await select.selectOption(preset);
  await page.waitForFunction(value => document.documentElement.dataset.viewPreset === value, preset);
  const dimensions = await page.evaluate(async () => {
    const { logicalViewport } = await import('/src/ui/viewViewport.js');
    const root = document.documentElement;
    const box = root.getBoundingClientRect();
    return { logical: logicalViewport(), width: box.width, height: box.height, scale: Number(root.dataset.viewScale), host: [innerWidth,innerHeight] };
  });
  if (presets[preset]) {
    const [width,height] = presets[preset];
    assert.equal(dimensions.logical.width, width);
    assert.equal(dimensions.logical.height, height);
    assert.ok(dimensions.width <= dimensions.host[0] + 2, `${preset} fits host width`);
    assert.ok(dimensions.height <= dimensions.host[1] + 2, `${preset} fits host height`);
    assert.ok(dimensions.scale > 0 && dimensions.scale <= 1);
  }
  assert.ok(await select.isVisible(), `Settings reachable in ${preset}`);
}
async function openCombatSettings(page) {
  await page.locator('[data-action-hint="menu"]').click();
  const settings = page.locator('[data-settings-host]');
  if (!await settings.count()) await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.waitFor();
  await page.locator('[data-general-select]').selectOption('Display');
}
function liveSnapshot() {
  const run = window.__combatRunForShot;
  const combat = window.__combat;
  return JSON.stringify({ runHP: run.runHP, deck: run.deck, round: combat.round, playerHP: combat.player.hp, phase: combat.phase });
}
try {
  for (const profile of ['core','current']) {
    const page = await pageFor(profile, 'combat');
    await page.locator('.end-turn').waitFor();
    await page.evaluate(() => { window.__qaCombatIdentity = window.__combat; });
    const before = await page.evaluate(liveSnapshot);
    await openCombatSettings(page);
    for (const preset of [...Object.keys(presets), 'auto']) {
      await choose(page, preset);
      assert.equal(await page.evaluate(() => window.__qaCombatIdentity === window.__combat), true, 'view change preserves live combat object');
      assert.equal(await page.evaluate(liveSnapshot), before, 'view change preserves HP, deck, round and phase');
    }
    await page.setViewportSize({ width:390,height:844 });
    await choose(page, 'desktop');
    await choose(page, 'auto');
    await page.close();
  }
  for (const host of Object.keys(hosts)) {
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
    await page.locator('select[data-key="viewPreset"]').waitFor();
    await page.screenshot({ path: resolve(output, `${host}.png`) });
    await page.close();
  }
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(`View preset state preservation and responsive Settings checks passed. Captures: ${output}`);
} finally {
  await browser.close();
  if (server) await server.close();
}
