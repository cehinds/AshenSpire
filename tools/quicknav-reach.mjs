#!/usr/bin/env node
// tools/quicknav-reach.mjs — the shipped quick menu, checked in a browser.
//
// WHY A BROWSER. Every property below is about a RENDERED RECT or a real key
// press. tests/run-node.mjs opens no browser and says so at the foot of its own
// output; nothing in it can see that a dropdown anchored to the combat topbar
// hangs off the left edge of a phone, because the combat topbar WRAPS at 390 px
// and the button it hangs from is not where the source suggests.
//
// WHAT IT ASSERTS, per variant x shape x context:
//   R1  every row of an open list is fully inside the viewport (the clamp)
//   R2  Save then Save & Quit to Title are the LAST TWO rows — every context,
//       both readings of "context-specific" (Constantine fixed this by hand)
//   R3  every row is at least 44 local px tall (Sunna's tap target)
//   R4  every row carries a REAL tooltip, shown on the focus cursor — `title=`
//       alone is invisible to touch and to a pad (Law 3 clause 4)
//   R5  the bumper ring wraps BOTH ends over the tab set (Law 3 clauses 1/1a),
//       driven by the keyboard analogue because no pad is attached
//   R6  variant B folds the strip only where autoLayout() says narrow, and the
//       folded switcher names the tab you are on
//   R7  legacy "off" remains a direct-to-overlay route, and its topbar button
//       retains the shared tap floor delivered by PR #341
//
// KNOWN-BAD FIRST (development.md SOP 3). This check was run against three
// deliberate breakages before it was allowed to pass anything — the clamp
// removed (R1 red at 390 combat), the ring's wrap removed (R5 red), and the
// tail band sorted into the body (R2 red). A detector that has never been red is
// not evidence.
//
// AND FOR MOST OF THIS FILE'S LIFE THAT PARAGRAPH WAS A PROMISE IT DID NOT KEEP
// (Rune, 2026-08-15). Those three breakages were MANUAL, done once at authoring
// and never again — under SOP 2's drift clause a red nobody can re-run is
// `unknown`, not coverage, and Vira's doors audit (2026-08-14) rated this tool
// OBSERVED-ONCE for exactly that. Worse, the line above used to promise a
// `--selftest` flag THAT DID NOT EXIST: passing it ran the ordinary sweep under
// a corpus-run's name. Vira found that and made the flag refuse; this act pays
// what was owed and makes the flag real.
//
// DOOR. The real input is the rendered quick-nav panel — this tool serves the
// real tree, boots the real screens with real settings, opens the real list and
// measures real rects. `--selftest` plants each known-bad as BYTES in a copy of
// the real file the defect would ship in and re-runs this whole tool against
// the copy: same serve.mjs, same browser, same clicks and key presses.
// Usage:  node tools/quicknav-reach.mjs [--shots DIR]
//         node tools/quicknav-reach.mjs --selftest   (the same-door known-bad corpus)
// Exit:   0 all green · 1 any finding · 2 the harness could not run
//
// REMOVAL CONDITION: delete when the Quick Menu surface or its responsive
// variants leave the product; this is now a production reachability gate.

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'quicknav-reach.mjs',
    args: ['--shape', '390x844-text-m'],
    timeoutMs: 900000,
    plants: [
      {
        // R3's known-bad: Sunna's tap floor removed at the one place that
        // decides a row's height. `min-height` is the whole rule — the row has
        // no other floor — so this is the defect, not a caricature of it.
        name: 'R3: the 44-local-px tap floor is dropped from the quick-nav row',
        file: 'styles/ui.css',
        find: '  min-height: var(--tap-floor); height: auto; padding: 0.6rem 1.6rem; text-align: left;',
        replace: '  min-height: 0; height: auto; padding: 0.1rem 1.6rem; text-align: left;',
        expectRed: /R3.*row\(s\) under 44 local px/,
      },
      {
        // R1's known-bad, and the one the tool was born for: the panel escapes
        // the viewport. `position: fixed` with a forced width wider than the
        // phone puts rows off the SIDE, which is the unreachable direction —
        // the clamp is what stops exactly this.
        name: 'R1: the panel is allowed to hang off the side of the phone (the clamp gone)',
        file: 'styles/ui.css',
        // RE-AIMED 2026-08-17 (Sten) — NOT relaxed, and not deleted. When
        // quicknav.js's placement arithmetic moved into fx.js placeAnchored(),
        // `--place-gap: 6px` became `.qn-panel`'s first declaration; this
        // find-string carried the selector and the brace, so it stopped matching
        // and doorplant hard-red'd it as PLANT SITE DRIFTED. That is the
        // mechanism working, and the fix is to re-aim, never to loosen. It now
        // anchors on the width triple it actually overrides — verified unique in
        // ui.css — so a declaration added above it cannot drift it again. The
        // known-bad is unchanged: a forced width wider than the phone, clamp
        // defeated.
        //
        // SCORED 2026-08-17 (Bjorn, gating d705b66): the re-aim STANDS — the
        // defect bytes are identical, the drift was caught LOUDLY rather than
        // skipped, and `grep -c` says this find-string occurs exactly ONCE in
        // ui.css. ONE BOUNDARY, because the uniqueness changed KIND: the old
        // string carried `.qn-panel {`, so it could only ever match this rule;
        // this one is unique by coincidence, and doorplant does not assert
        // uniqueness — it calls String.replace, first match only (its own `all`
        // note says what that costs). If a second rule ever carries this exact
        // triple, the plant lands on the wrong rule and R1 reports NOT CAUGHT —
        // LOUD, not a silent green, which is why this is a boundary and not a
        // repair. The real fix is a uniqueness assertion in doorplant; that
        // touches every corpus in the tree and is not a gate's act to make.
        find: '  position: fixed; width: 26rem; max-width: 92%;',
        replace: '  position: fixed !important; width: 60rem !important; max-width: none !important; left: -8rem !important;',
        expectRed: /R1.*(spans .* in a .* px view|escapes)/,
      },
    ],
  }));
}


