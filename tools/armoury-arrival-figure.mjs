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
// click plus a scroll is not the cost he was told.
//
// WHAT IS GATED vs WHAT IS ONLY REPORTED — stated here because the first two
// versions of this file printed four numbers and asserted two of them, and a
// printed number reads as a checked one. Codex found both gaps at `e5fe1dd`;
// two non-author verdicts had passed this probe without asking whether it
// asserted what it printed.
//   GATED    figure arrives whole (where the view declares one) · CARDS arrives
//            COLLAPSED, on every shape · one click actually EXPANDS it, to a box
//            with AREA, ABOVE THE FOLD · the fold round-trips · #305's mirror is
//            the literal single matrix where a figure is declared — ZERO mirrors
//            fail it, which they did not until Codex found that at `b9b3e81`
//   REPORTED stripFullyVisible — false at `dev` and at head alike, a pre-existing
//            scroll this change neither adds nor removes. Labelled in the output
//            so it cannot be mistaken for a gate.
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
          + `  aboveFold=${afterClick.stripAboveFold} [GATED]`
          + `  fullyVisible=${afterClick.stripFullyVisible} [reported, not gated]`
          + `  vh=${afterClick.viewportH}`);
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
      // THE RULING'S OTHER HALF, AND IT IS NOT THE FIGURE'S. D99 is two sentences:
      // the Armoury opens on the figure, AND *cards start carded*. The round trip
      // below only proves the fold is reversible — it is satisfied by ANY starting
      // state, so on its own it would pass a tree where CARDS arrives expanded.
      // Asserted on EVERY shape, and deliberately NOT behind `data-figure`: the
      // figure gate is skipped at narrow because that view declares no figure and
      // asserting one would be this tool lying about the phone — but CARDS exists
      // on every shape, so its arrival state is gated on every shape. Skipping
      // both together is what let a narrow-only regression read "all gates green".
      if (arrival.cardsCollapsed === null) {
        console.log('    FAIL no CARDS region — its arrival state cannot be read'); fails++;
      } else if (arrival.cardsCollapsed !== '1') {
        console.log(`    FAIL CARDS did not arrive collapsed (data-collapsed=${arrival.cardsCollapsed}) — the ruling is not met on this shape`); fails++;
      }
      if (refold && refold.cardsCollapsed !== arrival.cardsCollapsed) {
        console.log('    FAIL cards did not return to their arrival state after a second click'); fails++;
      }
      // ONE CLICK HAS TO OPEN SOMETHING YOU CAN SEE. `stripAboveFold` was computed
      // and PRINTED from the first run of this tool and asserted by nothing, so a
      // strip pushed entirely below the viewport exited 0 — the exact regression
      // this file exists to catch, passing. Gated now, on every shape.
      //
      // `stripFullyVisible` is REPORTED and deliberately NOT gated, and the
      // distinction is the whole point rather than an omission: the strip's last
      // row already sat below the fold at `dev` on arrival, so gating it true
      // would red a condition this change did not introduce and Constantine never
      // ruled on. What he was quoted is ONE CLICK; what that click opens has to be
      // REACHABLE, which is `aboveFold`. A number a tool prints is either gated or
      // labelled — printing it bare is how a check goes quiet.
      //
      // AND THE CLICK HAS TO HAVE DONE SOMETHING FIRST. Codex, at `b9b3e81`: if the
      // CARDS handler regresses to a no-op, the collapsed `.equip-cards` still
      // answers `getBoundingClientRect()` with a 0x0 box at top 0 — which is inside
      // the viewport, so `aboveFold` reads TRUE — and the second no-op leaves
      // `refold.cardsCollapsed` equal to arrival, so the round-trip check passes too.
      // Reproduced by planting `if (r.id === 'cards') return;` in the handler: every
      // gate green while one click opened nothing. So the state change is asserted
      // BEFORE the geometry, and the box is required to have AREA — `aboveFold` on a
      // zero-sized box is a claim about a point, not about a pane.
      // Scoped to a CORRECT arrival, deliberately: from a wrongly-expanded arrival the
      // first click legitimately COLLAPSES, and a gate that shouted "the control is
      // inert" there would name the wrong cause beside the gate that names the right
      // one. One defect, one message — the arrival gate above owns that case.
      if (afterClick && arrival.cardsCollapsed === '1') {
        if (afterClick.cardsCollapsed !== '0') {
          console.log(`    FAIL one click did not expand CARDS (data-collapsed=${afterClick.cardsCollapsed} after the click) — the control is inert`); fails++;
        } else if (!afterClick.stripBox || afterClick.stripBox.w <= 0 || afterClick.stripBox.h <= 0) {
          console.log(`    FAIL CARDS reports expanded but its strip has no area (${afterClick.stripBox ? `${afterClick.stripBox.w}x${afterClick.stripBox.h}` : 'ABSENT'}) — nothing was opened`); fails++;
        } else if (afterClick.stripAboveFold !== true) {
          console.log(`    FAIL one click opened CARDS below the fold (top=${afterClick.stripBox.top}, vh=${afterClick.viewportH})`
            + ' — the cost is a click AND a scroll, not the click he was quoted'); fails++;
        }
      }
      // #305: EXACTLY ONE MIRROR ON THE ART — and "exactly one" has to exclude ZERO.
      //
      // THIS GUARD WAS WEAKER THAN TWO REVIEWERS SAID IT WAS, AND I AM WRITING THAT
      // HERE RATHER THAN QUIETLY STRENGTHENING IT. As first written the condition read
      // `artTransform && artTransform !== 'none' && artTransform !== matrix(...)`, so it
      // fired only on a WRONG transform. A MISSING one — the `scaleX(-1)` rule deleted,
      // which Chromium resolves to `none` — passed, and a missing art element (`null`)
      // passed too. Codex found it at `b9b3e81`; I planted it by dropping
      // `.equipped-figure` from that rule and the tool printed `all gates green` with
      // the mirror gone. My own PR body and Viki's PASS both cited this row as proof
      // #305 was undisturbed, and she named it specifically as "measured as resolved
      // transforms, not inferred from the empty CSS diff". The measurement was real;
      // the ASSERTION over it accepted the defect it was named for. A double flip and
      // a deleted flip look the same to a reader and did not look the same to this
      // check — it caught one and waved the other through.
      //
      // Where the view DECLARES a figure, the art must carry the literal single mirror.
      // At narrow, `data-figure=0` and there is no art, so there is nothing to assert
      // and the tool says nothing rather than inventing a claim about the phone.
      if (arrival.dataFigure === '1') {
        if (arrival.artTransform === null) {
          console.log('    FAIL the view declares a figure but .equipped-figure is absent — #305\'s mirror has nothing to sit on'); fails++;
        } else if (arrival.artTransform !== 'matrix(-1, 0, 0, 1, 0, 0)') {
          console.log(`    FAIL .equipped-figure is not carrying #305's single mirror: ${arrival.artTransform}`
            + (arrival.artTransform === 'none' ? ' — the mirror is GONE, not doubled' : '')); fails++;
        }
      } else if (arrival.artTransform && arrival.artTransform !== 'none'
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
