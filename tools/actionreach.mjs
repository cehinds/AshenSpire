// tools/actionreach.mjs — is the way OUT of a screen on screen when the screen
// arrives, and does it STAY there while the player scrolls?
//
// WHY THIS EXISTS, and it is not a hypothetical: the same defect escaped twice
// on the same screen, a week apart, and neither escape was caught by anything
// in tools/.
//
//   - DESKTOP, 2026-07-2x. tools/tutorial-reach.mjs measured "#cz-start lays out
//     at top 1216 in a 1080px viewport, 136px below the fold", wrote the number
//     into a comment, called scrollIntoView, and went green. A tool that
//     measures a defect and then works around it reports PASS forever.
//   - PHONE, 2026-08-01. Sunna measured BEGIN THE CLIMB 374 device px below the
//     fold at 390x844 on a screen that "looks finished" where it stops — no
//     footer, no scroll affordance, 0 px scrollbar gutter — and found it by eye
//     on a shot, not with a tool.
//
// tools/screenreach.mjs cannot see this and SHOULD NOT: its whole load-bearing
// distinction is that SCROLLED OUT is fine and only COVERED is a defect,
// because the act map has 60+ nodes and most are off-screen at any moment.
// Correct there, blind here. This asks the complementary question about ONE
// control per screen: not "can the player reach it if they scroll" but "does
// the player know it is there at all".
//
// WHAT IT CHECKS, per shape x Text size:
//   1. the action is WHOLE on screen on arrival, before any scrolling
//   2. it is still whole after the content is scrolled to its bottom, and
//   3. it did not MOVE while that happened — i.e. it is bounded by flow rather
//      than sitting in the scrollport. (1) alone passes a screen whose button
//      merely happens to fit today's content; (3) is the property.
//   4. nothing on the screen is horizontally absent (EldenSpire#31's property,
//      re-asserted here because this tool visits shapes screenreach does not)
//   5. no wrapped set of equal-weight option cards ends in an ORPHAN ROW — a
//      last row holding fewer items than the row above it.
//
// WIDENED to clause 5 at #29 slice 3, and the widening is deliberate rather
// than convenient: BOTH defects are the arrival screen SAYING SOMETHING FALSE
// ABOUT ITSELF. Clauses 1-3 catch "there is nothing more here" when there is.
// Clause 5 catches "this one is chosen" when it isn't — three class cards
// wrapping 2-then-1 leave a lone centred card under a pair, which is the
// grammar of a selection, while the actually-selected card sat top-left with a
// full card height between the gold border and where the eye lands (Sunna,
// 2026-08-01). A player can check neither claim against anything on the screen.
//
// CLAUSE 5 IS ABOUT THE COUNT, WHICH IS WHY IT IS A CHECK AND NOT A ONE-OFF
// MEASUREMENT. Three cards wrap 2+1 and orphan; four wrap 2+2 and look fine;
// five wrap 2+2+1 and it is back. Law 1 promises a class is a table row, so the
// count is content and moves without anyone touching CSS. The defect returns on
// a data edit, and this is the only thing that would notice.
//
// TEXT SIZE IS NOT DECORATION. The row is sized in rem so it grows with the
// setting (Law 2), which means the setting can push the content out — so S/M/L/XL
// are applied exactly as main.js applies them (a root font-size %, the values
// from balance.ui.textSize) rather than assumed harmless.
//
// Usage
//   node tools/actionreach.mjs                 source tree via tools/serve.mjs
//   node tools/actionreach.mjs --dist          dist/AshenSpire.html over file://
//   node tools/actionreach.mjs --only 390x844
//   CHROME=/path/to/chrome node tools/actionreach.mjs
//
// Exit codes
//   0  every action is whole on arrival and pinned
//   1  a finding
//   2  usage / no browser / a screen that would not mount / NOTHING RUN — never a pass
//
// OBSERVED RED (the instrument rule, commons/development.md): run against
// dist/AshenSpire.html as committed at 3da9ca4 — the bundle from the commit
// before the fix — this reports FAIL, 39 findings of 40 cells, exit 1, with
// `moved` equal to the full scroll travel at every failing cell (432 px at
// 390x844 Text M; 1038 px at 430x932 XL). It was watched failing before it was
// allowed to count as coverage.
//
// THE ONE CELL THAT PASSED ON THE KNOWN-BAD IS THE REASON CLAUSE 3 EXISTS.
// 390x508 at Text size S passed on the old build — the layout flips wide at
// --ui-zoom 0.62 there and the content simply fit, so nothing scrolled and
// nothing moved. Fitting today is not being pinned, and one text size up the
// same cell failed. A tool that only asked clause 1 would have called that
// shape fixed.
//
// REMOVAL CONDITION: delete this file the day tools/screenreach.mjs grows an
// arrival-and-pinned assertion of its own, or the day no family game has a
// screen whose primary action can leave the viewport. Two tools asking one
// question is the second copy this house exists to catch.

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
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// One entry per screen with a primary action that can leave the viewport.
// `action` names the control; `port` names where that screen's content scrolls
// (null = find it by walking up from the action, which is what the BEFORE tree
// needs). Reached by PLAYING where a ?shot= state does not exist, because a
// shot state that has drifted from the real screen makes every green decorative.
const SCREENS = [
  {
    name: 'customize',
    reach: 'play',
    ready: `!!document.querySelector('.cz-portrait')`,
    root: '.screen.customize',
    action: '#cz-start',
    port: '.cz-scroll',
    // Clause 5's subject. Equal-weight option CARDS only — the sigil/tint/sprite
    // swatches also wrap, and a lone small square does not read as "chosen" the
    // way a lone card does, so they are deliberately out of scope rather than
    // forgotten. Widening this list is a design call, not a tuning one.
    optionSets: ['#cz-classes .class-pick', '#cz-keepsakes .cz-keepsake'],
  },
];