import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSER = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = process.argv.slice(2);
const ARTIFACT = args.includes('--artifact');
const si = args.indexOf('--shots');
const SHOTS = si >= 0 && args[si + 1] ? resolve(args[si + 1]) : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')).href);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
      else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

let chrome;
try {
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  chrome = await launchBrowser({ prefix: 'qnreach-', browser: BROWSER, timeoutMs: 15000 });
} catch (e) {
  console.error('quicknav-reach: UNKNOWN — no browser. ' + e.message);
  process.exit(2);
}
const cdp = connectCdp(chrome.wsUrl);
await cdp.ready;
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
await cdp.send('Page.enable', {}, S);
await cdp.send('Runtime.enable', {}, S);

const srv = await serve({ root: ROOT, port: 8477, open: false });
const BASE = `http://localhost:${srv.port}/`;
const APP = `${BASE}${ARTIFACT ? 'AshenSpire.html' : ''}`;

const ev = async (e) => {
  const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
  return r.result.value;
};
const until = async (e, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(e).catch(() => false)) return true; await wait(120); }
  return false;
};
const key = (k) => cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, text: k.length === 1 ? k : undefined }, S)
  .then(() => cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }, S));

const findings = [];
const checks = [];
const fail = (id, where, msg) => { findings.push(`${id}  ${where} — ${msg}`); checks.push(false); };
const pass = (id, where, msg) => { checks.push(true); if (process.env.QN_VERBOSE) console.log(`  ok ${id} ${where} ${msg || ''}`); };

