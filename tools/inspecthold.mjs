// tools/inspecthold.mjs — hold-to-inspect on the hand, observed: a read can
// happen, and a read can NEVER become a play.
//
// WHAT IT CHECKS, per shape (the disambiguation triangle, all three corners,
// plus the restore):
//   1. rest: every hand card is marked data-inspect="idle" (the gesture is
//      armed, readable by instrument and screenshot alike)
//   2. TAP corner: a quick tap on a targetable card still SELECTS it — the
//      pre-inspect behaviour, untouched
//   3. MID-HOLD: a stationary press reads data-inspect="pending" with no
//      expanded copy in the DOM — the attribute is the observation, so no
//      camera ever has to race a 400 ms window (the same-door note below)
//   4. INSPECT corner: past the dial the card expands — .card-inspect on
//      <body>, scaled visibly past the source card — and discard/energy are
//      UNCHANGED: the read cost nothing
//   5. restore: release removes the copy entirely, the card returns to idle,
//      state still unchanged, and the NEXT tap works (no swallowed tap —
//      Vira's F3 shape, checked here because this gesture swallows one click
//      by design and must swallow exactly that one)
//   6. abandon: movement past the shared 12 px boundary mid-pending hands the
//      press to the drag (ghost appears, inspect back to idle)
//   7. DRAG corner: a careful drag — 150 ms stationary, then onto an enemy —
//      still PLAYS the card (discard +1): the timer did not eat the game's
//      primary verb
//   8. reading is not gated on affordability: with energy forced to 0 (via
//      the window.__combat debug handle — the ONE state setup that does not
//      enter by the finger, named here rather than hidden) a hold on an
//      unaffordable card still expands
//
// Usage
//   node tools/inspecthold.mjs                     source tree via serve.mjs
//   node tools/inspecthold.mjs --root DIR          another tree (the known-bad run)
//   node tools/inspecthold.mjs --only 390x844
//   node tools/inspecthold.mjs --shots DIR         also write the four 390x844
//                                                  screenshots (rest, mid-hold,
//                                                  open, released)
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// OBSERVED RED (the instrument rule), same door as the real input — CDP touch
// on the shipped combat screen over ?shot=combat, exactly the entry
// tools/gesture-cancel.mjs already uses:
//   dev 86564e6 (pre-inspect)   exit 1, 18 FAIL (9 per shape): every
//                               inspect-specific line red by name
//                               (data-inspect never appears, nothing expands)
//                               — including "release: state unchanged",
//                               because on that tree A LONG STATIONARY PRESS
//                               PLAYS THE CARD ON RELEASE, which is precisely
//                               the press this gesture reclaims. The corners
//                               that were already true — tap selects,
//                               abandon-to-drag, drag plays — PASS there,
//                               which is exactly what they protect.
//   vega/hold-to-expand         exit 0, both shapes
// The run that produced those lines is in the branch report; re-run it with
// --root against any tree.
//
// BOUNDARY. Linux headless Chromium; synthesized touch is not a finger (no
// fling, no real contact patch). The mid-hold read (check 3) samples at
// ~150 ms of a 400 ms dial through Runtime.evaluate — a slow harness could
// sample late and read "open"; that fails loud, never silently green. The
// screenshot pass is evidence, not a check: it asserts nothing.
//
// REMOVAL: deleted the day the gesture leaves the hand, or a browser-level
// input harness supersedes CDP touch synthesis.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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
    on(method, fn) { handlers.set(method, fn); },
    off(method) { handlers.delete(method); },
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