// Nine shapes on purpose, and the list is NOT screenreach's four — a defect can
// live in the gap between two tools' shape lists, and one already did (Sunna's
// covered map node at 412x915, a shape screenreach does not test).
// 390x508 is here on purpose and is not a device: it is 390x844 with 336 px
// taken off the bottom, which is what an iOS-sized on-screen keyboard leaves
// when it resizes the LAYOUT viewport. It is the only half of the keyboard
// question this harness can ask (see the boundary at the end), and asking it is
// how the before-tree's failure at that shape was found rather than argued.
const SHAPES = [
  [320, 640], [360, 640], [390, 508], [390, 844], [412, 915], [430, 932],
  [844, 390], [1200, 730], [1366, 768], [1920, 1080],
];
// balance.ui.textSize. Read from the bundle would be better; typed here is a
// second copy and it is called out rather than hidden — it is the ONE value in
// this file that can drift, and clause 2 of Law 1 says so out loud.
const TEXT = { S: '56.25%', M: '62.5%', L: '68.75%', XL: '75%' };

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const probe = (sc) => `(() => {
  const n = (v) => +(+v).toFixed(2);
  const root = document.querySelector(${JSON.stringify(sc.root)});
  if (!root) return { error: 'no ' + ${JSON.stringify(sc.root)} };
  const go = root.querySelector(${JSON.stringify(sc.action)});
  if (!go) return { error: 'no ' + ${JSON.stringify(sc.action)} };
  const scrollerOf = (e) => {
    for (let p = e; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['auto','scroll'].includes(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return null;
  };
  const declared = ${JSON.stringify(sc.port)} ? root.querySelector(${JSON.stringify(sc.port)}) : null;
  const port = declared || scrollerOf(go) || root;
  const whole = (e) => { const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; };

  const t0 = port.scrollTop;
  const arrival = whole(go);
  const topAtRest = n(go.getBoundingClientRect().top);
  port.scrollTop = port.scrollHeight;
  const atBottom = whole(go);
  const topAtBottom = n(go.getBoundingClientRect().top);
  port.scrollTop = t0;

  // EldenSpire#31's property, re-asserted: zero pixels on screen horizontally
  // in a document that cannot scroll sideways is ABSENT, not clipped.
  let off = 0, offEg = '';
  for (const e of root.querySelectorAll('button,input,.cz-opt,.class-pick,.cz-keepsake,.choice,.opt')) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= 0 || r.left >= innerWidth) {
      off++;
      if (!offEg) offEg = ((e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,16) || e.id) + ' [' + n(r.left) + '..' + n(r.right) + ']';
    }
  }
  // Clause 5. Rows are found by GROUPING RENDERED TOPS, never by reading the
  // flex rules — the question is what the player sees wrap, and a stylesheet
  // cannot answer that at a given width and text size. 1 px of rounding
  // tolerance because a taller card in a row shifts its neighbours' tops.
  const orphans = [];
  for (const sel of ${JSON.stringify(sc.optionSets || [])}) {
    const items = [...root.querySelectorAll(sel)].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (items.length < 2) continue;
    const rows = [];
    for (const e of items) {
      const t = e.getBoundingClientRect().top;
      const row = rows.find((r) => Math.abs(r.top - t) <= 1);
      if (row) row.n++; else rows.push({ top: t, n: 1 });
    }
    rows.sort((a, b) => a.top - b.top);
    const counts = rows.map((r) => r.n);
    const widest = Math.max(...counts);
    // A single row cannot orphan. A last row narrower than the widest is one.
    if (rows.length > 1 && counts[counts.length - 1] < widest) {
      orphans.push(sel + ' wraps ' + counts.join('-then-') + ' (' + items.length + ' items)');
    }
  }

  return { arrival, atBottom, topAtRest, topAtBottom, moved: n(topAtRest - topAtBottom),
    btnH: n(go.getBoundingClientRect().height), off, offEg, orphans,
    layout: document.documentElement.getAttribute('data-layout'),
    inPort: !!scrollerOf(go) };
})()`;

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
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--disable-background-timer-throttling',
      '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`Chrome gave no DevTools endpoint:\n${err.slice(-400)}`)), 12000);
  });
}

