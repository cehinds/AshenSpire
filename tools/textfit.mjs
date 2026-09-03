#!/usr/bin/env node
// tools/textfit.mjs — THE GATE FOR "NOTHING BLEEDS", MEASURED ON A REAL PAGE.
//
// WHY THIS TOOL HAD TO EXIST. Every text overflow found in the UI-unification
// pass was found BY EYE, in a screenshot Constantine sent: a footer button
// clipped off its panel, a third button gone entirely, a tooltip title wrapping
// its display face to two lines, a card's landmarks drifting because a name
// took a second line. Not one of them was caught by a check. The kit's §02
// states the rule ("no text and no container may ever overflow its box") and
// tools/modal-shell-contract.mjs says plainly that it cannot enforce it —
// overflow is a fact about RENDERED BOXES, so the only honest instrument is a
// browser.
//
// WHAT COUNTS AS A BLEED, and why each escape hatch is allowed:
//   an element whose own text overflows its own box, AND whose box neither
//   scrolls (`overflow: auto|scroll`) nor declares a truncation
//   (`text-overflow: ellipsis`, `-webkit-line-clamp`).
// A scroller is not a bleed: the content is reachable. A clamp is not a bleed:
// the cut is deliberate and §02 requires the full text in a tooltip beside it —
// which THIS tool does not check, and says so below.
//
// SEPARATELY: an element whose rect leaves the viewport is reported even if it
// would otherwise be fine, because a control off the screen cannot be pressed.
//
// BOUNDARY, and it is a real one:
//   - `--webkit-line-clamp` and `ellipsis` are taken at their word. That a
//     truncated element also OFFERS its full text (a tooltip, a modal) is §02's
//     other half and is not measured here.
//   - one text size (the default). Law 4 says text scaling must not scale
//     non-text UI; proving that needs the same sweep at every step and is the
//     obvious next version.
//   - headless Chromium on one Linux box, default fonts. A font substitution
//     changes advance widths, so a green run here is not a green run on a
//     player's machine — it is a green run on the shapes and faces named.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SELFTEST = process.argv.includes('--selftest');

// The shapes the house measures at. 320x640 is the floor, 1200x730 the desk.
const SHAPES = [
  { w: 320, h: 640, d: 2, mobile: true },
  { w: 390, h: 844, d: 3, mobile: true },
  { w: 1200, h: 730, d: 1, mobile: false },
];

// Real screens, by their `?shot=` state (src/main.js reads it). Not every
// state — the ones a player spends time on, plus the two that carry the most
// text (compendium, changelog-bearing settings via title).
const SCREENS = ['title', 'startup', 'map', 'combat', 'shop', 'rest', 'reward', 'event', 'customize', 'compendium'];