async function main() {
  if (!browserPath) { console.error('inspecthold: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  const profile = mkdtempSync(join(tmpdir(), 'inspect-'));
  const s = await serve({ root: ROOT, port: 8272, open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`inspecthold — ${base} (root ${ROOT})`);
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
    const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };
    const shot = async (name) => { if (!shotsDir || W !== 390) return;
      const st = await ev(`(document.querySelector('.hand .card')||{dataset:{}}).dataset.inspect || 'unmarked'`);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, S);
      const st2 = await ev(`(document.querySelector('.hand .card')||{dataset:{}}).dataset.inspect || 'unmarked'`);
      writeFileSync(join(shotsDir, `${name}.png`), Buffer.from(data, 'base64'));
      console.log(`    shot ${name}.png (state ${st} -> ${st2})`); };

    await cdp.send('Page.navigate', { url: base + '?shot=combat' }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat'); await wait(500);
    console.log(`\n  ${shape}`);

    const state = `(() => ({ discard: +document.querySelector('.pile.discard .n').textContent,
      energy: (document.querySelector('.energy-orb')||{textContent:''}).textContent.trim(),
      open: document.querySelectorAll('body > .card-inspect').length,
      ghosts: [...document.querySelectorAll('body > .card')].filter(e=>e.style.position==='fixed' && !e.classList.contains('card-inspect')).length }))()`;
    // Centre the probe card first — the narrow hand is a scroller (gesture-
    // cancel's lesson: a drag at a stale off-strip centre touches nothing).
    const cardAt = `(() => { const c=document.querySelector('.hand .card');
      c.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width}; })()`;
    const strikeAt = `(() => { const c=[...document.querySelectorAll('.hand .card')].find(x=>/Strike/.test(x.textContent));
      c.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r=c.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
    const enemyAt = `(() => { const e=document.querySelector('.enemy:not(.dead)'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
    const inspectOf = `(() => (document.querySelector('.hand .card')||{dataset:{}}).dataset.inspect)()`;
    const before = await ev(state);

    // 1 — rest
    ok(await ev(`[...document.querySelectorAll('.hand .card')].every(c => c.dataset.inspect === 'idle')`),
      `rest: every hand card marked data-inspect="idle"`);
    await shot('1-hand-at-rest');

    // 2 — TAP corner (targetable card selects; second tap deselects)
    const st0 = await ev(strikeAt);
    await touch('touchStart', [{ x: st0.x, y: st0.y, id: 1 }]); await touch('touchEnd', []); await wait(300);
    ok(await ev(`!!document.querySelector('.hand .card.selected')`), `tap: quick tap still SELECTS a targetable card`);
    const st1 = await ev(strikeAt);
    await touch('touchStart', [{ x: st1.x, y: st1.y, id: 2 }]); await touch('touchEnd', []); await wait(300);

    // 3 + 4 — mid-hold, then open, one continuous press
    const p0 = await ev(cardAt);
    await touch('touchStart', [{ x: p0.x, y: p0.y, id: 3 }]); await wait(150);
    const mid = await ev(`(() => ({ st: ${inspectOf}, open: document.querySelectorAll('body > .card-inspect').length }))()`);
    ok(mid.st === 'pending' && mid.open === 0, `mid-hold: data-inspect="pending", no copy yet (read ${mid.st}, ${mid.open})`);
    await wait(450);
    const opened = await ev(`(() => { const g = document.querySelector('body > .card-inspect');
      return { st: ${inspectOf}, n: document.querySelectorAll('body > .card-inspect').length,
        w: g ? g.getBoundingClientRect().width : 0 }; })()`);
    ok(opened.st === 'open' && opened.n === 1, `inspect: past the dial the card is open (state ${opened.st}, copies ${opened.n})`);
    ok(opened.w >= p0.w * 1.5, `inspect: the copy is visibly expanded (${opened.w.toFixed(0)}px vs card ${p0.w.toFixed(0)}px)`);
    const during = await ev(state);
    ok(during.discard === before.discard && during.energy === before.energy, `inspect: reading changed NOTHING (discard ${during.discard}, energy ${during.energy})`);
    await shot('3-expanded-in-front');

    // 5 — restore on release, and the next tap is not swallowed
    await touch('touchEnd', []); await wait(250);
    const after = await ev(state);
    ok(after.open === 0, `release: the copy is gone (${after.open})`);
    ok(await ev(inspectOf) === 'idle', `release: card back to idle`);
    ok(after.discard === before.discard && after.energy === before.energy, `release: state unchanged`);
    await shot('4-released');
    const st2 = await ev(strikeAt);
    await touch('touchStart', [{ x: st2.x, y: st2.y, id: 4 }]); await touch('touchEnd', []); await wait(300);
    ok(await ev(`!!document.querySelector('.hand .card.selected')`), `release: the NEXT tap still selects (swallow is exactly one click)`);
    const st3 = await ev(strikeAt);
    await touch('touchStart', [{ x: st3.x, y: st3.y, id: 5 }]); await touch('touchEnd', []); await wait(300);

    // The mid-hold PHOTOGRAPH, on its own press — Rune's "the camera was the
    // finger": Page.captureScreenshot takes longer than the 400 ms window, so
    // a single racing capture brackets pending -> open, an ambiguous frame.
    // So the camera does not race: a page-side observer TIMESTAMPS every
    // data-inspect transition on the same epoch clock the screencast stamps
    // its frames with, the whole press is streamed, and the frame chosen is
    // one PROVABLY inside [pending, open) with 30 ms of margin on both sides.
    // Nothing here injects input; the press rides to open before releasing so
    // the lift is swallowed and can never tap-play the probe card.
    if (shotsDir && W === 390) {
      await ev(`(() => { window.__insLog = []; const h = document.querySelector('.hand');
        new MutationObserver((rs) => { for (const r of rs) window.__insLog.push({ v: r.target.dataset.inspect, t: Date.now() }); })
          .observe(h, { subtree: true, attributes: true, attributeFilter: ['data-inspect'] }); return 1; })()`);
      const frames = [];
      cdp.on('Page.screencastFrame', (p, sess) => {
        frames.push({ t: p.metadata.timestamp * 1000, data: p.data });
        cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId }, sess).catch(() => {});
      });
      await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }, S);
      const pc = await ev(cardAt);
      await touch('touchStart', [{ x: pc.x, y: pc.y, id: 30 }]);
      await wait(700);
      await cdp.send('Page.stopScreencast', {}, S);
      await touch('touchEnd', []); await wait(250);
      cdp.off('Page.screencastFrame');
      const log = await ev(`window.__insLog`);
      const tPend = (log.find((e) => e.v === 'pending') || {}).t;
      const tOpen = (log.find((e) => e.v === 'open') || {}).t;
      const frame = tPend && tOpen ? frames.filter((f) => f.t > tPend + 30 && f.t < tOpen - 30).pop() : null;
      if (frame) {
        writeFileSync(join(shotsDir, '2-mid-hold.png'), Buffer.from(frame.data, 'base64'));
        console.log(`    shot 2-mid-hold.png (frame at +${(frame.t - tPend).toFixed(0)}ms of a ${(tOpen - tPend).toFixed(0)}ms hold, ${frames.length} streamed)`);
      } else {
        console.log(`    shot 2-mid-hold: no frame provably inside the window (pending ${tPend}, open ${tOpen}, frames ${frames.length}) — nothing ambiguous written`);
      }
    }

    // 6 — movement mid-pending abandons the inspect and hands the press to the drag
    const p1 = await ev(cardAt);
    await touch('touchStart', [{ x: p1.x, y: p1.y, id: 6 }]); await wait(120);
    for (let i = 1; i <= 3; i++) await touch('touchMove', [{ x: p1.x, y: p1.y - i * 30, id: 6 }]);
    const mid2 = await ev(state);
    const stMid = await ev(inspectOf);
    ok(stMid === 'idle' && mid2.open === 0, `abandon: movement mid-pending returns the card to idle (${stMid}), no copy`);
    ok(mid2.ghosts === 1, `abandon: the DRAG took the press (ghost ${mid2.ghosts})`);
    await touch('touchCancel', []); await wait(250);

    // 8 — reading is not gated on affordability. Runs BEFORE the drag-play so
    // a Strike is still in hand for the repaint trick, and energy is restored
    // after. The state edit goes through the window.__combat debug handle —
    // the one non-finger step, named here rather than hidden; the REPAINT goes
    // through the screen's own path (a bare resize does not repaint the hand —
    // observed on the known-bad run): select a Strike while affordable (click
    // renders), zero the energy, cancel targeting via contextmenu (renders).
    const selectStrike = async (idBase) => {
      for (let t = 0; t < 4; t++) {
        const sp = await ev(strikeAt);
        await touch('touchStart', [{ x: sp.x, y: sp.y, id: idBase + t }]); await touch('touchEnd', []); await wait(350);
        if (await ev(`!!document.querySelector('.hand .card.selected')`)) return true;
      }
      return false;
    };
    const cancelTargeting = async () => {
      await ev(`(() => { document.querySelector('.combat').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return 1; })()`);
      await wait(300);
    };
    // select while affordable, THEN zero, then cancel (the cancel repaints)
    await selectStrike(40);
    await ev(`(() => { window.__combat.player.energy = 0; return 1; })()`);
    await cancelTargeting();
    const unaffordable = await ev(`(() => { const c = [...document.querySelectorAll('.hand .card')].find(x => x.classList.contains('unaffordable'));
      if (!c) return null; c.scrollIntoView({ inline: 'center', block: 'nearest' });
      const r = c.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
    if (unaffordable) {
      await touch('touchStart', [{ x: unaffordable.x, y: unaffordable.y, id: 8 }]); await wait(600);
      const ua = await ev(`document.querySelectorAll('body > .card-inspect').length`);
      ok(ua === 1, `unaffordable: a card you cannot pay for still READS (copies ${ua})`);
      await touch('touchEnd', []); await wait(200);
    } else {
      ok(false, `unaffordable: no .unaffordable card appeared after energy 0 — the probe could not repaint the hand`);
    }
    // 7 — DRAG corner: careful drag (150 ms stationary first) still plays.
    // On a FRESH boot: the shot hand carries exactly one guaranteed-targetable
    // Strike, and check 8's energy dance left the previous page's handlers
    // wired at a zero-energy paint (the captured `affordable` closure is how
    // the screen works, not a defect) — a reload is the honest reset, not a
    // second trick through the debug handle.
    await cdp.send('Page.navigate', { url: base + '?shot=combat' }, S);
    await until(`!!document.querySelector('.combat .hand .card')`, 'combat reboot'); await wait(500);
    const before7 = await ev(state);
    const p2 = await ev(strikeAt);
    const en = await ev(enemyAt);
    await touch('touchStart', [{ x: p2.x, y: p2.y, id: 7 }]); await wait(150);
    const steps = 6;
    for (let i = 1; i <= steps; i++) await touch('touchMove', [{ x: p2.x + (en.x - p2.x) * i / steps, y: p2.y + (en.y - p2.y) * i / steps, id: 7 }]);
    await touch('touchEnd', []); await wait(500);
    const played = await ev(state);
    ok(played.discard === before7.discard + 1, `drag: a careful drag onto an enemy still PLAYS (discard ${before7.discard}->${played.discard})`);

    await cdp.send('Target.closeTarget', { targetId });
  }

  cdp.close(); child.kill(); s.server.close();
  if (!ran) { console.error('inspecthold: NOTHING RAN'); process.exit(2); }
  console.log(fails ? `\ninspecthold: ${fails} FAIL` : '\ninspecthold: all green');
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('inspecthold:', e.message); process.exit(2); });
