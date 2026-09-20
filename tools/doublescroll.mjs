#!/usr/bin/env node
// tools/doublescroll.mjs — TWO THUMBS SIDE BY SIDE IN ONE DOOR. Constantine,
// from his own screen, with the photograph: "I hate this double scroll bar.
// it's in a lot of menus and needs to be adjusted or fixed. this should never
// happen."
//
// WHAT THE PHOTOGRAPH SHOWED, measured off his PNG rather than described: two
// thumbs 6 device px wide at x 48..53 and x 58..63, ten px apart, and the
// door's gold border at x 66 — so BOTH bars are inside one modal, one of them
// belonging to a box nested in the other. That is the shape this tool looks
// for, and it is already a written law: SPEC §7.2 Settings door geometry —
// "the active content pane is the single vertical scroll owner. Ancestors and
// nested section lists must not create a second vertical scrollport."
//
// WHY A TOOL AND NOT A PATCH. The complaint says "a lot of menus", and a patch
// aimed at the one door in the photograph cannot answer that. Nothing in
// tools/ measures this: settingsreach asks whether a section can be REACHED,
// scroll-cue-bleed asks whether a scrollport's travel is VISIBLE, menufit asks
// whether a surface FITS. All three are happy with two bars. So the sweep is
// the deliverable and the fix is what it turns green.
//
// WHAT COUNTS AS A FINDING, and the second clause is the one that keeps this
// honest: a pair of boxes where (a) one contains the other, and (b) BOTH are
// scrolling on the same axis AND BOTH ARE PAINTING A CLASSIC BAR. An element
// with `overflow-y: auto` that has nothing to scroll paints nothing and is not
// a finding; neither is an overlay bar, which takes no layout width. The test
// for paint is the layout gutter the bar actually takes —
// `offsetWidth - clientWidth - borders >= 1` — not a guess from the computed
// `overflow` value, because that value is true of dozens of boxes per screen
// and true of none of the ones a player can see.
//
// BOTH AXES. The report names x and y separately: a horizontal pair is the
// same defect lying down, and the door in the photograph is not the only shape
// this can take.
//
// Usage
//   node tools/doublescroll.mjs                 the source tree via tools/serve.mjs
//   node tools/doublescroll.mjs --dist          dist/AshenSpire.html, the shipped bundle
//   node tools/doublescroll.mjs --only 900x600  one shape
//   node tools/doublescroll.mjs --surface menu-settings
//   node tools/doublescroll.mjs --verbose       print the single ports too
//   node tools/doublescroll.mjs --mutate        plant the defect; the sweep MUST go red
//
// Exit codes
//   0  every swept surface owns at most one scrollport per axis per box tree
//      (or, under --mutate, the planted pair was correctly caught)
//   1  a nested pair, printed with both bars' widths and screen positions
//      (or, under --mutate, the plant went UNCAUGHT — this ruler proves nothing)
//   2  usage / no browser / a surface that would not open / NOTHING SWEPT
//
// WHY --mutate EXISTS AND WHAT IT PLANTS. A green sweep is worth exactly what
// its ruler is worth, and the ruler here is one expression against one engine's
// layout: get the paint test wrong and every door reports clean forever. The
// plant is the defect itself, restored by a stylesheet rather than by editing
// the tree — `overflow: auto` back on the settings host that owns the shell —
// on the very door the photograph was taken in. If the sweep does not go red
// against that, nothing it says about the other doors means anything.
//
// BOUNDARY. Linux headless Chromium, the shapes listed below, Text M. It reads
// LAYOUT, so it sees exactly the bars that take room from the content: a
// platform drawing overlay scrollbars (macOS by default, iOS) hides its bars
// from this ruler and from the player at rest alike. It sweeps the menus that
// open without playing the game — the ?shot= doors, the in-run ☰ overlay's two
// tabs, every Settings category, and the Armoury — and it does not claim the
// rooms behind a real run (Rewards, the LAN lobby, the post-boss doors).

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const args = process.argv.slice(2);
const argOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const onlyShape = argOf('--only');
const onlySurface = argOf('--surface');
const useDist = args.includes('--dist');
const verbose = args.includes('--verbose');
const mutate = args.includes('--mutate');
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const browserPath = argOf('--browser') || [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));

