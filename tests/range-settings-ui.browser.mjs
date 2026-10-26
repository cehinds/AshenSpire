// Real in-run Settings owner: select next-run Core while Current remains live.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '../tools/serve.mjs';
import { launchBrowser } from '../tools/browser.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true, lan: false });
const base = `${(process.env.BASE_URL || server.url).replace(/\/$/, '')}/`;
const out = process.env.RANGE_UI_OUT || '/tmp/range-action-ui'; mkdirSync(out, { recursive: true });
const launched = await launchBrowser({ prefix: 'range-settings-', browser: process.env.CHROME });
const browser = await chromium.connectOverCDP(launched.wsUrl);
const errors = [], failedResponses = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status() }); });
  await page.goto(`${base}index.html?shot=combat&gameProfile=current`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__combat, null, { timeout: 15000 });
  const before = await page.evaluate(() => ({ profile: window.__combatRunForShot.gameProfile?.hash, range: window.__combat.rangeState ?? null, runPolicy: window.__combatRunForShot.rangePolicy ?? null }));
  await page.keyboard.press('m');
  await page.locator('[data-settings-host]').waitFor({ state: 'visible', timeout: 15000 });
  const group = page.locator('[data-general-select]');
  await group.selectOption('Game rules');
  await page.locator('.game-profile-selector select').selectOption('core');
  await group.selectOption('Combat');
  await page.locator('[data-general-topic]').selectOption('Range');
  const toggle = page.locator('[data-key="rangeMechanics"]');
  await toggle.waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await toggle.isChecked(), true);
  await toggle.click();
  assert.equal(await toggle.isChecked(), false);
  const keys = ['rangeAdvanceSpPerBand', 'rangeReachPrecisionBonus', 'rangeThrowPrecisionPenalty'];
  for (const key of keys) {
    const input = page.locator(`input[type="number"][data-key="${key}"]`);
    await input.fill('0'); await input.press('Tab');
    assert.equal(await input.inputValue(), '0');
  }
  await page.locator('[data-search-toggle]').click();
  const search = page.locator('[data-advanced-search]'); await search.fill('range');
  await page.locator('[data-key="rangeMechanics"]').waitFor({ state: 'visible', timeout: 15000 });
  for (const key of keys) assert.equal(await page.locator(`input[type="number"][data-key="${key}"]`).inputValue(), '0');
  await search.fill('');
  await group.selectOption('Display'); await group.selectOption('Combat');
  await page.locator('[data-general-topic]').selectOption('Range');
  assert.equal(await page.locator('[data-key="rangeMechanics"]').isChecked(), false);
  const after = await page.evaluate(() => ({ profile: window.__combatRunForShot.gameProfile?.hash, range: window.__combat.rangeState ?? null, runPolicy: window.__combatRunForShot.rangePolicy ?? null }));
  assert.deepEqual(after, before, 'changing next-run controls never mutates the active Current fight/run');
  const prefs = await page.evaluate(() => Object.fromEntries(['rangeMechanics', 'rangeAdvanceSpPerBand', 'rangeReachPrecisionBonus', 'rangeThrowPrecisionPenalty'].map(key => {
    const node = document.querySelector(`[data-key="${key}"]`);
    return [key, key === 'rangeMechanics' ? node.checked : Number(node.value)];
  })));
  const policy = await page.evaluate(async settings => {
    const [{ contentBundle }, { createRegistries }, { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries }, { createRunState }] = await Promise.all([
      import('/src/content/index.js'), import('/src/model/registries.js'), import('/src/model/gameProfile.js'), import('/src/model/state.js'),
    ]);
    const profile = resolveGameProfile('core');
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    return createRunState({ registries, seed: 42, classId: 'reaver', profileMeta: { settings } }).rangePolicy;
  }, prefs);
  assert.deepEqual(policy, { version: 1, enabled: false, advanceSpPerBand: 0, reachPrecisionBonus: 0, throwPrecisionPenalty: 0 });
  await page.screenshot({ path: resolve(out, 'settings-current-next-core-390x844.png') });
  assert.deepEqual(errors, []);
  writeFileSync(resolve(out, 'settings-checks.json'), JSON.stringify({ before, after, prefs, policy, failedResponses, errors }, null, 2));
  console.log('Range Settings: real Current run / next Core, zero values, search/category repaint, and new-run-only policy passed.');
} finally {
  await browser.close();
  await launched.close();
  if (server) await new Promise((resolve, reject) => server.server.close(error => error ? reject(error) : resolve()));
}
