// Photograph actual production components from the existing shot catalog.
// node tools/character-creation-components-qa.mjs [--artifact] [--out DIR]
// Browser plugin not available: use the repository's Playwright/CDP workflow.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright` : 'playwright'));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outputArgument = args.indexOf('--out');
const out = resolve(outputArgument >= 0 ? args[outputArgument + 1] : resolve(root, 'outputs/character-creation-components'));
const entry = args.includes('--artifact') ? 'download/AshenSpire.html' : 'index.html';
const componentIds = [
  'creation-page-heading', 'creation-panel', 'creation-choice-tile',
  'creation-part-material', 'creation-part-trim', 'creation-part-body',
  'creation-choice-art', 'creation-choice-copy', 'creation-step-navigation',
  'creation-feat-browser', 'creation-feat-tile', 'creation-feat-detail', 'creation-feat-emblem',
  'class-choice-card', 'keepsake-choice', 'equipment-choice-card', 'primary-stat-card',
];
mkdirSync(out, { recursive: true });
const serving = await serve({ root, port: 0, open: false, quiet: true, host: '127.0.0.1' });
const launched = await launchBrowser({ browser: resolveBrowser([chromium.executablePath()]), prefix: 'creation-components-qa-' });
let browser;
const results = [];
try {
  browser = await chromium.connectOverCDP(launched.wsUrl);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${serving.port}/${entry}?shot=components#folio-creation-feat-browser`;
    await page.goto(url);
    await page.locator('#folio-creation-feat-browser').waitFor({ timeout: 60000 });
    assert.equal(new URL(page.url()).searchParams.get('shot'), 'components');
    assert.match(await page.title(), /Ashen\s*Spire/i);
    assert.ok((await page.locator('.component-catalog').textContent()).length > 100, 'meaningful production catalog rendered');
    assert.equal(await page.locator('nextjs-portal, #webpack-dev-server-client-overlay, vite-error-overlay').count(), 0);
    const featBrowser = page.locator('#folio-creation-feat-browser .cc-feat-browser');
    await featBrowser.locator('[data-feat="weaponDrill"].cc-choice-tile').click();
    assert.equal(await featBrowser.getAttribute('data-inspected-feat'), 'weaponDrill');
    assert.equal(await featBrowser.getAttribute('data-birth-feat-allowance'), '0');
    assert.equal(await featBrowser.locator('.cc-feat-detail-title').textContent(), 'Weapon Drill');
    const choice = page.locator('#folio-creation-choice-tile button');
    await choice.click();
    assert.equal(await page.locator('#folio-creation-choice-tile button').getAttribute('aria-pressed'), 'true');
    const navigation = page.locator('#folio-creation-step-navigation .cc-step-navigation');
    await navigation.scrollIntoViewIfNeeded();
    const attributes = navigation.locator('[data-creation-step="attributes"]');
    if (!await attributes.isVisible()) await navigation.locator('.as-catnav-toggle').click();
    await attributes.click();
    assert.equal(await attributes.getAttribute('aria-current'), 'step');
    for (const componentId of componentIds) {
      const folio = page.locator(`#folio-${componentId}`);
      await folio.scrollIntoViewIfNeeded();
      assert.equal(await folio.count(), 1, `one independently linked ${componentId}`);
      assert.ok(await folio.locator(`[data-ui-component="${componentId}"]`).count(), `${componentId} uses its registered production renderer`);
      await folio.locator('img').evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode().catch(() => {})));
      });
      const dimensions = await folio.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
      assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `${componentId} fits ${width}px viewport`);
      await folio.screenshot({ path: resolve(out, `${componentId}-${width}x${height}.png`) });
      results.push({ componentId, width, height, entry, url: `${url.split('#')[0]}#folio-${componentId}`, dimensions });
    }
    assert.deepEqual(errors, [], 'no production catalog runtime exceptions');
    const live = await context.newPage();
    const liveErrors = [];
    live.on('pageerror', error => liveErrors.push(error.message));
    const liveUrl = `http://127.0.0.1:${serving.port}/${entry}?shot=customize&shotClass=starseer`;
    await live.goto(liveUrl);
    await live.locator('#cz-tab-class').waitFor({ state: 'attached', timeout: 60000 });
    for (const stage of ['class', 'attributes', 'keepsake', 'equipment', 'feats', 'spells', 'review']) {
      const control = live.locator(`#cz-tab-${stage}`);
      if (!await control.isVisible()) await live.locator('#cz-cat-select').click();
      await control.click();
      await live.locator(`.cz-railed[data-creation-stage="${stage}"]`).waitFor();
      if (stage === 'feats') {
        await live.locator('#cz-feats-panel [data-feat="weaponDrill"].cc-choice-tile').click();
        assert.equal(await live.locator('#cz-feats-panel .cc-feat-detail-title').textContent(), 'Weapon Drill');
      }
      await live.locator('.cz-stage img').evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode().catch(() => {})));
      });
      await live.screenshot({ path: resolve(out, `page-${stage}-starseer-${width}x${height}.png`) });
      results.push({ stage, width, height, entry, url: liveUrl, posed: true, classId: 'starseer' });
    }
    assert.deepEqual(liveErrors, [], 'no live creation page runtime exceptions');
    await context.close();
  }
} finally {
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser?.close();
  await launched.close();
  await new Promise(done => serving.server.close(done));
}
console.log(`Character Creation components: ${results.length} desktop/mobile production specimens captured in ${out}`);
