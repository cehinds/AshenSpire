#!/usr/bin/env node
// Focused real-Chromium verification of character creation's stats step.
//
// RE-TAUGHT FOR THE WORKSPACE AND THE LEAN SCALE (2026-09-25). This tool used
// to walk the old `.cz-flow` fold (four top-level sections) and pick the
// retired 'standard' / 'pointbuy' modes on a baseline-10 scale; the screen has
// been a W1 workspace (a Class / Character / Equipment / Review rail) since
// 2026-09-19 and its modes are Standard (`lean`, the class preset) and Assign
// points (`assign`, every stat at its baseline with a pool to place). So it
// died at its first wait and checked nothing. What it reads now:
//
//   * the rail's four categories, and every class on the Class stage;
//   * the mode select offers exactly the configured creation modes;
//   * Standard seats each class's own preset (model/attributes.js
//     classAttributePreset), and the resource strip's Hand and Draw chips are
//     the hand a SOLO fight of that class deals (model/statProjection.js
//     handResourceRows, read through model/handRules.js classHandRules (the class's own openingHand row) — the
//     door engine/runCombat.js snapshots) — the legacy derived Draw row is
//     replaced, not joined;
//   * the class's primary stat card states the opening-hand effect;
//   * Assign points opens on the mode's baseline with its whole pool, and
//     spending the pool on the primary stat moves the Hand chip to the number
//     the rules give;
//   * nothing scrolls sideways, at desktop and phone widths.
//
// Every expected number is computed HERE from the same modules the screen
// reads, never typed in, so a retuned preset or hand rule moves both sides.
// It never presses Cancel in the Assign points dialog: that flow has its own
// owner and its own checks.
//
//   node tools/character-creation-check.mjs [outDir]    (CHROME=… to pick a browser)

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { classAttributePreset, creationMode, orderedAttributes } from '../src/model/attributes.js';
import { classRuleRow, ruleWeights } from '../src/model/derivedStats.js';
import { handResourceRows } from '../src/model/statProjection.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'outputs'));
const registries = createRegistries(contentBundle);
const CLASSES = registries.classes.all().map((cls) => cls.id);
const MODES = { standard: 'lean', assign: 'assign' };
// A `?shot=customize` boot runs on a fresh profile, so Settings are `{}`.
const expectedHand = (classId, attributes) => {
  const rows = handResourceRows(registries, { class: classId, attributes }, {});
  const value = (id) => rows.find((row) => row.id === id).value;
  return { opening: value('openingHand'), turn: value('draw') };
};

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const handlers = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const pair = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) pair.reject(new Error(message.error.message)); else pair.resolve(message.result);
    } else if (message.method && handlers.has(message.method)) handlers.get(message.method)(message.params, message.sessionId);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady);
      ws.addEventListener('error', rejectReady);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveSend, rejectSend) => {
        pending.set(id, { resolve: resolveSend, reject: rejectSend });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    on(method, handler) { handlers.set(method, handler); },
    close() { ws.close(); },
  };
}

const server = await serve({ root: ROOT, port: 8391, open: false });
const browser = await launchBrowser({ prefix: 'character-creation-', browser: process.env.CHROME || null, timeoutMs: 15000 });
const cdp = connectCdp(browser.wsUrl);
await cdp.ready;
mkdirSync(OUT, { recursive: true });

let failures = 0;
let checks = 0;
const assert = (condition, message) => {
  checks += 1;
  if (condition) console.log(`PASS ${message}`);
  else { failures += 1; console.log(`FAIL ${message}`); }
};