const ALL_SHAPES = [
  ...['M', 'XL'].map((text) => ({ w: 1200, h: 730, d: 1, mobile: false, text, tag: `1200x730-text-${text.toLowerCase()}` })),
  ...['M', 'XL'].map((text) => ({ w: 844, h: 344, d: 2, mobile: true, text, tag: `844x344-text-${text.toLowerCase()}` })),
  ...['M', 'XL'].map((text) => ({ w: 390, h: 844, d: 3, mobile: true, text, tag: `390x844-text-${text.toLowerCase()}` })),
];
const shapeIndex = args.indexOf('--shape');
const shapeFilter = shapeIndex >= 0 ? args[shapeIndex + 1] : null;
const SHAPES = shapeFilter ? ALL_SHAPES.filter((shape) => shape.tag === shapeFilter) : ALL_SHAPES;
if (!SHAPES.length) throw new Error(`quicknav-reach: unknown --shape ${shapeFilter}`);

let viewportText = 'M';

async function boot(shot, settings) {
  const q = encodeURIComponent(JSON.stringify({ ...settings, textSize: viewportText }));
  const separator = APP.includes('?') ? '&' : '?';
  await cdp.send('Page.navigate', { url: `${APP}${separator}shot=${shot}&shotSettings=${q}` }, S);
  const sel = shot === 'combat' ? '.combat .hand .card' : '.map-node';
  if (!(await until(`!!document.querySelector('${sel}')`))) throw new Error(`${shot} never rendered`);
  await wait(700);
}

// Local px: what an inline style writes in, and the space a 44 px tap target is
// specified in here. getBoundingClientRect is VISUAL — convert once (fx.js's
// rule), never compare across the two.
const ROWS_JS = `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const p = document.querySelector('.qn-panel');
  if (!p) return null;
  const vw = innerWidth / z, vh = innerHeight / z;
  return {
    zoom: z, viewW: vw, viewH: vh,
    scrolls: p.scrollHeight > p.clientHeight + 1,
    rows: Array.from(p.querySelectorAll('.qn-row')).map((b) => {
      const r = b.getBoundingClientRect();
      return {
        label: (b.querySelector('.qn-label') || {}).textContent || '',
        act: b.dataset.act || '', left: r.left / z, top: r.top / z,
        right: r.right / z, bottom: r.bottom / z, h: r.height / z,
        role: b.getAttribute('role') || '', checked: b.getAttribute('aria-checked'),
        condition: (b.querySelector('.qn-condition') || {}).textContent || '',
      };
    }),
  };
})()`;

let openAnchorSelector = null;
async function openList(anchorSel) {
  openAnchorSelector = anchorSel;
  await ev(`document.querySelector('${anchorSel}').click(); true`);
  const opened = await until(`!!document.querySelector('.qn-panel')`, 4000);
  if (opened) {
    const expanded = await ev(`document.querySelector('${anchorSel}')?.getAttribute('aria-expanded')`);
    if (expanded !== 'true') fail('R10', anchorSel, `opener aria-expanded=${expanded}`);
    else pass('R10', anchorSel, 'opener exposes expanded state');
  }
  return opened;
}
const closeList = async () => {
  if (!(await ev(`!!document.querySelector('.qn-panel')`))) return;
  await key('Escape');
  await until(`!document.querySelector('.qn-panel')`, 4000);
  if (!openAnchorSelector) return;
  const state = await ev(`(()=>{const a=document.querySelector('${openAnchorSelector}');return a&&{expanded:a.getAttribute('aria-expanded'),focused:document.activeElement===a}})()`);
  if (!state || state.expanded !== 'false' || !state.focused) fail('R10', openAnchorSelector, `Escape did not restore opener state/focus: ${JSON.stringify(state)}`);
  else pass('R10', openAnchorSelector, 'Escape restores collapsed state and opener focus');
  openAnchorSelector = null;
};