async function main() {
  if (!browserPath) { console.error('actionreach: no Chrome/Edge found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'actionreach-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error(`actionreach: ${f} does not exist — run \`node tools/launch.mjs --build-only\` first`); process.exit(2); }
    base = pathToFileURL(f).href;
  } else {
    const s = await serve({ root: ROOT, port: 8266, open: false });
    server = s.server; base = `http://localhost:${s.port}/`;
  }
  console.log(`actionreach — ${base}${useDist ? '  (the shipped single-file bundle)' : '  (source tree)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const evalIn = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, what, ms = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await evalIn(expr).catch(() => false)) return true; await wait(150); }
    throw new Error(`timed out waiting for ${what}`);
  };

  const fails = [];
  let cells = 0;
  for (const sc of SCREENS) {
    for (const [w, h] of SHAPES) {
      const shape = `${w}x${h}`;
      if (only && only !== shape) continue;
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: w < 700 }, S);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: w < 700, maxTouchPoints: 5 }, S);
      await cdp.send('Page.navigate', { url: base }, S);
      await until(`!!([...document.querySelectorAll('button')].find(x=>/BEGIN A CLIMB/i.test(x.textContent)))`, 'the title screen');
      await evalIn(`[...document.querySelectorAll('button')].find(x=>/BEGIN A CLIMB/i.test(x.textContent)).click(); 'ok'`);
      await until(sc.ready, `the ${sc.name} screen`);
      console.log(`\n  ${sc.name} @ ${shape}`);
      for (const [k, v] of Object.entries(TEXT)) {
        await evalIn(`document.documentElement.style.fontSize = '${v}'; 'ok'`);
        await wait(600); // auto-zoom re-flexes on a 150ms debounce
        const r = await evalIn(probe(sc));
        if (r.error) { fails.push(`${sc.name} ${shape} ${k}: ${r.error}`); console.log(`    ${k.padEnd(3)} ${r.error}`); continue; }
        cells++;
        const bad = [];
        if (!r.arrival) bad.push(`not whole on arrival (top ${r.topAtRest} in a ${h}px viewport)`);
        if (!r.atBottom) bad.push('not whole at the bottom of the scroll');
        if (r.moved !== 0) bad.push(`MOVED ${r.moved} px while the content scrolled — it is in the scrollport, not bounded by flow`);
        if (r.off) bad.push(`${r.off} control(s) horizontally absent, e.g. ${r.offEg}`);
        for (const o of (r.orphans || [])) bad.push(`ORPHAN ROW — ${o}: a lone card under a full row reads as "this one is chosen"`);
        console.log(`    ${k.padEnd(3)} ${String(r.layout).padEnd(7)} arrival=${String(r.arrival).padEnd(5)} bottom=${String(r.atBottom).padEnd(5)} ` +
          `top=${String(r.topAtRest).padEnd(8)} moved=${String(r.moved).padEnd(7)} btnH=${String(r.btnH).padEnd(6)} off=${r.off} orphan=${(r.orphans||[]).length}` +
          (bad.length ? '   <-- ' + bad.join(' · ') : ''));
        if (bad.length) fails.push(`${sc.name} ${shape} text=${k}: ${bad.join(' · ')}`);
      }
    }
  }

  // A CHECK THAT RAN NOTHING IS `unknown`, NEVER A PASS — screenreach's own
  // lesson, and the `verify-shipped: OK - 0 checks passed` fixture in
  // commons/development.md. Copied deliberately: it is the failure mode a
  // shape-filtered sweep has by construction.
  if (cells === 0) {
    console.error(`\nactionreach: nothing was measured${only ? ` (--only ${only} matched no shape)` : ''}. That is unknown, not a pass.`);
    console.error(`  shapes: ${SHAPES.map(([w, h]) => `${w}x${h}`).join(', ')}`);
    cdp.close(); child.kill(); if (server) server.close();
    process.exit(2);
  }

  console.log(`\n  BOUNDARY — Linux headless Chromium only; emulation is not a phone, and
  clicks are not touch. ONE screen is covered (customize) — shop, rest,
  rewards, the overlays and every screen without a scrolling body are covered
  here by nothing. It reads geometry at rest and after a programmatic scroll to
  the bottom: it does not swipe, does not press the action, and cannot judge
  whether the row is legible or whether a player would look for it there.

  THE ON-SCREEN KEYBOARD IS NOT MEASURED AND CANNOT BE. Headless Chromium has
  no OSK, and CDP cannot shrink the visual viewport alone — Emulation.
  setVisibleSize is accepted and silently does nothing, and a viewport clip on
  setDeviceMetricsOverride leaves window.visualViewport untouched (probed, not
  assumed). Shrinking the device metrics reproduces a LAYOUT-resizing keyboard
  exactly, which is why 390x508 is in the shape list; a VISUAL-resizing
  keyboard — the spec default for \`interactive-widget\` — is unknown here, in
  both directions, and 390x508 says NOTHING about it.

  4.4rem IS 44 LOCAL PX, NOT 44 DEVICE PX. btnH above is device px: at
  --ui-zoom 0.9 the row measures 39.59 and only clears 44 at Text size L. The
  gap is real and is Sunna's open card from 2026-07-31, not something a green
  here closes.`);

  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} finding(s) of ${cells} cell(s)` : `PASS — ${cells}/${cells} cells: the action is whole on arrival, does not move, and no option set orphans a row`}`);
  for (const f of fails) console.log(`    - ${f}`);
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`actionreach: ${e.message}`); process.exit(2); });
