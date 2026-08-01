// tools/menufit.mjs — the two surfaces a player manages a RUN from: the Armoury
// (equip slots) and the in-run ☰ overlay (deck, relics, stats). Does either fit
// the phone it is opened on?
//
// WHY THIS EXISTS. Constantine, from his own device: "it's hard to manage equip
// slots and other characteristics from menus due to scaling not auto adjusting
// for mobile screen very well." Sunna measured it and found both halves:
//
//   - THE ARMOURY HID TWO OF SIX WEAPON SLOTS. At 390x844 in the shipped default
//     view the third cell of each hand sat at x 380.55..443.55 in a 390-wide
//     screen — 9.45 px of a 63 px box, with no sideways scroll to reach it. Four
//     cells at Text L/XL. Her note on cause is the whole story: `ui.css` had
//     exactly ONE `data-layout='narrow'` block and it belonged to character
//     creation. The Armoury had never had a phone layout.
//   - THE MENU SHRANK AS THE PHONE SHRANK. `.overlay-modal { max-width: 92vw;
//     height: 74vh }` — vw/vh below <body>, which Law 2 forbids — so the share of
//     the screen it got was 74% x --ui-zoom exactly: 74.0% at zoom 1.0 and 54.8%
//     at 320x640. Auto sizing lowers the zoom as the phone gets smaller, so the
//     smallest phone got the smallest menu.
//
// NEITHER SURFACE IS SWEPT BY ANYTHING ELSE, and that is why this is a new tool
// rather than a clause somewhere. tools/screenreach.mjs reaches only screens with
// a ?shot= state (title, map, combat, boss, death, customize) — the Armoury and
// the overlay are opened by pressing something, so it has never seen either.
// tools/actionreach.mjs asks whether one screen's primary action is on arrival.
// Neither can answer "is the whole surface inside the phone".
//
// WHAT IT CHECKS, per shape x Text size:
//   1. NO EQUIP CELL IS CLIPPED, in EVERY view, not just the one that opens.
//      A cell showing 15% of itself is a control a player can neither read nor
//      reliably hit, and this screen cannot scroll sideways.
//   2. THE VIEW A PHONE OPENS ON is one that fits. Sunna's ruling, and the part
//      of it that is hers: "hybrid must not be what a phone opens."
//   3. THE OVERLAY USES THE SHARE OF THE SCREEN ITS AUTHOR WROTE — height 74%
//      of the app box, within tolerance, at every zoom. This is Law 2 stated as
//      an observable rather than as a grep for `vh`.
//   4. NOTHING IN EITHER SURFACE IS HORIZONTALLY ABSENT.
//   5. TAP TARGETS meet a floor of 44 DEVICE px, measured after --ui-zoom, on
//      the controls this work touches (the overlay tab strip). Sunna's ruling on
//      Law 4 (#37): "a floor of 44 device px measured after zoom; a floor is not
//      a ceiling." Reported for every control, ENFORCED only on the tab strip —
//      widening enforcement is a decision, not a tuning, and it is Marina's.
//
// THE SHAPE LIST IS A CLAIM ABOUT WHERE THE DEFECT LIVES, AND IT WILL BE READ AS
// ONE. Sunna withheld on #36 for exactly this: my previous tool's list stopped at
// 430 while the narrow band runs to ~580, and the sampling's shape became the
// claim's shape. So the widths below are EDGES — the band's bottom, its middle,
// its top (580), the first WIDE shape (600), and desktop — not a comfortable
// handful. It is still not exhaustive and clause (b) of the boundary says how.
//
// Usage
//   node tools/menufit.mjs                  source tree via tools/serve.mjs
//   node tools/menufit.mjs --dist           dist/AshenSpire.html over file://
//   node tools/menufit.mjs --only 390x844
//
// Exit codes
//   0  both surfaces fit at every shape x text size
//   1  a finding
//   2  usage / no browser / a surface that would not open / NOTHING RUN
//
// OBSERVED RED: run against dist/AshenSpire.html as committed at d027a9a — the
// commit before this fix — this reports FAIL with clipped equip cells at every
// narrow shape and an overlay height share of 74% x zoom rather than 74%. The
// numbers are in the handback; it was watched failing before it counted.
//
// REMOVAL CONDITION: deleted the day screenreach can open a surface that needs a
// press (then clauses 1 and 4 are its job), or the day neither surface exists.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// Edges, not samples — see the header. 580 is the top of the narrow band and 600
// is the first wide shape, so the band's end is measured rather than assumed.
const SHAPES = [
  [320, 640], [360, 640], [390, 844], [412, 915], [430, 932],
  [480, 900], [512, 900], [560, 900], [580, 900], [600, 900],
  [1200, 730],
];
// balance.ui.textSize. Typed here is a second copy and it is the ONE value in
// this file that can drift (Law 1 clause 2), so it is called out, not hidden.
const TEXT = { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' };
const TAP_FLOOR = 44; // device px, AFTER --ui-zoom. Sunna's ruling, card #37.

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A RECT WITHOUT ITS CLIP BOX IS A RUMOUR. Sunna nearly filed the rack table as
// wrong at #41 because her first probe read 7/7 for all three views:
// getBoundingClientRect() reports where a box WOULD be and knows nothing about an
// ancestor's overflow. Every count below is intersected with .armoury-body's own
// box, which is the thing that actually scrolls.
//
// AND "REACHABLE BY SCROLLING" IS NOT "VISIBLE ON ARRIVAL". The first version of
// this file measured only HORIZONTAL clipping — so the 7/7 vs 4/7 vs 0/7 table
// that justifies narrowDefaultView: 'rack' was produced by a scratch script and
// guarded by nothing. The branch's central claim, unchecked. Sunna's finding.
const CELLS = `(() => { const n=(v)=>+(+v).toFixed(2);
  const out=[]; let clipped=0, worst=100, noScroll=0, total=0;
  const body=document.querySelector('.armoury-body');
  const port=body?body.getBoundingClientRect():{top:0,bottom:innerHeight};
  for (const e of document.querySelectorAll('.es-cell')) {
    const r=e.getBoundingClientRect(); if (r.width===0) continue;
    total++;
    const vis=Math.max(0, Math.min(r.right, innerWidth)-Math.max(r.left, 0))/r.width*100;
    if (vis < 99.5) { clipped++; worst=Math.min(worst, vis);
      out.push(((e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,14))+' ['+n(r.left)+'..'+n(r.right)+'] '+n(vis)+'%'); }
    if (r.top>=port.top-0.5 && r.bottom<=port.bottom+0.5 && r.left>=-0.5 && r.right<=innerWidth+0.5) noScroll++;
  }
  return { clipped, worst: clipped? n(worst): 100, eg: out.slice(0,2), total, noScroll,
    view: (document.querySelector('.armoury')||{className:''}).className.replace(/.*view-(\\w+).*/,'$1') }; })()`;

const OVERLAY = `(() => { const n=(v)=>+(+v).toFixed(2);
  const veil=document.querySelector('.modal-veil'); if(!veil) return {error:'no overlay'};
  const panel=veil.querySelector('.overlay-modal'); if(!panel) return {error:'no .overlay-modal'};
  const app=document.getElementById('app');
  const pr=panel.getBoundingClientRect(), ar=app.getBoundingClientRect();
  // The author wrote 74% of the app box. Measured in ONE space: both rects are
  // post-zoom device px, so the ratio is zoom-free and comparable across shapes.
  const share=n(pr.height/ar.height*100);
  let absent=0, tiny=[];
  for (const e of veil.querySelectorAll('.ov-tab')) {
    const r=e.getBoundingClientRect(); if(r.width===0&&r.height===0) continue;
    if (r.right<=0||r.left>=innerWidth) absent++;
    if (r.height < ${TAP_FLOOR}) tiny.push(((e.textContent||'').trim().slice(0,10))+' '+n(r.height)); }
  const rows=[]; for (const t of veil.querySelectorAll('.ov-tab')) {
    const q=t.getBoundingClientRect(); const rr=rows.find(z=>Math.abs(z.t-q.top)<=1);
    if(rr) rr.n++; else rows.push({t:q.top,n:1}); }
  return { share, panelH:n(pr.height), appH:n(ar.height), absent,
    tabRows: rows.length, tinyTabs: tiny.length, tinyEg: tiny.slice(0,2) }; })()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

async function main() {
  if (!browserPath) { console.error('menufit: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'menufit-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`menufit: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href + '?shot=map';
  } else {
    const s = await serve({ root: ROOT, port: 8268, open: false });
    server = s.server; base = `http://localhost:${s.port}/?shot=map`;
  }
  console.log(`menufit — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw'); return r.result.value; };
  const until = async (x, w, ms = 15000) => { const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return true; await wait(150); }
    throw new Error(`timed out waiting for ${w}`); };

  const fails = []; let cells = 0;
  for (const [w, h] of SHAPES) {
    const shape = `${w}x${h}`;
    if (only && only !== shape) continue;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: w < 700, maxTouchPoints: 5 }, S);
    console.log(`\n  ${shape}`);
    for (const [k, v] of Object.entries(TEXT)) {
      await cdp.send('Page.navigate', { url: base }, S);
      await until(`!!document.querySelector('.map-node')`, 'the map');
      await ev(`document.documentElement.style.fontSize='${v}'; 'ok'`);
      await wait(700); // auto-zoom re-flexes on a 150ms debounce
      const layout = await ev(`document.documentElement.getAttribute('data-layout')`);
      // READ FROM THE RUNNING BUILD, never typed here — a tool holding its own
      // copy of a content value is the second copy this house exists to catch
      // (Law 1 clause 2). `null` if the bundle does not expose it, and the clause
      // then reports `unknown` by not firing, which the boundary states.
      const expectNarrowView = await ev(`(() => { try { return (window.__equipCfg
        && window.__equipCfg.narrowDefaultView) || null; }
        catch (e) { return null; } })()`);

      // --- the Armoury: the view it OPENS on, then every other view ---
      await ev(`document.querySelector('#open-armoury').click(); 'ok'`);
      await until(`!!document.querySelector('.armoury')`, 'the armoury');
      await wait(700);
      const opened = await ev(CELLS);
      const perView = {};
      // Views read off the RUNNING PAGE, not typed here — a typed list skipped
      // 'gear' silently the day it was added (#42), which is this tool's own
      // "the corpus was the claim" failure one week on. Falls back to the three
      // originals only if the debug handle is absent, and says nothing then.
      const viewList = (await ev(`(window.__equipCfg && window.__equipCfg.views) || null`)) || ['grid', 'rack', 'hybrid'];
      for (const view of viewList) {
        const hit = await ev(`(() => { const b=[...document.querySelectorAll('.armoury-views button')]
          .find(x=>new RegExp('^${view}$','i').test((x.textContent||'').trim())); if(!b) return false; b.click(); return true; })()`);
        if (!hit) { fails.push(`${shape} ${k}: no '${view}' view button`); continue; }
        await wait(650);
        perView[view] = await ev(CELLS);
      }
      await ev(`(() => { const b=[...document.querySelectorAll('.armoury button')].find(x=>/close|✕|×/i.test(x.textContent||x.title||'')); if(b) b.click(); return 1; })()`);
      await wait(300);

      // --- the ☰ overlay ---
      await cdp.send('Page.navigate', { url: base }, S);
      await until(`!!document.querySelector('.map-node')`, 'the map');
      await ev(`document.documentElement.style.fontSize='${v}'; 'ok'`);
      await wait(650);
      await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/☰/.test(x.textContent)); b.click(); })()`);
      await until(`!!document.querySelector('.modal-veil .ov-tab')`, 'the overlay');
      await wait(600);
      const ov = await ev(OVERLAY);

      cells++;
      const bad = [];
      // CLAUSE 2, and it is the branch's CENTRAL claim rather than a nicety.
      // Constantine's verb was MANAGE; a slot you have to go looking for is not
      // managed. Narrow only — that is where the claim was made.
      // COMPARATIVE, NOT ABSOLUTE — and the first draft of this clause was
      // absolute and caught me with it. "Every cell without scrolling" is true of
      // rack at Text S/M and FALSE at L/XL (3 of 7 at 390x844 XL), because at
      // large text no view fits seven cells in one screen. My 7/7 figure was
      // measured at the default text size and stated as if it were the property —
      // the same shape of error Sunna withheld #36 for, found this time by the
      // check rather than by her.
      // The property that IS true and IS worth enforcing: a phone must not open on
      // a view when another available view would show MORE of your slots at once.
      // That survives every text size and still goes red on the known-bad, where
      // hybrid shows 0 and rack shows 7.
      const better = Object.entries(perView).filter(([, r]) => r.noScroll > opened.noScroll);
      if (layout === 'narrow' && better.length) {
        bad.push(`ARMOURY OPENS ON A WORSE VIEW — '${opened.view}' shows ${opened.noScroll}/${opened.total} equip cells without scrolling; `
          + better.map(([n2, r]) => `'${n2}' shows ${r.noScroll}`).join(', '));
      }
      // CLAUSE 2b — IS IT THE VIEW THE TABLE NAMES? Vira's condition: a typo
      // (`'racks'`) fell through to hybrid in silence and this check stayed green,
      // because the CSS half of the same PR had just made hybrid fit. The two
      // halves masked each other. "Does the opened view fit" and "is the opened
      // view the one the data names" are two questions and only one was asked.
      if (layout === 'narrow' && expectNarrowView && opened.view !== expectNarrowView) {
        bad.push(`ARMOURY OPENED '${opened.view}' BUT balance.equipment.narrowDefaultView NAMES '${expectNarrowView}' — a silently-discarded content value`);
      }
      if (opened.clipped) bad.push(`ARMOURY OPENS CLIPPED — view '${opened.view}', ${opened.clipped} equip cell(s), worst ${opened.worst}% on screen, e.g. ${opened.eg[0]}`);
      for (const [view, r] of Object.entries(perView)) {
        if (r.clipped) bad.push(`view '${view}' clips ${r.clipped} cell(s), worst ${r.worst}%`);
      }
      if (ov.error) bad.push(`overlay: ${ov.error}`);
      else {
        // The author wrote 74%. 1.5 points of tolerance for border/rounding.
        if (Math.abs(ov.share - 74) > 1.5) bad.push(`OVERLAY GETS ${ov.share}% of the app box where its author wrote 74% (panel ${ov.panelH} of ${ov.appH})`);
        if (ov.absent) bad.push(`${ov.absent} overlay tab(s) horizontally absent`);
        if (ov.tinyTabs) bad.push(`${ov.tinyTabs} tab(s) under the ${TAP_FLOOR} device-px floor, e.g. ${ov.tinyEg.join(', ')}`);
      }
      const viewSummary = Object.entries(perView).map(([n2, r]) => `${n2}:${r.noScroll}/${r.total}`).join(' ');
      console.log(`    ${k.padEnd(3)} ${String(layout).padEnd(7)} opens='${String(opened.view).padEnd(6)}' clipped=${String(opened.clipped).padEnd(2)} noScroll=${opened.noScroll}/${opened.total} ` +
        `[${viewSummary}]  overlay ${String(ov.share ?? '?').padStart(5)}% tabRows=${ov.tabRows ?? '?'} tiny=${ov.tinyTabs ?? '?'}` +
        (bad.length ? '\n         <-- ' + bad.join('\n         <-- ') : ''));
      for (const b of bad) fails.push(`${shape} text=${k}: ${b}`);
    }
  }

  // A check that ran nothing is `unknown`, never a pass — screenreach's lesson,
  // and development.md's `verify-shipped: OK - 0 checks passed` fixture.
  if (cells === 0) {
    console.error(`\nmenufit: nothing was measured${only ? ` (--only ${only} matched no shape)` : ''}. That is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map(([w, h]) => `${w}x${h}`).join(', ')}`);
    cdp.close(); child.kill(); if (server) server.close(); process.exit(2);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; emulation is not a phone and clicks
  are not touch. What this does NOT cover:
  (a) The SHOP, REST and REWARD screens, the coop/LAN surfaces, and the Armoury's
      piece-picker sub-panel. Only the two surfaces in Constantine's sentence.
  (b) HEIGHT. layoutForCap fits on BOTH axes, so the narrow/wide flip is not a
      width — 528x900 is narrow and 540x720 is wide. This list varies width at a
      near-constant height and is SILENT about the other axis. That silence is
      layoutForCap's card (#37 neighbours), not this file's, and it is named here
      rather than left to be discovered.
  (c) LEGIBILITY. It measures whether a control is on screen and how big it is.
      Whether the phone view is a GOOD view is Sunna's call and no number here.
  (d) The ${TAP_FLOOR} device-px floor is ENFORCED only on the overlay tab strip —
      the surface this work touches. Every other control is measured and reported
      but cannot fail this tool. Widening that is Marina's decision (Law 4, #37),
      deliberately not taken by a tool author mid-fix.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} finding(s) of ${cells} cell(s)` : `PASS — ${cells}/${cells} cells: both surfaces fit, no equip cell clipped, the overlay keeps its written share`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`menufit: ${e.message}`); process.exit(2); });
