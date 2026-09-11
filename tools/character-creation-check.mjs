#!/usr/bin/env node
// Focused real-Chromium verification for the character-creation redesign.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

// EVERY CREATION DISCLOSURE IS A `<details>` STRUCTURE, so a face is a
// `<summary>`, not a button in a `.disc-faces` row. `mountDisclosure(...,
// { structure: 'details' })` is what the creation screen passes everywhere
// now, and `mountDetailsDisclosure` shapes it two ways: a multi-row fold
// wraps each row in a plain `div`, a single-row fold does not. This tool
// died at its FIRST wait for weeks because it still looked for
// `.disc-faces > .disc-face` — a selector for a structure the screen had
// stopped using, which reads as "creation never mounted" rather than "the
// gate is looking in the wrong place". Bound to depth, never a descendant
// search: the faces of a nested fold live INSIDE an outer fold's panel, and
// a loose selector would count them as the outer fold's own.
const faces = (host, suffix = '') => [
  `${host} > details.disc-fold-row > summary.disc-face${suffix}`,
  `${host} > div > details.disc-fold-row > summary.disc-face${suffix}`,
].join(', ');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'outputs'));
const browserCandidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);
if (!browserPath) {
  console.error('character-creation-check: no Chrome/Edge found; set CHROME');
  process.exit(2);
}

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
const browser = await launchBrowser({ prefix: 'character-creation-', browser: browserPath, timeoutMs: 15000 });
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

