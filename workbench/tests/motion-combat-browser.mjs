// Targeted native Motion Studio QA. Run from the repository root; output stays outside the tree.
// node workbench/tests/motion-combat-browser.mjs --out /absolute/evidence/path
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const out = resolve(arg('--out') || 'scratch/qa/motion-combat-review');
const port = arg('--port') || '4346';
mkdirSync(out, { recursive: true });
const server = spawn(process.execPath, ['workbench/server.mjs', '--port', port, '--no-open'], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
let browser;
const errors = [], failedArtwork = [], checks = [];
const timeout = (fn, ms = 45000) => new Promise((done, fail) => {
  const start = Date.now();
  const run = async () => {
    try { const result = await fn(); if (result) { done(result); return; } } catch { /* wait for startup */ }
    if (Date.now() - start >= ms) { fail(Error('Timed out waiting for Workbench / game startup')); return; }
    setTimeout(run, 200);
  };
  run();
});
try {
  const base = await timeout(() => serverLog.match(/Workbench: (http:\/\/\S+)/)?.[1]);
  const session = await (await fetch(base + '/api/session')).json();
  const tools = () => fetch(base + '/api/tools', { headers: { 'x-studio-token': session.token } }).then(response => response.json());
  await timeout(async () => (await tools()).find(tool => tool.id === 'game' && tool.status === 'up'), 60000);
  const executablePath = process.env.CHROME_PATH || '/usr/bin/chromium';
  browser = await chromium.launch({ ...(existsSync(executablePath) ? { executablePath } : {}), args: ['--no-sandbox', '--mute-audio'] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() < 400) return;
    try { if (response.request().frame().url().includes('/modules/motion/render.html') && /\.(webp|png)(\?|$)/.test(response.url())) failedArtwork.push({ status: response.status(), url: response.url() }); } catch { /* detached request */ }
  });
  await page.goto(base + '/#mod=motion&class=reaver&anim=combat%3Areaver%3Asmash', { waitUntil: 'domcontentloaded' });
  const renderer = async () => {
    await page.waitForFunction(() => document.querySelector('.mo-frame')?.src.includes('/modules/motion/render.html'));
    return (await page.locator('.mo-frame').elementHandle()).contentFrame();
  };
  const painted = async frame => frame.waitForFunction(() => {
    const canvas = document.querySelector('#stage .alternative-card-stage canvas');
    if (!canvas) return false;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 32 && ++visible > 1000) return true;
    return false;
  });
  const open = async (classId, action, available = true) => {
    const id = `combat:${classId}:${action}`;
    await page.evaluate(({ classId, id }) => { location.hash = new URLSearchParams({ mod: 'motion', class: classId, anim: id }).toString(); }, { classId, id });
    await page.waitForFunction(id => document.querySelector('.mo-file')?.textContent === id, id);
    const frame = await renderer();
    await frame.waitForFunction(({ id, available }) => {
      const stage = document.getElementById('stage');
      return stage?.dataset.combatId === id && (!available || stage.dataset.combatReady === 'true');
    }, { id, available });
    if (available) await painted(frame);
    return frame;
  };
  const scrub = async (time, expected) => {
    await page.locator('.mo-scrub').evaluate((element, time) => { element.value = String(time); element.dispatchEvent(new Event('input', { bubbles: true })); }, time);
    const frame = await renderer();
    if (expected) await frame.waitForFunction(pose => document.getElementById('stage').dataset.pose === pose, expected);
    await painted(frame);
    return frame.locator('#stage').getAttribute('data-pose');
  };
  await open('reaver', 'smash');
  const libraryToggle = page.locator('.mo-toggle[data-overlay="lib"]');
  if (await libraryToggle.isVisible()) await libraryToggle.click();
  await page.locator('.mo-kinds [data-kind="combat"]').click();
  await page.locator('.mo-class').selectOption('');
  assert.equal(await page.locator('.mo-list [data-kind="combat"]').count(), 52);
  await page.locator('.mo-item[data-id="combat:reaver:smash"]').click();
  await page.locator('.mo-play').click();
  await page.waitForFunction(() => Number(document.querySelector('.mo-scrub')?.value) > 0);
  await page.locator('.mo-play').click();
  assert.equal(await page.locator('.mo-play').getAttribute('aria-pressed'), 'false');
  checks.push('Native Combat sequences filter exposes all 52 rows, row click and Play/Pause work');
  assert.equal(await page.locator('.mo-tick').count(), 5);
  assert.equal(await page.locator('.mo-scrub').getAttribute('max'), '195');
  await scrub(117, 'pilot-smash-impact');
  assert.equal(await page.locator('[data-mode="edit"]').isDisabled(), true);
  assert.equal(await page.locator('.mo-review').isDisabled(), true);
  assert.equal(await page.locator('.mo-readonly').isVisible(), true);
  checks.push('SM03 five slots, 195ms game pace, 117ms contact, read-only controls');
  const captures = [];
  for (const [name, width, height] of [['desktop', 1600, 1000], ['wide', 1920, 1080], ['tablet', 1024, 1366], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await scrub(117, 'pilot-smash-impact');
    await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: true });
    captures.push({ name, width, height, action: 'combat:reaver:smash', timeMs: 117 });
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await open('reaver', 'sweep');
  await scrub(78, 'pilot-sweep-contact');
  await scrub(195, 'stance-sweep');
  checks.push('SW09 78ms contact and return to held Sweep');
  await open('reaver', 'fully-defended');
  const ticks = await page.locator('.mo-tick').evaluateAll(nodes => nodes.map(node => parseFloat(node.style.left)));
  assert.equal(ticks.length, 6);
  assert.ok(Math.abs(ticks[1] - 100 * 2 / 13) < 0.0001);
  await scrub(66, 'pilot-impact-v');
  await page.screenshot({ path: resolve(out, 'shared-reaction.png') });
  for (const [action, count] of [['counter-guard', 13], ['counter-evade', 9]]) {
    await open('reaver', action);
    assert.equal(await page.locator('.mo-tick').count(), count);
    await page.locator('.mo-tick').last().click();
    assert.match(await (await renderer()).locator('#stage').getAttribute('data-pose'), /pilot-attack-6/);
  }
  checks.push('Shared Guard/Parry/Resisted weighted phase and 13/9-phase Counter flavors');
  for (const classId of ['rogue', 'starseer', 'herald']) {
    await open(classId, 'smash');
    await scrub(117, 'class-smash-impact');
    assert.match(await page.locator('.mo-meta').innerText(), new RegExp(`class-smash/${classId}/production.json`));
    await open(classId, 'evade');
    assert.match(await page.locator('.mo-insp').innerText(), /No registered painted evade/);
    await open(classId, 'fully-defended', false);
    assert.equal(await page.locator('.mo-play').isDisabled(), true);
    assert.match(await page.locator('.mo-insp').innerText(), /no registered painted impact reaction/);
  }
  await page.screenshot({ path: resolve(out, 'missing-reaction.png') });
  checks.push('All four default-class Smash profiles; missing-class reaction and Evade fallbacks');
  // Return to an ordinary editable pose file through the same module, without a page reload.
  const editable = 'pose-studio/renewal/cards/reaver/attack.pose.json';
  await page.evaluate(path => { location.hash = new URLSearchParams({ mod: 'motion', anim: path }).toString(); }, editable);
  await page.waitForFunction(path => document.querySelector('.mo-file')?.textContent === path, editable);
  assert.equal(await page.locator('[data-mode="edit"]').isDisabled(), false);
  assert.equal(await page.locator('.mo-readonly').isVisible(), false);
  checks.push('Returning to editable pose files restores editing controls');
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 });
  const touch = await touchContext.newPage();
  await touch.goto(base + '/#mod=motion&class=reaver&anim=combat%3Areaver%3Asmash', { waitUntil: 'domcontentloaded' });
  await touch.waitForFunction(() => document.querySelector('.mo-file')?.textContent === 'combat:reaver:smash');
  await touch.locator('.mo-toggle[data-overlay="lib"]').tap();
  await touch.locator('.mo-kinds [data-kind="combat"]').tap();
  await touch.locator('.mo-item[data-id="combat:reaver:sweep"]').tap();
  await touch.waitForFunction(() => document.querySelector('.mo-file')?.textContent === 'combat:reaver:sweep');
  const touchFrame = await (await touch.locator('.mo-frame').elementHandle()).contentFrame();
  await touchFrame.waitForFunction(() => document.getElementById('stage')?.dataset.combatId === 'combat:reaver:sweep' && document.getElementById('stage')?.dataset.combatReady === 'true');
  await painted(touchFrame);
  await touch.screenshot({ path: resolve(out, 'mobile-touch-selection.png'), fullPage: true });
  await touchContext.close();
  checks.push('Mobile touch selects a combat sequence through the native Library overlay');
  const malformed = await context.newPage();
  await malformed.route('**/src/model/combatSequenceReview.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function combatSequenceReviews(){throw Error("invalid review config")} export function sampleCombatSequenceReview(){}' }));
  await malformed.goto(base + '/#mod=motion', { waitUntil: 'domcontentloaded' });
  await malformed.waitForFunction(() => document.querySelector('.mo-setup')?.textContent.includes('invalid review config'));
  await malformed.close();
  const unavailable = await context.newPage();
  await unavailable.route('**/workbench/modules/motion/render.mjs', route => route.abort());
  await unavailable.goto(base + '/#mod=motion', { waitUntil: 'domcontentloaded' });
  await unavailable.waitForFunction(() => document.querySelector('.mo-setup')?.textContent.includes('renderer did not respond'), null, { timeout: 20000 });
  await unavailable.close();
  checks.push('Malformed configuration and failed renderer imports show bounded actionable errors');
  assert.deepEqual(failedArtwork, [], 'current registered artwork loads without HTTP failures');
  assert.deepEqual(errors, [], 'no JavaScript exceptions');
  const source = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(resolve(out, 'results.json'), JSON.stringify({ source, date: new Date().toISOString(), captures, checks, errors, failedArtwork }, null, 2));
  writeFileSync(resolve(out, 'CAPTURE-DETAILS.md'), `# Motion Studio combat sequence review\n\nSource commit: ${source}\nCaptured: ${new Date().toISOString()}\n\nNative Workbench module at ${base}/#mod=motion. SM03 impact at 117ms; current registered class-default art. These captures inspect source playback, not a paid combat dispatch.\n\n${captures.map(row => `- ${row.name}: ${row.width}×${row.height}`).join('\n')}\n`);
  console.log(JSON.stringify({ passed: checks.length, captures: captures.length + 2, out, source }));
} catch (error) {
  writeFileSync(resolve(out, 'failure.json'), JSON.stringify({ message: error.stack, errors, failedArtwork, serverLog }, null, 2));
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