// THE SHAPES ARE EDGES, NOT A HANDFUL. A door that fits has no bars at all, so
// a sweep over comfortable shapes proves nothing: the pairs live where the
// content is taller than the door. 900x600 is the shortest desktop shape the
// layout decider still calls wide (`data-short`), and it is where the in-run
// door's two bars are widest; 1366x768 is the ordinary laptop in the
// photograph's band; 844x390 is landscape, the shape with the least height of
// all; 390x844 and 360x640 are the phones.
const SHAPES = [
  { tag: '1366x768', w: 1366, h: 768, dsf: 1, mobile: false },
  { tag: '1200x730', w: 1200, h: 730, dsf: 1, mobile: false },
  { tag: '900x600', w: 900, h: 600, dsf: 1, mobile: false },
  { tag: '844x390', w: 844, h: 390, dsf: 3, mobile: true },
  { tag: '390x844', w: 390, h: 844, dsf: 3, mobile: true },
  { tag: '360x640', w: 360, h: 640, dsf: 2, mobile: true },
];

// A surface is a ?shot= door plus an optional sequence of presses that opens a
// menu over it. `after` returns true when the menu is open and a string naming
// what was missing when it is not — a menu that silently fails to open is a
// surface swept at 0% and reported as clean, which is the shape this file's
// own header calls the worst kind of pass.
const OPEN_MENU = `(async () => {
  const pause = () => new Promise((r) => setTimeout(r, 90));
  document.querySelector('#open-menu')?.click(); await pause();
  if (document.querySelector('.qn-panel')) {
    document.querySelector('.qn-row[data-act="tab"][data-tab="settings"]')?.click();
    await pause();
  }
  return document.querySelector('.overlay-modal') ? true : 'the ☰ overlay never opened';
})()`;
const overlayTab = (id) => `(async () => {
  const pause = () => new Promise((r) => setTimeout(r, 90));
  const open = await ${OPEN_MENU};
  if (open !== true) return open;
  const tab = document.querySelector('.ov-tab[data-member=${JSON.stringify(id)}]');
  if (!tab) return 'no ${id} tab in the overlay';
  tab.click(); await pause(); await pause();
  return true;
})()`;
const SURFACES = [
  { name: 'title', shot: 'title', ready: `!!document.querySelector('#app button')` },
  { name: 'title-settings', shot: 'title', ready: `!!document.querySelector('#app button')`,
    after: `(() => { const b = [...document.querySelectorAll('button')].find((x) => /settings/i.test(x.textContent));
      if (!b) return 'no Settings button on the title'; b.click(); return true; })()`,
    open: `!!document.querySelector('[data-settings-host]')`, categories: true },
  { name: 'map', shot: 'map', ready: `!!document.querySelector('.map-node')` },
  // THE DOOR IN THE PHOTOGRAPH. `?shot=map` is the cheapest room that has a ☰.
  { name: 'menu-settings', shot: 'map', ready: `!!document.querySelector('.map-node')`,
    after: overlayTab('settings'), open: `!!document.querySelector('[data-settings-host]')`, categories: true },
  { name: 'menu-controls', shot: 'map', ready: `!!document.querySelector('.map-node')`,
    after: overlayTab('controls'), open: `!!document.querySelector('.overlay-body .controls-pane, .overlay-body')` },
  // The Armoury is opened by a press, has no ?shot= of its own, and is the
  // other long list a player manages a run from.
  { name: 'armoury', shot: 'map', ready: `!!document.querySelector('.map-node')`,
    after: `(async () => { const pause = () => new Promise((r) => setTimeout(r, 90));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true })); await pause(); await pause();
      return document.querySelector('.armoury') ? true : 'the Armoury shortcut opened nothing'; })()`,
    open: `!!document.querySelector('.armoury')` },
  { name: 'combat', shot: 'combat', ready: `!!document.querySelector('.combat .hand .card')` },
  { name: 'customize', shot: 'customize', ready: `!!document.querySelector('.cz-portrait')` },
  { name: 'compendium', shot: 'compendium', ready: `!!document.querySelector('.cp-cell')` },
  { name: 'rest', shot: 'rest', ready: `!!document.querySelector('#rest-opt')` },
  { name: 'smith', shot: 'smith', ready: `!!document.querySelector('.smith-candidate-region')` },
  { name: 'shop', shot: 'shop', ready: `!!document.querySelector('#leave-shop')` },
  { name: 'death', shot: 'death', ready: `!!document.querySelector('#app button')` },
];

