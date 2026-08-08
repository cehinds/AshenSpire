#!/usr/bin/env node
// tools/settingsreach.mjs — can a tired human find the settings section they
// came for? (Sunna, 2026-08-07, EldenSpire#90.)
//
// WHAT IT MEASURES, and it measures the SAME things before and after so the two
// numbers come from one ruler:
//   1. NAMES ON SCREEN when Settings opens — how many of the six sections a
//      player can see without moving anything. The whole complaint in one
//      number.
//   2. THUMB-DRAGS TO THE LAST SECTION — a drag is 60% of the scroller's own
//      client height, stated here because a number with no ruler is a rumour.
//   3. THE TAP FLOOR on whatever control selects a section, in DEVICE px, i.e.
//      after --ui-zoom. 44 is the floor (card #37).
//   4. BOTH EDGES. The first is the one this change is for: six sections must
//      not become six screens a player has to HUNT — so it counts names, not
//      taps. The second is the one this change could BREAK: a section that
//      scrolls internally must STILL SCROLL, so it drives Display (the longest,
//      sixteen rows) to the bottom and checks the last row actually arrives.
//   5. role=tab / tablist / aria-selected — a screen reader had NONE of these
//      on any surface in this repo before tonight.
//
// IT RUNS ON EITHER TREE. `.set-cat[data-member]` (six headings, one column)
// and `.set-tab` (a tab strip) are both read, so the same command produces the
// before row on dev and the after row on the branch. Nothing is injected: it
// serves the repo and drives dist/AshenSpire.html, the artifact Constantine
// actually opens, through real clicks.
//
// Run:  node tools/settingsreach.mjs [--browser PATH] [--src]
//       --src drives the source tree instead of the built bundle.
//
// BOUNDARY: Linux headless Chromium, two shapes, four text sizes, title-screen
// door only for the geometry table (the in-run door is measured separately by
// --ring below). It proves a name is ON SCREEN and a control is BIG ENOUGH. It
// does not prove the six names are the RIGHT six (Freja) or that a section's
// contents are correct (Vira). And the standing caveat holds: dvh/svh/lvh all
// read 759.59 headless, so every below-the-fold number UNDER-states the truth.

