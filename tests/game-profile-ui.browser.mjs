// Run after source integration: PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/usr/bin/chromium GAME_PROFILE_ARTIFACT=/path/to/AshenSpire.html node tests/game-profile-ui.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { serve } from '../tools/serve.mjs';
import { publishBranchPreviews, PREVIEW_SANDBOX } from '../tools/pages-site.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.GAME_PROFILE_UI_OUT || '/tmp/ashen-game-profile-ui';
const artifactPath = process.env.GAME_PROFILE_ARTIFACT;
if (!artifactPath || !existsSync(artifactPath)) {
  throw new Error('Set GAME_PROFILE_ARTIFACT to the built standalone AshenSpire.html before running this browser suite.');
}
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const base = server.url;
const errors = [];
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small-phone', width: 360, height: 800 },
];

async function sourcePage(query, viewport = viewports[0]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}index.html?${query}`);
  return page;
}

async function captureSourceScenes() {
  // Existing slots keep the same five title actions and Continue enters the
  // saved run for both presets. This guards the original profile paths too.
  for (const profile of ['core', 'current']) {
    const savedTitle = await sourcePage(`shot=title&gameProfile=${profile}`);
    await savedTitle.waitForSelector('.title-menu');
    assert.deepEqual(
      await savedTitle.locator('.title-menu [data-title-action]').evaluateAll(rows => rows.map(row => row.dataset.titleAction)),
      ['continue', 'new', 'load', 'settings', 'quit'],
    );
    await savedTitle.locator('.slot-continue').click();
    await savedTitle.waitForSelector('.mapscreen');
    await savedTitle.close();
  }

  // Capture the title's actual entrance gate, then activate it and verify the
  // folded title reveals the normal menu before the user can choose Exit.
  for (const viewport of [viewports[0], viewports[2]]) {
    const page = await sourcePage('gameProfile=core', viewport);
    await page.waitForSelector('.startup-gate');
    await page.screenshot({ path: resolve(output, `source-opening-${viewport.name}.png`) });
    await page.locator('.startup-gate').click();
    await page.waitForSelector('.title-menu');
    assert.deepEqual(
      await page.locator('.title-menu [data-title-action]').evaluateAll(rows => rows.map(row => row.dataset.titleAction)),
      ['new', 'settings', 'quit'],
    );
    await page.screenshot({ path: resolve(output, `source-menu-${viewport.name}.png`) });
    if (viewport.name === 'desktop') {
      await page.locator('#quit-game').click();
      await page.waitForSelector('.farewell');
      assert.ok((await page.locator('.farewell').innerText()).trim().length > 0, 'Exit reaches the farewell screen in a browser tab');
      await page.screenshot({ path: resolve(output, 'source-farewell-desktop.png') });
    }
    await page.close();
  }

  // Reach both real stages of configured creation. This is the menu route,
  // including the save-slot selection, rather than a DOM fixture.
  const creation = await sourcePage('gameProfile=core');
  await creation.waitForSelector('.startup-gate');
  await creation.locator('.startup-gate').click();
  await creation.waitForSelector('#new-game');
  await creation.locator('#new-game').click();
  await creation.locator('[data-slot-pick="2"]').click();
  await creation.getByRole('button', { name: 'Create character', exact: true }).click();
  await creation.getByRole('button', { name: 'Start', exact: true }).click();
  assert.equal(await creation.locator('.game-profile-setup').count(), 0, 'New Game goes directly to class selection');
  assert.equal(await creation.locator('.cz-railed').getAttribute('data-creation-stage'), 'class');
  assert.equal(await creation.locator('.cz-class.locked').count(), 3, 'new profiles can select Reaver while the other three classes remain locked');
  await creation.screenshot({ path: resolve(output, 'core-class-desktop.png') });
  await creation.locator('#cz-next').click();
  assert.equal(await creation.locator('.cz-railed').getAttribute('data-creation-stage'), 'review');
  assert.equal(await creation.locator('.cc-starter-deck .card').count(), 10, 'class review shows the authored ten-card starter');
  await creation.screenshot({ path: resolve(output, 'core-review-desktop.png') });
  await creation.locator('#cz-start').click();
  await creation.waitForSelector('.mapscreen');
  assert.equal(await creation.locator('.map-node').count(), 18, 'a fresh default act has eight depths and 18 nodes across its three branch lanes');
  await creation.screenshot({ path: resolve(output, 'core-map-desktop.png') });
  await creation.close();

  // Importing an author override changes the generated map, not just the
  // selector value. Five pre-boss depths plus two shared rests and the boss
  // render six depths and twelve nodes.
  const imported = await sourcePage('shot=title&gameProfile=core');
  await imported.waitForSelector('#new-game');
  await imported.locator('#settings').click();
  await imported.getByLabel('General section', { exact: true }).selectOption('Game rules');
  const importedSelector = imported.getByLabel('New game configuration');
  const routeOverride = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: { routes: { prebossNodes: 5, restFloors: [2, 4] } } };
  await imported.getByLabel('Import game configuration JSON').setInputFiles({
    name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(routeOverride)),
  });
  await imported.waitForTimeout(100);
  assert.equal(await importedSelector.inputValue(), 'imported');
  await importedSelector.selectOption('current');
  await importedSelector.selectOption('imported');
  await imported.getByRole('button', { name: 'Done and Save', exact: true }).click();
if (await imported.getByRole('button', { name: 'Not now', exact: true }).isVisible()) await imported.getByRole('button', { name: 'Not now', exact: true }).click();
  await imported.locator('#new-game').click();
  await imported.locator('[data-slot-pick="2"]').click();
  await imported.getByRole('button', { name: 'Create character', exact: true }).click();
  await imported.getByRole('button', { name: 'Start', exact: true }).click();
  assert.equal(await imported.locator('.cz-class.locked').count(), 3);
  await imported.locator('#cz-next').click();
  await imported.locator('#cz-start').click();
  await imported.waitForSelector('.mapscreen');
  assert.equal(await imported.locator('.map-node').count(), 12, 'imported prebossNodes=5 creates six depths and twelve nodes');
  await imported.close();

  for (const viewport of [viewports[2]]) {
    const customize = await sourcePage('gameProfile=core', viewport);
    await customize.waitForSelector('.startup-gate');
    await customize.locator('.startup-gate').click();
    await customize.waitForSelector('#new-game');
    await customize.locator('#new-game').click();
    await customize.locator('[data-slot-pick="2"]').click();
    await customize.getByRole('button', { name: 'Create character', exact: true }).click();
    await customize.getByRole('button', { name: 'Start', exact: true }).click();
    assert.equal(await customize.locator('.cz-railed').getAttribute('data-creation-stage'), 'class');
    await customize.screenshot({ path: resolve(output, `core-class-${viewport.name}.png`) });
    await customize.locator('#cz-next').click();
    assert.equal(await customize.locator('.cz-railed').getAttribute('data-creation-stage'), 'review');
    assert.equal(await customize.locator('.cc-starter-deck .card').count(), 10);
    await customize.screenshot({ path: resolve(output, `core-review-${viewport.name}.png`) });
    await customize.close();
  }

  const mapPhone = await sourcePage('shot=map&gameProfile=core&shotSeed=3', viewports[2]);
  await mapPhone.waitForSelector('.mapscreen');
  assert.equal(await mapPhone.locator('.map-node').count(), 18);
  await mapPhone.screenshot({ path: resolve(output, 'core-map-phone.png') });
  await mapPhone.close();

  // The market shot is an authored configured run state with enough currency
  // and goods to render the same merchant surface a live run uses.
  for (const viewport of [viewports[0], viewports[2]]) {
    const shop = await sourcePage('shot=shop&gameProfile=core', viewport);
    await shop.waitForSelector('.merchant-workspace');
    assert.equal(await shop.locator('.merchant-offer').count(), 3);
    await shop.screenshot({ path: resolve(output, `core-shop-${viewport.name}.png`) });
    const buy = shop.locator('.merchant-offer button, .merchant-offer [role="button"]').first();
    if (await buy.count()) {
      await buy.click();
      await shop.waitForTimeout(150);
      if (await shop.locator('[role="dialog"]').count()) {
        await shop.screenshot({ path: resolve(output, `core-shop-review-${viewport.name}.png`) });
      }
    }
    await shop.close();
  }

  const combat = await sourcePage('shot=combat&gameProfile=core&shotSeed=3');
  await combat.waitForSelector('.end-turn');
  assert.ok(await combat.locator('.hand .card').count() > 0, 'the configured combat fixture enters a real fight with its authored hand');
  await combat.screenshot({ path: resolve(output, 'core-combat-desktop.png') });
  await combat.close();

  const fallback = { formatVersion: 1, core: 'ashen.core@1.0.0', modules: { cards: false, art: false, routes: false } };
  const fallbackPage = await sourcePage(`shot=combat&wb.gameProfile=${encodeURIComponent(JSON.stringify(fallback))}`);
  await fallbackPage.waitForSelector('.foundation-attack');
  assert.equal(await fallbackPage.locator('.foundation-attack').count(), 1);
  assert.ok(await fallbackPage.locator('.foundation-standin').count() >= 2);
  const hpBefore = await fallbackPage.evaluate(() => window.__combat.enemies[0].hp);
  await fallbackPage.locator('.foundation-attack').click();
  await fallbackPage.waitForFunction(before => window.__combat.enemies[0].hp < before, hpBefore);
  await fallbackPage.close();
}

async function capturePagesSandbox() {
  assert.equal(PREVIEW_SANDBOX, 'allow-scripts allow-pointer-lock allow-popups');
  assert.equal(/allow-same-origin/.test(PREVIEW_SANDBOX), false);
  const previewRoot = mkdtempSync(join(tmpdir(), 'ashen-pages-preview-'));
  publishBranchPreviews(previewRoot, [{
    branch: 'Feature/json-game-modules', path: 'Feature-json-game-modules', pr: 0,
    sha: '0142aaa7f', file: 'AshenSpire.html', from: artifactPath,
  }]);
  const previewServer = await serve({ root: previewRoot, port: 0, open: false, quiet: true });
  const previewBase = `${previewServer.url}branches/Feature-json-game-modules/latest/`;
  try {
  for (const viewport of [viewports[0]]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(previewBase);
    const iframe = page.locator('#preview');
    assert.equal(await iframe.getAttribute('sandbox'), PREVIEW_SANDBOX);
    const game = page.frameLocator('#preview');
    await game.locator('.startup-gate').waitFor();
    const frame = page.frames().find(candidate => candidate.url() === 'about:srcdoc');
    assert.ok(frame, 'the preview build runs as srcdoc');
    assert.equal(await frame.evaluate(() => location.origin), 'null', 'the preview has an opaque origin');
    assert.equal(await frame.evaluate(() => {
      try { localStorage.getItem('ashen:test'); return false; }
      catch (error) { return error.name === 'SecurityError'; }
    }), true, 'the preview cannot read same-origin localStorage');
    await game.locator('.startup-gate').screenshot({ path: resolve(output, `artifact-opening-${viewport.name}.png`) });
    // Playwright treats the srcdoc body as a separately clipped hit target;
    // dispatch the same activation click on the focused gate element.
    const iframeBounds = await iframe.boundingBox();
    assert.ok(iframeBounds, 'the sandbox iframe is visible for real pointer input');
    await page.mouse.click(iframeBounds.x + iframeBounds.width / 2, iframeBounds.y + iframeBounds.height / 2);
    await game.locator('.title-menu').waitFor();
    assert.deepEqual(
      await game.locator('.title-menu [data-title-action]').evaluateAll(rows => rows.map(row => row.dataset.titleAction)),
      ['new', 'settings', 'quit'],
    );
    await game.locator('body').screenshot({ path: resolve(output, `artifact-menu-${viewport.name}.png`) });
    if (viewport.name === 'desktop') {
      const quitBounds = await frame.locator('#quit-game').evaluate(element => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
      await page.mouse.click(iframeBounds.x + quitBounds.x + quitBounds.width / 2, iframeBounds.y + quitBounds.y + quitBounds.height / 2);
      await game.locator('.farewell').waitFor();
      assert.ok((await game.locator('.farewell').innerText()).trim().length > 0);
      await game.locator('body').screenshot({ path: resolve(output, 'artifact-farewell-desktop.png') });
    }
    await page.close();
  }
  } finally {
    previewServer.server.close();
    rmSync(previewRoot, { recursive: true, force: true });
  }
}

try {
  await captureSourceScenes();
  await capturePagesSandbox();
  assert.deepEqual(errors, []);
  console.log(`game-profile-ui browser: PASS; source scenes and Pages sandbox; screenshots ${output}`);
} finally {
  await browser.close();
  server.server.close();
}
