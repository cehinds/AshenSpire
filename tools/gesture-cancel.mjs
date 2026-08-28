// tools/gesture-cancel.mjs — the gesture lifecycle, observed: a cancelled drag
// must drop nothing, leak nothing, strand nothing, and COST NOTHING.
//
// WHY THIS EXISTS. EldenSpire#22: wireCardInput added pointermove/pointerup to
// window per drag, removed them only in onUp, and had no pointercancel path.
// Vira measured the consequence before the fix existed: a cancelled drag's
// stale onUp fired on the NEXT tap — a different pointerId — and played the
// card the player had declined to play (discard 0->1, energy 3->2, both
// shapes). Her red bars are this file's checks 1-3; her F3 (the swallowed tap,
// found gating the fix itself) is check 4. The scratch probes that produced
// the PR's numbers had no home, so nobody else could re-run them — this is
// that home (her second non-blocking, folded).
//
// WHAT IT CHECKS, per shape:
//   1. cancel mid-drag: no ghost, window pointer listeners at baseline, and a
//      following tap on an enemy changes NOTHING (discard, energy)
//   2. five cancels: window listener count FLAT, no ghosts stranded
//   3. a second finger during a live drag cannot complete the drop
//   4. THE TAP AFTER A CANCEL COSTS NOTHING (Vira's F3): one tap on a
//      targetable card after a cancelled drag SELECTS it. The first fix armed
//      suppressClick before the cancelled-return and ate exactly one tap —
//      introduced by the fix, on the gesture the fix exists to make safe.
//   5. a real vertical drag onto an enemy still plays (the other edge)
//   6. narrow only: the per-axis split — five drag attempts reach the cards
//      5/5, a horizontal swipe through a card scrolls the hand, no ghost
//      stranded by the claim
//
// Usage
//   node tools/gesture-cancel.mjs                 source tree via tools/serve.mjs
//   node tools/gesture-cancel.mjs --dist          dist/AshenSpire.html over file://
//   node tools/gesture-cancel.mjs --only 390x844
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// OBSERVED RED (the instrument rule), this exact file against both known-bads:
//   dev 505b874 (pre-fix)    exit 1, 12 failing lines — ghost stranded, window
//                            pairs leaking, tap-after-cancel plays a card
//   d47240a (fix, 1st cut)   exit 1, EXACTLY 2 failing lines: F3 at both
//                            shapes, nothing else — Vira's gate finding
//                            isolated to the one line that caused it
//   the corrected fix        exit 0
// Both watched before this file counted as coverage. Two of this file's own
// checks failed on probe artifacts before any of that held (a trusted tap on a
// no-target card PLAYS it; a scrolled hand strip moves a card out from under
// its stale rect) — the fixes are inline where each bit.
//
// BOUNDARY. Linux headless Chromium; synthesized touch (Input.dispatchTouch-
// Event) is not a finger and cannot FLING — the dev narrow 0/5-pointerdowns
// state is reproducible only via the fling-claim priming Vira's probe does;
// this one does not claim it. ?shot=combat is sound HERE because gesture
// checks never depended on storage (her ruling; persistence checks must boot
// without ?shot=). The long-press context-menu path: headless fires zero
// contextmenu events, unmeasured. The keydown listener leak on remount is
// OUT OF SCOPE and NOT FIXED by #22 — it is #40's, measured 3->13 over ten
// remounts, and a green here says nothing about it.
//
// REMOVAL: deleted the day a browser-level input harness supersedes CDP touch
// synthesis, or the gesture helper (src/ui/gesture.js) grows its own suite.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

// DOOR, and why --selftest exists (Rune, 2026-08-15). The real input is a
// finger on glass, and it enters here as synthesized touch through CDP against
// the real page served from this tree — the strongest door available without a
// phone. The known-bads in the header above were REAL and were watched, but
// they were three named refs (505b874, d47240a, the corrected fix): under SOP
// 2's drift clause a red pinned to a ref that is no longer checked out is
// `unknown`, not coverage, which is what Vira's audit (2026-08-14) rated this
// tool — OBSERVED-ONCE. `--selftest` re-observes the SAME defect class without
// needing the old checkout: the pre-#22 gesture shape is planted back into
// src/ui/gesture.js in a copy of the tree, and this whole tool re-runs against
// the copy — same serve.mjs, same browser, same synthesized touch.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'gesture-cancel.mjs',
    args: ['--only', '390x844'],
    timeoutMs: 600000,
    plants: [
      {
        name: 'the pre-#22 shape returns: no pointercancel path, so a cancelled drag leaks its listeners',
        file: 'src/ui/gesture.js',
        find: "el.addEventListener('pointercancel', cancel);",
        replace: "/* planted: the #22 defect — no pointercancel path at all */",
        expectRed: /FAIL (cancel: window listeners at baseline|five cancels: window listeners FLAT|cancel: no ghost)/,
      },
      {
        // Vira's F3, the defect the FIRST fix introduced: suppressClick armed
        // ABOVE the cancelled-return eats exactly one tap — on the very
        // gesture the fix exists to make safe. Swapping the two lines back is
        // that known-bad, entering where it originally shipped.
        name: 'F3 returns: suppressClick arms above the cancelled-return and eats the next tap',
        file: 'src/ui/screens/combat.js',
        find: "          if (cancelled) return;\n          suppressClick = true;",
        replace: "          suppressClick = true; // planted: armed above the cancelled-return (the F3 shape)\n          if (cancelled) return;",
        expectRed: /FAIL F3: ONE tap after a cancel selects the card/,
      },
    ],
  }));
}

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
// WHAT TREE DID THIS SEE? Naming the file is not naming its freshness — this
// tool measured a two-merge-stale bundle and printed OK once already. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';
printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const SHAPES = [[390, 844], [1200, 730]];
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const useDist = args.includes('--dist');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--allow-file-access-from-files', '--no-first-run', 'about:blank'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = ''; const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-300)}`)), 12000);
  });
}

