// tools/placement.mjs — ANCHORED PLACEMENT HAS ONE HOME, AND THE GAP HAS ONE
// HOME TOO. The check on src/ui/fx.js placeAnchored(), measured on the real
// screens through the real gestures.
//
// WHY IT EXISTS. Until 2026-08-17 "put this element next to that one" was
// written out twice — tooltip.js place() and quicknav.js position() — with a
// private gap constant in each (`pad = 14`, `gap = 6`). Two homes for one length
// and two homes for one shape, so a placement fix had two files to land in and
// landed in neither. Sunna refused to collapse them twice and was right both
// times; the second of her reasons is the one this tool exists to keep honest:
// A SHARED PLACEMENT FUNCTION THAT HARD-CODES A GAP RE-COMMITS THE SECOND-COPY
// DEFECT AT THE MOMENT IT CLAIMS TO REMOVE ONE (Law 0 clause 4). The gap now
// lives in CSS as `--place-gap` on the placed element, and this tool measures
// the RENDERED distance against the DECLARED one. If the code ever grows its own
// copy again, the two disagree here and this goes red.
//
// WHAT IT CHECKS, per shape, on the real boot:
//   P1 DECLARED   every placed surface declares --place-gap, and it is > 0.
//                 A missing declaration resolves to 0 in placeAnchored (Law 0
//                 clause 5: fail visible, never plausible) — the panel welds
//                 itself to its anchor. That is a defect and this names it,
//                 rather than P2 passing because both sides agree on nothing.
//   P2 ONE HOME   the distance the browser actually rendered, on whichever axis
//                 separates the two boxes, equals the number the stylesheet
//                 declares. THIS IS THE LAW 0 CHECK. Tolerance 0.5 local px, and
//                 that is a float-noise tolerance, NOT a verdict threshold —
//                 see the neighbourhood note below.
//   P3 CLEAR      a tooltip does not sit on its anchor's SIBLINGS. `beside` was
//                 true and not enough: a hand card is one of five in a row, so
//                 "right of it" is on the next card. Measured before the fix, on
//                 ?shot=combat with a completed hold: 2 of 5 cards touched at
//                 390x844 (52.4% of one) and 3 of 5 at 1200x730, where the worst
//                 hold buried two at 96.2% and 71.0%.
//   P4 UNDER      the quick-nav panel's top is at or below its button's bottom,
//                 and its right edge is on the button's. That is the OTHER
//                 intent — `under`, not `beside` — and the reason the intent is
//                 named by the caller instead of guessed from the geometry.
//
// THE DOOR. Every number is read off a real boot: served over http, loaded in
// headless Chromium, the real hover / the real click, `getBoundingClientRect`
// converted to local px once (fx.js's rule) before anything is compared. The
// declared gap is read with `getComputedStyle(el).getPropertyValue('--place-gap')`
// — the same call placeAnchored makes, off the same cascade. `--selftest` plants
// its known-bads as file bytes in a copied real tree (tools/doorplant.mjs) and
// runs this whole tool from the copy.
//
// THE NEIGHBOURHOOD, stated because the Gate asks (CHARTER 2b). P2's 0.5 is not
// a verdict threshold — it separates float noise from a real disagreement, and
// nothing about the design sits near it. It is still given a cell either side by
// the same door: plant A moves the stylesheet by ONE local px while the code
// keeps its own copy (measured 14, declared 15 → 1.0, red) and the clean run
// measures ~0.0 (green). One step of the check's own unit flips the verdict, and
// both cells arrive as a CSS edit in a copied tree. P1, P3 and P4 are not
// thresholds at all: P1 is "declared or not", P3 is a count that must be zero,
// P4 is a sign test.
//
// BOUNDARIES, and they are real.
//   · TWO SURFACES, NOT EVERY PLACED THING. The tooltip and the quick-nav panel
//     are placeAnchored's only callers today. tutorial.js still places its own
//     bubble in the veil's local space with its own clamp, and main.js's
//     ?shot=fx points are a third hand-rolled site. Neither is measured here and
//     neither is converted — `unknown`, named rather than implied.
//   · P3 IS THE HAND AND NOTHING ELSE. Every other attachTooltip caller now
//     passes `clear: el.parentElement` too, and none of them is sampled. The
//     disclosure faces (`.disc-faces`) are the obvious next one.
//   · LINUX HEADLESS CHROMIUM, two shapes, default Text size and UI size. The
//     gap is `px` and must not track either dial (Law 4 clause 3); that it does
//     not is a claim about the CSS, and this tool never turns the dials.
//   · P2 SAYS THE RENDERED GAP MATCHES THE DECLARED ONE. It says nothing about
//     whether 14 px is the right number for a human — that is Sunna's read.
//
// Usage
//   node tools/placement.mjs                  source tree via serve.mjs
//   node tools/placement.mjs --only 390x844
//   node tools/placement.mjs --selftest       the same-door known-bad corpus
//   node tools/placement.mjs --browser PATH
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// REMOVAL: deleted the day placeAnchored has no callers, or the day the gap
// stops being a length a stylesheet owns.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'placement.mjs',
    args: ['--only', '1200x730'],
    timeoutMs: 900000,
    plants: [
      {
        // THE LAW 0 PLANT, and the whole reason this tool exists. The code takes
        // its gap back as a private constant while the stylesheet says something
        // else. ONE LOCAL PX of disagreement, deliberately — if the smallest
        // possible second copy is caught, every larger one is, and it gives P2's
        // tolerance a cell on the far side of itself by the same door.
        name: 'the gap grows a SECOND HOME — placeAnchored keeps its own 14 while ui.css says 15',
        edits: [
          {
            file: 'src/ui/fx.js',
            find: '  const gap = placeGap(el);',
            replace: '  const gap = 14; // planted: the private constant, back where it was',
          },
          {
            file: 'styles/ui.css',
            find: '  --place-gap: 14px;',
            replace: '  --place-gap: 15px;',
          },
        ],
        expectRed: /P2 .*tooltip.*rendered .* declared|P2 ONE HOME/,
      },
      {
        // The gap loses its home entirely. placeAnchored resolves it to 0 and
        // welds the tooltip to the card — VISIBLY wrong rather than plausibly
        // wrong (Law 0 clause 5). P2 alone would pass this, because measured 0
        // and declared 0 agree; P1 is the assertion that catches it, and this
        // plant is why P1 is not redundant.
        name: 'the gap has NO home — #tooltip stops declaring --place-gap',
        file: 'styles/ui.css',
        find: '  --place-gap: 14px;\n',
        replace: '',
        expectRed: /P1 /,
      },
      {
        // The clear preference cut. This is the payoff half: without it the
        // tooltip goes back to sitting on the cards either side of the one it
        // explains.
        name: 'the tooltip stops keeping off its anchor\'s group (the clear pass cut)',
        file: 'src/ui/fx.js',
        find: '    if (clear && usable.length > 1) {',
        replace: '    if (false && clear && usable.length > 1) { // planted: no group preference',
        expectRed: /P3 /,
      },
      {
        // The intent misnamed at the call site. `beside` is a legal intent and a
        // wrong answer here: at 1200 there is room to the right of ☰, so the
        // list opens BESIDE the button instead of under it. This is the check on
        // Marina's rule that the intent is named by the caller — a name that
        // nothing verifies is a comment.
        name: 'quicknav asks for the WRONG INTENT — beside its button instead of under it',
        file: 'src/ui/components/quicknav.js',
        // The comment is a BLOCK comment on purpose: a `//` here swallows the
        // call's own `);` and the plant becomes a SyntaxError, which boots
        // nothing and exits 2. doorplant refused to score that as a catch —
        // correctly, and it is the difference between an instrument that is
        // silent and one that is broken.
        find: "{ intent: 'under', align: 'end', view }",
        replace: "{ intent: 'beside', view } /* planted: the wrong intent, named at the call site */",
        expectRed: /P4 /,
      },
    ],
  }));
}

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const only = argOf('--only');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
if (!browserPath) { console.error('placement: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHAPES = [{ w: 390, h: 844, d: 3, mobile: true }, { w: 1200, h: 730, d: 1, mobile: false }];
const GAP_TOL = 0.5; // local px — float noise, not a verdict threshold (see header)

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-300)}`)), 12000);
  });
}

// ONE READING, shared by every check below: two boxes in LOCAL px, the gap the
// placed element declares, and which axis actually separates them.
//
// WHY "whichever axis separates". placeAnchored pins only the SEPARATING axis —
// a tooltip below a control has to be below it, and its horizontal position is
// free to slide so the vertical room can be used at all. So the declared gap is
// carried by exactly one axis and the other is whatever the slide chose. Both
// axes are reported; the check asks that ONE of them is the declared number, and
// names the axis it found it on. Neither separating (the boxes overlap) means
// the bound answered instead of a side — reported as `on it`, which is a
// finding, not a measurement.
const READ = (anchorSel, placedSel) => `(() => {
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
  const a0 = document.querySelector(${JSON.stringify(anchorSel)});
  const p0 = document.querySelector(${JSON.stringify(placedSel)});
  if (!a0 || !p0) return { missing: !a0 ? ${JSON.stringify(anchorSel)} : ${JSON.stringify(placedSel)} };
  const L = (el) => { const r = el.getBoundingClientRect();
    return { left: r.left/z, top: r.top/z, right: r.right/z, bottom: r.bottom/z, w: r.width/z, h: r.height/z }; };
  const a = L(a0), p = L(p0);
  const raw = getComputedStyle(p0).getPropertyValue('--place-gap').trim();
  const declared = parseFloat(raw);
  const axes = [];
  if (p.left  >= a.right)  axes.push({ side: 'right', gap: p.left - a.right });
  if (p.right <= a.left)   axes.push({ side: 'left',  gap: a.left - p.right });
  if (p.top   >= a.bottom) axes.push({ side: 'below', gap: p.top - a.bottom });
  if (p.bottom<= a.top)    axes.push({ side: 'above', gap: a.top - p.bottom });
  return { a, p, zoom: z, raw, declared: Number.isFinite(declared) ? declared : null, axes };
})()`;

// Every hand card, and how much of each one the tooltip is sitting on.
const COVER = `(() => {
  const t = document.getElementById('tooltip');
  if (!t || getComputedStyle(t).display === 'none') return { shown: false };
  const tr = t.getBoundingClientRect();
  const ov = (x, y) => Math.max(0, Math.min(x.right,y.right)-Math.max(x.left,y.left))
                     * Math.max(0, Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top));
  const cards = [...document.querySelectorAll('.hand .card')];
  const hit = cards.map((c, i) => { const r = c.getBoundingClientRect(); const area = ov(tr, r);
    return { i, pct: r.width*r.height ? +(100*area/(r.width*r.height)).toFixed(1) : 0 }; })
    .filter((c) => c.pct > 0);
  return { shown: true, n: cards.length, hit };
})()`;

const findings = [];
let checks = 0;
const ok = (id, where, msg) => { checks++; console.log(`    PASS ${id}  ${where} — ${msg}`); };
const bad = (id, where, msg) => { checks++; findings.push(`${id}  ${where} — ${msg}`); console.log(`    FAIL ${id}  ${where} — ${msg}`); };

/** P1 + P2 on one surface: the gap is declared, and the render agrees with it. */
function gapChecks(where, surface, r) {
  if (r.missing) { bad('P1', where, `${surface}: ${r.missing} is not on the screen — nothing measured`); return; }
  if (r.declared == null || !(r.declared > 0)) {
    bad('P1', where, `${surface}: --place-gap is ${r.raw ? `"${r.raw}"` : 'UNDECLARED'} — placeAnchored resolves that to 0 and welds the panel to its anchor`);
    return;
  }
  ok('P1', where, `${surface}: --place-gap declared "${r.raw}" (${r.declared} local px)`);
  if (!r.axes.length) {
    bad('P2', where, `${surface}: the panel overlaps its anchor on BOTH axes — the bound answered, not a side, so there is no rendered gap to compare`);
    return;
  }
  const near = r.axes.find((x) => Math.abs(x.gap - r.declared) <= GAP_TOL);
  const seen = r.axes.map((x) => `${x.side} ${x.gap.toFixed(2)}`).join(', ');
  if (near) ok('P2', where, `${surface}: rendered ${near.gap.toFixed(2)} = declared ${r.declared} local px, on the ${near.side} axis (all separations: ${seen})`);
  else bad('P2', where, `${surface}: rendered ${seen} — declared ${r.declared}. The gap the browser drew is not the gap the stylesheet owns: the code is carrying a second copy`);
}

async function main() {
  const { serve } = await import(join(ROOT, 'tools/serve.mjs'));
  const profile = mkdtempSync(join(tmpdir(), 'placement-'));
  const s = await serve({ root: ROOT, port: 8294, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`placement — ${base} (root ${ROOT})`);
  console.log('DOOR: real boot over http in headless Chromium, real hover and real click; every');
  console.log('      box converted to LOCAL px once before anything is compared; the declared gap');
  console.log(`      read with the same getComputedStyle('--place-gap') placeAnchored uses.`);
  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let ran = 0;

  for (const vp of SHAPES) {
    const shape = `${vp.w}x${vp.h}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    console.log(`\n  ${shape}`);

    // ---- the tooltip, on the hand ------------------------------------------
    await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat');
    await wait(500);
    const n = await ev(`document.querySelectorAll('.hand .card').length`);
    if (!n) { bad('P3', shape, 'no hand cards rendered — nothing to measure'); continue; }

    // Every card in the hand, hovered in turn. The tooltip is a HOVER here, not
    // a hold: the hold is tooltippersist's subject and place() is the same call
    // either way, so this samples the whole row for the price of one gesture
    // each.
    let worst = null; let touchedCards = 0;
    for (let i = 0; i < n; i++) {
      await ev(`(() => { const c = document.querySelectorAll('.hand .card')[${i}];
        c.scrollIntoView({ inline: 'center', block: 'nearest' });
        c.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false })); return true; })()`);
      await wait(260);
      const cov = await ev(COVER);
      if (!cov.shown) { bad('P3', shape, `card #${i}: hovering it showed no tooltip — nothing measured`); continue; }
      const others = cov.hit.filter((h) => h.i !== i);
      if (others.length) {
        touchedCards += others.length;
        const w = others.reduce((m, h) => (h.pct > (m?.pct || 0) ? h : m), null);
        if (!worst || w.pct > worst.pct) worst = { ...w, from: i };
      }
      if (i === 0) gapChecks(shape, 'tooltip vs hand card #0', await ev(READ('.hand .card', '#tooltip')));
      await ev(`document.querySelectorAll('.hand .card')[${i}].dispatchEvent(new PointerEvent('pointerleave', { bubbles: false })); true`);
      await wait(80);
    }
    if (touchedCards === 0) ok('P3', shape, `the tooltip clears its neighbours on all ${n} hand cards (0 sibling cards touched)`);
    else bad('P3', shape, `the tooltip sits on ${touchedCards} sibling card(s) across ${n} hovers — worst ${worst.pct}% of card #${worst.i}, from card #${worst.from}. A tooltip may not cover the hand it is explaining`);

    // ---- the quick-nav panel, the OTHER intent ------------------------------
    // The list is behind a setting, so it is turned on the way the game turns it
    // on (?shotSettings), and opened by clicking the real ☰ button.
    const q = encodeURIComponent(JSON.stringify({ quickNav: 'mirror' }));
    await cdp.send('Page.navigate', { url: `${base}?shot=map&shotSettings=${q}` }, S);
    await until(`!!document.querySelector('.map-node')`, 'map');
    await wait(600);
    await ev(`document.getElementById('open-menu').click(); true`);
    const opened = await ev(`!!document.querySelector('.qn-panel')`).catch(() => false)
      || await until(`!!document.querySelector('.qn-panel')`, 'qn-panel', 4000).then(() => true).catch(() => false);
    if (!opened) { bad('P4', shape, 'the quick-nav list did not open — nothing measured'); }
    else {
      await wait(250);
      const r = await ev(READ('#open-menu', '.qn-panel'));
      gapChecks(shape, 'quick-nav panel vs ☰', r);
      if (r.missing) { /* already reported by gapChecks */ }
      else {
        // UNDER, not beside — the intent the caller named. Two claims, because
        // `under` is two: the separating axis is the vertical one, and the free
        // axis is END-aligned (the panel's right edge on the button's). The
        // right-edge claim is waived when the bound moved it, which on a phone
        // it does: the topbar wraps and puts ☰ at the LEFT edge, so a panel
        // right-aligned to it would start off-screen. Naming the waiver is the
        // point — an assertion that quietly excuses itself is the thing this
        // house calls green-that-was-not-clearance.
        const under = r.p.top >= r.a.bottom - 0.5;
        if (under) ok('P4', shape, `the panel opens UNDER ☰ (panel top ${r.p.top.toFixed(1)} ≥ button bottom ${r.a.bottom.toFixed(1)} local px)`);
        else bad('P4', shape, `the panel is NOT under ☰ — panel (${r.p.left.toFixed(1)},${r.p.top.toFixed(1)})-(${r.p.right.toFixed(1)},${r.p.bottom.toFixed(1)}) against button bottom ${r.a.bottom.toFixed(1)}. 'under' is the intent this call site names`);
        const clamped = r.p.left <= 4.5;
        if (Math.abs(r.p.right - r.a.right) <= 0.5) ok('P4', shape, `right-aligned to ☰ (${r.p.right.toFixed(1)} = ${r.a.right.toFixed(1)} local px)`);
        else if (clamped) ok('P4', shape, `right-alignment WAIVED — the bound moved it (panel left ${r.p.left.toFixed(1)} is on the screen margin); align: 'end' is a preference the clamp outranks`);
        else bad('P4', shape, `align: 'end' did not hold — panel right ${r.p.right.toFixed(1)} vs button right ${r.a.right.toFixed(1)} local px, and the panel is not against the bound`);
      }
    }
    await cdp.send('Target.closeTarget', { targetId });
  }

  cdp.close(); child.kill(); await s.close?.();
  if (!ran) { console.error('placement: NOTHING RAN'); process.exit(2); }
  console.log(findings.length ? `\nplacement: ${findings.length} FINDING(S) over ${checks} check(s)` : `\nplacement: all green — ${checks} check(s)`);
  process.exit(findings.length ? 1 : 0);
}

main().catch((e) => { console.error('placement: UNKNOWN — ' + (e.stack || e.message)); process.exit(2); });