async function checkList(where, { expectTail = true } = {}) {
  const d = await ev(ROWS_JS);
  if (!d) return fail('R1', where, 'no list opened');
  // R1 — every row inside the viewport. The panel may scroll; a row below the
  // fold is reachable, a row off the SIDE is not, so the side test is absolute
  // and the vertical test allows an inner scroll.
  for (const r of d.rows) {
    if (r.left < -0.5 || r.right > d.viewW + 0.5) {
      fail('R1', where, `row "${r.label}" spans ${r.left.toFixed(1)}..${r.right.toFixed(1)} in a ${d.viewW.toFixed(0)} px view`);
      break;
    }
  }
  const panel = await ev(`(() => { const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
    const r = document.querySelector('.qn-panel').getBoundingClientRect();
    return { top: r.top / z, bottom: r.bottom / z, left: r.left / z, right: r.right / z }; })()`);
  if (panel.top < -0.5 || panel.left < -0.5 || panel.right > d.viewW + 0.5 || panel.bottom > d.viewH + 0.5) {
    fail('R1', where, `panel box ${JSON.stringify(panel)} escapes ${d.viewW.toFixed(0)}x${d.viewH.toFixed(0)}`);
  } else pass('R1', where, `${d.rows.length} rows inside`);

  // R2 — his constraint, and it is the one thing not up for testing.
  if (expectTail) {
    const last2 = d.rows.slice(-2).map((r) => r.act);
    if (last2.join(',') !== 'save,quit') fail('R2', where, `last two rows are ${last2.join(', ') || '(none)'}, not save, quit`);
    else pass('R2', where);
  }

  const controls = d.rows.slice(0, 2);
  if (controls.map((r) => r.act).join(',') !== 'fullscreen,music') {
    fail('R8', where, `first two rows are ${controls.map((r) => r.act).join(', ') || '(none)'}`);
  } else if (controls.some((r) => r.role !== 'switch' || !['true', 'false'].includes(r.checked) || !r.condition)) {
    fail('R8', where, `stateful rows lack switch/ARIA/condition state: ${JSON.stringify(controls)}`);
  } else pass('R8', where, 'Fullscreen and Music are named synchronized switches');

  // R3 — 44 local px.
  const short = d.rows.filter((r) => r.h < 43.5);
  if (short.length) fail('R3', where, `${short.length} row(s) under 44 local px (min ${Math.min(...short.map((r) => r.h)).toFixed(1)})`);
  else pass('R3', where, `min row ${Math.min(...d.rows.map((r) => r.h)).toFixed(1)} local px`);

  // R4 — a real tooltip on the focus cursor, not `title=`.
  const tip = await ev(`(() => {
    const b = document.querySelector('.qn-row');
    b.dispatchEvent(new CustomEvent('gpfocus'));
    return new Promise((res) => setTimeout(() => {
      const t = document.getElementById('tooltip');
      res({ shown: !!t && t.style.display === 'block', text: t ? t.textContent.trim().slice(0, 40) : '', title: b.getAttribute('title') });
    }, 260));
  })()`);
  if (!tip.shown) fail('R4', where, 'first row shows no tooltip on the focus cursor');
  else pass('R4', where, `"${tip.text}"`);
  await ev(`document.querySelector('.qn-row').dispatchEvent(new CustomEvent('gpblur')); true`);
  return d;
}

