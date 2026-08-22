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
// EACH SHAPE DECLARES WHAT IT EXPECTS TO SEE, because `data-figure` alone cannot
// tell an EXPECTED absence from a REGRESSION. Codex, at `7d39ad3`: flip
// `balance.equipment.defaultView` from `hybrid` to the figureless `rack` and the
// DESKTOP reports `data-figure=0`, so every figure and mirror assertion is skipped
// and the run exits green — with the figure gone from the exact screen D99 is about.
// Planted and confirmed: `view=rack data-figure=0 … all gates green`.
//
// The phone is the ONLY shape whose figurelessness is expected, and it is expected
// because `narrowDefaultView` opens `rack`, whose whole job is `figure: false`. So
// the expectation is stated HERE, per shape, and asserted BEFORE `data-figure` is
// allowed to excuse anything — the same move Vira made in `foldsurvivors`: do not
// trust a state, assert the input that produces it.
const SHAPES = [
  { name: 'desktop', w: 1440, h: 860, expectFigure: true },
  { name: 'phone', w: 390, h: 844, expectFigure: false },
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
    // INTERSECTS THE VIEWPORT — not merely "starts before its bottom edge".
    // top < vh alone accepts a strip lying ENTIRELY ABOVE the viewport: Codex,
    // at 7d39ad3, top=-500 bottom=-131. Planted top: -1400px and the tool
    // printed top=-1079 aboveFold=true and all-gates-green on a pane no player
    // could see. A half-open interval where the claim is an INTERSECTION. Both
    // edges now; the name is kept so the output line reads the same for anyone
    // comparing runs. (No backticks in this comment: it lives inside PROBE's
    // own template literal, and a stray one ends the string.)
    stripAboveFold: strip ? (box(strip).top < vh && box(strip).bottom > 0) : null,
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
  // A COUNTED VERDICT NEEDS A REAL COUNT. #294's door refuses a bare
  // `all gates green` as silence, and D103 said the bill for that would be paid
  // per tool — this is one of the n. So every assertion is RECORDED as it is
  // evaluated, and the terminal line states what was actually counted. The
  // number is never typed: if a branch does not run, it is not in it.
  let checks = 0;
  let unknowns = 0;
  const unknownWhy = new Set();
  const gate = (ok, msg) => {
    checks++;
    if (!ok) { console.log(`    FAIL ${msg}`); fails++; }
    return ok;
  };
  const skip = (why) => { unknowns++; unknownWhy.add(why); };
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
      //
      // WHAT THIS TOOL PROVES AND WHAT IT DOES NOT — stated here and PRINTED
      // unconditionally at the end, because three rounds of findings on this file
      // were all one shape: geometry satisfied without reachability, or a state
      // trusted instead of asserted.
      //
      // It drives `HTMLElement.click()`. That runs the handler whether the control
      // is visible, on-screen, covered, or hit-testable at all. Codex demonstrated
      // it at `7d39ad3` and I planted it: `pointer-events: none; opacity: 0` on the
      // CARDS control — unpressable by any player — and every gate green with
      // `clicks=1`. VIKI NAMED THIS EXACT BOUNDARY IN #304's BODY and this probe
      // inherited the limit without the declaration. It is declared now, in the
      // output rather than in a comment, and the reachability gate is a card with
      // her `body.style.zoom` coordinate finding attached — #315's A6 already
      // drives real CDP input aimed with `elementFromPoint`, so the door exists and
      // duplicating it here would be a second home for one act.
      //
      // THE EXPECTED VIEW, ASSERTED BEFORE `data-figure` IS ALLOWED TO EXCUSE
      // ANYTHING. Otherwise a desktop regressed to the figureless `rack` skips every
      // figure and mirror check and exits green.
      if (shape.expectFigure) {
        gate(arrival.dataFigure === '1',
          `this shape must open on a view that DECLARES a figure, and it opened on `
          + `'${arrival.view}' with data-figure=${arrival.dataFigure} `
          + `— check balance.equipment.defaultView; every figure and mirror gate below `
          + `is skipped when this is 0, so a regression here would otherwise pass in silence`);
      } else {
        gate(arrival.dataFigure === '0',
          `this shape is expected to open on the figureless view and it declared a figure `
          + `(view='${arrival.view}', data-figure=${arrival.dataFigure}) — the phone's `
          + `no-op claim in this PR would no longer hold`);
        console.log('    note: this view declares no figure (data-figure=0) — nothing for the strip to squeeze here');
      }

      // THE FIGURE'S ABSENCE AT NARROW IS A DECLARED PROPERTY, NOT A DEFECT, and
      // asserting it away would be this tool lying about the phone. The gate is read
      // off what the screen SAYS it is drawing (`data-figure`) — but only now that
      // the line above has proved the screen was ASKED to draw one.
      if (arrival.dataFigure === '1') {
        const rendered = gate(!!f, 'view declares a figure and none rendered');
        // THE RULING, AS A NUMBER. Where a figure exists, it must arrive WHOLE:
        // its visible area is its layout area, not a clipped band of it.
        if (rendered && fv) {
          const whole = fv.area >= f.area * 0.98;
          console.log(`    ruling      figure arrives ${whole ? 'WHOLE' : 'CLIPPED'}`
            + `  visible/layout = ${(fv.area / f.area * 100).toFixed(0)}%`);
          gate(whole, 'the figure does not arrive whole — the ruling is not met');
        } else {
          skip('the figure did not render, so its arrival area could not be measured');
        }
      } else {
        skip('the view declares no figure (data-figure=0), so the arrival-area gate does not apply');
      }

      gate(arrival.foldBtnPresent, 'no CARDS control — nothing to click');

      // THE RULING'S OTHER HALF, AND IT IS NOT THE FIGURE'S. D99 is two sentences:
      // the Armoury opens on the figure, AND *cards start carded*. The round trip
      // below only proves the fold is reversible — it is satisfied by ANY starting
      // state. Asserted on EVERY shape and deliberately NOT behind `data-figure`:
      // CARDS exists on every shape, and skipping both together is what let a
      // narrow-only regression read "all gates green".
      if (arrival.cardsCollapsed === null) {
        gate(false, 'no CARDS region — its arrival state cannot be read');
      } else {
        gate(arrival.cardsCollapsed === '1',
          `CARDS did not arrive collapsed (data-collapsed=${arrival.cardsCollapsed}) — the ruling is not met on this shape`);
      }

      if (refold) {
        gate(refold.cardsCollapsed === arrival.cardsCollapsed,
          'cards did not return to their arrival state after a second click');
      } else {
        skip('the fold control was absent, so the second click was never driven');
      }

      // ONE CLICK HAS TO OPEN SOMETHING YOU CAN SEE — three assertions in order,
      // because each is only meaningful once the one before it holds.
      //
      //   (i)  the click CHANGED THE STATE. A no-op handler leaves the collapsed
      //        `.equip-cards` answering with a 0x0 box at top 0 — inside the
      //        viewport, so `aboveFold` reads TRUE — and the second no-op leaves
      //        `refold` equal to arrival, so the round trip passes too.
      //   (ii) what opened HAS AREA. `aboveFold` on a zero-sized box is a claim
      //        about a point, not about a pane.
      //   (iii) and it INTERSECTS THE VIEWPORT, both edges — see `stripAboveFold`.
      //
      // `stripFullyVisible` is REPORTED and deliberately NOT gated: it is false at
      // `dev` and at head alike, a pre-existing scroll this change neither adds nor
      // removes, and gating it would red a condition nobody ruled on. A number a
      // tool prints is either GATED or LABELLED.
      //
      // Scoped to a CORRECT arrival: from a wrongly-expanded arrival the first click
      // legitimately COLLAPSES, and shouting "the control is inert" there would name
      // the wrong cause beside the gate that names the right one.
      if (afterClick && arrival.cardsCollapsed === '1') {
        const expanded = gate(afterClick.cardsCollapsed === '0',
          `one click did not expand CARDS (data-collapsed=${afterClick.cardsCollapsed} after the click) — the control is inert`);
        if (expanded) {
          const hasArea = gate(!!afterClick.stripBox && afterClick.stripBox.w > 0 && afterClick.stripBox.h > 0,
            `CARDS reports expanded but its strip has no area (${afterClick.stripBox ? `${afterClick.stripBox.w}x${afterClick.stripBox.h}` : 'ABSENT'}) — nothing was opened`);
          if (hasArea) {
            gate(afterClick.stripAboveFold === true,
              `one click opened CARDS outside the viewport (top=${afterClick.stripBox.top}, bottom=${afterClick.stripBox.bottom}, vh=${afterClick.viewportH})`
              + ' — the cost is a click AND a scroll, not the click he was quoted');
          } else {
            skip('the opened strip had no area, so its position could not be judged');
          }
        } else {
          skip('the click did not expand CARDS, so nothing was opened to measure');
          skip('the click did not expand CARDS, so no opened pane could be placed');
        }
      } else {
        skip('CARDS did not arrive collapsed, so the one-click cost was not measurable from a correct start');
      }

      // #305: EXACTLY ONE MIRROR ON THE ART — and "exactly one" has to exclude ZERO.
      //
      // THIS GUARD WAS WEAKER THAN TWO REVIEWERS SAID IT WAS. As first written it
      // fired only on a WRONG transform, so a DELETED `scaleX(-1)` (Chromium: `none`)
      // and a missing art element (`null`) both passed. My own PR body and Viki's
      // PASS both cited this row as proof #305 was undisturbed. The measurement was
      // real; the assertion over it accepted the defect it was named for.
      if (arrival.dataFigure === '1') {
        if (arrival.artTransform === null) {
          gate(false, 'the view declares a figure but .equipped-figure is absent — #305\'s mirror has nothing to sit on');
        } else {
          gate(arrival.artTransform === 'matrix(-1, 0, 0, 1, 0, 0)',
            `.equipped-figure is not carrying #305's single mirror: ${arrival.artTransform}`
            + (arrival.artTransform === 'none' ? ' — the mirror is GONE, not doubled' : ''));
        }
      } else {
        skip('the view declares no figure, so there is no art to carry #305\'s mirror');
      }
      gate(!arrival.figTransform || arrival.figTransform === 'none',
        `a transform appeared on .armoury-figure — second mirror risk: ${arrival.figTransform}`);
    }
  } finally {
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    cdp.close(); await dropBrowser(); await (s.close ? s.close() : s.stop ? s.stop() : Promise.resolve());
  }

  if (json) console.log('\n' + JSON.stringify(out, null, 2));

  // THE BOUNDARY IS PRINTED, NOT COMMENTED — unconditionally, green or red.
  // Three rounds of findings on this file were one shape: geometry satisfied
  // without reachability. Two of those were predicate bugs and are fixed. The
  // third is the tool's SHAPE and is not fixable here, so it is declared where a
  // reader of the output will see it, the way gatelist and hintstrip declare
  // theirs. A limit stated only in a comment is a limit the next reader inherits
  // as a defect — which is exactly what happened between #304's body and this file.
  console.log('');
  console.log('  BOUNDARY — what a green here does NOT mean:');
  console.log('   · THE CLICK IS A DOM `.click()`, NOT A PRESS. It runs the handler whether the');
  console.log('     control is visible, on screen, covered, or hit-testable. Planted');
  console.log('     `pointer-events: none; opacity: 0` on the CARDS control — unpressable by any');
  console.log('     player — and every gate here still passed with clicks=1. SO THIS TOOL DOES');
  console.log('     NOT PROVE A PLAYER CAN PERFORM THE CLICK D99 PRICED. It proves the handler');
  console.log('     is wired and the geometry that follows is right. Viki named this same limit');
  console.log('     in #304 and measured why it is hard here (body.style.zoom: rect px and CDP');
  console.log('     input px are different spaces); #315\'s A6 is the door that solves it.');
  console.log('   · stripFullyVisible is REPORTED, never gated — false at dev and at head alike.');
  console.log('   · two shapes only, 1440x860 and 390x844; the band between them is unmeasured.');
  console.log('   · one container, one headless Chromium, deviceScaleFactor 1. No pixels are');
  console.log('     compared here: every number above is a rect.');
  if (unknowns) {
    console.log('');
    console.log(`  ⚠ ${unknowns} assertion(s) resolved to \`unknown\` this run and are counted in NEITHER`);
    console.log('    the verdict below nor the failures. `unknown` shrinks this tool\'s denominator');
    console.log('    and leaves its EXIT STATUS UNCHANGED — printed unconditionally so a run that');
    console.log('    quietly stops asserting things is visible as a falling count, not as silence:');
    for (const why of unknownWhy) console.log(`      · ${why}`);
  }

  // ONE TERMINATED VERDICT LINE, CARRYING WHAT WAS ACTUALLY COUNTED. #294's
  // `readVerdict` refuses a bare "all gates green" as silence, and D103 ruled the
  // closed grammar stands and the bill is paid per tool. This is that payment.
  // The count is DERIVED — every gate() call increments it as it is evaluated —
  // so it cannot be a number typed to satisfy a parser. Nothing trails the claim:
  // the commentary above is on its own lines, which is the door's whole contract.
  console.log('');
  if (fails) console.log(`  armoury-arrival-figure: ${fails} of ${checks} checks FAILED`);
  else console.log(`  armoury-arrival-figure: OK — ${checks} checks passed`);
  process.exit(fails ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(2); });