async function exercise(width, height, screenshotName, screenshotSection, profileMeta = null) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
  }, sessionId);
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
  const until = async (expression, label, timeout = 15000, required = true) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression).catch(() => false)) return true;
      await wait(100);
    }
    if (!required) return false;
    throw new Error(`timeout waiting for ${label}`);
  };
  const click = async (selector, index = 0) => {
    await evaluate(`(() => { const e=document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!e) return false; e.scrollIntoView({block:'center',inline:'center'}); return true; })()`);
    await wait(80);
    const point = await evaluate(`(() => { const e = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!e) return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing selector ${selector}[${index}]`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await wait(100);
  };
  const setInput = async (selector, value) => evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); e.value=${JSON.stringify(value)}; e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:${JSON.stringify(value)}})); e.dispatchEvent(new Event('change',{bubbles:true})); return e.value; })()`);
  // OPEN MEANS OPEN, NOT TOGGLE. A face is a `<summary>` whose click toggles,
  // and the folds keep their own state: a top-level section closing does not
  // close the pickers nested inside it. So a second `open('primary')` on an
  // already-open picker CLOSED it, and every later click aimed into that
  // panel then landed on a 0px-tall control — which is why the gate reported
  // "the selection did not persist" and "Begin refuses" for choices it had
  // never actually made. Checking before clicking makes each call mean what
  // its name says, whatever the fold was doing beforehand.
  const open = async (key) => {
    const already = await evaluate(`document.querySelector('[data-face="${key}"]')?.getAttribute('aria-expanded') === 'true'`).catch(() => false);
    if (already) return;
    await click(`[data-face="${key}"]`);
  };
  // The property is "nothing scrolls sideways": the root and every element
  // that CAN scroll (overflow-x auto/scroll). An element clipped by design
  // (overflow: hidden — a card's tag strip, an info button's glyph box) never
  // scrolls and never widens the page, so it is not asked. It used to be, and
  // the gated flow (2026-09-11) opens the armour section on arrival, which put
  // those by-design clips in front of this reader for the first time.
  const noOverflow = () => evaluate(`(() => {
    const root=document.querySelector('.customize');
    const scrollers=[root,...root.querySelectorAll('*')].filter(e=>['auto','scroll'].includes(getComputedStyle(e).overflowX));
    return root.scrollWidth<=root.clientWidth+1 && scrollers.every(e=>e.scrollWidth<=e.clientWidth+1);
  })()`);

  if (profileMeta) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.clear(); localStorage.setItem('sote_meta_v1', ${JSON.stringify(JSON.stringify(profileMeta))});`,
    }, sessionId);
  }

  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/${profileMeta ? '' : '?shot=customize'}` }, sessionId);
  if (profileMeta) {
    await until(`!!document.querySelector('.startup-gate') || !!document.querySelector('.slot-new')`, 'startup gate or title screen for veteran profile', 60000);
    if (await evaluate(`!!document.querySelector('.startup-gate')`)) await click('.startup-gate');
    await until(`!!document.querySelector('.slot-new')`, 'title screen for veteran profile');
    await click('.slot-new');
    await until(`!!document.querySelector('.title-menu-modal [data-title-action="modal-continue"]:not([disabled])')`, 'new-run slot selection');
    await click('.title-menu-modal [data-title-action="modal-continue"]');
    await until(`!!document.querySelector('.title-menu-modal [data-title-action="review-new"]:not([disabled])')`, 'new-run confirmation');
    await click('.title-menu-modal [data-title-action="review-new"]');
  }
  await until(`document.querySelectorAll(${JSON.stringify(faces('.cz-flow'))}).length===4`, 'four creation sections');
  await wait(250);
  const arrival = await evaluate(`(() => ({
    labels:[...document.querySelectorAll(${JSON.stringify(faces('.cz-flow', ' .disc-name'))})].map(e=>e.textContent.trim()),
    open:[...document.querySelectorAll(${JSON.stringify(faces('.cz-flow', '[aria-expanded="true"]'))})].map(e=>e.dataset.face)
  }))()`);
  assert(JSON.stringify(arrival.labels) === JSON.stringify(['CLASS', 'CHARACTER', 'STARTING EQUIP', 'SEED']), `${width}x${height}: sections are in the requested order`);
  assert(JSON.stringify(arrival.open) === JSON.stringify(['class']), `${width}x${height}: exactly Class opens on arrival`);
  // THE FLOW IS GATED (2026-09-11): no class is chosen on arrival, and every
  // later step's Continue waits for the one before it. The exercise below
  // reads Reaver's kit, so Reaver is chosen here as a player would.
  assert((await evaluate(`document.querySelectorAll('#cz-classes .cz-class.chosen').length`)) === 0, `${width}x${height}: no class is chosen on arrival`);
  assert((await evaluate(`document.querySelector('.cz-next[data-next="character"]').dataset.refusal || ''`)) === 'Choose a class.', `${width}x${height}: Continue to character refuses until a class is chosen`);
  await click('.cz-class[data-class="reaver"]');
  assert((await evaluate(`document.querySelector('.cz-next[data-next="character"]').hasAttribute('aria-disabled')`)) === false, `${width}x${height}: choosing a class readies Continue to character`);
  const classLayout = await evaluate(`(() => ({
    preview:!!document.querySelector('.cc-class-preview'), resources:document.querySelectorAll('.cc-class-resource').length,
    view:document.querySelector('#cz-classes').dataset.view,
    selected:document.querySelector('#cz-class-view-toggle [data-view-mode="list"]').getAttribute('aria-pressed'),
    divider:getComputedStyle(document.querySelector('.cc-class-divider')).display,
    percent:document.querySelector('.cc-class-divider').getAttribute('aria-valuenow')
  }))()`);
  assert(classLayout.preview && classLayout.resources === 5 && classLayout.view === 'list' && classLayout.selected === 'true'
    && classLayout.percent === '30' && (width < 700 ? classLayout.divider === 'none' : classLayout.divider !== 'none'),
  `${width}x${height}: Class uses the configured preview split, five resources, and responsive list selector`);
  if (width >= 700) {
    const dividerAlignment = await evaluate(`(() => {
      const preview = document.querySelector('.cc-class-preview-host').getBoundingClientRect();
      const divider = document.querySelector('.cc-class-divider').getBoundingClientRect();
      const selection = document.querySelector('.cc-class-selection').getBoundingClientRect();
      const gapCenter = (preview.right + selection.left) / 2;
      return Math.abs((divider.left + divider.width / 2) - gapCenter);
    })()`);
    assert(dividerAlignment <= 1, `${width}x${height}: Class resize handle is centered between both panes`);
    const dividerKeys = await evaluate(`(() => {
      const divider = document.querySelector('.cc-class-divider');
      const press = (key) => divider.dispatchEvent(new KeyboardEvent('keydown', {key,bubbles:true}));
      press('ArrowRight'); const arrow = divider.getAttribute('aria-valuenow');
      press('Home'); const home = divider.getAttribute('aria-valuenow');
      press('End'); const end = divider.getAttribute('aria-valuenow');
      press('Home'); for(let i=0;i<4;i+=1) press('ArrowRight');
      return {arrow,home,end,restored:divider.getAttribute('aria-valuenow')};
    })()`);
    assert(dividerKeys.arrow === '32' && dividerKeys.home === '22' && dividerKeys.end === '45' && dividerKeys.restored === '30',
      `${width}x${height}: Class separator supports Arrow, Home, and End keyboard resizing`);
  }
  await click('#cz-class-view-toggle [data-view-mode="grid"]');
  const classGrid = await evaluate(`(() => {
    const host = document.querySelector('#cz-classes');
    const cards = [...host.querySelectorAll('.class-pick')];
    return {
      view: host.dataset.view,
      display: getComputedStyle(host).display,
      sameRow: cards.length > 1 && Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) <= 1,
      overflow: host.scrollWidth > host.clientWidth + 1,
    };
  })()`);
  assert(classGrid.view === 'grid' && classGrid.display === 'grid' && !classGrid.overflow && classGrid.sameRow,
    `${width}x${height}: Class Grid changes the rendered collection geometry (${JSON.stringify(classGrid)})`);
  await click('#cz-class-view-toggle [data-view-mode="list"]');
  assert(await noOverflow(), `${width}x${height}: Class has no horizontal overflow`);

  if ((profileMeta && profileMeta.unlocked || []).includes('winAsReaver')) {
    await open('equipment');
    assert(await evaluate(`!!document.querySelector('#cz-armours [data-starting-armour-id="oathsworn"]')`), `${width}x${height}: profile-earned armour appears beside JSON defaults`);
    // NESTED FOLDS ARE CLOSED UNTIL SOMETHING OPENS THEM, so the option is in
    // the DOM at zero height and a click at its centre lands on whatever is
    // actually there. Opening ARMOUR first is what a player does, and it is
    // the difference between "the selection did not persist" and "the
    // selection was never made".
    await open('armour');
    await click('#cz-armours [data-starting-armour-id="oathsworn"]');
    await open('character');
    await open('equipment');
    await open('armour');
    assert((await evaluate(`document.querySelector('#cz-armours [data-starting-armour-id="oathsworn"]').getAttribute('aria-pressed')`)) === 'true', `${width}x${height}: profile-earned armour selection persists through section changes`);
  }

  await open('character');
  // NOTHING NESTED OPENS ITSELF, and that is the rule rather than a gap: the
  // disclosure's contract is "default folded — his word", and the creation
  // screen opens exactly one thing on arrival (CLASS, at the top level). This
  // row used to demand PRIMARY STATS be open the moment CHARACTER was, which
  // was true of the shared-panel structure's armed face and is not true of the
  // `details` structure the screen mounts now. Asserting the rule instead of
  // the old side effect keeps the coverage and stops three later rows failing
  // for a reason that has nothing to do with what they measure: the stat cards
  // live in that panel, so while it was closed they were 0px tall and every
  // click at their centre landed on whatever was behind them.
  const nestedArrival = await evaluate(
    `[...document.querySelectorAll(${JSON.stringify(faces('#cz-character-fold', '[aria-expanded="true"]'))})].map(e=>e.dataset.face)`,
  );
  assert(nestedArrival.length === 0,
    `${width}x${height}: Character's own pickers all arrive folded (${JSON.stringify(nestedArrival)})`);
  await open('primary');
  // THE FLOW IS GATED (2026-09-11): Primary Stats opens on the Standard /
  // Assign points question alone, and the stat cards appear with the answer.
  await click('#cz-statedit .se-mode[data-creation-mode="standard"]');
  // `faces` reads A NATIVELY ACTIVATABLE FACE, not specifically a <button>:
  // every creation disclosure mounts with structure 'details' now, so each
  // face is the fold's own <summary> — focusable and activatable by keyboard
  // and pointer with no handler of its own, which is the property this row
  // exists to hold. The literal BUTTON it used to demand was a claim about
  // WHICH structure the screen mounts, and it failed the moment the screen
  // mounted the other one.
  const attributeCards = await evaluate(`(() => ({
    count: document.querySelectorAll('#cz-primary-stats [data-face^="attribute:"]').length,
    faces: [...document.querySelectorAll('#cz-primary-stats [data-face^="attribute:"]')].map((card) => card.tagName),
    summaries: [...document.querySelectorAll('#cz-primary-stats [data-face^="attribute:"] .disc-summary')].map((node) => node.textContent.trim()),
  }))()`);
  assert(attributeCards.count === 5 && attributeCards.summaries.length === 5
    && attributeCards.faces.every((tag) => tag === 'SUMMARY' || tag === 'BUTTON'),
    `${width}x${height}: five model-driven attribute cards expose folded summaries (${JSON.stringify(attributeCards)})`);
  await click('#cz-primary-stats [data-face="attribute:strength"]');
  const strengthReveal = await evaluate(`(() => {
    const reveal = document.querySelector('#cz-primary-stats [data-reveal-for="attribute:strength"]');
    // The reveal is the kit's DetailCard since the 2026-09-04 sweep: its title is .dc-name (it was an h4).
    return { shown: !!reveal && !reveal.hidden, title: reveal?.querySelector('.dc-name, h4')?.textContent || '', bullets: reveal?.querySelectorAll('li').length || 0 };
  })()`);
  assert(strengthReveal.shown && strengthReveal.title === 'Strength' && strengthReveal.bullets > 0,
    `${width}x${height}: Strength unfolds beneath its card with model-derived benefits (${JSON.stringify(strengthReveal)})`);
  await evaluate(`document.querySelector('#cz-primary-stats').scrollIntoView({block:'center'})`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }, sessionId);
  await wait(180);
  const attributeShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  writeFileSync(join(OUT, `attribute-cards-${width < 700 ? 'mobile' : 'desktop'}.png`), Buffer.from(attributeShot.data, 'base64'));
  await evaluate(`document.querySelector('#cz-primary-stats [data-face="attribute:dexterity"]').dispatchEvent(new CustomEvent('gpfocus'))`);
  await wait(180);
  assert(await evaluate(`document.querySelector('#tooltip')?.style.display === 'block' && /Dexterity/.test(document.querySelector('#tooltip')?.textContent || '')`),
    `${width}x${height}: folded attributes expose the same description by tooltip`);
  await evaluate(`document.querySelector('#cz-primary-stats [data-face="attribute:dexterity"]').dispatchEvent(new CustomEvent('gpblur'))`);
  // SPRITE LEFT THIS FOLD IN #692, which moved the sprite/sigil/tint group
  // beside the preview instead of nesting it under Character. The row is
  // asserted where it now lives rather than dropped: this check exists so the
  // sprite picker cannot go unreachable, and deleting the SPRITE expectation
  // would have retired that coverage instead of following it.
  const characterFold = await evaluate(`(() => ({
    labels:[...document.querySelectorAll(${JSON.stringify(faces('#cz-character-fold', ' .disc-name'))})].map(e=>e.textContent.trim()),
    open:[...document.querySelectorAll(${JSON.stringify(faces('#cz-character-fold', '[aria-expanded="true"]'))})].map(e=>e.dataset.face),
    previewLabels:[...document.querySelectorAll(${JSON.stringify(faces('#cz-preview-fold', ' .disc-name'))})].map(e=>e.textContent.trim()),
    resourceOrder:[...document.querySelectorAll('#cz-primary-group > *')].map(e=>e.id)
  }))()`);
  assert(JSON.stringify(characterFold.labels) === JSON.stringify(['PRIMARY STATS', 'KEEPSAKE'])
    && JSON.stringify(characterFold.previewLabels) === JSON.stringify(['SPRITE'])
    && JSON.stringify(characterFold.open) === JSON.stringify(['primary'])
    && JSON.stringify(characterFold.resourceOrder.slice(0, 3)) === JSON.stringify(['cz-statedit', 'cz-primary-stats', 'cz-derived']),
  `${width}x${height}: Character nests modes, stats and keepsake one-open, with SPRITE beside the preview`);
  await open('primary');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Reaver Assign Points overlay');
  const refunded = await evaluate(`(() => ({
    remaining:document.querySelector('.cc-stat-overlay .se-pool .sp-v')?.textContent.trim(),
    values:[...document.querySelectorAll('.cc-stat-overlay .se-value')].map((node) => node.textContent.trim()),
    rowInsets:[...document.querySelectorAll('.cc-stat-overlay .se-row')].map((row) => {
      const style=getComputedStyle(row.querySelector('.disc-face > .as-row'));
      return [style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft];
    }),
  }))()`);
  assert(refunded.remaining === '10' && refunded.values.join(',') === '10,10,10,10,10'
    && refunded.rowInsets.every((edges) => edges.every((edge) => parseFloat(edge) > 0)),
  `${width}x${height}: Assign Points refunds to five baseline-10 stats and keeps padding inside every card header (${JSON.stringify(refunded)})`);
  assert((await evaluate(`document.querySelectorAll('.cc-stat-overlay [data-face^="attribute:"]').length`)) === 5,
    `${width}x${height}: Assign Points reuses five foldout attribute cards`);
  const allocationInsets = await evaluate(`[...document.querySelectorAll('.cc-stat-overlay .as-row.setting')].map((row) => {
    const style = getComputedStyle(row.querySelector('.disc-face > .as-row'));
    return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
  })`);
  assert(allocationInsets.length === 5 && allocationInsets.every((insets) =>
    insets.length === 4 && insets.every((value) => parseFloat(value) > 0)),
  `${width}x${height}: every Assign Points card header keeps text padding on all four sides (${JSON.stringify(allocationInsets)})`);
  await click('.cc-stat-overlay [data-face="attribute:strength"]');
  const allocationGeometry = await evaluate(`(() => {
    const row = document.querySelector('.cc-stat-overlay .se-row');
    const face = row?.querySelector('.cc-primary-stat');
    const controls = row?.querySelector('.se-controls');
    const reveal = row?.querySelector('.disc-reveal:not([hidden])');
    const rect = (node) => { const box = node?.getBoundingClientRect(); return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width } : null; };
    const style = row && getComputedStyle(row);
    return { component: row?.dataset.uiComponent || '', row: rect(row), face: rect(face), controls: rect(controls), reveal: rect(reveal),
      inset: style ? {left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight)} : null };
  })()`);
  assert(allocationGeometry.component === 'stat-allocation-row'
      && allocationGeometry.reveal?.left <= allocationGeometry.row.left + allocationGeometry.inset.left + 4
      && allocationGeometry.reveal?.right >= allocationGeometry.row.right - allocationGeometry.inset.right - 4
      && allocationGeometry.controls?.top >= allocationGeometry.face?.top && allocationGeometry.controls?.bottom <= allocationGeometry.face?.bottom && allocationGeometry.controls?.right <= allocationGeometry.face?.right && allocationGeometry.reveal?.top >= allocationGeometry.face?.bottom - 1,
    `${width}x${height}: Assign Points disclosure spans the invisible stat-and-controls parent (${JSON.stringify(allocationGeometry)})`);
  await evaluate(`document.querySelector('.cc-stat-overlay [data-face="attribute:constitution"]').dispatchEvent(new CustomEvent('gpfocus'))`);
  await wait(180);
  assert(await evaluate(`document.querySelector('#tooltip')?.style.display === 'block' && /Constitution/.test(document.querySelector('#tooltip')?.textContent || '')`),
    `${width}x${height}: Assign Points exposes the shared attribute tooltip`);
  await evaluate(`document.querySelector('.cc-stat-overlay [data-face="attribute:constitution"]').dispatchEvent(new CustomEvent('gpblur'))`);
  const allocationShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  writeFileSync(join(OUT, `attribute-assignment-${width < 700 ? 'mobile' : 'desktop'}.png`), Buffer.from(allocationShot.data, 'base64'));
  assert(await evaluate(`(() => { const overlay=document.querySelector('.cc-stat-overlay'); overlay.querySelector('button')?.focus(); return document.querySelector('.screen.customize').inert === true && overlay.contains(document.activeElement); })()`), `${width}x${height}: Assign Points scopes the screen and keeps focus inside the dialog`);
  await evaluate(`document.querySelector('.cc-stat-overlay').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Reaver Assign Points Escape close');
  const escapeReceipt = await evaluate(`(() => ({inert:document.querySelector('.screen.customize').inert,active:document.activeElement?.dataset?.creationMode||'',chosen:document.querySelector('#cz-statedit .se-mode.chosen')?.dataset.creationMode||'',cursor:document.querySelector('#cz-statedit .se-mode.gp-focus')?.dataset.creationMode||''}))()`);
  assert(escapeReceipt.inert === false && escapeReceipt.active === 'standard' && escapeReceipt.chosen === 'standard' && escapeReceipt.cursor === 'standard', `${width}x${height}: Escape cancels Assign Points, clears the modal scope, and focuses Standard (${JSON.stringify(escapeReceipt)})`);
  await open('primary');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Reaver Assign Points reopen');
  assert(await evaluate(`document.querySelector('.cc-stat-overlay .se-pool .sp-v')?.textContent.trim()==='10' && [...document.querySelectorAll('.cc-stat-overlay .se-value')].every((node)=>node.textContent.trim()==='10')`),
    `${width}x${height}: reopening Assign Points refunds the complete allocation again`);
  assert(await evaluate(`(() => { const modal=document.querySelector('.cc-stat-overlay'); const buttons=[...modal.querySelectorAll('button')]; buttons.at(-1).focus(); buttons.at(-1).dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true})); return document.activeElement===buttons[0]; })()`), `${width}x${height}: Assign Points traps forward Tab focus inside the dialog`);
  await click('.cc-stat-overlay [aria-label="Increase Strength"]');
  for (let i = 0; i < 5; i += 1) await click('.cc-stat-overlay [aria-label="Increase Dexterity"]');
  for (let i = 0; i < 4; i += 1) await click('.cc-stat-overlay [aria-label="Increase Constitution"]');
  await click('.cc-stat-overlay [data-stat-done]');
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Reaver Assign Points overlay close');
  await open('equipment');
  await open('rightHand');
  const errorsBeforeIncompatiblePick = errors.length;
  await click('#cz-right-hand [data-armament-id="greatsword"] .equipment-poker-card');
  await click('#cz-right-hand [data-armament-id="greatsword"] .equipment-choose');
  // The weapon's refusal is explained where the player can act on it: the
  // Main Hand section's own Continue (Begin names the first unmet step, which
  // may still be the keepsake or the armour).
  const incompatible = await evaluate(`(() => {
    const next = document.querySelector('[data-equipment-section="rightHand"] .cc-equipment-continue');
    const choice = document.querySelector('#cz-right-hand [data-armament-id="greatsword"] .equipment-choose');
    return { disabled: next.getAttribute('aria-disabled'), refusal: next.dataset.refusal || '', selected:choice?.getAttribute('aria-pressed') };
  })()`);
  assert(errors.length === errorsBeforeIncompatiblePick, `${width}x${height}: incompatible hand selection keeps the live preview total`);
  assert((incompatible.disabled === 'true' && /Greatsword needs strength 12/.test(incompatible.refusal)) || incompatible.selected === 'false',
    `${width}x${height}: incompatible equipment is rejected at its card or explained at its section's Continue (${JSON.stringify(incompatible)})`);
  await open('character');
  await open('primary');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Reaver correction overlay');
  await click('.cc-stat-overlay [data-stat-done]');
  const modalRefusal = await evaluate(`(() => {
    const done = document.querySelector('.cc-stat-overlay [data-stat-done]');
    const tip = document.querySelector('#tooltip');
    return { open: !!done, disabled: done?.getAttribute('aria-disabled'), refusal: done?.dataset.refusal || '', tip: tip?.textContent || '', shown: tip?.style.display };
  })()`);
  assert(modalRefusal.open && modalRefusal.disabled === 'true' && /10 stat points still to assign/.test(modalRefusal.refusal)
    && modalRefusal.shown === 'block' && /10 stat points still to assign/.test(modalRefusal.tip),
  `${width}x${height}: reopened Assign Points explains that its refunded pool must be assigned`);
  for (let i = 0; i < 2; i += 1) await click('.cc-stat-overlay [aria-label="Increase Strength"]');
  for (let i = 0; i < 5; i += 1) await click('.cc-stat-overlay [aria-label="Increase Dexterity"]');
  for (let i = 0; i < 3; i += 1) await click('.cc-stat-overlay [aria-label="Increase Constitution"]');
  await click('.cc-stat-overlay [data-stat-done]');
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Reaver correction overlay close');
  // Begin may still wait on later steps (keepsake, armour); what correcting
  // the stats must clear is the weapon's own refusal.
  assert(!/Greatsword/.test(await evaluate(`document.querySelector('#cz-start').dataset.refusal || ''`)), `${width}x${height}: correcting stats clears the equipment refusal`);

  // THE WAY ON IS ON THE RIGHT, THE WAY BACK ON THE LEFT (owner, 2026-09-11).
  // modalFooter() appends the secondaries and then the primary, so document
  // order already says it — but a stylesheet can undo that and one did: a
  // `grid-column:1 / -1; order:1` on the primary drew Begin at x=10 and Back at
  // x=854 here, the row reading forward-then-back. tools/modal-shell-contract
  // holds the source order and bans that rule; only a real page can say where
  // the buttons LANDED, so this row measures the rendered left edges and the
  // equal ladder tracks the owner asked for on 2026-09-03 in the same breath.
  const footOrder = await evaluate(`(() => {
    const row = document.querySelector('.cz-actions .modal-foot-actions, .modal-foot-actions');
    if (!row) return null;
    // BY IDENTITY, NOT BY CLASS: refusesWhen rewrites this button's classes as
    // the allocation goes valid and invalid, so a test for the component's own
    // primary marker reads false at the wrong moment. On this screen the way on
    // is #cz-start and nothing else is.
    const kids = [...row.children].map((b) => ({
      label: (b.textContent || '').trim().slice(0, 12),
      isPrimary: b.id === 'cz-start',
      left: Math.round(b.getBoundingClientRect().left),
      width: Math.round(b.getBoundingClientRect().width),
    }));
    return { kids, primary: kids.find((k) => k.isPrimary) || null, backs: kids.filter((k) => !k.isPrimary) };
  })()`);
  assert(footOrder && footOrder.primary && footOrder.backs.length > 0
    && footOrder.backs.every((back) => back.left < footOrder.primary.left),
  `${width}x${height}: the creation foot puts every way back left of the way on (${JSON.stringify(footOrder)})`);
  // Uniform size is the other half of the same instruction; a primary that grew
  // to take the row is how it ended up on the left last time.
  assert(footOrder && footOrder.backs.every((back) => Math.abs(back.width - footOrder.primary.width) <= 12),
    `${width}x${height}: the foot's buttons stay one size (${JSON.stringify(footOrder && footOrder.kids)})`);

  await open('class');

  await click('.cz-class[data-class="starseer"]');
  assert((await evaluate(`document.querySelector('[data-face="class"] .disc-value').textContent`)) === 'Starseer', `${width}x${height}: class selector updates its receipt`);
  await open('equipment');
  await open('armour');
  assert((await evaluate(`document.querySelector('#cz-equipment-fold [data-face="armour"] .disc-value').textContent`)) === '—', `${width}x${height}: armour arrives unchosen after a class change`);
  await click('#cz-armours [data-starting-armour-id="default"] .equipment-poker-card');
  await click('#cz-armours [data-starting-armour-id="default"] .equipment-choose');
  assert((await evaluate(`document.querySelector('#cz-equipment-fold [data-face="armour"] .disc-value').textContent`)) === 'Nightweave', `${width}x${height}: armour receipt is scoped to the selected class`);
  await open('character');
  assert(await noOverflow(), `${width}x${height}: Character has no horizontal overflow`);
  assert((await evaluate(`document.querySelectorAll('.cc-primary-stats .cc-primary-stat').length`)) === 5, `${width}x${height}: five primary stats are vertical cards`);
  assert((await evaluate(`document.querySelectorAll('#cz-character-panel .se-step').length`)) === 0, `${width}x${height}: Standard shows no plus/minus controls`);
  await click('#cz-preview-fold [data-face="sprite"]');
  await click('#cz-styles .cz-opt', 1);
  await click('#cz-sprite-fold [data-face="tint"]');
  await click('#cz-tints .cz-opt', 1);
  await click('#cz-sprite-fold [data-face="sigil"]');
  await click('#cz-glyphs .cz-opt', 1);
  await open('keepsake');
  await click('#cz-keepsakes .cz-keepsake', 1);
  assert((await evaluate(`[...document.querySelectorAll(${JSON.stringify(faces('#cz-character-fold', '[aria-expanded="true"]'))})].map(e=>e.dataset.face).join(',')`)) === 'keepsake', `${width}x${height}: nested Character disclosures keep only the focused picker open`);
  await setInput('#cz-name', 'Marya');
  await click('#cz-character-fold [data-face="primary"]');
  await open('primary');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
  await until(`!!document.querySelector('.cc-stat-overlay')`, 'Assign Points overlay');
  assert((await evaluate(`document.querySelectorAll('.cc-stat-overlay .se-step').length`)) === 10, `${width}x${height}: Assign Points reuses five plus/minus rows in an overlay`);
  // SPEND THE POOL EVENLY, LOWEST FIRST, rather than piling it into two stats.
  // The old fixed 5-into-STR / 5-into-DEX pair was written against the class
  // preset; since #692 the editor opens at a flat baseline, so that pair spends
  // the whole pool on two stats and leaves the rest at 10 — and this class's
  // Ash Staff needs intelligence 12, so Done then refuses ("Ash Staff needs
  // intelligence 12 — you have 10") and the overlay never closes. Spreading
  // the ten points is both what a player completing a valid character does and
  // independent of which class or requirement the fixture happens to carry.
  for (let guard = 0; guard < 40; guard += 1) {
    const next = await evaluate(`(() => {
      const left = Number.parseInt(document.querySelector('.cc-stat-overlay .se-pool .sp-v')?.textContent.trim() || '0', 10);
      const open = [...document.querySelectorAll('.cc-stat-overlay [data-stat-action="increase"]')]
        .filter((control) => control.getAttribute('aria-disabled') === 'false')
        .map((control) => ({
          id: control.dataset.statId,
          value: Number.parseInt(control.closest('.se-controls')?.querySelector('.se-value')?.textContent.trim() || '0', 10),
        }))
        .sort((a, b) => a.value - b.value);
      return { left, pick: open[0]?.id || null };
    })()`);
    if (next.left <= 0 || !next.pick) break;
    await click(`.cc-stat-overlay [data-stat-action="increase"][data-stat-id="${next.pick}"]`);
  }
  await evaluate(`(() => { document.querySelectorAll('.gp-focus').forEach(e => e.classList.remove('gp-focus')); const e=document.querySelector('.cc-stat-overlay [aria-label="Decrease Dexterity"]'); e.focus(); e.classList.add('gp-focus'); e.click(); })()`);
  assert(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Decrease Dexterity' && document.querySelector('.cc-stat-overlay .gp-focus')?.getAttribute('aria-label') === 'Decrease Dexterity'`), `${width}x${height}: redraw preserves keyboard and gamepad focus on the decremented stat`);
  await evaluate(`(() => { const e=document.querySelector('.cc-stat-overlay [aria-label="Increase Dexterity"]'); document.querySelectorAll('.gp-focus').forEach(x => x.classList.remove('gp-focus')); e.focus(); e.classList.add('gp-focus'); e.click(); })()`);
  assert(await evaluate(`document.activeElement?.getAttribute('aria-label') === 'Increase Dexterity' && document.querySelector('.cc-stat-overlay .gp-focus')?.getAttribute('aria-label') === 'Increase Dexterity'`), `${width}x${height}: redraw preserves keyboard and gamepad focus on the incremented stat`);
  for (let i = 0; i < 2; i += 1) await click('.cc-stat-overlay [aria-label="Increase Strength"]');
  for (let i = 0; i < 2; i += 1) await click('.cc-stat-overlay [aria-label="Increase Dexterity"]');
  for (let i = 0; i < 3; i += 1) await click('.cc-stat-overlay [aria-label="Increase Constitution"]');
  await click('.cc-stat-overlay [aria-label="Increase Wisdom"]');
  for (let i = 0; i < 2; i += 1) await click('.cc-stat-overlay [aria-label="Increase Intelligence"]');
  // SPEND WHATEVER THE POOL STILL HOLDS, rather than trusting a hand-counted
  // click list. Since #692 the editor opens at a flat baseline with the whole
  // pool unspent, so every fixed sequence written against the old class preset
  // lands on a different total — this one finished a point short and Done
  // rightly refused. Reading the pool and spending the remainder keeps the
  // check about what it is for (Done closes once the allocation is complete)
  // instead of about arithmetic that the next tuning change will break again.
  // Spend into whichever stepper will TAKE a point: a stat sitting on the
  // mode's ceiling refuses correctly, so hammering one stat proves nothing.
  const spendPool = async () => {
    let state = null;
    for (let guard = 0; guard < 30; guard += 1) {
      state = await evaluate(`(() => {
        const left = Number.parseInt(document.querySelector('.cc-stat-overlay .se-pool .sp-v')?.textContent.trim() || '0', 10);
        const open = [...document.querySelectorAll('.cc-stat-overlay [data-stat-action="increase"]')]
          .filter((control) => control.getAttribute('aria-disabled') === 'false')
          .map((control) => control.dataset.statId);
        return { left, open, values:[...document.querySelectorAll('.cc-stat-overlay .se-value')].map((n) => n.textContent.trim()) };
      })()`);
      if (state.left <= 0 || !state.open.length) break;
      await click(`.cc-stat-overlay [data-stat-action="increase"][data-stat-id="${state.open[0]}"]`);
    }
    return state;
  };
  const spendState = await spendPool();
  assert(spendState && spendState.left === 0,
    `${width}x${height}: the whole point pool can be spent through the steppers (${JSON.stringify(spendState)})`);
  await click('.cc-stat-overlay [data-stat-done]');
  await until(`!document.querySelector('.cc-stat-overlay')`, 'Assign Points overlay close');

  await open('equipment');
  assert(await noOverflow(), `${width}x${height}: Starting Equip has no horizontal overflow`);
  assert((await evaluate(`document.querySelector('#cz-equipment-view-toggle [data-view-mode="list"]').getAttribute('aria-pressed')`)) === 'true', `${width}x${height}: Starting Equip defaults to configured list view`);
  await click('#cz-equipment-view-toggle [data-view-mode="grid"]');
  const equipmentGrid = await evaluate(`(() => {
    const host = document.querySelector('#cz-armours');
    const cards = [...host.querySelectorAll('.equip-chip')];
    return {
      view: host.dataset.view,
      display: getComputedStyle(host).display,
      sameRow: cards.length > 1 && Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) <= 1,
      overflow: host.scrollWidth > host.clientWidth + 1,
    };
  })()`);
  assert(equipmentGrid.view === 'grid' && equipmentGrid.display === 'grid' && !equipmentGrid.overflow && (width < 700 || equipmentGrid.sameRow),
    `${width}x${height}: equipment Grid changes every subcard collection's rendered geometry (${JSON.stringify(equipmentGrid)})`);
  await click('#cz-equipment-view-toggle [data-view-mode="list"]');
  assert((await evaluate(`document.querySelectorAll('#cz-armours .equip-chip').length`)) >= 2, `${width}x${height}: at least two armour cards are direct selectors`);
  assert((await evaluate(`document.querySelectorAll('#cz-left-hand .equip-chip').length`)) >= 2, `${width}x${height}: Left Hand has direct armament cards`);
  assert((await evaluate(`document.querySelectorAll('#cz-right-hand .equip-chip').length`)) >= 2, `${width}x${height}: Right Hand has direct armament cards`);
  await click('#cz-auto-advance-toggle .cc-switch');
  await open('armour');
  await click('#cz-armours .equip-chip', 1);
  assert((await evaluate(`[...document.querySelectorAll(${JSON.stringify(faces('#cz-equipment-fold', '[aria-expanded="true"]'))})].map(e=>e.dataset.face).join(',')`)) === 'armour', `${width}x${height}: disabled auto-advance keeps the current equipment subcard open`);
  await click('#cz-auto-advance-toggle .cc-switch');
  await click('#cz-armours .equip-chip', 0);
  // THE NEXT SUBCARD IS WHICHEVER ONE THE CONFIGURATION PUTS NEXT, read off the
  // fold rather than named here. This row demanded `leftHand`, and the
  // configured order is armour → rightHand → leftHand → relic, so it was
  // asserting a hand-copied order that had since changed: the screen advanced
  // correctly and the gate called it a regression. Reading the order makes the
  // row about advancing, which is what auto-advance means.
  const advance = await evaluate(`(() => {
    const order = [...document.querySelectorAll(${JSON.stringify(faces('#cz-equipment-fold'))})].map(e=>e.dataset.face);
    const open = [...document.querySelectorAll(${JSON.stringify(faces('#cz-equipment-fold', '[aria-expanded="true"]'))})].map(e=>e.dataset.face);
    return { order, open, after: order[order.indexOf('armour') + 1] ?? null };
  })()`);
  assert(advance.open.join(',') === advance.after,
    `${width}x${height}: a valid equipment choice auto-advances to the next configured subcard (${JSON.stringify(advance)})`);
  await click('#cz-left-hand [data-armament-id="ashStaff"]');
  await click('#cz-right-hand [data-armament-id="ashStaff"]');
  const moved = await evaluate(`(() => ({left:document.querySelector('#cz-left-hand [data-armament-id="ashStaff"]').getAttribute('aria-pressed'),right:document.querySelector('#cz-right-hand [data-armament-id="ashStaff"]').getAttribute('aria-pressed')}))()`);
  assert(moved.left === 'false' && moved.right === 'true', `${width}x${height}: choosing one armament for the other hand moves it`);
  await open('leftHand');
  await click('#cz-left-hand [data-armament-id="starstoneStaff"]');
  await open('relic');
  await click('#cz-relics .cc-relic-card', 1);

  await open('character');
  const persisted = await evaluate(`(() => ({
    name:document.querySelector('#cz-name').value,
    pointbuy:document.querySelector('#cz-statedit .se-mode[data-creation-mode="pointbuy"]').getAttribute('aria-pressed'),
    keepsake:document.querySelector('#cz-keepsakes [data-keepsake-id="oldCinder"]').getAttribute('aria-pressed')
  }))()`);
  assert(persisted.name === 'Marya' && persisted.pointbuy === 'true' && persisted.keepsake === 'true', `${width}x${height}: character choices persist through section changes`);
  await open('equipment');
  const gearPersisted = await evaluate(`(() => ({
    armour:document.querySelectorAll('#cz-armours .equip-chip')[0].getAttribute('aria-pressed'),
    left:document.querySelector('#cz-left-hand [data-armament-id="starstoneStaff"]').getAttribute('aria-pressed'),
    right:document.querySelector('#cz-right-hand [data-armament-id="ashStaff"]').getAttribute('aria-pressed'),
    relic:document.querySelectorAll('#cz-relics .cc-relic-card')[1].getAttribute('aria-pressed'),
    leftPressed:[...document.querySelectorAll('#cz-left-hand [data-armament-id]')].filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.dataset.armamentId),
    leftRefused:document.querySelector('#cz-left-hand [data-armament-id="starstoneStaff"]')?.getAttribute('aria-disabled') ?? null
  }))()`);
  // Only the four CHOICES decide this row; `leftPressed` and `leftRefused` are
  // carried for the message so a red says which pick was lost and whether the
  // card had refused it.
  assert(['armour', 'left', 'right', 'relic'].every((key) => gearPersisted[key] === 'true'),
    `${width}x${height}: equipment choices persist through section changes (${JSON.stringify(gearPersisted)})`);

  await open('seed');
  await setInput('#seed-input', 'REDESIGN');
  assert(await noOverflow(), `${width}x${height}: Seed has no horizontal overflow`);
  await open(screenshotSection);
  if (screenshotSection === 'class') await click('.cz-class[data-class="reaver"]');
  await evaluate(`document.querySelector('.cz-scroll').scrollTop=0`);
  await wait(250);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  writeFileSync(join(OUT, screenshotName), Buffer.from(shot.data, 'base64'));

  if (screenshotSection === 'class') {
    await open('equipment');
    await open('armour');
    await evaluate(`document.querySelector('[data-face="equipment"]').scrollIntoView({block:'start'})`);
    await wait(200);
    const equipmentShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    writeFileSync(join(OUT, screenshotName.replace('after-', 'equipment-')), Buffer.from(equipmentShot.data, 'base64'));
    await open('class');
    await click('.cz-class[data-class="starseer"]');
  }
  await open('seed');
  await click('#cz-start');
  // A REFUSED `Begin` IS A FINDING, NOT A DEAD HARNESS — and here it was the
  // screen being right. Changing class above REFUNDS THE POINT POOL, so Begin
  // refused with "10 stat points still to assign." and this wait sat on a
  // correct refusal until it threw, taking the mobile pass and the component
  // catalogue down with it. Both halves are worth holding: the refusal is
  // asserted where it happens, and then the character is finished the way a
  // player finishes it before Begin is pressed again.
  let entered = await until(`!!document.querySelector('.mapscreen')`, 'Begin to enter the map', 4000, false);
  if (!entered) {
    const refusal = await evaluate(`document.querySelector('#tooltip')?.textContent?.trim().slice(0, 200) || null`);
    assert(/stat points? still to assign/i.test(refusal || ''),
      `${width}x${height}: Begin refuses an unfinished allocation and says why (${JSON.stringify(refusal)})`);
    await open('character');
    await open('primary');
    await open('primary');
  await click('#cz-statedit .se-mode[data-creation-mode="pointbuy"]');
    if (await until(`!!document.querySelector('.cc-stat-overlay')`, 'Assign Points after a class change', 8000, false)) {
      await spendPool();
      await click('.cc-stat-overlay [data-stat-done]');
      await until(`!document.querySelector('.cc-stat-overlay')`, 'Assign Points close after a class change', 8000, false);
    }
    await open('seed');
    await click('#cz-start');
    entered = await until(`!!document.querySelector('.mapscreen')`, 'Begin to enter the map', 15000, false);
  }
  const stillRefusing = entered ? null : await evaluate(`(() => ({
    tip: document.querySelector('#tooltip')?.textContent?.trim().slice(0, 200) || null,
    mode: document.querySelector('#cz-statedit .se-mode[aria-pressed="true"]')?.dataset.creationMode ?? null,
    overlay: !!document.querySelector('.cc-stat-overlay'),
    open: [...document.querySelectorAll('.disc-face[aria-expanded="true"]')].map(e=>e.dataset.face).join(','),
  }))()`).catch((error) => ({ probe: error.message }));
  assert(entered, `${width}x${height}: Begin enters the map once the allocation is complete${entered ? '' : ` (${JSON.stringify(stillRefusing)})`}`);
  if (entered) {
    // WHAT THE MAP ACTUALLY CARRIES. This row read `.mapscreen .nm` for a
    // "MARYA … STARSEER" string; the map header is the shared combat HUD, and
    // its identity chip carries CLASS ONLY — no `.nm` node exists there, so
    // the read was `null.textContent` and threw, which killed the run after
    // Begin rather than reporting anything. The class the player chose LAST is
    // the value this can see, so that is what it holds; whether a name appears
    // anywhere on the surface is reported rather than demanded, since the
    // header is not where the name is shown.
    const begun = await evaluate(`(() => ({
      cls: document.querySelector('.mapscreen .hud-class .cv')?.textContent?.trim() ?? null,
      nameShown: /MARYA/i.test(document.querySelector('.mapscreen')?.textContent || ''),
    }))()`);
    assert(/starseer/i.test(begun.cls || ''),
      `${width}x${height}: Begin consumes the class chosen last (${JSON.stringify(begun)})`);
  }
  assert(errors.length === 0, `${width}x${height}: no uncaught browser exceptions`);
  await cdp.send('Target.closeTarget', { targetId });
}