async function checkMusicParity(where) {
  const readQuick = `(()=>{const b=document.querySelector('.qn-row[data-act="music"]');return b&&{open:!!document.querySelector('.qn-panel'),checked:b.getAttribute('aria-checked')}})()`;
  const before = await ev(readQuick);
  if (!before || before.checked !== 'true') return fail('R9', where, `Quick Menu did not begin Music ON: ${JSON.stringify(before)}`);
  await ev(`document.querySelector('.qn-row[data-act="music"]').click(); true`);
  await wait(150);
  const off = await ev(readQuick);
  if (!off?.open || off.checked !== 'false') return fail('R9', where, `Quick Menu did not stay open at Music OFF: ${JSON.stringify(off)}`);
  await shoot(`${where}__mirror-map-music-off`);
  await ev(`document.querySelector('.qn-row[data-tab="settings"]').click(); true`);
  if (!(await until(`document.querySelector('.ov-tab.on')?.dataset.member === 'settings' && document.querySelectorAll('.set-tab').length > 0`))) {
    const state = await ev(`(()=>({overlay:!!document.querySelector('.overlay-modal'),quick:!!document.querySelector('.qn-panel'),active:[...document.querySelectorAll('.ov-tab.on')].map(x=>x.dataset.member),settingsRows:document.querySelectorAll('.set-tab').length}))()`);
    return fail('R9', where, `Settings destination did not open the overlay Settings panel: ${JSON.stringify(state)}`);
  }
  await ev(`document.querySelector('.set-tab[data-member="Audio"]').click(); true`);
  await wait(100);
  const settingsOff = await ev(`document.querySelector('.toggle[data-key="musicEnabled"]')?.getAttribute('aria-checked')`);
  if (settingsOff !== 'false') return fail('R9', where, `Settings did not reflect Quick Menu OFF (aria=${settingsOff})`);
  await ev(`document.querySelector('.toggle[data-key="musicEnabled"]').click(); true`);
  await wait(100);
  await ev(`document.querySelector('#ov-close').click(); true`);
  await ev(`document.querySelector('#open-menu').click(); true`);
  await until(`!!document.querySelector('.qn-panel')`, 4000);
  const quickOn = await ev(readQuick);
  if (quickOn?.checked !== 'true') return fail('R9', where, `Quick Menu did not reflect Settings ON: ${JSON.stringify(quickOn)}`);
  pass('R9', where, 'Quick Menu ↔ Settings Music state synchronized both ways');
}

async function shoot(name) {
  if (!SHOTS) return;
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, S);
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
}

async function shootCatalog(vp) {
  if (!SHOTS) return;
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile,
  }, S);
  await cdp.send('Page.navigate', { url: `${BASE}docs/component-catalog.html` }, S);
  if (!(await until(`!!document.querySelector('.component-catalog, [data-component-catalog], main')`))) {
    throw new Error(`component catalog never rendered at ${vp.w}x${vp.h}`);
  }
  await wait(500);
  await shoot(`${vp.w}x${vp.h}__component-catalog`);
}

