// tools/profile-first-run.mjs — Viki, 2026-08-08 (M7).
//
// HIS ASK: "profile should be able to be created before first run, not after".
//
// WHY THIS IS A BROWSER AND NOT A UNIT TEST. The defect was found by walking the
// shipped build (Bjorn's `watched` audit, 2026-08-08): clear localStorage, boot,
// pick a class, type a name, press BEGIN THE CLIMB — storage held `sote_run_v1`
// and no `sote_meta_v1`, and Title → Profile then printed his own sentence
// back at him in bold. Every part of that lives above the engine: the screens,
// the click order, the real Storage. tests/engine.test.js 13c holds the same
// claims at the manager; this holds them where he would see them.
//
// THE KNOWN-BAD ENTERS BY THE SAME DOOR AS THE REAL INPUT and it is not a
// fabrication: the pre-fix tree IS the known-bad. Copy this file into a
// worktree at dev cd3da94 and all SIX checks go red through these same clicks,
// against the same shipped bundle Bjorn walked — observed 2026-08-08:
//
//   FAIL 1 keys after the press: sote_run_v1
//   FAIL 2 the press wrote: sote_run_v1
//   FAIL 3 "No profile yet — one is created when you finish your first run."
//   FAIL 4 before: sote_run_v1 -> after: sote_run_v1
//   FAIL 5 run=gone, profile=GONE
//   FAIL 6 "No profile yet — one is created when you finish your first run."
//
// Run:  node tools/profile-first-run.mjs            (serves src/, index.html)
//       node tools/profile-first-run.mjs --dist     (the SHIPPED single file)
// Exit 0 = every check passed. Exit 1 = at least one red, each named. A step
// that cannot find the control it needs is RED, never skipped — a walk that
// stops early has proven nothing, which is the failure this file exists inside.
//
// BOUNDARY: headless Chromium, one viewport (390×844), one storage backend. It
// proves WHEN the profile is written and WHAT the Profile screen then says. It
// is silent on quota-exhausted storage, on private-mode storage that throws,
// and on every screen it does not open.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const DIST = process.argv.includes('--dist');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const { port } = await serve({ root: ROOT, port: 8196, open: false });
const PAGE = `http://localhost:${port}/${DIST ? 'dist/AshenSpire.html' : ''}`;

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';
// ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
// Chrome's own TMPDIR inside it, and removes it whatever happens. This driver
// passed no `--user-data-dir` and never killed the browser at all, so every run
// stranded both. `awaitEndpoint` is off: it polls /json/list on a fixed port.
await launchBrowser({
  prefix: 'profile-first-run-', browser: CHROME, headless: '--headless=new',
  awaitEndpoint: false, args: ['--remote-debugging-port=9396'], stdio: 'ignore',
});
async function cdp(p) {
  let l;
  for (let i = 0; i < 100; i++) {
    try { l = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); if (l.length) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  const ws = new WebSocket(l.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const w = new Map();
  ws.onmessage = (m) => { const g = JSON.parse(m.data); if (g.id != null && w.has(g.id)) { const { ok, no } = w.get(g.id); w.delete(g.id); g.error ? no(new Error(g.error.message)) : ok(g.result); } };
  return { send: (m2, p2 = {}) => { const n = ++id; ws.send(JSON.stringify({ id: n, method: m2, params: p2 })); return new Promise((ok, no) => w.set(n, { ok, no })); } };
}
const c = await cdp(9396);
await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const ev = async (e) => {
  const r = await c.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval');
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async (ms = 1600) => {
  await c.send('Page.navigate', { url: PAGE });
  await sleep(ms);
  if (await ev("!!document.querySelector('.startup-gate')")) {
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(260);
  }
};

let fails = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!ok) fails++; };

// The walk, exactly as Bjorn drove it. Returns what storage looked like after
// BEGIN THE CLIMB *and in what order the page wrote it* — Storage.prototype is
// patched before the press, so the order is the game's own writes through the
// real API, not our reconstruction of them.
async function walkToTheClimb() {
  await boot();
  await ev('localStorage.clear(); 1');
  await boot();
  const started = await ev(`(()=>{
    const slot = document.querySelector('.slot-new'); if (!slot) return {step:'title', saw:document.body.innerText.slice(0,200)};
    slot.click(); return {ok:true};
  })()`);
  if (!started.ok) return { failed: `could not reach character creation (${started.step}): ${started.saw}` };
  await sleep(500);
  const picked = await ev(`(()=>{
    const cards=[...document.querySelectorAll('.cz-class')];
    if (!cards.length) return {step:'classes', saw:document.body.innerText.slice(0,200)};
    cards[cards.length-1].click();                       // pick a class, deliberately not the default
    const name=document.querySelector('#cz-name');
    if (!name) return {step:'name'};
    name.value='Ashling'; name.dispatchEvent(new Event('input',{bubbles:true}));
    // Watch the writes the press itself makes.
    window.__writes=[]; const orig=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){ window.__writes.push(k); return orig.call(this,k,v); };
    const go=document.querySelector('#cz-start'); if (!go) return {step:'begin'};
    go.click(); return {ok:true, picked:cards[cards.length-1].dataset.classId};
  })()`);
  if (!picked.ok) return { failed: `character creation had no ${picked.step}` };
  await sleep(900);
  return await ev(`(()=>({
    writes: window.__writes||[],
    keys: Object.keys(localStorage).sort(),
    meta: localStorage.getItem('sote_meta_v1'),
    run: localStorage.getItem('sote_run_v1'),
    screen: (document.querySelector('.screen')||{className:'(none)'}).className,
  }))()`);
}

// Title → Profile, and hand back the sentence the player reads.
async function profileSentence() {
  await ev(`(()=>{const b=document.querySelector('#profile'); if(b) b.click(); return 1;})()`);
  await sleep(700);
  return await ev(`(()=>{
    const body=document.querySelector('.profile-archive-body'); if(!body) return {no:'profile archive'};
    const line=body.querySelector('.prof-state');
    return {line: line ? line.textContent.trim() : null};
  })()`);
}

// ---- 1 & 2: the walk itself ------------------------------------------------
const walk = await walkToTheClimb();
if (walk.failed) {
  check('1 BEGIN THE CLIMB leaves a profile in storage', false, walk.failed);
  check('2 and the profile is written BEFORE the run', false, walk.failed);
} else {
  check('1 BEGIN THE CLIMB leaves a profile in storage', walk.meta != null,
    `keys after the press: ${walk.keys.join(', ') || '(none)'}`);
  const mi = walk.writes.indexOf('sote_meta_v1');
  const ri = walk.writes.indexOf('sote_run_v1');
  check('2 and the profile is written BEFORE the run', mi !== -1 && ri !== -1 && mi < ri,
    `the press wrote: ${walk.writes.join(' → ') || '(nothing)'}`);
}

// ---- 3: the sentence, on the screen he opened ------------------------------
// Back to the title first: the walk left us on the map, and Settings there is a
// different door. This is the route he took — start a climb, come back out, go
// looking for the profile.
{
  await boot();
  const s = await profileSentence();
  check('3 Title → Profile no longer prints his ask back at him',
    !!s.line && !/finish your first run/i.test(s.line),
    s.no ? `could not open ${s.no}` : `"${s.line}"`);
}

// ---- 4: the pre-existing player — runs already, no profile -----------------
// The run bytes are the ones the walk above just made, so this is a real save
// from this build rather than a fixture I wrote to suit myself.
{
  const runBytes = walk.run;
  if (!runBytes) {
    check('4 a player who already has runs and no profile gets one on resume', false, 'the walk produced no run to replant');
  } else {
    await ev(`(()=>{ localStorage.clear(); localStorage.setItem('sote_run_v1', ${JSON.stringify(runBytes)}); return 1; })()`);
    await boot();
    const before = await ev(`Object.keys(localStorage).sort().join(', ')`);
    const resumed = await ev(`(()=>{const b=document.querySelector('.slot-continue'); if(!b) return {no:document.body.innerText.slice(0,160)}; b.click(); return {ok:true};})()`);
    await sleep(900);
    const after = await ev(`({keys:Object.keys(localStorage).sort().join(', '), meta: localStorage.getItem('sote_meta_v1')!=null})`);
    check('4 a player who already has runs and no profile gets one on resume',
      resumed.ok === true && after.meta === true,
      resumed.ok ? `before: ${before} → after: ${after.keys}` : `no CONTINUE button: ${resumed.no}`);
  }
}

// ---- 5: abandoning before the first fight keeps the profile ----------------
{
  await boot();
  // Delete is a two-click, self-resetting confirm (title.js) — the second click
  // is the one that deletes, and driving only the first proves nothing.
  const gone = await ev(`(async()=>{
    const del=document.querySelector('.slot-delete'); if(!del) return {no:'no occupied slot to delete'};
    const ms=Number(del.dataset.holdMs);
    if (!(ms > 0)) {
      del.click();
      return {ok:true, ms:0};
    }
    const pointerId=17;
    del.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles:true, pointerId, pointerType:'touch', isPrimary:true,
      clientX:del.getBoundingClientRect().left + del.getBoundingClientRect().width / 2,
      clientY:del.getBoundingClientRect().top + del.getBoundingClientRect().height / 2,
    }));
    await new Promise((resolve)=>setTimeout(resolve, ms + 160));
    if (del.isConnected) del.dispatchEvent(new PointerEvent('pointerup', {
      bubbles:true, pointerId, pointerType:'touch', isPrimary:true,
    }));
    return {ok:true, ms};
  })()`);
  await sleep(600);
  const after = await ev(`({run: localStorage.getItem('sote_run_v1'), meta: localStorage.getItem('sote_meta_v1')})`);
  check('5 abandoning the climb deletes the run and keeps the profile',
    gone.ok === true && after.run == null && after.meta != null,
    gone.ok ? `run=${after.run == null ? 'gone' : 'still there'}, profile=${after.meta == null ? 'GONE' : 'kept'}` : gone.no);
}

// ---- 6: the empty state is still reachable, and still honest ---------------
// Someone who opens Settings before they have ever begun a climb. The sentence
// must still exist (that state is real) and must describe what will happen.
{
  await boot();
  await ev('localStorage.clear(); 1');
  await boot();
  const s = await profileSentence();
  check('6 a player who has never climbed is told when the profile arrives',
    !!s.line && /no profile yet/i.test(s.line) && !/finish your first run/i.test(s.line),
    s.no ? `could not open ${s.no}` : `"${s.line}"`);
}

console.log(`\nBOUNDARY: headless Chromium at 390x844, ${DIST ? 'the SHIPPED bundle (dist/AshenSpire.html)' : 'the source tree (index.html)'}, one storage backend.`);
console.log('It proves WHEN the profile is written and WHAT the Profile screen says. It is silent on');
console.log('storage that is full or throws, and on every screen it does not open.');
console.log(fails ? `\nprofile-first-run: RED — ${6 - fails}/6 checks passed; ${fails} failed` : '\nprofile-first-run: OK — 6 checks passed');
process.exit(fails ? 1 : 0);
