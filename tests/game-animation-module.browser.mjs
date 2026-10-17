// PLAYWRIGHT_MODULE=/path/to/playwright CHROME=/usr/bin/chromium ANIMATION_MODULE_OUT=/tmp/animation-module node tests/game-animation-module.browser.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = resolve(process.env.ANIMATION_MODULE_OUT || '/tmp/ashen-animation-module');
mkdirSync(out, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
const evidence = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scenes: [], errors: [], artFailures: [] };
let active;
const author = (profile, enabled) => JSON.stringify({ formatVersion: 1, core: `ashen.${profile}@1.0.0`, modules: { animation: { enabled } } });
async function open(profile, enabled, viewport, scene = 'combat', classic = false) {
  const page = active = await browser.newPage({ viewport, hasTouch: viewport.width < 600 });
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && /\/(assets|assets-mobile|assets-display)\//.test(response.url())) evidence.artFailures.push({ status: response.status(), url: response.url() }); });
  const query = new URLSearchParams({ shot: scene, shotSeed: '3', gameProfile: author(profile, enabled), shotSettings: JSON.stringify({ classicAppearance: classic }), shotHand: '5' });
  await page.goto(`${server.url}index.html?${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator(scene === 'combat' ? '.combatant.player .sprite' : '#strategize-opt').waitFor();
  return page;
}
async function painted(page, selector) {
  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    if (!node || node.querySelector('[data-art-placeholder]') || node.querySelector('[data-art-error]')) return false;
    const canvases = [...node.querySelectorAll('canvas')];
    if (canvases.length) return canvases.some(canvas => {
      const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      return data?.some((value, i) => i % 4 === 3 && value > 0);
    });
    const images = [...node.querySelectorAll('img')];
    return images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0);
  }, selector);
}
async function geometry(page) {
  return page.locator('.combatant .sprite').evaluateAll(nodes => nodes.map(node => ({ id: node.closest('[data-eid]').dataset.eid, box: node.getBoundingClientRect().toJSON() })));
}
async function watch(page) {
  await page.evaluate(async () => {
    const { stageFor } = await import('/src/ui/services/PoseAnimator.js');
    window.__motionTrace = { actions: [], choreography: [] };
    window.__motionWatch = setInterval(() => {
      for (const node of document.querySelectorAll('.combatant .sprite')) {
        const action = stageFor(node)?.presentation?.action;
        if (action) window.__motionTrace.actions.push(action);
        if (node.matches('.act-attack,.act-move,.enemy-attack-pose')) window.__motionTrace.choreography.push(node.className);
      }
    }, 5);
  });
}
async function play(page, enabled) {
  await painted(page, '.combatant.player .sprite');
  const before = await page.evaluate(() => ({ hp: window.__combat.enemies[0].hp, energy: window.__combat.player.energy, stamina: window.__combat.player.stamina, turn: window.__combat.turn }));
  await watch(page);
  const strike = page.locator('.hand .card[data-card-id$="strike"]').first();
  const card = await strike.boundingBox();
  assert.ok(card);
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
  const target = page.locator('.combatant.enemy .sprite').first();
  const bounds = await target.boundingBox();
  assert.ok(bounds?.width > 0);
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.combatant.enemy'), point), true, 'real target art remains hittable');
  if (page.viewportSize().width < 600) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(old => window.__combat.enemies[0].hp < old.hp, before);
  await page.waitForFunction(() => !document.querySelector('.end-turn')?.disabled);
  const paid = await page.evaluate(() => ({ energy: window.__combat.player.energy, stamina: window.__combat.player.stamina }));
  assert.ok(paid.energy < before.energy || paid.stamina < before.stamina, 'UI play pays normally');
  await page.locator('.end-turn').click();
  await page.waitForFunction(turn => window.__combat.turn > turn && !document.querySelector('.end-turn')?.disabled, before.turn);
  const trace = await page.evaluate(() => { clearInterval(window.__motionWatch); return window.__motionTrace; });
  if (enabled) assert.ok(trace.actions.length || trace.choreography.length, 'enabled run shows actual action motion');
  else assert.deepEqual(trace, { actions: [], choreography: [] }, 'disabled run never starts authored action/choreography');
  return { before, paid, trace, turn: await page.evaluate(() => window.__combat.turn) };
}
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    let baseline;
    for (const enabled of [true, false]) {
      const page = await open('core', enabled, viewport);
      await painted(page, '.combatant.player .sprite');
      const initial = await geometry(page);
      if (enabled) baseline = initial; else assert.deepEqual(initial, baseline, 'animation JSON never changes target geometry');
      assert.equal(await page.evaluate(() => window.__combatRunForShot.gameProfile.modules.animation.enabled), enabled);
      await page.screenshot({ path: resolve(out, `core-${enabled ? 'on' : 'off'}-${viewport.width}x${viewport.height}.png`) });
      const result = await play(page, enabled);
      evidence.scenes.push({ profile: 'core', enabled, viewport, initial, result });
      await page.close(); active = null;
    }
  }
  // Current's legacy foundation consumes the same author override; Classic
  // retains its own stage geometry instead of selecting a still-only factory.
  for (const classic of [false, true]) {
    let baseline;
    for (const enabled of [true, false]) {
      const page = await open('current', enabled, { width: 1440, height: 900 }, 'combat', classic);
      await painted(page, '.combatant.player .sprite');
      const initial = await geometry(page);
      if (enabled) baseline = initial; else assert.deepEqual(initial, baseline);
      const result = await play(page, enabled);
      evidence.scenes.push({ profile: 'current', classic, enabled, initial, result });
      await page.close(); active = null;
    }
  }
  for (const enabled of [true, false]) {
    const page = await open('core', enabled, { width: 1440, height: 900 }, 'rest');
    await page.locator('#strategize-opt').click();
    const rows = page.locator('[data-pane="collection"] .deck-editor-main');
    await rows.filter({ hasText: /Strike/i }).first().click();
    await page.locator('input[data-focus-key="preview:animation"]').check();
    const stage = page.locator('.deck-editor-animation [data-animation-set]');
    await stage.waitFor();
    await painted(page, '.deck-editor-animation-stage');
    const toggle = page.locator('.deck-editor-animation-toggle');
    assert.equal(await toggle.isDisabled(), !enabled);
    const poses = new Set();
    for (let i = 0; i < 20; i++) { poses.add(await stage.getAttribute('data-pose')); await page.waitForTimeout(50); }
    if (enabled) assert.ok(poses.size > 1, 'Reading Desk actually plays its authored sequence');
    else assert.equal(poses.size, 1, 'disabled Reading Desk retains one painted resting figure');
    await page.screenshot({ path: resolve(out, `reading-desk-${enabled ? 'on' : 'off'}.png`) });
    evidence.scenes.push({ scene: 'reading-desk', enabled, poses: [...poses], dimensions: await stage.boundingBox() });
    await page.locator('#deck-editor-cancel').click();
    await page.locator('#strategize-opt').waitFor();
    await page.close(); active = null;
  }
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(evidence.artFailures, []);
  writeFileSync(resolve(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(`PASS animation module browser: ${evidence.scenes.length} scenes; four sizes, on/off geometry, actual targeting/payment/End Turn, Current/Classic and Reading Desk.`);
} catch (error) {
  evidence.failure = { message: error.message, stack: error.stack, url: active?.url() };
  if (active && !active.isClosed()) { evidence.failure.state = await active.evaluate(() => ({ combat: window.__combat && { phase: window.__combat.phase, turn: window.__combat.turn, result: window.__combat.result, pendingReaction: window.__combat.pendingReaction }, trace: window.__motionTrace, buttons: [...document.querySelectorAll('button')].map(node => ({ text: node.textContent, disabled: node.disabled })) })).catch(() => null); await active.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {}); }
  writeFileSync(resolve(out, 'failure.json'), JSON.stringify(evidence, null, 2));
  throw error;
} finally { await browser.close(); await new Promise(done => server.server.close(done)); }