async function checkCatalog(width, height, screenshotName) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
  }, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=components` }, sessionId);
  const started = Date.now();
  while (Date.now() - started < 15000 && !(await evaluate(`!!document.querySelector('.component-catalog')`).catch(() => false))) await wait(100);
  const receipt = await evaluate(`(() => {
    const root = document.querySelector('.component-catalog');
    const items = [...root.querySelectorAll('[data-catalog-component]')];
    return {
      keys: items.map((item) => item.dataset.catalogComponent),
      visible: items.every((item) => { const r=item.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(item).display!=='none'; }),
      controls: {
        classes: root.querySelectorAll('.cz-class').length,
        stats: root.querySelectorAll('.cc-primary-stat').length,
        keepsakes: root.querySelectorAll('.cz-keepsake').length,
        armour: root.querySelectorAll('#cz-armours .equip-chip').length,
        left: root.querySelectorAll('#cz-left-hand .equip-chip').length,
        right: root.querySelectorAll('#cz-right-hand .equip-chip').length,
        relics: root.querySelectorAll('.cc-relic-card').length,
        seed: root.querySelectorAll('#seed-input').length,
      },
      primitives: {
        disclosure: root.querySelectorAll('[data-catalog-component="character-disclosure"] .disc-face').length,
        classPreview: root.querySelectorAll('[data-catalog-component="class-preview-pane"] .cc-class-preview').length,
        classResources: root.querySelectorAll('[data-catalog-component="class-resource-grid"] .cc-class-resource-grid').length,
        classChoice: root.querySelectorAll('[data-catalog-component="class-choice-card"] .cz-class').length,
        viewMode: root.querySelectorAll('[data-catalog-component="view-mode-toggle"] [data-view-mode]').length,
        autoAdvance: root.querySelectorAll('[data-catalog-component="boolean-setting-toggle"] .cc-switch').length,
        selectionFace: root.querySelectorAll('[data-catalog-component="selection-section-face"] .cc-selection-face').length,
        stat: root.querySelectorAll('[data-catalog-component="primary-stat-card"] .cc-primary-stat').length,
        resources: root.querySelectorAll('[data-catalog-component="resource-strip"] .cc-derived').length,
        mode: root.querySelectorAll('[data-catalog-component="mode-choice"] .se-mode').length,
        sprite: root.querySelectorAll('[data-catalog-component="sprite-choice"] .cz-opt.style').length,
        tint: root.querySelectorAll('[data-catalog-component="tint-choice"] .cz-opt.tint').length,
        sigil: root.querySelectorAll('[data-catalog-component="sigil-choice"] .cz-opt').length,
        keepsake: root.querySelectorAll('[data-catalog-component="keepsake-choice"] .cz-keepsake').length,
        equipment: root.querySelectorAll('[data-catalog-component="equipment-choice-card"] .equip-chip').length,
        relic: root.querySelectorAll('[data-catalog-component="relic-choice-card"] .cc-relic-card').length,
      },
      overflow: root.scrollWidth > root.clientWidth + 1,
    };
  })()`);
  assert(receipt.visible && receipt.keys.join(',') === 'class,character,equipment,seed,character-disclosure,class-preview-pane,class-resource-grid,class-choice-card,view-mode-toggle,boolean-setting-toggle,selection-section-face,primary-stat-card,resource-strip,mode-choice,sprite-choice,tint-choice,sigil-choice,keepsake-choice,equipment-choice-card,relic-choice-card', `${width}x${height}: component catalog shows live sections plus all reusable creation components`);
  assert(receipt.controls.classes >= 2 && receipt.controls.stats >= 5 && receipt.controls.keepsakes >= 2
    && receipt.controls.armour >= 2 && receipt.controls.left >= 2 && receipt.controls.right >= 2
    && receipt.controls.relics >= 2 && receipt.controls.seed === 1 && !receipt.overflow,
  `${width}x${height}: component catalog includes every creation selector without horizontal overflow`);
  assert(Object.values(receipt.primitives).every((count) => count >= 1),
    `${width}x${height}: component catalog references every reusable creation component`);
  await evaluate(`document.querySelector('[data-catalog-component="view-mode-toggle"] [data-view-mode="grid"]').click()`);
  assert(await evaluate(`document.querySelector('[data-catalog-component="view-mode-toggle"] [data-view-mode="grid"]').getAttribute('aria-pressed') === 'true'`),
    `${width}x${height}: catalog view-mode specimen switches to Grid`);
  await evaluate(`document.querySelector('[data-catalog-component="view-mode-toggle"] [data-view-mode="list"]').click()`);
  assert(await evaluate(`document.querySelector('[data-catalog-component="view-mode-toggle"] [data-view-mode="list"]').getAttribute('aria-pressed') === 'true'`),
    `${width}x${height}: catalog view-mode specimen remains interactive after replacement`);
  const interactive = await evaluate(`(() => {
    const second = (key, selector) => document.querySelectorAll('[data-catalog-component="'+key+'"] '+selector)[1];
    const choose = (key, selector) => { const node=second(key,selector); node?.click(); return node ? document.querySelectorAll('[data-catalog-component="'+key+'"] '+selector)[1]?.getAttribute('aria-pressed') : null; };
    const auto=document.querySelector('[data-catalog-component="boolean-setting-toggle"] .cc-switch'); auto.click();
    return {
      classChoice:choose('class-choice-card','.cz-class'),
      auto:document.querySelector('[data-catalog-component="boolean-setting-toggle"] .cc-switch').getAttribute('aria-checked'),
      mode:choose('mode-choice','.se-mode'), sprite:choose('sprite-choice','.style'), tint:choose('tint-choice','.tint'),
      sigil:choose('sigil-choice','.sigil'), keepsake:choose('keepsake-choice','.cz-keepsake'),
      equipment:choose('equipment-choice-card','.equip-chip'), relic:choose('relic-choice-card','.cc-relic-card'),
    };
  })()`);
  assert(interactive.classChoice === 'true' && interactive.auto === 'false'
    && Object.entries(interactive).filter(([key]) => !['classChoice','auto'].includes(key)).every(([,value]) => value === 'true'),
  `${width}x${height}: catalog specimens expose working selection and setting states`);
  const disclosureChoice = await evaluate(`(() => {
    const root=document.querySelector('[data-catalog-component="character-disclosure"]');
    root.querySelector('[data-face="sample-keepsake"]').click();
    const choices=root.querySelectorAll('.cz-keepsake'); choices[1].click();
    return {open:[...root.querySelectorAll('.disc-face[aria-expanded="true"]')].map(e=>e.dataset.face).join(','), selected:root.querySelectorAll('.cz-keepsake')[1].getAttribute('aria-pressed')};
  })()`);
  assert(disclosureChoice.open === 'sample-keepsake' && disclosureChoice.selected === 'true', `${width}x${height}: catalog disclosure and nested keepsake choices remain interactive`);
  await evaluate(`document.querySelector('[data-catalog-component="character-disclosure"]').scrollIntoView({block:'start'})`);
  await wait(150);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  writeFileSync(join(OUT, screenshotName), Buffer.from(shot.data, 'base64'));
  await cdp.send('Target.closeTarget', { targetId });
}

try {
  await exercise(1440, 1024, 'character-creation-after-desktop.png', 'class', {
    schemaVersion: 2, settings: {}, results: [], discoveredArmaments: [], discoveryReceipts: [], unlocked: ['winAsReaver'],
  });
  await exercise(390, 844, 'character-creation-after-mobile.png', 'class');
  await checkCatalog(1440, 900, 'character-creation-component-catalog-desktop.png');
  await checkCatalog(390, 844, 'character-creation-component-catalog-mobile.png');
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
