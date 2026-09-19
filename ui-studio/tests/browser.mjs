// node ui-studio/tests/browser.mjs — the studio in headless Chromium.
//
// Boots the server against this checkout with a disposable state directory,
// drags a band edge, validates, switches devices, compares, draws and moves a
// sketch box, saves a sketch and opens the live game. Exits 1 on the first
// failed assertion. Nothing in the checkout is written except the one sketch
// it saves and then removes.
//
// Set UI_STUDIO_PLAYWRIGHT to a Playwright module path when it is not on
// Node's module path (e.g. the global install: `npm root -g`/playwright), and
// UI_STUDIO_EVIDENCE to a directory to keep screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createUiStudio } from '../server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.UI_STUDIO_PLAYWRIGHT ? pathToFileURL(path.resolve(process.env.UI_STUDIO_PLAYWRIGHT)).href : 'playwright');
const evidence = process.env.UI_STUDIO_EVIDENCE ? path.resolve(process.env.UI_STUDIO_EVIDENCE) : null;
if (evidence) await fs.mkdir(evidence, { recursive: true });
const shot = async (page, name) => { if (evidence) await page.screenshot({ path: path.join(evidence, `${name}.png`) }); };

const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-studio-browser-'));
const app = await createUiStudio({ port: 0, stateDir });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const sketchFile = path.join(HERE, '..', 'workspace', 'sketches', 'ui-studio-browser-test.json');
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && (m.location().url || app.url).startsWith(app.url)) errors.push(m.text()); });
  // The studio's own requests must all succeed. The game inside the preview
  // frame is the checkout's own business (a missing sound is the game's
  // finding, not the studio's), so only its document load is watched.
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()} ${r.failure() && r.failure().errorText}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(app.url)) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(app.url);
  await page.waitForSelector('svg.canvas');
  await shot(page, '01-config');

  // Config: drag the hud/scene edge down; the file becomes dirty and bands still sum to 100.
  const handle = await page.locator('[data-hit^="bandEdge:0:"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  const bands = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('input[type="number"][data-band]')].map((e) => [e.dataset.band, Number(e.value)])));
  assert.ok(bands.hud > 10, `hud grew: ${JSON.stringify(bands)}`);
  assert.equal(Object.values(bands).reduce((a, b) => a + b, 0), 100);
  assert.equal(await page.textContent('#dirty-count'), '1');
  await shot(page, '02-band-dragged');

  // Undo restores the file; redo brings the edit back.
  await page.keyboard.press('Control+z');
  assert.equal(await page.textContent('#dirty-count'), '0');
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await page.textContent('#dirty-count'), '1');

  // Validate with the compiler; the tree compiles clean.
  await page.click('#right-tabs button[data-tab="files"]');
  await page.click('button[data-act="validate"]');
  await page.waitForSelector('#right-body .ok, #right-body .problems');
  assert.match(await page.textContent('#right-body .ok'), /compile clean/);
  await shot(page, '03-validated');
  // The result speaks for the tree it checked: a second drag afterwards sets
  // it aside until the next validation.
  const again = await page.locator('[data-hit^="bandEdge:0:"]').boundingBox();
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await page.mouse.down();
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2 + 24, { steps: 6 });
  await page.mouse.up();
  await page.click('#right-tabs button[data-tab="files"]');
  await page.waitForSelector('#validation-stale');
  assert.equal(await page.$('#right-body .ok'), null, 'a stale "compiles clean" is not shown');

  // A phone reports the game's narrow mode; Compare draws every enabled device.
  await page.selectOption('#device', 'iphone-14');
  assert.match(await page.textContent('#layout-badge'), /390×844 → narrow, zoom 0\.9/);
  await page.click('#modes button[data-mode="compare"]');
  await page.waitForSelector('.compare figure');
  assert.ok((await page.locator('.compare figure').count()) >= 10);
  await shot(page, '04-compare');

  // Sketch: draw, move (snapped), duplicate, save.
  await page.click('#modes button[data-mode="sketch"]');
  await page.click('button[data-tool="box"]');
  const svg = await page.locator('svg.canvas').boundingBox();
  await page.mouse.move(svg.x + 120, svg.y + 120); await page.mouse.down();
  await page.mouse.move(svg.x + 300, svg.y + 260, { steps: 10 }); await page.mouse.up();
  assert.equal(await page.locator('#box-list li[data-box]').count(), 1);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ui-studio.sketch')).sketch.boxes[0]);
  const box = await page.locator('[data-hit^="box:"]').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 10 }); await page.mouse.up();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ui-studio.sketch')).sketch.boxes[0]);
  assert.ok(after.x > before.x && after.y > before.y, 'the box moved');
  await page.keyboard.press('Control+d');
  assert.equal(await page.locator('#box-list li[data-box]').count(), 2);
  await page.click('#right-tabs button[data-tab="files"]');
  await page.fill('#sketch-name', 'ui-studio-browser-test');
  await page.click('button[data-act="save-sketch"]');
  await page.waitForFunction(() => /Sketch saved/.test(document.querySelector('#status').textContent));
  const saved = JSON.parse(await fs.readFile(sketchFile, 'utf8'));
  assert.equal(saved.schema, 'ashenspire.ui-sketch/1');
  assert.equal(saved.boxes.length, 2);
  await shot(page, '05-sketch');

  // Live game: the frame loads from the preview origin at the device size.
  await page.click('#modes button[data-mode="game"]');
  const frame = page.frameLocator('iframe[title="Live game"]');
  await frame.locator('body').waitFor({ timeout: 15000 });
  assert.equal(await page.getAttribute('iframe[title="Live game"]', 'width'), '390');
  await page.waitForTimeout(1500);
  await shot(page, '06-game');

  assert.deepEqual(errors, [], `no page errors:\n${errors.join('\n')}`);
  console.log('ui-studio browser: OK');
} finally {
  await browser.close();
  await app.close();
  await fs.rm(sketchFile, { force: true });
  await fs.rm(stateDir, { recursive: true, force: true });
}
