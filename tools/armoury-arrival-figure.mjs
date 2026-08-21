#!/usr/bin/env node
// tools/armoury-arrival-figure.mjs — WHAT THE ARMOURY GIVES THE FIGURE ON
// ARRIVAL, measured in pixels at two shapes.
//
// Constantine's ruling, 2026-08-21: *the Armoury opens with the figure, and
// CARDS is one click away.* The cost he accepted, stated to him plainly:
// someone browsing loot now pays a click every visit. This tool is the edge
// that ruling is proved against — before and after, same probe, both shapes.
//
// WHAT IS MEASURED, AND WHY IT IS THE FIGURE'S BOX AND NOT THE SPRITE'S.
// `.armoury-figure` is the container the layout sizes; `.equipped-figure`
// inside it is the art, and #305's compositing mirror
// (`.class-sprite, .equipped-figure { transform: scaleX(-1) }`, guarded by
// `.class-sprite .equipped-figure { transform: none }`) lives on THAT element.
// A transform changes a client rect. So both are read, and the mirror is read
// as a COMPUTED transform on each of them — this tool goes red if a change
// creates a second mirror or cancels theirs, which is the hazard of making the
// figure bigger while #305 is live in the tree.
//
// TWO SHAPES, AND THE PHONE IS THE ONE THAT MATTERS.
//   1440x860  desktop — where the squeeze was found
//    390x844  phone   — where `data-layout='narrow'` is on, and where a panel
//                       that reads fine at 1440 can leave the figure or the
//                       cards unreachable
// The tree settles layout by `data-layout` on the root element, NOT by media
// query, so the shape is set with device metrics and the attribute is READ
// back rather than assumed — a probe that assumed it would report on a
// desktop layout wearing a phone's pixel count.
//
// COST, MEASURED AND NOT QUOTED. "One click away" is checked as an actual
// click count AND as whether the cards land above the fold once opened: a
// click plus a scroll is not the cost he was told. Both are printed.
//
// DOOR. Source tree, repo's own tools/serve.mjs, real Chromium through
// tools/browser.mjs's CDP path. NOT tools/screenshot.mjs — its one-shot flags
// print trailing blank rows and exit 0, so a green from it means nothing.
//
// Usage:  node tools/armoury-arrival-figure.mjs
//         node tools/armoury-arrival-figure.mjs --json

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHAPES = [
  { name: 'desktop', w: 1440, h: 860 },
  { name: 'phone', w: 390, h: 844 },
];

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}

// The one read. Everything this tool claims comes from these pixels.
const PROBE = `(() => {
  const q = (s) => document.querySelector(s);
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
             bottom: Math.round(r.bottom), area: Math.round(r.width * r.height) }; };
  // THE NUMBER THIS TOOL IS ANSWERABLE TO. The figure's own rect is 260x330
  // whether the strip is open or shut — it never moves, because what moves is
  // its SCROLL PARENT. Reading the rect alone reports "nothing changed" while
  // more than half the figure sits behind a clipped edge. So: the rect
  // intersected with every clipping ancestor and the viewport.
  const visible = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    const clippers = [];
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const b = p.getBoundingClientRect();
        clippers.push({ cls: p.className, ov: cs.overflowX + '/' + cs.overflowY,
                        box: [Math.round(b.width), Math.round(b.height)] });
        x0 = Math.max(x0, b.left); y0 = Math.max(y0, b.top);
        x1 = Math.min(x1, b.right); y1 = Math.min(y1, b.bottom);
      }
      p = p.parentElement;
    }
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0);
    x1 = Math.min(x1, window.innerWidth); y1 = Math.min(y1, window.innerHeight);
    const w = Math.max(0, Math.round(x1 - x0)), h = Math.max(0, Math.round(y1 - y0));
    return { w, h, area: w * h, clippers };
  };
  const overlay = q('.armoury-overlay');
  const body = q('.armoury-overlay .armoury-body');
  const armoury = q('.armoury-overlay .armoury');
  const fig = q('.armoury-overlay .armoury-figure');
  const art = q('.armoury-overlay .equipped-figure');
  const cards = q('.armoury-overlay [data-region="cards"]');
  const strip = q('.armoury-overlay .equip-cards');
  const foldBtn = q('.armoury-overlay [data-fold="cards"]');
  const vh = window.innerHeight;
  // The mirror, read as the browser resolved it — not as the stylesheet reads.
  const tf = (el) => el ? getComputedStyle(el).transform : null;
  return {
    layout: document.documentElement.getAttribute('data-layout'),
    view: armoury ? armoury.dataset.view : null,
    dataFigure: armoury ? armoury.dataset.figure : null,
    dataSlots: armoury ? armoury.dataset.slots : null,
    overlay: box(overlay),
    body: box(body),
    figure: box(fig),
    figureVisible: visible(fig),
    art: box(art),
    artTransform: tf(art),
    figTransform: tf(fig),
    cardsCollapsed: cards ? cards.dataset.collapsed : null,
    cardsExpanded: foldBtn ? foldBtn.getAttribute('aria-expanded') : null,
    foldBtnPresent: !!foldBtn,
    foldBtnBox: box(foldBtn),
    stripBox: box(strip),
    // Above the fold = the strip's top edge is inside the viewport AND its
    // whole box is too. A pane you must scroll to is not one click away.
    stripAboveFold: strip ? (box(strip).top < vh) : null,
    stripFullyVisible: strip ? (box(strip).bottom <= vh && box(strip).top >= 0) : null,
    viewportH: vh,
  };
})()`;

