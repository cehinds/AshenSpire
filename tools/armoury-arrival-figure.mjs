// Armoury tab reachability and visible character/card geometry in a real browser.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
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
    // THE SAME PRIMITIVE THE FIGURE ALREADY USES, applied to the subject it was
    // never applied to. This file solved this once: the figure's own rect reads
    // 260x330 whether the strip is open or shut, so measuring the RECT reports
    // nothing changed while half the figure sits behind a clipped edge — and the
    // answer was not a predicate, it was measuring the rect intersected with every
    // clipping ancestor and the viewport. Then the strip was measured with
    // hand-rolled vertical arithmetic instead. Four rounds of findings all reduce
    // to that: geometry satisfiable while nothing is on screen. The knowledge was
    // in the file; the code used it for one subject and not the other.
    stripVisible: visible(strip),
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

let checks = 0, failures = 0;
const gate = (ok, label) => { checks++; console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++; };
let server, browser, cdp;
try {
  server = await serve({ root: ROOT, port: 8491, open: false });
  browser = await launchBrowser({ prefix: 'armfig-', timeoutMs: 20000 });
  cdp = connectCdp(browser.wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const ev = async expression => { const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  const until = async expression => { for (let i = 0; i < 300; i++) { if (await ev(expression)) return; await wait(100); } throw new Error(`Timeout: ${expression}`); };
  for (const [width, height] of [[1440, 860], [390, 844], [320, 740]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=combat&shotSeed=ART1` }, sessionId);
    await until('!!document.querySelector("#combat-armoury")');
    await ev('document.querySelector("#combat-armoury").click()');
    await until('!!document.querySelector(".armoury")');
    gate(await ev('document.querySelector(".armoury").dataset.page === "rack"'), `${width}: Equipment is the default tab`);
    for (const tab of ['grid', 'rack', 'hybrid', 'cards']) {
      await ev(`document.querySelector('.armoury [data-member="${tab}"]').click()`);
      await wait(200);
      gate(await ev(`document.querySelector('.armoury [data-member="${tab}"]').getAttribute('aria-selected') === 'true'`), `${width}: ${tab} tab opens`);
      gate(await ev('(()=>{const e=document.querySelector(".armoury-shell-body");return e.scrollWidth <= e.clientWidth+1})()'), `${width}: ${tab} stays within the modal width`);
      if (tab === 'grid') {
        gate(await ev('!document.querySelector(".armoury-inventory")'), `${width}: Character contains no inventory list`);
        const reading = await ev(PROBE);
        gate(reading.figure?.area > 0 && reading.figureVisible?.area >= reading.figure.area * .95, `${width}: character figure is visible without clipping`);
      }
      if (tab === 'cards') {
        const reading = await ev(`(()=>{const cards=[...document.querySelectorAll('.armoury-card-gallery > .card')];const first=cards[0];const r=first?.getBoundingClientRect();const body=document.querySelector('.armoury-shell-body').getBoundingClientRect();return {count:cards.length,ratio:r?.width/r?.height,visible:r?.top>=body.top && r?.bottom<=body.bottom,text:first?parseFloat(getComputedStyle(first.querySelector('.ctext')).fontSize)*parseFloat(getComputedStyle(document.body).zoom || '1'):0};})()`);
        gate(reading.count > 5, `${width}: deck gallery contains the class and equipment cards`);
        gate(Math.abs(reading.ratio - 5/7) < .02 && reading.visible, `${width}: first card keeps its profile and is fully visible`);
        gate(reading.text >= 14.9, `${width}: card body text has a 15px reading floor`);
      }
    }
  }
} catch (error) { failures++; console.error(error); }
finally {
  cdp?.close(); if (browser) await browser.close(); if (server) await new Promise(resolve => server.server.close(resolve));
  console.log('BOUNDARY: DOM-driven tab clicks and geometry in Chromium at three widths; pointer hit testing is covered by the separate Playwright preview checks.');
  console.log(`${checks-failures}/${checks} Armoury tab checks passed.`);
  process.exitCode = failures ? 1 : 0;
}