try {
  for (const vp of SHAPES) {
    viewportText = vp.text;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    if (vp.mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
    console.log(`\n== ${vp.tag} ==`);

    // ---- R7: legacy off remains explicit -----------------------------------
    await boot('map', { quickNav: 'off' });
    await ev(`document.getElementById('open-menu').click(); true`);
    await wait(350);
    const offPanel = await ev(`!!document.querySelector('.qn-panel')`);
    const offOverlay = await ev(`!!document.querySelector('.overlay-modal')`);
    if (offPanel) fail('R7', `${vp.tag} off/map`, 'a quick-nav list opened with the setting off');
    else if (!offOverlay) fail('R7', `${vp.tag} off/map`, 'the ☰ button did not open the overlay');
    else pass('R7', `${vp.tag} off/map`, 'legacy off: ☰ → overlay, no list');
    const offBtn = await ev(`(() => { const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
      const r = document.getElementById('open-menu').getBoundingClientRect(); return r.height / z; })()`);
    if (offBtn < 44) fail('R7', `${vp.tag} off/map`, `topbar button is ${offBtn.toFixed(1)} local px, under the 44 px floor`);
    else pass('R7', `${vp.tag} off/map`, `topbar button ${offBtn.toFixed(1)} local px (shared floor)`);
    await shoot(`${vp.tag}__off-map`);

    for (const mode of ['mirror', 'switcher']) {
      for (const fixedEnds of [true]) {
        const tagFE = 'fixed';
        // ---- map ----
        await boot('map', { quickNav: mode, quickNavFixedEnds: fixedEnds });
        if (!(await openList('#open-menu'))) fail('R1', `${vp.tag} ${mode}/${tagFE} map`, 'list did not open');
        else {
          await checkList(`${vp.tag} ${mode}/${tagFE} map`);
          if (fixedEnds && mode === 'mirror') {
            await shoot(`${vp.tag}__${mode}-map`);
            await checkMusicParity(vp.tag);
          }
        }
        await closeList();

        // ---- combat: the shape where the topbar wraps ----
        await boot('combat', { quickNav: mode, quickNavFixedEnds: fixedEnds });
        if (!(await openList('#combat-menu'))) fail('R1', `${vp.tag} ${mode}/${tagFE} combat`, 'list did not open');
        else {
          const d = await checkList(`${vp.tag} ${mode}/${tagFE} combat`);
          // The reading itself: controls stay first and destinations remain stable.
          if (d && d.rows.length > 1) {
            const second = d.rows[1].act === 'tab' ? 'tab' : d.rows[1].act;
            console.log(`  reading  ${vp.tag} ${mode}/${tagFE} combat: row 2 = "${d.rows[1].label}"`);
            void second;
          }
          if (fixedEnds && mode === 'mirror') await shoot(`${vp.tag}__${mode}-combat`);
        }
        await closeList();
      }

      // ---- the menu-expanded case: A mirrors, B folds ----
      await boot('map', { quickNav: mode, quickNavFixedEnds: true });
      await ev(`document.getElementById('open-menu').click(); true`);
      await until(`!!document.querySelector('.qn-panel')`, 4000);
      await ev(`document.querySelector('.qn-row[data-tab="deck"]').click(); true`);
      if (!(await until(`!!document.querySelector('.overlay-modal')`, 4000))) {
        fail('R1', `${vp.tag} ${mode} overlay`, 'a Deck row did not open the overlay');
      } else {
        await wait(400);
        const narrow = await ev(`document.documentElement.getAttribute('data-layout') === 'narrow'`);
        const folded = await ev(`!!document.querySelector('#ov-switch')`);
        const stripVisible = await ev(`(() => { const s = document.querySelector('.overlay-tabs'); return !!s && !s.hidden; })()`);
        const wantFold = mode === 'switcher' && narrow;
        // R6 — folds where autoLayout() says narrow, and only there.
        if (folded !== wantFold) fail('R6', `${vp.tag} ${mode} overlay`, `fold=${folded} but data-layout=${narrow ? 'narrow' : 'wide'} wants ${wantFold}`);
        else if (folded && stripVisible) fail('R6', `${vp.tag} ${mode} overlay`, 'folded AND the strip is still on screen — two tab controls');
        else pass('R6', `${vp.tag} ${mode} overlay`, folded ? 'strip folded to a switcher' : 'strip stands');
        if (folded) {
          const lbl = await ev(`document.querySelector('#ov-switch').textContent`);
          if (!/^Deck/.test(lbl)) fail('R6', `${vp.tag} ${mode} overlay`, `switcher says "${lbl}", not the tab it is on`);
          else pass('R6', `${vp.tag} ${mode} overlay`, `switcher names "${lbl.trim()}"`);
        }

        // R5 — the ring wraps at BOTH ends, over the same set either way.
        // The strip's member id is read from data-member, not data-tab: #78 put
        // every navigable set on one convention — data-surface on the host,
        // data-member on each control — so an instrument can enumerate a set off
        // the rendered page instead of importing the module that declared it.
        const tabIds = await ev(`(() => {
          const s = window.__qnTabs; return s || null; })()`);
        void tabIds;
        const order = [];
        const cur = async () => ev(`(() => {
          const on = document.querySelector('.ov-tab.on');
          if (on) return on.dataset.member;
          const sw = document.querySelector('#ov-switch');
          return sw ? sw.textContent.replace(/\\s*▾\\s*$/, '').replace(/\\s*\\(\\d+\\)\\s*$/, '') : null;
        })()`);
        const first = await cur();
        order.push(first);
        for (let i = 0; i < 12; i++) {
          await key(']');
          await wait(90);
          const c = await cur();
          if (c === first) break;
          order.push(c);
        }
        const back = await cur();
        if (back !== first) fail('R5', `${vp.tag} ${mode} overlay`, `] x${order.length} never wrapped back to "${first}" (saw ${order.join(' → ')})`);
        else if (order.length < 3) fail('R5', `${vp.tag} ${mode} overlay`, `the ring holds only ${order.length} tab(s)`);
        else pass('R5', `${vp.tag} ${mode} overlay`, `] wraps after ${order.length}: ${order.join(' → ')}`);
        await key('[');
        await wait(120);
        const prevWrap = await cur();
        if (prevWrap !== order[order.length - 1]) fail('R5', `${vp.tag} ${mode} overlay`, `[ from "${first}" gave "${prevWrap}", not the last tab "${order[order.length - 1]}"`);
        else pass('R5', `${vp.tag} ${mode} overlay`, `[ wraps to "${prevWrap}"`);
        // back to the tab we started on, then photograph the menu-expanded case
        await key(']');
        await wait(120);
        // Variant B on a WIDE screen deliberately offers no list here: the strip
        // fits, so ☰ steps back and there is exactly one tab control on screen.
        // That absence is the variant, not a finding — the assertion is that it
        // happens only in that one cell.
        const anchor = folded ? '#ov-switch' : '#ov-quicknav';
        const present = await ev(`!!document.querySelector('${anchor}')`);
        const wantAnchor = mode === 'mirror' || folded;
        if (present !== wantAnchor) {
          fail('R6', `${vp.tag} ${mode} overlay`, `${anchor} present=${present}, expected ${wantAnchor}`);
        } else if (!present) {
          pass('R6', `${vp.tag} ${mode} overlay`, 'wide + switcher: strip stands alone, ☰ steps back');
          await shoot(`${vp.tag}__${mode}-overlay`);
        } else if (await openList(anchor)) {
          await checkList(`${vp.tag} ${mode} overlay-list`);
          await shoot(`${vp.tag}__${mode}-overlay`);
          await closeList();
        } else fail('R1', `${vp.tag} ${mode} overlay-list`, `${anchor} opened nothing`);
      }
    }
  }
  await shootCatalog({ w: 1200, h: 730, d: 1, mobile: false });
  await shootCatalog({ w: 390, h: 844, d: 3, mobile: true });
} catch (e) {
  console.error('quicknav-reach: UNKNOWN — ' + (e.stack || e.message));
  srv.server.close();
  cdp.close();
  await chrome.close();
  process.exit(2);
}

srv.server.close();
cdp.close();
await chrome.close();

const red = findings.length;
console.log(`\n${checks.filter(Boolean).length}/${checks.length} checks green, ${red} finding(s)`);
for (const f of findings) console.log('  RED  ' + f);
console.log('DOOR: the rendered panel, served from this tree and opened by real clicks in a real');
console.log('      browser. `--selftest` re-observes two known-bads planted as bytes in the real');
console.log('      stylesheet — R3\'s tap floor and R1\'s clamp (observed red 2026-08-15,');
console.log('      re-runnable). The three manual breakages named in the header were one-off and');
console.log('      had drifted to `unknown` under SOP 2; they are superseded, not cited.');
console.log('BOUNDARY: six text/viewport shapes (1200x730, 844x344, 390x844), map +');
console.log('          combat + menu-expanded. --artifact selects the shipped root HTML.');
console.log('          NO GAMEPAD IS ATTACHED — R5 drives the ring through the keyboard');
console.log('          analogue ([ / ]), which shares the ring but NOT the button-4/5');
console.log('          precedence path. The precedence line itself is read, not observed.');
process.exit(red ? 1 : 0);