async function main() {
  if (!browserPath) { console.error('gesture-cancel: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'gcancel-'));
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error('gesture-cancel: no dist — run launch.mjs --build-only'); process.exit(2); }
    base = pathToFileURL(f).href;
  } else { const s = await serve({ root: ROOT, port: 8270, open: false }); server = s.server; base = `http://localhost:${s.port}/`; }
  console.log(`gesture-cancel — ${base}${useDist ? ' (shipped bundle)' : ' (source tree)'}`);

  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let fails = 0, ran = 0;

  for (const [W, H] of SHAPES) {
    const shape = `${W}x${H}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 }, S);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points }, S);
    const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };

    await cdp.send('Page.navigate', { url: base + '?shot=combat' }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(500);
    console.log(`\n  ${shape}`);
    await ev(`(() => { window.__pl={move:0,up:0}; const A=window.addEventListener.bind(window), R=window.removeEventListener.bind(window);
      window.addEventListener=(t,f,o)=>{ if(t==='pointermove')__pl.move++; if(t==='pointerup')__pl.up++; return A(t,f,o); };
      window.removeEventListener=(t,f,o)=>{ if(t==='pointermove')__pl.move--; if(t==='pointerup')__pl.up--; return R(t,f,o); }; return 1; })()`);
    const state = `(() => ({ discard: +document.querySelector('.pile.discard .n').textContent,
      energy: (document.querySelector('.energy-orb')||{textContent:''}).textContent.trim(),
      ghosts: [...document.querySelectorAll('body > .card')].filter(e=>e.style.position==='fixed').length, pl: window.__pl }))()`;
    // Every target is centred in the strip before measuring — the narrow hand
    // scrolls, and any probe that moved it (F3 does) leaves earlier cards
    // outside the viewport, where a drag at their stale centre touches nothing.
    const cardAt = `(() => { const c=document.querySelector('.hand .card');
      c.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
    const enemyAt = `(() => { const e=document.querySelector('.enemy:not(.dead)'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
    const before = await ev(state);
    const dragCancel = async (id) => { const p = await ev(cardAt);
      await touch('touchStart', [{ x: p.x, y: p.y, id }]);
      for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: p.x, y: p.y - i * 30, id }]);
      await touch('touchCancel', []); await wait(250); };

    // 1
    await dragCancel(1);
    const a1 = await ev(state);
    ok(a1.ghosts === 0, `cancel: no ghost (${a1.ghosts})`);
    ok(a1.pl.move === before.pl.move && a1.pl.up === before.pl.up, `cancel: window listeners at baseline`);
    const en = await ev(enemyAt);
    await touch('touchStart', [{ x: en.x, y: en.y, id: 2 }]); await touch('touchEnd', []); await wait(400);
    const a2 = await ev(state);
    ok(a2.discard === before.discard && a2.energy === before.energy, `tap on enemy after cancel changes nothing (discard ${before.discard}->${a2.discard}, energy ${a2.energy})`);
    // 4 — Vira's F3: the NEXT tap must not vanish. The tap lands on a card that
    // NEEDS A TARGET (a Strike), so its click SELECTS — the observable that
    // distinguishes "tap worked" from "tap swallowed". The first draft tapped
    // .hand .card[0], which is a no-target card here, and a trusted tap on one
    // PLAYS it immediately — correct behaviour failing the probe's wrong
    // premise, and contaminating the later drag check's discard arithmetic.
    // scrollIntoView first: on narrow the hand is a scroller and the first
    // Strike in DOM order can sit outside the strip — a tap at its unscrolled
    // centre lands on nothing and reads as a swallowed tap that never happened.
    const strikeAt = `(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Strike/.test(x.textContent));
      c.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
    const sc0 = await ev(strikeAt);
    await touch('touchStart', [{ x: sc0.x, y: sc0.y, id: 3 }]);
    for (let i = 1; i <= 4; i++) await touch('touchMove', [{ x: sc0.x, y: sc0.y - i * 30, id: 3 }]);
    await touch('touchCancel', []); await wait(250);
    const sc1 = await ev(strikeAt);
    await touch('touchStart', [{ x: sc1.x, y: sc1.y, id: 4 }]); await touch('touchEnd', []); await wait(400);
    ok(await ev(`!!document.querySelector('.hand .card.selected')`), `F3: ONE tap after a cancel selects the card (no swallowed tap)`);
    // second tap toggles the selection off (the screen's own semantics), so the
    // armed targeting cannot leak a play into the checks below
    const sc2 = await ev(strikeAt);
    await touch('touchStart', [{ x: sc2.x, y: sc2.y, id: 5 }]); await touch('touchEnd', []); await wait(300);
    // 2
    for (let i = 0; i < 5; i++) await dragCancel(10 + i);
    const a3 = await ev(state);
    ok(a3.pl.move === before.pl.move && a3.pl.up === before.pl.up, `five cancels: window listeners FLAT`);
    ok(a3.ghosts === 0, `five cancels: no ghosts stranded`);
    // 3
    const p3 = await ev(cardAt);
    await touch('touchStart', [{ x: p3.x, y: p3.y, id: 20 }]);
    for (let i = 1; i <= 3; i++) await touch('touchMove', [{ x: p3.x, y: p3.y - i * 30, id: 20 }]);
    const d0 = (await ev(state)).discard;
    await touch('touchStart', [{ x: en.x, y: en.y, id: 21 }, { x: p3.x, y: p3.y - 90, id: 20 }]);
    await touch('touchEnd', [{ x: p3.x, y: p3.y - 90, id: 20 }]); await wait(300);
    ok((await ev(state)).discard === d0, `second finger cannot complete the drop`);
    await touch('touchCancel', []); await wait(300);
    // 5
    const p4 = await ev(cardAt);
    await touch('touchStart', [{ x: p4.x, y: p4.y, id: 30 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: p4.x + (en.x - p4.x) * i / 6, y: p4.y + (en.y - p4.y) * i / 6, id: 30 }]);
    await touch('touchEnd', []); await wait(500);
    ok((await ev(state)).discard === before.discard + 1, `a real drag still plays`);
    // 6 — narrow only
    if (W < 700) {
      await cdp.send('Page.navigate', { url: base + '?shot=combat' }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(500);
      await ev(`(() => { window.__downs=0; document.querySelector('.hand').addEventListener('pointerdown',(e)=>{ if(e.target.closest('.card'))__downs++; },true); return 1; })()`);
      let ghosts = 0;
      for (let i = 0; i < 5; i++) {
        const p = await ev(cardAt);
        await touch('touchStart', [{ x: p.x, y: p.y, id: 40 + i }]);
        for (let k = 1; k <= 3; k++) await touch('touchMove', [{ x: p.x, y: p.y - 40 * k, id: 40 + i }]);
        ghosts += await ev(`[...document.querySelectorAll('body > .card')].filter(e=>e.style.position==='fixed').length`);
        await touch('touchMove', [{ x: p.x, y: p.y, id: 40 + i }]); // back over the hand: release plays nothing
        await touch('touchEnd', []); await wait(250);
      }
      ok(await ev('window.__downs') === 5 && ghosts === 5, `axis split: five attempts aim five cards (${ghosts}/5 ghosts)`);
      const s0 = await ev(`document.querySelector('.hand').scrollLeft`);
      const p = await ev(cardAt);
      await touch('touchStart', [{ x: p.x, y: p.y, id: 50 }]);
      for (let k = 1; k <= 6; k++) await touch('touchMove', [{ x: p.x - 30 * k, y: p.y, id: 50 }]);
      await touch('touchEnd', []); await wait(400);
      ok(await ev(`document.querySelector('.hand').scrollLeft`) > s0, `axis split: horizontal swipe through a card scrolls the hand`);
      ok(await ev(`[...document.querySelectorAll('body > .card')].filter(e=>e.style.position==='fixed').length`) === 0, `axis split: the claim strands no ghost`);
    }
    await cdp.send('Target.closeTarget', { targetId });
  }
  if (ran === 0) { console.error(`\ngesture-cancel: --only ${only} matched nothing. Unknown, not a pass.`); process.exit(2); }
  console.log(`\n  ${fails ? `FAIL — ${fails} finding(s)` : 'PASS — a cancelled gesture drops nothing, leaks nothing, strands nothing, costs nothing'}`);
  console.log('  DOOR: synthesized touch through CDP against the real page served from this tree.');
  console.log('        `--selftest` re-observes both original defect shapes as bytes planted in a copy');
  console.log('        of the real source — the #22 missing pointercancel path and Vira\'s F3 line');
  console.log('        order (observed red 2026-08-15, re-runnable). The header\'s three ref-pinned');
  console.log('        observations are superseded: under SOP 2 they had drifted to `unknown`.');
  console.log('  NOT COVERED, found by a plant that would NOT go red: the listener ledger this tool');
  console.log('        watches is WINDOW\'s. src/ui/gesture.js scopes its listeners to the ELEMENT, so');
  console.log('        dropping its removeEventListener leaks an element listener and every count here');
  console.log('        stays flat. A real hole, named rather than papered over.');
  cdp.close(); child.kill(); if (server) server.close();
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(`gesture-cancel: ${e.message}`); process.exit(2); });