async function run() {
  const json = process.argv.includes('--json');
  const out = {};
  console.log(`armoury-arrival-figure — source tree, real browser, ${SHAPES.map((s) => `${s.w}x${s.h}`).join(' + ')}`);

  const s = await serve({ root: ROOT, port: 8491, open: false });
  const base = `http://localhost:${s.port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'armfig-', args: ['--allow-file-access-from-files'], timeoutMs: 20000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);

  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
    return r.result.value;
  };
  const until = async (x, w, ms = 25000) => { const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(60); } throw new Error('timeout ' + w); };

  let fails = 0;
  try {
    for (const shape of SHAPES) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: shape.w, height: shape.h, deviceScaleFactor: 1, mobile: shape.name === 'phone' }, S);
      // A fresh navigation per shape. Re-using a mounted panel would measure a
      // RESIZE, and the ask is about what ARRIVAL gives the figure.
      await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
      await until("!!document.querySelector('.combat .hand .card')", 'combat');
      await wait(700);
      await ev("document.querySelector('#combat-armoury').click()");
      await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
      await wait(600);

      const arrival = await ev(PROBE);
      // One click on the CARDS control, then read again. The click is COUNTED,
      // not assumed: the control has to be there to be clicked.
      let clicks = 0;
      let afterClick = null;
      if (arrival.foldBtnPresent) {
        await ev("document.querySelector('.armoury-overlay [data-fold=\"cards\"]').click()");
        clicks = 1;
        await wait(500);
        afterClick = await ev(PROBE);
      }
      // And back — the fold must still refold, or "one click away" is a trapdoor.
      let refold = null;
      if (arrival.foldBtnPresent) {
        await ev("document.querySelector('.armoury-overlay [data-fold=\"cards\"]').click()");
        await wait(500);
        refold = await ev(PROBE);
      }
      out[shape.name] = { shape, arrival, clicks, afterClick, refold };

      const f = arrival.figure;
      const a = afterClick && afterClick.figure;
      console.log(`\n  ${shape.name}  ${shape.w}x${shape.h}   data-layout=${arrival.layout}`);
      console.log(`    view=${arrival.view} data-figure=${arrival.dataFigure} data-slots=${arrival.dataSlots}`
        + `   overlay ${arrival.overlay ? `${arrival.overlay.w}x${arrival.overlay.h}` : '-'}`
        + `  body ${arrival.body ? `${arrival.body.w}x${arrival.body.h}` : '-'}`);
      const fv = arrival.figureVisible;
      const av = afterClick && afterClick.figureVisible;
      console.log(`    arrival      figure layout ${f ? `${f.w}x${f.h}` : 'ABSENT'}`
        + `  VISIBLE ${fv ? `${fv.w}x${fv.h} (area ${fv.area})` : 'ABSENT'}`
        + `   cards collapsed=${arrival.cardsCollapsed}`);
      console.log(`    after 1 click figure layout ${a ? `${a.w}x${a.h}` : 'ABSENT'}`
        + `  VISIBLE ${av ? `${av.w}x${av.h} (area ${av.area})` : 'ABSENT'}`
        + `   cards collapsed=${afterClick ? afterClick.cardsCollapsed : '-'}`);
      if (fv && fv.clippers.length) {
        console.log(`    clipped by   ${fv.clippers.map((c) => `${c.cls}[${c.box.join('x')}]`).join(' < ')}`);
      }
      if (afterClick) {
        console.log(`    cost         clicks=${clicks}  strip ${afterClick.stripBox ? `${afterClick.stripBox.w}x${afterClick.stripBox.h} top=${afterClick.stripBox.top}` : 'ABSENT'}`
          + `  aboveFold=${afterClick.stripAboveFold}  fullyVisible=${afterClick.stripFullyVisible}  vh=${afterClick.viewportH}`);
      }
      if (refold) {
        console.log(`    refold       cards collapsed=${refold.cardsCollapsed}`
          + `  figure ${refold.figure ? `${refold.figure.w}x${refold.figure.h}` : 'ABSENT'}`);
      }
      console.log(`    #305 mirror  .equipped-figure transform=${arrival.artTransform}`
        + `   .armoury-figure transform=${arrival.figTransform}`);

      // ---- the gates -----------------------------------------------------
      // THE FIGURE'S ABSENCE AT NARROW IS A DECLARED PROPERTY, NOT A DEFECT, and
      // asserting it away would be this tool lying about the phone. `rack` is the
      // view `narrowDefaultView` opens a phone on and its whole job is `figure:
      // false` — so the gate is read off what the screen SAYS it is drawing
      // (`data-figure`), never off the shape. A phone that starts drawing a
      // figure will be gated here the moment it does.
      if (arrival.dataFigure === '1' && !f) { console.log('    FAIL view declares a figure and none rendered'); fails++; }
      if (arrival.dataFigure === '0') {
        console.log('    note: this view declares no figure (data-figure=0) — nothing for the strip to squeeze here');
      }
      // THE RULING, AS A NUMBER. Where a figure exists, it must arrive WHOLE:
      // its visible area is its layout area, not a clipped band of it.
      if (arrival.dataFigure === '1' && f && fv) {
        const whole = fv.area >= f.area * 0.98;
        console.log(`    ruling      figure arrives ${whole ? 'WHOLE' : 'CLIPPED'}`
          + `  visible/layout = ${(fv.area / f.area * 100).toFixed(0)}%`);
        if (!whole) { console.log('    FAIL the figure does not arrive whole — the ruling is not met'); fails++; }
      }
      if (!arrival.foldBtnPresent) { console.log('    FAIL no CARDS control — nothing to click'); fails++; }
      if (refold && refold.cardsCollapsed !== arrival.cardsCollapsed) {
        console.log('    FAIL cards did not return to their arrival state after a second click'); fails++;
      }
      // #305: exactly one mirror on the art, none added to the container.
      if (arrival.artTransform && arrival.artTransform !== 'none'
          && arrival.artTransform !== 'matrix(-1, 0, 0, 1, 0, 0)') {
        console.log(`    FAIL .equipped-figure transform is not the single #305 mirror: ${arrival.artTransform}`); fails++;
      }
      if (arrival.figTransform && arrival.figTransform !== 'none') {
        console.log(`    FAIL a transform appeared on .armoury-figure — second mirror risk: ${arrival.figTransform}`); fails++;
      }
    }
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    cdp.close(); await dropBrowser(); await (s.close ? s.close() : s.stop ? s.stop() : Promise.resolve());
  }

  if (json) console.log('\n' + JSON.stringify(out, null, 2));
  console.log(`\n  ${fails ? `${fails} FAIL` : 'all gates green'}`);
  process.exit(fails ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