async function exercise(width, height, screenshotName) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 }, sessionId);
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (params, sourceSession) => {
    if (sourceSession !== sessionId) return;
    const detail = params && params.exceptionDetails;
    errors.push((detail && (detail.exception && detail.exception.description || detail.text)) || 'runtime exception');
  });
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label, timeout = 15000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  // A real pointer press at the control's centre, so a control covered by
  // something else is a failure rather than a silent `element.click()`.
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',inline:'center'})`);
    await wait(80);
    const point = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing selector ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await wait(120);
  };
  const chooseMode = (modeId) => evaluate(`(() => { const s=document.querySelector('#cz-statedit .cc-mode-select'); s.value=${JSON.stringify(modeId)}; s.dispatchEvent(new Event('change',{bubbles:true})); return s.value; })()`);
  // OPEN MEANS OPEN, NOT TOGGLE: the Primary Stats fold is a <details>.
  const openPrimary = async () => {
    if (await evaluate(`document.querySelector('[data-face="primary"]')?.closest('details')?.open === true`)) return;
    await click('[data-face="primary"]');
  };
  const shown = () => evaluate(`(() => ({
    stats:Object.fromEntries([...document.querySelectorAll('#cz-primary-stats .cc-attribute-card')].map(c=>[c.dataset.stat, Number(c.querySelector('.as-status')?.textContent)])),
    summaries:Object.fromEntries([...document.querySelectorAll('#cz-primary-stats .cc-attribute-card')].map(c=>[c.dataset.stat, c.querySelector('.disc-summary')?.textContent.trim()])),
    chips:Object.fromEntries([...document.querySelectorAll('#cz-derived .as-chip[data-stat]')].map(c=>[c.dataset.stat, {key:c.querySelector('.ck')?.textContent, value:Number(c.querySelector('.cv')?.textContent), formula:c.dataset.formula||''}])),
  }))()`);
  const noOverflow = () => evaluate(`(() => {
    const root=document.querySelector('.screen.customize');
    const scrollers=[root,...root.querySelectorAll('*')].filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowX));
    return root.scrollWidth<=root.clientWidth+1 && scrollers.every(e=>e.scrollWidth<=e.clientWidth+1);
  })()`);
  const at = `${width}x${height}`;

  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=customize` }, sessionId);
  await until(`document.querySelectorAll('.cz-tab').length===4 && !!document.querySelector('#cz-classes .cz-class')`, 'the creation workspace', 60000);
  await wait(250);

  const rail = await evaluate(`[...document.querySelectorAll('.cz-tab')].map(e=>e.id)`);
  assert(JSON.stringify(rail) === JSON.stringify(['cz-tab-class', 'cz-tab-character', 'cz-tab-equipment', 'cz-tab-review']),
    `${at}: the rail lists Class, Character, Equipment and Review (${JSON.stringify(rail)})`);
  const offered = await evaluate(`[...document.querySelectorAll('#cz-classes .cz-class')].map(e=>e.dataset.class)`);
  assert(CLASSES.every((id) => offered.includes(id)), `${at}: every class is offered (${JSON.stringify(offered)})`);

  for (const classId of CLASSES) {
    // Back, not the rail: a phone folds the rail into a category selector,
    // and the footer's Back steps from Character to Class at every width.
    if (!(await evaluate(`!!document.querySelector('#cz-classes .cz-class')`))) await click('#cz-back');
    await until(`!!document.querySelector('#cz-classes .cz-class[data-class="${classId}"]')`, `${classId} on the Class stage`);
    await click(`#cz-classes .cz-class[data-class="${classId}"]`);
    await click('#cz-next');
    await until(`!!document.querySelector('#cz-statedit .cc-mode-select')`, `${classId}: the Character stage`);
    await openPrimary();

    const options = await evaluate(`[...document.querySelectorAll('#cz-statedit .cc-mode-select option')].filter(o=>o.value).map(o=>o.value+':'+o.textContent.trim())`);
    const expectedOptions = Object.values(MODES).map((id) => `${id}:${creationMode(registries, id).label}`);
    assert(JSON.stringify(options) === JSON.stringify(expectedOptions), `${at} ${classId}: the mode select offers Standard and Assign points (${JSON.stringify(options)})`);

    await chooseMode(MODES.standard);
    await until(`document.querySelectorAll('#cz-primary-stats .cc-attribute-card').length===${orderedAttributes(registries).length}`, `${classId}: Standard stat cards`);
    const preset = classAttributePreset(registries, classId, MODES.standard);
    const hand = expectedHand(classId, preset);
    const primaryStat = ruleWeights(classRuleRow(registries.derivedStatRules, classId, 'openingHand'))[0][0];
    const standard = await shown();
    assert(JSON.stringify(standard.stats) === JSON.stringify(preset), `${at} ${classId}: Standard seats the class preset (${JSON.stringify(standard.stats)})`);
    assert(standard.chips.openingHand?.key === 'Hand' && standard.chips.openingHand.value === hand.opening,
      `${at} ${classId}: the Hand chip is the solo opening hand, ${hand.opening} (${JSON.stringify(standard.chips.openingHand)})`);
    assert(standard.chips.draw?.key === 'Draw' && standard.chips.draw.value === hand.turn,
      `${at} ${classId}: the Draw chip is the solo turn draw, ${hand.turn} (${JSON.stringify(standard.chips.draw)})`);
    assert(standard.chips.draw?.formula.startsWith('Each turn:'), `${at} ${classId}: the Draw chip is the hand rules' turn draw, not the co-op derived row`);
    assert(standard.chips.openingHand?.formula.startsWith('Opening hand:') && standard.chips.openingHand.formula.endsWith(`= ${hand.opening}`),
      `${at} ${classId}: the Hand chip's tooltip carries its arithmetic`);
    assert(/Opening hand per/.test(standard.summaries[primaryStat] || ''),
      `${at} ${classId}: the ${primaryStat} card states the opening-hand effect (${standard.summaries[primaryStat]})`);
    assert(Object.entries(standard.summaries).every(([id, text]) => id === primaryStat || !/Opening hand/.test(text || '')),
      `${at} ${classId}: only the class's own attribute claims the opening hand`);
    if (classId === 'starseer') {
      await evaluate(`document.querySelector('#cz-derived')?.scrollIntoView({block:'center'})`);
      await wait(150);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      writeFileSync(join(OUT, screenshotName.replace('.png', '-standard-starseer.png')), Buffer.from(shot.data, 'base64'));
    }

    // ASSIGN POINTS: the mode's baseline everywhere and its whole pool to place.
    const assign = creationMode(registries, MODES.assign);
    await chooseMode(MODES.assign);
    await until(`!!document.querySelector('.cc-stat-overlay')`, `${classId}: the Assign points dialog`);
    const opened = await evaluate(`(() => ({
      values:[...document.querySelectorAll('.cc-stat-overlay .se-value')].map(e=>Number(e.textContent)),
      pool:Number(document.querySelector('.cc-stat-overlay .se-pool .sp-v')?.textContent),
      steps:document.querySelectorAll('.cc-stat-overlay .se-step').length,
    }))()`);
    assert(opened.values.length === orderedAttributes(registries).length && opened.values.every((v) => v === assign.baseline)
      && opened.pool === assign.bonusPool && opened.steps === opened.values.length * 2,
    `${at} ${classId}: Assign points opens on baseline ${assign.baseline} with ${assign.bonusPool} points (${JSON.stringify(opened)})`);
    const spend = Math.min(assign.bonusPool, assign.maximum - assign.baseline);
    for (let i = 0; i < spend; i += 1) await click(`.cc-stat-overlay .se-step[data-stat-id="${primaryStat}"][data-stat-action="increase"]`);
    const left = await evaluate(`Number(document.querySelector('.cc-stat-overlay .se-pool .sp-v')?.textContent)`);
    assert(left === assign.bonusPool - spend, `${at} ${classId}: each + spends one point (${left} left)`);
    // Whatever the pool still holds goes to Constitution, so Continue accepts.
    for (let i = 0; i < left; i += 1) await click(`.cc-stat-overlay .se-step[data-stat-id="constitution"][data-stat-action="increase"]`);
    await click('.cc-stat-overlay .modal-foot .as-btn.primary');
    await until(`!document.querySelector('.cc-stat-overlay')`, `${classId}: the Assign points dialog closes on Continue`);
    const spent = Object.fromEntries(orderedAttributes(registries).map((def) => [def.id, assign.baseline]));
    spent[primaryStat] += spend;
    spent.constitution += left;
    const assigned = await shown();
    const assignedHand = expectedHand(classId, spent);
    assert(JSON.stringify(assigned.stats) === JSON.stringify(spent), `${at} ${classId}: the committed allocation is on the cards (${JSON.stringify(assigned.stats)})`);
    assert(assigned.chips.openingHand?.value === assignedHand.opening,
      `${at} ${classId}: after Assign points the Hand chip follows the allocation, ${assignedHand.opening} (${assigned.chips.openingHand?.value})`);
    assert(await noOverflow(), `${at} ${classId}: nothing scrolls sideways`);
  }

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(OUT, screenshotName), Buffer.from(shot.data, 'base64'));
  assert(errors.length === 0, `${at}: no runtime exceptions${errors.length ? ` (${errors.join(' | ')})` : ''}`);
  await cdp.send('Target.closeTarget', { targetId });
}

try {
  await exercise(1440, 1024, 'character-creation-desktop.png');
  await exercise(390, 844, 'character-creation-mobile.png');
} catch (error) {
  failures += 1;
  console.error(`FAIL browser harness: ${error.stack || error.message}`);
} finally {
  cdp.close();
  await browser.close();
  await new Promise((resolveClose) => server.server.close(resolveClose));
}

console.log(`character-creation-check: ${checks - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