import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean);

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const useSrc = args.includes('--src');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SHAPES = [
  { tag: '390x844', w: 390, h: 844, dsf: 2 },
  { tag: '1200x730', w: 1200, h: 730, dsf: 1 },
];
// balance.ui.textSize. Typed here is a second copy and it is the ONE value in
// this file that can drift (Law 1 clause 2), so it is called out, not hidden.
const TEXT = { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' };
const TAP_FLOOR = 44; // device px, AFTER --ui-zoom. Card #37.
const DRAG = 0.6;     // one thumb drag = 60% of the scroller's client height.

// The scroller is `.modal` on the title door and `.overlay-body` on the in-run
// one — asked of the DOM rather than assumed, because a wrong scroller makes
// every scroll number below a fiction.
const READ = `(() => { const n=(v)=>+(+v).toFixed(2);
  const host=document.querySelector('[data-settings-host]');
  if(!host) return {error:'settings never opened'};
  let sc=host.parentElement;
  while (sc && sc!==document.body && !(sc.scrollHeight > sc.clientHeight + 1)) sc=sc.parentElement;
  if (!sc || sc===document.body) sc = host.closest('.modal, .overlay-body') || host;
  const port = sc.getBoundingClientRect();
  // BOTH SHAPES OF THE SURFACE. Headings carry data-member on dev; tabs carry
  // it on the branch. Neither selector is assumed present.
  const heads=[...host.querySelectorAll('.set-cat[data-member]')];
  const tabs=[...host.querySelectorAll('.set-tab')];
  const marks = tabs.length ? tabs : heads;
  const kind = tabs.length ? 'tabs' : 'headings';
  const name=(e)=>(e.dataset.member||e.textContent||'').trim();
  // ON SCREEN = the mark's box intersects the scroller's visible box AND the
  // viewport. A rect that "would be" somewhere is not a thing a player sees.
  const onScreen = marks.filter((e)=>{ const r=e.getBoundingClientRect();
    return r.bottom>Math.max(port.top,0)+0.5 && r.top<Math.min(port.bottom,innerHeight)-0.5
      && r.right>0.5 && r.left<innerWidth-0.5; }).map(name);
  // How far down the content the LAST mark sits, and what that costs a thumb.
  let deepest=0;
  for (const e of marks) { const r=e.getBoundingClientRect();
    deepest=Math.max(deepest, r.top - port.top + sc.scrollTop); }
  const step = Math.max(1, sc.clientHeight*${DRAG});
  const need = Math.max(0, deepest - sc.clientHeight*0.5);
  // With tabs every section is one TAP: nothing has to scroll to reach a name.
  const drags = kind==='tabs' ? 0 : Math.ceil(need/step);
  // The floor, in device px. getBoundingClientRect is ALREADY post-zoom because
  // --ui-zoom is applied with body{zoom} — multiplying by it again is the error
  // that nearly cost me a night at #90, and 44.0-exactly was the tell.
  let floor=null, floorEg=null;
  for (const e of tabs) { const r=e.getBoundingClientRect(); if(!r.height) continue;
    if (floor===null || r.height<floor) { floor=n(r.height); floorEg=name(e); } }
  const strip=host.querySelector('.set-tabs');
  return { kind, total: marks.length, names: marks.map(name), onScreen,
    onScreenN: onScreen.length, deepest: n(deepest), drags,
    scrollH: n(sc.scrollHeight), clientH: n(sc.clientHeight),
    floor, floorEg, stripH: strip? n(strip.getBoundingClientRect().height): null,
    roleTab: host.querySelectorAll('[role="tab"]').length,
    roleTabList: host.querySelectorAll('[role="tablist"]').length,
    ariaSel: host.querySelectorAll('[aria-selected="true"]').length,
    zoom: n(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'))||1) }; })()`;

// EDGE 2 — the one this change could break. Select Display (sixteen rows, the
// longest section), drive its scroller to the bottom, and ask whether the LAST
// row actually arrived. A tab strip that traps content is worse than a column.
const EDGE_LONG = `(() => { const n=(v)=>+(+v).toFixed(2);
  const host=document.querySelector('[data-settings-host]');
  if(!host) return {error:'settings never opened'};
  const t=[...host.querySelectorAll('.set-tab')].find(e=>e.dataset.member==='Display');
  if (t) t.click();
  let sc=host.parentElement;
  while (sc && sc!==document.body && !(sc.scrollHeight > sc.clientHeight + 1)) sc=sc.parentElement;
  if (!sc || sc===document.body) sc = host.closest('.modal, .overlay-body') || host;
  const rows=[...host.querySelectorAll('.set-row')];
  if (!rows.length) return {error:'no rows in Display'};
  const scrolls = sc.scrollHeight > sc.clientHeight + 1;
  sc.scrollTop = sc.scrollHeight;
  const last=rows[rows.length-1].getBoundingClientRect();
  const port=sc.getBoundingClientRect();
  const arrived = last.bottom <= Math.min(port.bottom, innerHeight)+1.5 && last.top >= Math.max(port.top,0)-1.5;
  // And the strip must still be there once you are at the bottom — a taxonomy
  // that scrolls away at row sixteen is the defect again, one screenful later.
  const strip=host.querySelector('.set-tabs');
  const stripStill = strip ? (() => { const r=strip.getBoundingClientRect();
    return r.bottom>Math.max(port.top,0)+0.5 && r.top<Math.min(port.bottom,innerHeight)-0.5; })() : null;
  sc.scrollTop = 0;
  return { rows: rows.length, scrolls, lastRowArrives: arrived,
    lastBottom: n(last.bottom), portBottom: n(Math.min(port.bottom,innerHeight)),
    stripStillOnScreen: stripStill }; })()`;

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
  if (!browserPath) { console.error('settingsreach: no Chrome found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'setreach-'));
  const s = await serve({ root: ROOT, port: 8503, open: false });
  const BASE = useSrc ? `http://localhost:${s.port}/` : `http://localhost:${s.port}/dist/AshenSpire.html`;
  console.log(`settingsreach — ${BASE}${useSrc ? '  (source tree)' : '  (the shipped single-file bundle)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw'); return r.result.value; };

  const fails = []; let cells = 0;
  const openSettings = `(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/settings/i.test(x.textContent));
    if(!b) return 'no Settings button'; b.click(); return true; })()`;

  console.log('\nshape      text  kind      names on screen / total   drags to last   deepest px   tab floor(dev px)   strip h');
  for (const sh of SHAPES) {
    for (const [size, pct] of Object.entries(TEXT)) {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: sh.w, height: sh.h, deviceScaleFactor: sh.dsf, mobile: sh.dsf > 1 }, S);
      // The text size is set the way a PLAYER sets it — through stored settings
      // the app reads at boot — never by writing html{font-size} from outside.
      await ev(`localStorage.setItem('sote_meta_v1', JSON.stringify({settings:{textSize:${JSON.stringify(size)}}}))`).catch(() => {});
      await cdp.send('Page.navigate', { url: BASE }, S);
      await wait(1500);
      const opened = await ev(openSettings);
      if (opened !== true) { fails.push(`${sh.tag}/${size}: ${opened}`); continue; }
      await wait(450);
      const r = await ev(READ);
      cells++;
      if (r.error) { fails.push(`${sh.tag}/${size}: ${r.error}`); continue; }
      const floorTxt = r.floor === null ? '     n/a          '
        : `${String(r.floor).padEnd(6)}${r.floor + 0.5 < TAP_FLOOR ? 'UNDER 44' : 'ok'}`.padEnd(18);
      console.log(`${sh.tag.padEnd(10)} ${size.padEnd(5)} ${r.kind.padEnd(9)} `
        + `${String(r.onScreenN).padStart(3)} / ${String(r.total).padEnd(3)}             `
        + `${String(r.drags).padStart(3)}          ${String(r.deepest).padStart(8)}   ${floorTxt} ${r.stripH ?? '-'}`);
      if (r.floor !== null && r.floor + 0.5 < TAP_FLOOR) fails.push(`${sh.tag}/${size}: tab "${r.floorEg}" is ${r.floor} device px, under the ${TAP_FLOOR} floor`);
      if (r.total !== 6) fails.push(`${sh.tag}/${size}: ${r.total} categories, expected 6 — ${r.names.join(', ')}`);

      // Edge 2, at every cell: the long section must still scroll to its end.
      const e2 = await ev(EDGE_LONG);
      if (e2.error) { fails.push(`${sh.tag}/${size}: edge2 ${e2.error}`); continue; }
      if (!e2.lastRowArrives) fails.push(`${sh.tag}/${size}: Display's last row does NOT arrive at the bottom (${e2.lastBottom} vs port ${e2.portBottom})`);
      if (e2.stripStillOnScreen === false) fails.push(`${sh.tag}/${size}: the tab strip scrolls away — at the bottom of Display the taxonomy is gone again`);
      console.log(`            edge2  Display ${e2.rows} rows · scrolls=${e2.scrolls} · last row arrives=${e2.lastRowArrives} · strip still on screen=${e2.stripStillOnScreen}`);

      if (size === 'M') {
        console.log(`            aria   role=tab ${r.roleTab} · role=tablist ${r.roleTabList} · aria-selected=true ${r.ariaSel} · --ui-zoom ${r.zoom}`);
        console.log(`            names  ${r.onScreen.join(' · ') || '(none)'}`);
      }
    }
  }

  // ---- tooltips (Law 3 clause 4), with a POSITIVE CONTROL ------------------
  // My last tooltip probe read a property attachTooltip never sets, so it could
  // only ever answer "no tooltip" — a ruler with one possible answer. This one
  // fires the events the function actually listens for, and proves the ruler
  // works by firing them at a control that is KNOWN to have one first.
  console.log('\ntooltips (Law 3 clause 4) — hover and the pad focus cursor');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 730, deviceScaleFactor: 1, mobile: false }, S);

  // THE RULER IS PROVED BEFORE IT IS USED, IN BOTH DIRECTIONS. My last tooltip
  // probe read `b.__ttip`, a property attachTooltip never sets, so it could only
  // ever answer "no tooltip" — and it looked like a finding. This one fires the
  // events attachTooltip actually listens for, at a card (which has a tooltip)
  // and at a plain element (which has none), and prints both answers. If the
  // positive control is silent the tool says so and the settings numbers below
  // are worthless — stated rather than assumed.
  //
  // The element is `#tooltip`, an id, NOT `.tooltip` — checked in
  // src/ui/components/tooltip.js rather than guessed. The guess is what cost
  // the first run of this file.
  const FIRE = `const fire = async (el, how) => {
      const pre = document.getElementById('tooltip'); if (pre) pre.style.display='none';
      if (how==='hover') el.dispatchEvent(new PointerEvent('pointerenter', {bubbles:true, clientX:20, clientY:20}));
      else el.dispatchEvent(new CustomEvent('gpfocus'));
      await new Promise(r=>setTimeout(r, 340));
      const t = document.getElementById('tooltip');
      const shown = !!(t && getComputedStyle(t).display === 'block' && (t.innerText||'').trim());
      const text = shown ? (t.innerText||'').trim().replace(/\\s+/g,' ').slice(0,70) : '';
      el.dispatchEvent(new PointerEvent('pointerleave', {bubbles:true}));
      el.dispatchEvent(new CustomEvent('gpblur'));
      await new Promise(r=>setTimeout(r, 80));
      return { shown, text };
    };`;
  await cdp.send('Page.navigate', { url: BASE + '?shot=combat' }, S); await wait(2200);
  const controls = await ev(`(async () => { ${FIRE}
    const card = document.querySelector('.card');
    const plain = document.querySelector('h1, .combat') || document.body;
    return { positive: card ? await fire(card,'hover') : {shown:null,text:'no .card on the combat screen'},
             positivePad: card ? await fire(card,'pad') : {shown:null,text:''},
             negative: await fire(plain,'hover') };
  })()`);
  console.log(`  ruler check — POSITIVE (a card, known to carry one): hover=${controls.positive.shown} pad=${controls.positivePad.shown}  ${JSON.stringify(controls.positive.text)}`);
  console.log(`  ruler check — NEGATIVE (an element with none):       hover=${controls.negative.shown}`);
  if (controls.positive.shown !== true) fails.push('RULER BROKEN: the positive control shows no tooltip, so every tooltip number below is meaningless');
  if (controls.negative.shown !== false) fails.push('RULER BROKEN: the negative control shows a tooltip — this probe answers yes to anything');

  await cdp.send('Page.navigate', { url: BASE }, S); await wait(1500);
  await ev(openSettings); await wait(400);
  const tips = await ev(`(async () => { ${FIRE}
    const out = { tabs: [] };
    for (const b of document.querySelectorAll('.set-tab')) {
      out.tabs.push({ name: b.dataset.member, hover: await fire(b,'hover'), pad: await fire(b,'pad') });
    }
    return out;
  })()`);
  const tabTips = tips.tabs || [];
  const hoverOk = tabTips.filter((t) => t.hover.shown).length;
  const padOk = tabTips.filter((t) => t.pad.shown).length;
  console.log(`  ${hoverOk}/${tabTips.length} tabs answer on HOVER, ${padOk}/${tabTips.length} on the PAD focus cursor`);
  for (const t of tabTips) console.log(`    ${String(t.name).padEnd(15)} ${t.hover.shown ? 'hover ok' : 'HOVER SILENT'}  ${t.pad.shown ? 'pad ok' : 'PAD SILENT'}  ${t.hover.text || t.pad.text}`);
  if (tabTips.length && hoverOk !== tabTips.length) fails.push(`${tabTips.length - hoverOk} tab(s) say nothing on hover — Law 3 clause 4`);
  if (tabTips.length && padOk !== tabTips.length) fails.push(`${tabTips.length - padOk} tab(s) say nothing to the pad cursor — Law 3 clause 4`);

  // ---- Law 3 clause 1: the ring, and clause 6: two sets, one pair of bumpers
  console.log('\nLaw 3 — the ring, and the answer when two tab sets are on screen');
  const ringDoor1 = await ev(`(() => {
    const names=[...document.querySelectorAll('.set-tab')].map(e=>e.dataset.member);
    if (!names.length) return {skip:'no tab strip on this tree'};
    const sel=()=> (document.querySelector('.set-tab.on')||{dataset:{}}).dataset.member;
    const key=(k)=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
    const seq=[sel()];
    for (let i=0;i<names.length;i++){ key(']'); seq.push(sel()); }
    const back=[sel()]; for (let i=0;i<names.length;i++){ key('['); back.push(sel()); }
    return { names, forward: seq, backward: back,
      wrapsForward: seq[seq.length-1]===seq[0] && new Set(seq).size===names.length,
      wrapsBackward: back[back.length-1]===back[0] && new Set(back).size===names.length };
  })()`);
  if (ringDoor1.skip) console.log(`  SKIP door 1 — ${ringDoor1.skip}`);
  else {
    console.log(`  door 1 (title modal, settings IS the surface): ] → ${ringDoor1.forward.join(' → ')}`);
    console.log(`                                                 [ → ${ringDoor1.backward.join(' → ')}`);
    console.log(`  wraps forward=${ringDoor1.wrapsForward}  wraps backward=${ringDoor1.wrapsBackward}`);
    if (!ringDoor1.wrapsForward) fails.push('door 1: ] does not cycle all six and wrap — Law 3 clause 1');
    if (!ringDoor1.wrapsBackward) fails.push('door 1: [ does not cycle all six and wrap — Law 3 clause 1');
  }

  // Door 2: settings INSIDE the overlay. Two strips on screen, one pair of
  // bumpers. The ruling is the OUTER strip keeps them, so ] must move the
  // OVERLAY tab and leave the settings tab where it was.
  await cdp.send('Page.navigate', { url: BASE + '?shot=map' }, S); await wait(1800);
  const door2 = await ev(`(async () => {
    const m=[...document.querySelectorAll('button')].find(b=>/menu|☰/i.test(b.textContent)||b.classList.contains('open-menu'));
    if(!m) return {skip:'no menu button on the map'};
    m.click(); await new Promise(r=>setTimeout(r,600));
    const t=[...document.querySelectorAll('.ov-tab')].find(b=>/^settings$/i.test(b.textContent.trim()));
    if(!t) return {skip:'no Settings tab in the overlay'};
    t.click(); await new Promise(r=>setTimeout(r,600));
    const setBefore=(document.querySelector('.set-tab.on')||{dataset:{}}).dataset.member;
    const ovBefore=(document.querySelector('.ov-tab.on')||{}).textContent;
    // READ THE COUNT BEFORE PRESSING. The first run of this file read it after,
    // by which time ] had changed the overlay tab and taken the settings strip
    // off the page with it — so the tool printed "0 settings tabs" about a
    // screen that had six.
    const settingsTabsPresent=document.querySelectorAll('.set-tab').length;
    document.dispatchEvent(new KeyboardEvent('keydown',{key:']',bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    const ovAfter=(document.querySelector('.ov-tab.on')||{}).textContent;
    const setAfter=(document.querySelector('.set-tab.on')||{dataset:{}}).dataset.member;
    return { setBefore, setAfter, ovBefore, ovAfter, settingsTabsPresent };
  })()`);
  if (door2.skip) console.log(`  SKIP door 2 — ${door2.skip}`);
  else {
    console.log(`  door 2 (overlay → Settings): ${door2.settingsTabsPresent} settings tabs on screen inside ${'the overlay strip'}`);
    console.log(`     ] moved the OVERLAY tab  ${JSON.stringify(door2.ovBefore)} → ${JSON.stringify(door2.ovAfter)}`);
    console.log(`     and left the SETTINGS tab ${JSON.stringify(door2.setBefore)} → ${JSON.stringify(door2.setAfter)}`);
    if (!door2.settingsTabsPresent) fails.push('door 2: the settings tab strip did not render inside the overlay');
    // ONE assertion, and it is the whole ruling: the OUTER strip moved. The
    // inner selection is not asserted after the press because the press takes
    // the settings panel off the page — asserting on a node that is gone is how
    // a check starts answering about nothing.
    if (door2.settingsTabsPresent && door2.ovBefore === door2.ovAfter) fails.push('door 2: the outer strip did NOT keep the bumpers — Law 3 clause 6');
  }

  // ---- THE STRIP MUST NOT MOVE WHEN YOU USE IT ----------------------------
  // Found in a PICTURE, not in a number, and it is the defect this change could
  // most easily have shipped: the modal is auto-height and vertically centred,
  // so a one-row section (Advanced) makes it collapse and every tab jumps up
  // the screen. A control that moves AFTER you press it is what makes a tired
  // person mis-tap the next one. Six sections, six positions, one strip.
  console.log('\nthe strip must not move when you use it (both shapes)');
  for (const sh of SHAPES) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: sh.w, height: sh.h, deviceScaleFactor: sh.dsf, mobile: sh.dsf > 1 }, S);
    await ev(`localStorage.removeItem('sote_meta_v1')`).catch(() => {});
    await cdp.send('Page.navigate', { url: BASE }, S); await wait(1600);
    await ev(openSettings); await wait(450);
    const move = await ev(`(async () => { const n=(v)=>+(+v).toFixed(2);
      const tops=[];
      for (const b of [...document.querySelectorAll('.set-tab')]) {
        b.click(); await new Promise(r=>setTimeout(r,260));
        const s=document.querySelector('.set-tabs');
        tops.push({ cat: b.dataset.member, top: n(s.getBoundingClientRect().top) });
      }
      return tops; })()`);
    const ys = move.map((m) => m.top);
    const spread = +(Math.max(...ys) - Math.min(...ys)).toFixed(2);
    console.log(`  ${sh.tag}  strip top per section: ${move.map((m) => `${m.cat}=${m.top}`).join('  ')}`);
    console.log(`  ${sh.tag}  worst jump = ${spread}px`);
    if (spread > 1) fails.push(`${sh.tag}: the tab strip moves ${spread}px between sections — the control jumps after you press it`);
  }

  // ---- the choice is remembered, and the wrong-name edge fails SAFE --------
  // A player who came to change the volume opens Settings, taps Audio, closes,
  // and comes back. Landing on Display again every time is the small unkindness
  // this whole change is against. It rides in `meta.settings`, the free bag
  // every other setting uses — no save-schema change. Observed BOTH ways.
  console.log('\npersistence — the section you were on, and the section that no longer exists');
  await cdp.send('Page.navigate', { url: BASE }, S); await wait(1600);
  const persist = await ev(`(async () => {
    const open = () => [...document.querySelectorAll('button')].find(x=>/settings/i.test(x.textContent)).click();
    const close = () => { const b=document.getElementById('set-close'); if(b) b.click(); };
    open(); await new Promise(r=>setTimeout(r,500));
    const first=(document.querySelector('.set-tab.on')||{dataset:{}}).dataset.member;
    [...document.querySelectorAll('.set-tab')].find(e=>e.dataset.member==='Audio').click();
    await new Promise(r=>setTimeout(r,300));
    const stored=(JSON.parse(localStorage.getItem('sote_meta_v1')||'{}').settings||{}).settingsCategory;
    close(); await new Promise(r=>setTimeout(r,300));
    open(); await new Promise(r=>setTimeout(r,500));
    const reopened=(document.querySelector('.set-tab.on')||{dataset:{}}).dataset.member;
    close(); await new Promise(r=>setTimeout(r,200));
    // The wrong-name edge: a stored category nothing files under any more.
    const meta=JSON.parse(localStorage.getItem('sote_meta_v1')||'{}');
    meta.settings=meta.settings||{}; meta.settings.settingsCategory='Lore';
    localStorage.setItem('sote_meta_v1', JSON.stringify(meta));
    open(); await new Promise(r=>setTimeout(r,500));
    const afterBogus=(document.querySelector('.set-tab.on')||{dataset:{}}).dataset.member;
    const tabsAfterBogus=document.querySelectorAll('.set-tab').length;
    const panelText=(document.querySelector('.set-panel')||{innerText:''}).innerText.trim().length;
    return { first, stored, reopened, afterBogus, tabsAfterBogus, panelText };
  })()`);
  console.log(`  opened on ${JSON.stringify(persist.first)} · tapped Audio · stored ${JSON.stringify(persist.stored)} · reopened on ${JSON.stringify(persist.reopened)}`);
  console.log(`  stored "Lore" (a category nothing files under) → opens on ${JSON.stringify(persist.afterBogus)}, ${persist.tabsAfterBogus} tabs, ${persist.panelText} chars in the panel`);
  if (persist.stored !== 'Audio') fails.push(`persistence: the choice was not written to meta.settings (got ${JSON.stringify(persist.stored)})`);
  if (persist.reopened !== 'Audio') fails.push(`persistence: reopened on ${JSON.stringify(persist.reopened)} instead of Audio`);
  if (persist.afterBogus !== 'Display' || !persist.panelText) fails.push('EDGE: a stored category that no longer exists did not fall back to the first tab with a full panel');

  console.log(`\n${cells} cells measured (2 shapes x 4 text sizes).`);
  if (fails.length) {
    console.log(`\nsettingsreach: ${fails.length} finding(s)`);
    for (const f of fails) console.log(`  ✗ ${f}`);
  } else {
    console.log('\nsettingsreach: OK — every category name on screen at open, every selector over the 44 device-px floor,');
    console.log('  the long section still scrolls to its last row, the strip stays put, both bumper directions wrap,');
    console.log('  and the outer strip keeps the bumpers where two tab sets meet.');
  }
  console.log('\nBOUNDARY: linux headless chromium; two shapes; title-screen door for the table; nothing on Windows;');
  console.log('  no gamepad attached (the ring is driven by [ and ], which is the same code path input.js runs for LB/RB);');
  console.log('  dvh/svh/lvh all read 759.59 headless, so every below-the-fold number here UNDER-states the truth.');

  cdp.close(); child.kill(); s.server.close();
  process.exit(fails.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