const browserPath = [process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve: done, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else done(msg.result);
  });
  return {
    ready: new Promise((done, fail) => { ws.addEventListener('open', done); ws.addEventListener('error', fail); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, reject) => {
        pending.set(id, { resolve: done, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

// Runs INSIDE the page. Kept as one expression so it can be handed to
// Runtime.evaluate without a build step.
const PROBE = `(() => {
  const out = { bleeds: [], escaped: [], scanned: 0 };
  const id = (el) => el.tagName.toLowerCase()
    + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '');
  const snippet = (el) => (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 44);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    out.scanned += 1;
    const scrolls = /auto|scroll/.test(cs.overflowX) || /auto|scroll/.test(cs.overflowY);
    const clamps = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    const ellipsis = cs.textOverflow === 'ellipsis';
    const dx = el.scrollWidth - el.clientWidth;
    const dy = el.scrollHeight - el.clientHeight;
    if ((dx > 1 || dy > 1) && !scrolls && !clamps && !ellipsis) {
      out.bleeds.push({ el: id(el), dx: Math.round(dx), dy: Math.round(dy), text: snippet(el) });
    }
    // IS IT REACHABLE, NOT IS IT VISIBLE. The first cut of this check compared
    // every rect to the viewport and reported 158 findings, nearly all of them
    // rows scrolled out of a list that scrolls — reachable content, wrongly
    // called escaped. A gate that cries wolf 158 times is worse than no gate,
    // because the real 33 are then invisible inside it.
    // So: find the nearest ancestor that CLIPS. If it scrolls, the element is
    // reachable by scrolling and is not a finding, however far outside the
    // viewport it currently sits. Only content clipped by something that
    // CANNOT scroll — or by the document itself — has actually escaped.
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      let clip = el.parentElement;
      let scrollable = false;
      while (clip && clip !== document.body) {
        const ps = getComputedStyle(clip);
        const oflow = ps.overflowX + ' ' + ps.overflowY;
        if (/hidden|auto|scroll|clip/.test(oflow)) {
          scrollable = /auto|scroll/.test(oflow)
            && (clip.scrollHeight > clip.clientHeight + 1 || clip.scrollWidth > clip.clientWidth + 1);
          break;
        }
        clip = clip.parentElement;
      }
      if (!scrollable) {
        const box = clip && clip !== document.body
          ? clip.getBoundingClientRect()
          : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        if (r.right > box.right + 1 || r.left < box.left - 1 || r.bottom > box.bottom + 1 || r.top < box.top - 1) {
          out.escaped.push({ el: id(el), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
            view: [Math.round(box.right - box.left), Math.round(box.bottom - box.top)], text: snippet(el) });
        }
      }
    }
  }
  return out;
})()`;

// THE PLANT. A tool that has never been observed red is a tool nobody should
// quote. This injects one element that bleeds in the exact shape the rule
// forbids — a nowrap label wider than a fixed box, with no scroller and no
// declared truncation — and the run FAILS if the probe does not find it.
const PLANT = `(() => {
  const el = document.createElement('div');
  el.className = 'textfit-plant';
  el.style.cssText = 'position:fixed;left:0;top:0;width:40px;overflow:hidden;white-space:nowrap;font-size:14px';
  el.textContent = 'A LABEL FAR WIDER THAN FORTY PIXELS';
  document.body.appendChild(el);
  return true;
})()`;

async function main() {
  if (!browserPath) { console.error('textfit UNKNOWN — no chromium found. Set CHROME=/path/to/chrome.'); return 2; }
  const server = await serve({ root: ROOT, port: 8291, open: false });
  const launched = await launchBrowser({ prefix: 'textfit-', browser: browserPath, timeoutMs: 20000 });
  const cdp = connectCdp(launched.wsUrl);
  const findings = [];
  let scanned = 0;
  let plantSeen = 0;
  let plantRuns = 0;
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);

    for (const shape of SHAPES) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: shape.w, height: shape.h, deviceScaleFactor: shape.d, mobile: shape.mobile }, sessionId);
      for (const screen of SCREENS) {
        await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=${screen}` }, sessionId);
        // Wait for the app to paint something of its own before measuring.
        let ready = false;
        for (let i = 0; i < 60 && !ready; i++) {
          const r = await cdp.send('Runtime.evaluate',
            { expression: 'document.querySelectorAll("body *").length > 12', returnByValue: true }, sessionId);
          ready = r.result?.value === true;
          if (!ready) await new Promise((d) => setTimeout(d, 100));
        }
        if (!ready) { findings.push({ shape, screen, err: 'never painted' }); continue; }
        await new Promise((d) => setTimeout(d, 220));

        if (SELFTEST) {
          plantRuns += 1;
          await cdp.send('Runtime.evaluate', { expression: PLANT, returnByValue: true }, sessionId);
        }
        const res = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true, awaitPromise: true }, sessionId);
        const got = res.result?.value;
        if (!got) { findings.push({ shape, screen, err: 'probe returned nothing' }); continue; }
        scanned += got.scanned;
        if (SELFTEST) {
          if (got.bleeds.some((b) => b.el.includes('textfit-plant'))) plantSeen += 1;
          continue;
        }
        for (const b of got.bleeds) findings.push({ shape, screen, kind: 'bleed', ...b });
        for (const e of got.escaped) findings.push({ shape, screen, kind: 'escaped', ...e });
      }
    }
  } finally {
    cdp.close();
    await launched.close();
    server.server.close();
  }

  const shapes = SHAPES.map((s) => `${s.w}x${s.h}`).join(', ');
  if (SELFTEST) {
    console.log(`textfit --selftest: plant observed red in ${plantSeen}/${plantRuns} page(s)`);
    if (plantSeen !== plantRuns) {
      console.error('textfit --selftest RED — the probe MISSED a planted bleed. It cannot be quoted until it sees one.');
      return 1;
    }
    console.log('textfit --selftest OK — the probe sees a bleed it is meant to see.');
    return 0;
  }

  console.log(`textfit: ${scanned} text-bearing element(s) measured across ${SCREENS.length} screen(s) x ${SHAPES.length} shape(s)`);
  console.log(`      shapes: ${shapes}; screens: ${SCREENS.join(', ')}`);
  if (!findings.length) {
    console.log('textfit GREEN — no text overflowed a box that neither scrolls nor declares a truncation.');
  } else {
    for (const f of findings) {
      const at = `${f.shape.w}x${f.shape.h} ${f.screen}`;
      if (f.err) console.error(`  ERR   ${at} — ${f.err}`);
      else if (f.kind === 'bleed') console.error(`  BLEED ${at} ${f.el} overflows by ${f.dx}x${f.dy}px — "${f.text}"`);
      else console.error(`  OFF   ${at} ${f.el} at [${f.rect}] outside [${f.view}] — "${f.text}"`);
    }
    console.error(`\ntextfit RED — ${findings.length} finding(s)`);
  }
  console.log('BOUNDARY: a clamp/ellipsis is taken at its word — that a truncated element also OFFERS');
  console.log('      its full text is the rule\'s other half and is NOT measured here. One text size,');
  console.log('      headless Chromium, default fonts: a green run is green on the shapes named.');
  return findings.length ? 1 : 0;
}

process.exit(await main());