// THE RULER. One expression, run in the page, answering only about boxes that
// are on screen and painting a bar.
const SCAN = `(() => {
  const round = (v) => +(+v).toFixed(1);
  const name = (e) => {
    if (e === document.documentElement) return 'html';
    if (e === document.body) return 'body';
    const cls = typeof e.className === 'string' && e.className.trim()
      ? '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + cls;
  };
  const ports = [];
  for (const e of document.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const box = e.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) continue;
    const borderX = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    const borderY = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    // The gutter the bar TAKES. An overlay bar takes none and is invisible to
    // this ruler by construction, which the boundary in the header states.
    const barY = e.offsetWidth - e.clientWidth - borderX;
    const barX = e.offsetHeight - e.clientHeight - borderY;
    const travelsY = /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1;
    const travelsX = /auto|scroll/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1;
    if (travelsY && barY >= 1) ports.push({ e, axis: 'y', sel: name(e), bar: round(barY), at: round(box.right), span: round(box.height) });
    if (travelsX && barX >= 1) ports.push({ e, axis: 'x', sel: name(e), bar: round(barX), at: round(box.bottom), span: round(box.width) });
  }
  const pairs = [];
  for (const outer of ports) for (const inner of ports) {
    if (outer === inner || outer.axis !== inner.axis) continue;
    if (!outer.e.contains(inner.e)) continue;
    pairs.push({ axis: outer.axis, outer: outer.sel, inner: inner.sel,
      outerBar: outer.bar, innerBar: inner.bar, outerAt: outer.at, innerAt: inner.at,
      apart: round(Math.abs(outer.at - inner.at)) });
  }
  return { pairs, ports: ports.map((p) => p.axis + ' ' + p.sel + ' bar=' + p.bar + ' at=' + p.at) };
})()`;

// Every Settings category, one at a time. A door that owns one scrollport on
// General and two on Advanced is a door with the defect, and General is what
// opens — so the sweep presses through the whole taxonomy rather than trusting
// the tab it lands on.
const CATEGORIES = `[...document.querySelectorAll('[data-settings-host] .set-tab')].map((t) => t.dataset.member)`;
const selectCategory = (member) => `(async () => {
  const pause = () => new Promise((r) => setTimeout(r, 120));
  const tab = document.querySelector('[data-settings-host] .set-tab[data-member=' + ${JSON.stringify(JSON.stringify(member))} + ']');
  if (!tab) return 'category ' + ${JSON.stringify(member)} + ' vanished';
  tab.click(); await pause(); await pause();
  return true;
})()`;

// THE PLANT (--mutate). Exactly the rule the fix added, undone, in the page:
// the shell scrolls again under a pane that is still scrolling, and the two
// bars stand where Constantine photographed them. It is injected AFTER the
// door opens so it cannot change which door opens, and it is torn down with
// the navigation that follows.
//
// BOTH HALVES, AND THE SECOND IS THE ONE A FIRST DRAFT OF THIS PLANT LEFT OUT.
// Giving the shell its scrollport back is not enough: the fix also frees the
// workspace's height (`height: auto` over the kit's `.as-railed { height:
// 100% }`), so with only the first line the workspace grows to its content,
// the PANE stops scrolling, and the door wears ONE bar — a plant that leaves
// the defect unreproduced, goes uncaught, and fails a working ruler. Measured
// at 900x600 in the ☰ door: one line -> `.overlay-body` alone at bar 13; both
// lines -> `.overlay-body` at 734 and `#set-panel` at 724, the photograph.
const PLANT = `(() => {
  const style = document.createElement('style');
  style.id = 'doublescroll-plant';
  style.textContent = '.modal-body[data-settings-host]:has(> .set-railed)'
    + ' { display: block !important; overflow-y: auto !important; }'
    + '.modal-body[data-settings-host] > .set-railed { height: 100% !important; }';
  document.head.appendChild(style);
  // The plant has to actually plant something: a rule that changes no box is a
  // defeat that was never dealt, and it would pass this check by accident.
  const host = document.querySelector('.modal-body[data-settings-host]');
  if (!host) return 'no settings host in a modal body to plant on';
  return getComputedStyle(host).overflowY === 'auto' ? true : 'the plant did not take';
})()`;

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

function report(shape, where, pairs) {
  const lines = [];
  for (const p of pairs) {
    const edge = p.axis === 'y' ? 'right edges' : 'bottom edges';
    lines.push(`${shape} ${where}: TWO ${p.axis.toUpperCase()} SCROLLBARS`
      + `\n    outer ${p.outer} — bar ${p.outerBar} px`
      + `\n    inner ${p.inner} — bar ${p.innerBar} px`
      + `\n    ${edge} ${p.outerAt} and ${p.innerAt}, ${p.apart} px apart`);
  }
  return lines;
}

