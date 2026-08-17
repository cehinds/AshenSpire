// tools/tooltippersist.mjs — E8: the tooltip stays up until something replaces
// it, observed on the real combat screen through the finger's own door.
//
// HIS SENTENCE, and it is the whole spec (asks-ledger.md E8, his words):
//   "when selecting and holding on a card the tool tip pops up for a second and
//    then the zoom in card replaces it. instead keep the tooltip up after
//    holding the card for a set period of time and disappears once another card
//    is selected or it is played or another menu or game state activates"
//
// So the tooltip a COMPLETED HOLD summoned is persistent, and it ends on the
// three things he named. Every other tooltip — hover, focus cursor, the tap
// refusal — keeps today's behaviour exactly, and check 9 is the guard on that.
//
// WHAT IT CHECKS, per shape, in one continuous session on ?shot=combat:
//   1. HOLD: past the dial the copy is open AND the tooltip is still on screen.
//      This is his defect, stated positively — on dev the zoom card hid it.
//   2. LIFT: release the hold and the tooltip is STILL on screen. On touch the
//      lift fires pointerleave, which is what actually killed it; check 1 alone
//      is silence about the half a phone player lives in.
//   3. READABLE: the tooltip's box is wholly inside the viewport. A persistent
//      tooltip half off the screen is a worse artifact than a vanishing one.
//   4. INERT: computed pointer-events is `none`. THIS IS THE TRAP FLOOR — a
//      tooltip that stays cannot be allowed to eat a tap meant for the game.
//   5. HIS (a) another card is SELECTED  -> gone
//   6. HIS (b) a card is PLAYED          -> gone (discard moved, so it played)
//   7. HIS (c) a game state ACTIVATES    -> gone (End Turn)
//   8. REPLACED: hovering another control swaps the text, leaves exactly one
//      tooltip, and UNSTICKS it — the replacement is also the release valve.
//   9. UNCHANGED: an ordinary hover on the same card, with NO hold, still hides
//      on pointerleave. The change is the hold, not the tooltip.
//
// BOUNDARY — HIS THREE ENDINGS ARE CARRIED BY TWO DIFFERENT WIRES, AND THE
// SPLIT WAS MEASURED, NOT REASONED. I wrote "one mechanism" here first and P3
// disproved it in the same hour: cutting the DOM watch turned check 5 red and
// left 6 and 7 green.
//   · 5 SELECTED — carried ONLY by the new DOM watch in tooltip.js. No screen
//     calls hideTooltip() when a targetable card is merely selected; that wire
//     did not exist before this change and check 5 is the only thing on it.
//   · 6 PLAYED and 7 END TURN — carried by explicit hideTooltip() calls that
//     were ALREADY in combat.js (the drag start at :813, playCard, endTurn).
//     They would pass with the watch removed entirely. Their green is a claim
//     about the screen's existing wiring, not about this change.
// So a reader may not cite 6 and 7 as coverage of the new mechanism. Stated
// here rather than implied, per the predicate-vs-sentence rule.
//
// NOT MEASURED, and routed through the same watch as check 5: selecting by
// KEYBOARD (combat.js number keys) and selecting a targeted FLASK. Both
// re-render the hand, so both should end a stuck tooltip; neither is sampled
// here and both are `unknown`.
//
// NOT MEASURED, AND A WHOLE SURFACE: CO-OP. src/ui/screens/coop.js mounts the
// same hand.js, so the hold sticks there too, and this tool has never booted a
// co-op surface — the same standing hole handlayout and inspecthold carry
// (docs/HAND-COLLAPSE-CONSULT.md). `unknown`, not green, and named because a
// reader will otherwise take "the hand" to mean both of them.
//
// OTHER BOUNDARIES. Linux headless Chromium; synthesized touch is not a finger.
// Nothing here measures WHERE the tooltip sits beyond "inside the viewport" —
// place() is untouched by this change and this tool makes no claim about it.
// The hold path is measured on hand cards only, which is the only surface that
// can stick: no other caller asks for it.
//
// Usage
//   node tools/tooltippersist.mjs                source tree via serve.mjs
//   node tools/tooltippersist.mjs --selftest     the re-runnable known-bad
//   node tools/tooltippersist.mjs --root DIR     another tree
//   node tools/tooltippersist.mjs --only 390x844
//   node tools/tooltippersist.mjs --shots DIR   also write the two frames he
//                                               asked to see (held, lifted).
//                                               Evidence, not a check: the
//                                               camera asserts nothing.
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// REMOVAL: deleted the day the reading hold leaves the hand, or the day the
// tooltip stops being one shared element.

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const { serve } = await import(join(TOOLS, 'serve.mjs'));

