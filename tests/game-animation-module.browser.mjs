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
const selectedCase = process.env.ANIMATION_MODULE_CASE || 'full';
assert.ok(['full', 'current', 'reading'].includes(selectedCase), 'ANIMATION_MODULE_CASE must be full, current or reading');
const evidence = { selectedCase, head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scenes: [], errors: [], artFailures: [], optionalAudioFallbacks: [] };
let active;
const author = (profile, enabled) => JSON.stringify({ formatVersion: 1, core: `ashen.${profile}@1.0.0`, modules: { animation: { enabled } } });
async function open(profile, enabled, viewport, scene = 'combat', classic = false) {
  const page = active = await browser.newPage({ viewport, hasTouch: viewport.width < 600 });
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => evidence.errors.push(error.message));
  page.on('response', response => {
    if (response.status() < 400) return;
    const failure = { status: response.status(), url: response.url() };
    // audio.js deliberately probes optional samples and synthesizes absent ones.
    if (/\/assets\/sfx\/.*\.ogg$/.test(response.url())) evidence.optionalAudioFallbacks.push(failure);
    else if (/\/(assets|assets-mobile|assets-display)\/.*\.(?:webp|png|jpg|jpeg|svg)(?:\?|$)/i.test(response.url())) evidence.artFailures.push(failure);
  });
  const query = new URLSearchParams({ shot: scene, shotSeed: '3', gameProfile: author(profile, enabled), shotSettings: JSON.stringify({ classicAppearance: classic }), shotHand: '5' });
  await page.goto(`${server.url}index.html?${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator(scene === 'combat' ? '.combatant.player .sprite' : '#strategize-opt').waitFor();
  return page;
}
async function painted(page, selector) {
  await page.waitForFunction(async selector => {
    const node = document.querySelector(selector);
    if (!node || node.querySelector('[data-art-placeholder]') || node.querySelector('[data-art-error]')) return false;
    const canvases = [...node.querySelectorAll('canvas')];
    if (canvases.length) return canvases.some(canvas => {
      const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      return data?.some((value, i) => i % 4 === 3 && value > 0);
    });
    const visible = element => {
      if (!element.getClientRects().length) return false;
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (current.hidden || style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    // Painted stages retain hidden defeated art and an initially empty,
    // display:none crossfade buffer. Verify the image actually being drawn.
    const images = [...node.querySelectorAll('img')].filter(visible);
    if (!images.length || images.some(image => !image.complete || image.naturalWidth <= 0)) return false;
    try { await Promise.all(images.map(image => image.decode())); return true; } catch { return false; }
  }, selector);
}
async function geometry(page) {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.evaluate(async () => {
    await document.fonts.ready;
    const { stageFor } = await import('/src/ui/services/PoseAnimator.js');
    await Promise.all([...document.querySelectorAll('.combatant .sprite')].map(node => stageFor(node)?.ready));
    delete window.__spriteGeometryReadiness;
  });
  // Entry transitions and font-driven reflow can move the whole battlefield.
  // Require unchanged real target rectangles for eight consecutive frames,
  // with no finite animation still moving a target or one of its ancestors.
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('.combatant .sprite')];
    if (!nodes.length) return false;
    const ancestors = new Set();
    for (const node of nodes) for (let parent = node; parent; parent = parent.parentElement) ancestors.add(parent);
    const entering = [...ancestors].some(node => node.getAnimations().some(animation =>
      ['running', 'pending'].includes(animation.playState) && Number.isFinite(animation.effect?.getComputedTiming().endTime)));
    const value = JSON.stringify(nodes.map(node => ({ id: node.closest('[data-eid]').dataset.eid, box: node.getBoundingClientRect().toJSON() })));
    const previous = window.__spriteGeometryReadiness;
    const frames = !entering && previous?.value === value ? previous.frames + 1 : 0;
    window.__spriteGeometryReadiness = { value, frames, entering };
    return frames >= 8;
  }, null, { polling: 'raf' });
  return page.locator('.combatant .sprite').evaluateAll(nodes => nodes.map(node => ({ id: node.closest('[data-eid]').dataset.eid, box: node.getBoundingClientRect().toJSON() })));
}
async function watch(page) {
  await page.evaluate(async () => {
    const { stageFor } = await import('/src/ui/services/PoseAnimator.js');
    window.__motionTrace = { actions: [], choreography: [], bodyTransitions: [] };
    window.__motionWatch = setInterval(() => {
      for (const node of document.querySelectorAll('.combatant .sprite')) {
        const presentation = stageFor(node)?.presentation;
        const action = presentation?.action;
        const transition = presentation?.transition || node.querySelector('[data-pose-transition]:not([data-pose-transition=""])')?.dataset.poseTransition;
        if (transition) window.__motionTrace.bodyTransitions.push(transition);
        if (action) window.__motionTrace.actions.push(action);
        if (node.matches('.act-attack,.act-move,.enemy-attack-pose')) window.__motionTrace.choreography.push(node.className);
      }
    }, 5);
  });
}
async function play(page, enabled) {
  await painted(page, '.combatant.player .sprite');
  const before = await page.evaluate(() => ({ hp: window.__combat.enemies[0].hp, targetId: window.__combat.enemies[0].id, energy: window.__combat.player.energy, stamina: window.__combat.player.stamina, turn: window.__combat.turn, eventIndex: window.__combat.eventLog.length, legacy: window.__combatRunForShot.gameProfile.foundation.mode === 'legacy' }));
  await watch(page);
  const strike = page.locator('.hand .card[data-card-id$="strike"]').first();
  const instanceId = await strike.getAttribute('data-instance-id');
  const card = await strike.boundingBox();
  assert.ok(card);
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
  // Classic's sprite rectangle includes empty formation space and its
  // independent target buttons can sit outside the combatant. Probe a bounded
  // set of real pointer locations, requiring the intended enemy's exact ID.
  const point = await page.evaluate(targetId => {
    const sprite = document.querySelector(`.combatant.enemy[data-eid="${CSS.escape(targetId)}"] .sprite`);
    const picker = document.querySelector(`.enemy-target-button[data-eid="${CSS.escape(targetId)}"]:not(:disabled)`);
    for (const node of [sprite, picker]) {
      if (!node || !node.getClientRects().length) continue;
      const box = node.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) continue;
      for (const [fx, fy] of [[.5, .5], [.5, .25], [.5, .75], [.25, .5], [.75, .5], [.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
        const x = box.x + box.width * fx, y = box.y + box.height * fy;
        const hit = document.elementFromPoint(x, y);
        const proxy = hit?.closest('.enemy-target-button');
        const enemy = hit?.closest('.combatant.enemy');
        if ((proxy && !proxy.disabled && proxy.dataset.eid === targetId)
          || (enemy?.dataset.eid === targetId && !hit.closest('button'))) return { x, y };
      }
    }
    return null;
  }, before.targetId);
  assert.ok(point, 'the intended enemy has a real hittable figure or target button');
  if (page.viewportSize().width < 600) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.waitForFunction(({ eventIndex, instanceId }) => window.__combat.eventLog.slice(eventIndex).some(event => event.type === 'cardResolved' && event.cardInstanceId === instanceId), { eventIndex: before.eventIndex, instanceId });
  const action = await page.evaluate(({ eventIndex, targetId }) => ({ hp: window.__combat.enemies.find(enemy => enemy.id === targetId).hp, receipts: window.__combat.eventLog.slice(eventIndex).map(event => Object.fromEntries(Object.entries(event).filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value)))) }), before);
  for (const type of ['cardPlayed', 'cardResolved']) assert.ok(action.receipts.some(event => event.type === type && event.cardInstanceId === instanceId && event.targetId === before.targetId), `${type} belongs to the selected card and real clicked target`);
  if (before.legacy) {
    // Current's seed-3 first enemy is at reach distance. Its melee Strike
    // deliberately misses, pays once and resolves; animation policy cannot
    // turn that authored outcome into damage. Core's fixture below hits.
    const miss = action.receipts.find(event => event.type === 'attackMissed' && event.sourceId === 'player' && event.targetId === before.targetId);
    assert.ok(miss, 'Current fixture emits the expected range miss');
    assert.equal(miss.missReason, 'range'); assert.equal(miss.inRange, false); assert.equal(miss.hitChance, 0);
    assert.equal(action.hp, before.hp, 'a range miss never damages the target');
    assert.deepEqual(action.receipts.filter(event => ['energySpent', 'staminaSpent'].includes(event.type)).map(event => [event.type, event.amount]), [['energySpent', 1], ['staminaSpent', 1]]);
  } else assert.ok(action.hp < before.hp, 'Core fixture damages the real clicked target');
  await page.waitForFunction(() => !document.querySelector('.end-turn')?.disabled);
  const paid = await page.evaluate(() => ({ energy: window.__combat.player.energy, stamina: window.__combat.player.stamina }));
  assert.ok(paid.energy < before.energy || paid.stamina < before.stamina, 'UI play pays normally');
  await page.locator('.end-turn').click();
  await page.locator('.confirmation-confirm').click();
  const reactionAnswers = [];
  const deadline = Date.now() + 30000;
  while (true) {
    assert.ok(Date.now() < deadline, 'enemy turn finishes within the bounded reaction-response window');
    await page.waitForFunction(turn => (window.__combat.turn > turn && !document.querySelector('.end-turn')?.disabled)
      || (window.__combat.pendingReaction && document.querySelector('.reaction-choice .modal-foot button[data-control-role="exit"]')), before.turn, { timeout: Math.max(1, deadline - Date.now()) });
    const pending = await page.evaluate(() => window.__combat.pendingReaction && { offerId: window.__combat.pendingReaction.id, sourceId: window.__combat.pendingReaction.sourceId, ownerId: window.__combat.pendingReaction.ownerId });
    if (!pending) break;
    assert.ok(reactionAnswers.length < 8, 'fixture opens at most eight real reaction offers');
    assert.ok(!reactionAnswers.some(answer => answer.offerId === pending.offerId), 'each reaction offer is answered once');
    // This fixture deliberately takes no optional reaction. Use the modal's
    // actual Back/Resolve footer control; never dispatch or alter model state.
    const decline = page.locator('.reaction-choice .modal-foot button[data-control-role="exit"]');
    assert.match((await decline.innerText()).trim(), /^(Back|Resolve)$/);
    await decline.click();
    await page.waitForFunction(offerId => window.__combat.eventLog.some(event => event.type === 'combatReactionChosen' && event.offerId === offerId && event.cardInstanceId === null), pending.offerId);
    reactionAnswers.push({ ...pending, response: 'pass' });
  }
  if (before.legacy) assert.ok(reactionAnswers.length > 0, 'Current fixture exercises the real optional reaction prompt');
  const trace = await page.evaluate(() => { clearInterval(window.__motionWatch); return window.__motionTrace; });
  if (enabled) assert.ok(trace.actions.length || trace.choreography.length, 'enabled run shows actual action motion');
  else assert.deepEqual(trace, { actions: [], choreography: [], bodyTransitions: [] }, 'disabled run never starts authored action, choreography or body transitions');
  const outcome = await page.evaluate(eventIndex => {
    const combat = window.__combat;
    const resources = entity => Object.fromEntries(['id', 'hp', 'mana', 'stamina', 'energy', 'block', 'barrier', 'alive', 'formationCell', 'statuses', 'persistentWard', 'persistentPoise'].filter(key => entity[key] !== undefined).map(key => [key, entity[key]]));
    return { player: resources(combat.player), enemies: combat.enemies.map(resources), turn: combat.turn, phase: combat.phase, result: combat.result, rng: combat.rng.getCounters(), receipts: combat.eventLog.slice(eventIndex).map(event => Object.fromEntries(Object.entries(event).filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value)))) };
  }, before.eventIndex);
  return { before, paid, action, reactionAnswers, trace, outcome };
}
try {
  for (const viewport of (selectedCase !== 'full' ? [] : [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 768, height: 1024 }])) {
    let baseline, baselineOutcome;
    for (const enabled of [true, false]) {
      const page = await open('core', enabled, viewport);
      await painted(page, '.combatant.player .sprite');
      const initial = await geometry(page);
      if (enabled) baseline = initial; else assert.deepEqual(initial, baseline, 'animation JSON never changes target geometry');
      assert.equal(await page.evaluate(() => window.__combatRunForShot.gameProfile.modules.animation.enabled), enabled);
      await page.screenshot({ path: resolve(out, `core-${enabled ? 'on' : 'off'}-${viewport.width}x${viewport.height}.png`) });
      const result = await play(page, enabled);
      if (enabled) baselineOutcome = result.outcome; else assert.deepEqual(result.outcome, baselineOutcome, 'on/off preserves real browser combat outcome, resources, RNG and ordered receipts');
      evidence.scenes.push({ profile: 'core', enabled, viewport, initial, result });
      await page.close(); active = null;
    }
  }
  // Current's legacy foundation consumes the same author override; Classic
  // retains its own stage geometry instead of selecting a still-only factory.
  for (const classic of (selectedCase === 'reading' ? [] : [false, true])) {
    let baseline, baselineOutcome;
    for (const enabled of [true, false]) {
      const page = await open('current', enabled, { width: 1440, height: 900 }, 'combat', classic);
      await painted(page, '.combatant.player .sprite');
      const initial = await geometry(page);
      if (enabled) baseline = initial; else assert.deepEqual(initial, baseline);
      const result = await play(page, enabled);
      if (enabled) baselineOutcome = result.outcome; else assert.deepEqual(result.outcome, baselineOutcome, 'on/off preserves real browser combat outcome, resources, RNG and ordered receipts');
      evidence.scenes.push({ profile: 'current', classic, enabled, initial, result });
      await page.close(); active = null;
    }
  }
  for (const enabled of (selectedCase === 'current' ? [] : [true, false])) {
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
  console.log(`PASS animation module browser (${selectedCase}): ${evidence.scenes.length} scenes; on/off geometry/outcome parity, real targeting/payment/End Turn; Core hits and Current expected range misses.`);
} catch (error) {
  evidence.failure = { message: error.message, stack: error.stack, url: active?.url() };
  if (active && !active.isClosed()) { evidence.failure.state = await active.evaluate(() => ({ combat: window.__combat && { phase: window.__combat.phase, turn: window.__combat.turn, result: window.__combat.result, pendingReaction: window.__combat.pendingReaction, player: window.__combat.player, enemies: window.__combat.enemies, eventLog: window.__combat.eventLog }, trace: window.__motionTrace, domEnemyOrder: [...document.querySelectorAll('.combatant.enemy')].map(node => node.dataset.eid), buttons: [...document.querySelectorAll('button')].map(node => ({ text: node.textContent, disabled: node.disabled })) })).catch(() => null); await active.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {}); }
  writeFileSync(resolve(out, 'failure.json'), JSON.stringify(evidence, null, 2));
  throw error;
} finally { await browser.close(); await new Promise(done => server.server.close(done)); }