async function main() {
  if (!browserPath) { console.error('doublescroll: no Chrome found — pass --browser PATH or set $CHROME'); process.exit(2); }
  // --mutate narrows to the one door the plant is written for, and says so
  // rather than quietly sweeping thirteen surfaces to prove one point.
  const surfaces = SURFACES.filter((s) => (mutate ? s.name === 'menu-settings' : (!onlySurface || s.name === onlySurface)));
  const shapes = SHAPES.filter((s) => (mutate ? s.tag === '900x600' : (!onlyShape || s.tag === onlyShape)));
  if (!surfaces.length) { console.error(`doublescroll: no surface named ${onlySurface}`); process.exit(2); }
  if (!shapes.length) { console.error(`doublescroll: no shape named ${onlyShape}`); process.exit(2); }

  const server = await serve({ root: ROOT, port: 8511, open: false });
  const BASE = useDist ? `http://localhost:${server.port}/dist/AshenSpire.html` : `http://localhost:${server.port}/`;
  console.log(`doublescroll — ${BASE}${useDist ? '  (the shipped single-file bundle)' : '  (the source tree)'}`);

  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'dblscroll-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
    timeoutMs: 20000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const ev = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'the page threw');
    return r.result.value;
  };
  // WAIT ON THE PAGE, NEVER ON THE CLOCK — a cold ?shot= boot on a loaded host
  // has been measured past 12 s in this repo, and a fixed sleep measures the
  // machine instead of the door.
  const until = async (expression, label, timeoutMs = 45000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await ev(expression).catch(() => false)) return true;
      await wait(120);
    }
    throw new Error(`timed out after ${timeoutMs} ms waiting for ${label}`);
  };

  const findings = [];
  const notOpened = [];
  let swept = 0;

  for (const shape of shapes) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: shape.w, height: shape.h, deviceScaleFactor: shape.dsf, mobile: shape.mobile }, S);
    for (const surface of surfaces) {
      await cdp.send('Page.navigate', { url: `${BASE}?shot=${surface.shot}` }, S);
      await until(surface.ready, `${shape.tag} ${surface.name}`);
      if (surface.after) {
        const opened = await ev(surface.after);
        if (opened !== true) { notOpened.push(`${shape.tag} ${surface.name}: ${opened}`); continue; }
        await until(surface.open, `${shape.tag} ${surface.name} to open`);
      }
      // One settle after the door mounts: the layout decider re-plans railed
      // doors on a ResizeObserver, and a box measured mid-plan is a fiction.
      await wait(450);
      if (mutate) {
        const planted = await ev(PLANT);
        if (planted !== true) { console.error(`doublescroll --mutate: ${planted}`); process.exit(2); }
        await wait(200);
      }

      const places = surface.categories ? await ev(CATEGORIES) : [null];
      for (const place of (places.length ? places : [null])) {
        if (place) {
          const picked = await ev(selectCategory(place));
          if (picked !== true) { notOpened.push(`${shape.tag} ${surface.name}: ${picked}`); continue; }
          await wait(200);
        }
        const where = place ? `${surface.name}/${place}` : surface.name;
        const scan = await ev(SCAN);
        swept++;
        if (scan.pairs.length) findings.push(...report(shape.tag, where, scan.pairs));
        else if (verbose) console.log(`${shape.tag} ${where}: ok — ${scan.ports.join(' | ') || 'no bars'}`);
      }
    }
  }

  // `serve()` hands back `{ server, url, port }` — the listening socket is
  // `server.server`, and an optional call on the wrapper (`server.close?.()`)
  // is a no-op that leaves the port open and this process ALIVE after its
  // verdict is printed. Watched here: the full sweep printed "no door paints
  // two bars" and then hung, which in CI is a step that never ends rather than
  // a step that passes.
  await dropBrowser(); cdp.close(); server.server.close();

  // NOTHING SWEPT IS NOT A PASS. A run that opened no surface prints no
  // findings, and a green bar over zero checks is how this class of defect
  // survived every instrument in tools/ for as long as it did.
  if (!swept) { console.error('doublescroll: swept NOTHING — no surface opened'); process.exit(2); }
  for (const line of notOpened) console.error(`doublescroll: ${line}`);
  console.log(`\nswept ${swept} surface state${swept === 1 ? '' : 's'} over ${shapes.length} shape${shapes.length === 1 ? '' : 's'}`);

  if (mutate) {
    for (const line of findings) console.log(`  ${line}\n`);
    if (!findings.length) {
      console.error('\ndoublescroll --mutate: the defect was planted and the sweep stayed GREEN.'
        + '\nThe ruler is broken — every clean verdict it has printed is worthless.');
      process.exit(1);
    }
    console.log(`doublescroll --mutate: OK — the plant was caught (${findings.length} pair${findings.length === 1 ? '' : 's'}).`);
    process.exit(0);
  }

  if (findings.length) {
    console.error(`\n${findings.length} nested scrollbar pair${findings.length === 1 ? '' : 's'}:\n`);
    for (const line of findings) console.error(`  ${line}\n`);
    process.exit(1);
  }
  if (notOpened.length) { console.error('\na surface would not open — nothing was measured there'); process.exit(2); }
  console.log('no door paints two bars on one axis.');
  process.exit(0);
}

main().catch((err) => { console.error(`doublescroll: ${err.message}`); process.exit(2); });