const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const SHAPES = [[390, 844], [1200, 730]];
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const only = argOf('--only');
const shotsDir = argOf('--shots');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map(); const handlers = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); }
    else if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params, m.sessionId); });
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

// ---- the re-runnable known-bad ---------------------------------------------
// Three plants, three CONTRACTS. Each is a real source line in a disposable
// copy of this tree, judged by re-running this whole tool at --root COPY:
// real serve, real boot, real CDP touch on the real combat screen. Nothing is
// handed to a function.
const PLANTS = [
  {
    name: 'P1 the zoom kills it again',
    file: 'src/ui/components/hand.js',
    from: "      armInspect(el, { ms: inspectMs, onOpen: () => stickTooltip(el) });",
    to: "      armInspect(el, { ms: inspectMs, onOpen: () => hideTooltip() });",
    what: 'the completed hold no longer keeps the tooltip — dev\'s behaviour, rebuilt',
    expect: 'HIS DEFECT is back — "hold: the tooltip survives the zoom" red',
    mustRed: (out) => /FAIL hold: the tooltip survives the zoom/.test(out),
    mustStay: (out) => /PASS unchanged: a plain hover still hides on leave/.test(out),
    extra: (dir) => {
      // the plant needs the old import back, or the copy simply throws
      const p = resolve(dir, 'src/ui/components/hand.js');
      writeFileSync(p, readFileSync(p, 'utf8').replace(
        "import { stickTooltip } from './tooltip.js';",
        "import { hideTooltip } from './tooltip.js';"), 'utf8');
    },
  },
  {
    name: 'P2 the lift kills it',
    file: 'src/ui/components/tooltip.js',
    from: '    if (stuck) return; // E8: a completed hold outlives the pointer leaving',
    to: '    /* tooltippersist --selftest P2: the lift dismisses a stuck tooltip */',
    what: 'pointerleave stops respecting the stick',
    expect: 'the phone player loses it at the lift — "lift" red',
    mustRed: (out) => /FAIL lift: the tooltip is still up after release/.test(out),
    mustStay: (out) => /PASS hold: the tooltip survives the zoom/.test(out),
  },
  {
    name: 'P3 selection stops ending it',
    file: 'src/ui/components/tooltip.js',
    from: '  stuckWatch = new MutationObserver(() => { if (!el.isConnected) hideTooltip(); });',
    to: '  stuckWatch = new MutationObserver(() => { /* tooltippersist --selftest P3: nothing ends it */ });',
    what: 'the stuck tooltip stops noticing that the card it explains is gone',
    expect: 'HIS (a) breaks and ONLY his (a) — "selected" red, played/endturn still green',
    // The asymmetry is the finding, so the plant asserts it in both directions:
    // this watch is the whole of "another card is selected", and it is NOT what
    // carries "played" or "end turn". A plant that only demanded a red here
    // would have let my own wrong boundary sentence stand.
    mustRed: (out) => /FAIL selected:/.test(out),
    mustStay: (out) => /PASS lift: the tooltip is still up after release/.test(out)
      && /PASS played:/.test(out) && /PASS endturn:/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'ttpersist-kb-'));
  for (const d of ['src', 'styles', 'assets']) {
    if (existsSync(resolve(ROOT, d))) cpSync(resolve(ROOT, d), resolve(dir, d), { recursive: true });
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

function plantInto(dir, p) {
  const path = resolve(dir, p.file);
  const src = readFileSync(path, 'utf8');
  const first = src.indexOf(p.from);
  if (first < 0 || src.indexOf(p.from, first + 1) >= 0) {
    console.error(`tooltippersist --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  That line is one of this behaviour\'s CONTRACTS, not a convenience. RE-AIM the');
    console.error('  plant at wherever the contract lives now. Do not delete it: a corpus that');
    console.error('  silently stops matching is the eleven-instruments shape.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
  if (p.extra) p.extra(dir);
}

function runSelfAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root, '--only', '390x844'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('tooltippersist --selftest — the re-runnable known-bad');
  console.log('  DOOR: every known-bad below is a SOURCE EDIT to a disposable copy of this tree');
  console.log(`  (root ${ROOT}), judged by re-running this whole tool at --root COPY: served over`);
  console.log('  http, booted in headless Chromium, held with real CDP touch at real coordinates');
  console.log('  on the real combat screen. Nothing is handed to stickTooltip().');
  console.log('  SCOPE: the planted runs are 390x844 (one cell); the full run sweeps both shapes.\n');

  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  console.log('  control: untouched copy of this tree (no plant)');
  const clean = await runSelfAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants below are the only difference`);
  if (clean.code !== 0) for (const l of clean.out.split('\n').filter((l) => /\s+FAIL /.test(l))) console.log(`    control red |${l.replace(/^\s+/, ' ')}`);
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runSelfAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: the untouched corner stays green (right reason, not a crater)`);
    for (const line of r.out.split('\n').filter((l) => /\s+FAIL /.test(l))) {
      console.log(`    red |${line.replace(/^\s+/, ' ')}`);
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(fails
    ? `\ntooltippersist --selftest: ${fails} FAIL — this instrument's red is NOT re-observed; treat its greens as unknown`
    : '\ntooltippersist --selftest: held — clean copy green, all three contracts red by name, through the finger\'s own door');
  console.log('  BOUNDARY: the plants cover the stick, the lift and the END. The viewport check,');
  console.log('  the pointer-events floor and the replacement are asserted every run and have');
  console.log('  never been watched to fail.');
  process.exit(fails ? 1 : 0);
}

async function main() {
  if (!browserPath) { console.error('tooltippersist: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  if (args.includes('--selftest')) return selftest();
  const profile = mkdtempSync(join(tmpdir(), 'ttpersist-'));
  const s = await serve({ root: ROOT, port: 8291, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`tooltippersist — ${base} (root ${ROOT})`);

  if (shotsDir) mkdirSync(shotsDir, { recursive: true });
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
    const mouse = (type, x, y) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'none', buttons: 0 }, S);
    const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };
    const shot = async (name) => { if (!shotsDir) return;
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, S);
      writeFileSync(join(shotsDir, `${shape}-${name}.png`), Buffer.from(data, 'base64'));
      console.log(`    shot ${shape}-${name}.png`); };

    const combatUrl = base + '?shot=combat';
    const boot = async () => {
      await cdp.send('Page.navigate', { url: combatUrl }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat');
      await wait(500);
    };
    await boot();
    console.log(`\n  ${shape}`);

    // The one reading of the tooltip, used by every line below: is it painted,
    // what does it say, and is its box inside the room. Read off the live
    // element and its computed style — never off a flag this change owns.
    const tip = `(() => { const t = document.getElementById('tooltip');
      if (!t) return { present: false };
      const cs = getComputedStyle(t); const r = t.getBoundingClientRect();
      return { present: true, shown: cs.display !== 'none' && r.width > 0 && r.height > 0,
        pe: cs.pointerEvents, title: (t.querySelector('.tt-title')||{textContent:''}).textContent.trim(),
        left: r.left, top: r.top, right: r.right, bottom: r.bottom,
        vw: innerWidth, vh: innerHeight, n: document.querySelectorAll('#tooltip').length }; })()`;
    const state = `(() => ({ discard: +document.querySelector('.pile.discard .n').textContent,
      energy: (document.querySelector('.energy-orb')||{textContent:''}).textContent.trim(),
      open: document.querySelectorAll('body > .card-inspect').length }))()`;
    const aimFn = `const __aim = (c) => { const r = c.getBoundingClientRect();
      const sib = c.nextElementSibling; const sr = sib ? sib.getBoundingClientRect() : null;
      const right = sr && sr.left < r.right && sr.left > r.left ? sr.left : r.right;
      return { x: (r.left + right) / 2, y: r.top + r.height / 2 }; };`;
    const nthCard = (i) => `(() => { ${aimFn} const cs=[...document.querySelectorAll('.hand .card')];
      const c=cs[${i}]; if (!c) return null; c.scrollIntoView({ inline: 'center', block: 'nearest' });
      return Object.assign(__aim(c), { name: (c.querySelector('.cname')||{textContent:''}).textContent.trim() }); })()`;
    // A card whose NAME differs from the given one — the hand deals duplicates,
    // and "the text changed" is no evidence at all if both cards say the same
    // thing. Null when the hand is all one card, which the check reports.
    const otherNamed = (name) => `(() => { ${aimFn}
      const c=[...document.querySelectorAll('.hand .card')].find(x => ((x.querySelector('.cname')||{textContent:''}).textContent.trim()) !== ${JSON.stringify(name)});
      if (!c) return null; c.scrollIntoView({ inline: 'center', block: 'nearest' });
      return Object.assign(__aim(c), { name: (c.querySelector('.cname')||{textContent:''}).textContent.trim() }); })()`;
    const strikeAt = `(() => { ${aimFn} const c=[...document.querySelectorAll('.hand .card')].find(x=>/Strike/.test(x.textContent));
      if (!c) return null; c.scrollIntoView({ inline: 'center', block: 'nearest' }); return __aim(c); })()`;
    const enemyAt = `(() => { const e=document.querySelector('.enemy:not(.dead)'); if (!e) return null;
      const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;

    // A completed hold, left OPEN: touchStart, past the 400 ms dial, no lift.
    const holdOpen = async (i, id) => {
      const p = await ev(nthCard(i));
      await touch('touchStart', [{ x: p.x, y: p.y, id }]);
      await wait(650);
      return p;
    };

    // ---- 1 · the hold, his defect stated positively -------------------------
    const p0 = await holdOpen(0, 11);
    const openState = await ev(state);
    const t1 = await ev(tip);
    ok(openState.open === 1 && t1.shown,
      `hold: the tooltip survives the zoom (copy ${openState.open}, tooltip ${t1.shown ? 'shown' : 'HIDDEN'}, "${t1.title || '—'}")`);
    await shot('1-held-zoom-and-tooltip');

    // ---- 2 · the lift — the half a phone player lives in --------------------
    await touch('touchEnd', []); await wait(300);
    const t2 = await ev(tip);
    const lifted = await ev(state);
    // BOTH halves, because a shot of a stranded zoom copy looks exactly like a
    // shot of a persistent tooltip if you only read one of them.
    ok(t2.shown && lifted.open === 0,
      `lift: the tooltip is still up after release (${t2.shown ? 'shown' : 'HIDDEN'}, "${t2.title || '—'}") and the zoom copy is gone (${lifted.open})`);
    await shot('2-lifted-tooltip-stays');

    // ---- 3 · readable — wholly inside the room ------------------------------
    ok(t2.shown && t2.left >= 0 && t2.top >= 0 && t2.right <= t2.vw + 0.5 && t2.bottom <= t2.vh + 0.5,
      `readable: the box is inside the viewport (${t2.left?.toFixed(0)},${t2.top?.toFixed(0)})-(${t2.right?.toFixed(0)},${t2.bottom?.toFixed(0)}) in ${t2.vw}x${t2.vh}`);

    // ---- 4 · THE TRAP FLOOR — it can never eat a tap ------------------------
    ok(t2.pe === 'none' && t2.n === 1,
      `inert: pointer-events ${t2.pe}, and there is exactly ${t2.n} tooltip — a persistent tooltip may not swallow a tap`);

    // ---- 8 · replaced, and the replacement unsticks it ----------------------
    // Done here, while the tooltip from card 0 is still up: hover card 1 with a
    // MOUSE, which is the other summoning path, and watch the text change.
    const p1 = await ev(otherNamed(p0.name));
    if (p1) {
      await mouse('mouseMoved', p1.x, p1.y); await wait(400);
      const t8 = await ev(tip);
      const swapped = t8.shown && t8.title && t8.title !== t2.title && t8.n === 1;
      // …and the replacement is not itself sticky: move off and it must go.
      await mouse('mouseMoved', 4, 4); await wait(250);
      const t8b = await ev(tip);
      ok(swapped && !t8b.shown,
        `replaced: hovering another card swaps the text ("${t2.title}" -> "${t8.title}") and the replacement is NOT stuck (${t8b.shown ? 'still shown' : 'gone on leave'})`);
    } else {
      ok(false, `replaced: no card in hand named anything but "${p0.name}" — nothing that could visibly replace it`);
    }

    // ---- 9 · UNCHANGED: a plain hover, no hold, still hides on leave --------
    await mouse('mouseMoved', p0.x, p0.y); await wait(400);
    const t9a = await ev(tip);
    await mouse('mouseMoved', 4, 4); await wait(250);
    const t9b = await ev(tip);
    ok(t9a.shown && !t9b.shown,
      `unchanged: a plain hover still hides on leave (shown ${t9a.shown} -> ${t9b.shown}) — the change is the HOLD, not the tooltip`);

    // ---- 5 · HIS (a) another card is SELECTED -------------------------------
    await boot();
    await holdOpen(0, 12); await touch('touchEnd', []); await wait(300);
    const before5 = await ev(tip);
    const sp = await ev(strikeAt);
    if (sp && before5.shown) {
      await touch('touchStart', [{ x: sp.x, y: sp.y, id: 13 }]); await touch('touchEnd', []); await wait(400);
      const sel = await ev(`!!document.querySelector('.hand .card.selected')`);
      const t5 = await ev(tip);
      ok(sel && !t5.shown, `selected: tapping another card ends it (selected ${sel}, tooltip ${t5.shown ? 'STILL SHOWN' : 'gone'})`);
    } else {
      ok(false, `selected: setup failed (stuck ${before5.shown}, strike ${!!sp})`);
    }

    // ---- 6 · HIS (b) it is PLAYED ------------------------------------------
    await boot();
    await holdOpen(0, 14); await touch('touchEnd', []); await wait(300);
    const before6state = await ev(state);
    const before6 = await ev(tip);
    const sp6 = await ev(strikeAt);
    const en = await ev(enemyAt);
    if (sp6 && en && before6.shown) {
      // A careful drag onto an enemy — the game's primary verb, by the finger.
      await touch('touchStart', [{ x: sp6.x, y: sp6.y, id: 15 }]); await wait(150);
      for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: sp6.x + (en.x - sp6.x) * i / 6, y: sp6.y + (en.y - sp6.y) * i / 6, id: 15 }]);
      await touch('touchEnd', []); await wait(600);
      const after6 = await ev(state);
      const t6 = await ev(tip);
      ok(after6.discard === before6state.discard + 1 && !t6.shown,
        `played: the card played (discard ${before6state.discard}->${after6.discard}) and the tooltip is ${t6.shown ? 'STILL SHOWN' : 'gone'}`);
    } else {
      ok(false, `played: setup failed (stuck ${before6.shown}, strike ${!!sp6}, enemy ${!!en})`);
    }

    // ---- 7 · HIS (c) a game state ACTIVATES (End Turn) ----------------------
    await boot();
    await holdOpen(0, 16); await touch('touchEnd', []); await wait(300);
    const before7 = await ev(tip);
    const etAt = await ev(`(() => { const b=document.querySelector('.end-turn'); if (!b) return null;
      const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (etAt && before7.shown) {
      // End Turn takes the shared second beat (hold), so press and hold it.
      await touch('touchStart', [{ x: etAt.x, y: etAt.y, id: 17 }]); await wait(900);
      await touch('touchEnd', []); await wait(700);
      const t7 = await ev(tip);
      const turned = await ev(`!!document.querySelector('.combat')`);
      ok(turned && !t7.shown, `endturn: a game state activating ends it (tooltip ${t7.shown ? 'STILL SHOWN' : 'gone'})`);
    } else {
      ok(false, `endturn: setup failed (stuck ${before7.shown}, end-turn ${!!etAt})`);
    }

    await cdp.send('Target.closeTarget', { targetId });
  }

  cdp.close(); child.kill(); s.server.close();
  if (!ran) { console.error('tooltippersist: NOTHING RAN'); process.exit(2); }
  console.log('\n  BOUNDARY (measured by --selftest P3, not reasoned): check 5 is the ONLY line on the');
  console.log('  new DOM watch. Checks 6 and 7 are carried by hideTooltip() calls already in');
  console.log('  combat.js and pass with the watch removed — do not cite them as coverage of this');
  console.log('  change. Keyboard select and flask select route through the same watch as 5 and are');
  console.log('  NOT sampled: unknown. Placement is not measured beyond "inside the viewport".');
  console.log(fails ? `\ntooltippersist: ${fails} FAIL` : '\ntooltippersist: all green');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('tooltippersist:', e.message); process.exit(2); });
