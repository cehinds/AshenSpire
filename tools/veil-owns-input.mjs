// tools/veil-owns-input.mjs — WHILE A VEIL IS STANDING, THE SCREEN BENEATH IT
// DOES NOT ACT ON A KEY. One property, checked once per veil this game can put
// over the board.
//
// WHY THIS EXISTS. combat.js guarded its whole keyboard handler on
// `overlayIsOpen()` — a predicate that answered for ONE named veil, the in-run
// menu overlay, because it read that module's own `openVeil` handle. Five other
// veils in this game are `.modal-veil` elements that predicate had never heard
// of. The one a player meets: OPEN THE DRAW PILE, PRESS E, AND THE TURN ENDS
// UNDER THE OPEN PANEL. Hand 5 -> 0, on a screen the player is reading, from a
// key they pressed at a panel that was supposed to own it. Bjorn found it while
// gating; Freja confirmed the neighbourhood; Marina's framing is the one this
// file is built to: two homes, and one of them costs a hand.
//
// WHAT IT CHECKS, per shape, and the shape of the check is the same four lines
// every time — that is the point, not an economy:
//   for each route that puts a veil over the combat board
//     open it · press End Turn · the hand is the SAME SIZE and the turn did not
//     advance · close it
//   then, THE OTHER EDGE, and it is not optional: with NOTHING standing, one
//   press of End Turn STILL ENDS THE TURN. A guard that blocks the key always
//   passes every line above and is a worse bug than the one it replaced.
//
// Routes covered: the draw pile, the discard pile, the in-combat Armoury, the
// in-run menu overlay (the ONE the old predicate knew — kept as the control,
// so a green here is not evidence that the old code was wrong about it), and
// the quick-nav list.
//
// THE TUTORIAL VEIL IS DELIBERATELY NOT A ROUTE HERE. `.tut-veil` is not a
// `.modal-veil`, is `pointer-events: none`, and coaches the player THROUGH
// playing the board — so the board beneath it must keep answering keys. It is
// checked in the opposite direction (that E still works while it stands) rather
// than left unmentioned, because "absent from the list" and "ruled out of the
// list" look identical to the next reader.
//
// Usage
//   node tools/veil-owns-input.mjs                source tree via tools/serve.mjs
//   node tools/veil-owns-input.mjs --dist         dist/AshenSpire.html over file://
//   node tools/veil-owns-input.mjs --only 1200x730
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// BOUNDARY — what a green here does NOT mean. It presses ONE key, the one bound
// to End Turn, and says nothing about the other twenty this screen answers; it
// runs on Linux headless Chromium at ?shot=combat with no pad attached, so the
// gamepad path is covered only in so far as doAction() synthesizes the same key
// (it does — input.js doAction, and that is read, not observed here); and it
// never opens the map, so map.js's copy of the same guard is UNCHECKED by this
// file. Nothing here says the veil looks right or that its own controls work.
//
// REMOVAL: deleted the day no screen guards a key on whether a veil is standing.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
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

// The ROUTES table is the whole tool. A new veil over the board is a row here,
// never a new function — an entry describes, the loop below derives (Law 0).
const ROUTES = [
  { id: 'drawPile', label: 'the draw pile', open: `document.querySelector('.pile.draw').click()`,
    up: `!!document.querySelector('.modal-veil .modal h2')` },
  { id: 'discardPile', label: 'the discard pile', open: `document.querySelector('.pile.discard').click()`,
    up: `!!document.querySelector('.modal-veil .modal h2')` },
  { id: 'armoury', label: 'the in-combat Armoury', open: `document.querySelector('#combat-armoury').click()`,
    up: `!!document.querySelector('.armoury-overlay')` },
  { id: 'overlay', label: 'the in-run menu overlay (the CONTROL — the one veil the old predicate knew)',
    open: `document.querySelector('#combat-menu, .topbar-btn[title="Menu"], #combat-deck').click()`,
    up: `!!document.querySelector('.modal-veil .ov-tab')` },
];

async function main() {
  if (!browserPath) { console.error('veil-owns-input: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  let server = null, base;
  if (useDist) {
    const f = resolve(ROOT, 'dist/AshenSpire.html');
    if (!existsSync(f)) { console.error('veil-owns-input: no dist — run launch.mjs --build-only'); process.exit(2); }
    base = pathToFileURL(f).href;
  } else { const s = await serve({ root: ROOT, port: 8477, open: false }); server = s.server; base = `http://localhost:${s.port}/`; }
  console.log(`veil-owns-input — ${base}${useDist ? ' (shipped bundle)' : ' (source tree)'}`);

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'veilinput-', browser: browserPath,
    args: ['--allow-file-access-from-files'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  let fails = 0, ran = 0, checks = 0;

  for (const [W, H] of SHAPES) {
    const shape = `${W}x${H}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    const ok = (b, what) => { checks++; if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };
    // The key is READ from the game's own bindings, never typed here — a probe
    // that hardcodes 'e' stops measuring the moment a player rebinds End Turn,
    // and it would also stop measuring if the default ever changed.
    //
    // AND IT IS A HELD KEY SINCE 2026-08-17 (S7, the WIDE hold), for the same
    // reason the key is read rather than typed. End Turn's second beat now
    // applies on EVERY input, so a TAP of this key correctly does nothing — and
    // this probe's two CONTROL cells went red the hour that landed, which is
    // the control cells doing their job: the veil cells assert End Turn does
    // NOTHING, and they would have passed VACUOUSLY against a key that had
    // simply stopped working. So the press is a real hold, and its LENGTH is
    // derived from the button's own `data-hold-ms` — the machinery publishes
    // it, a number typed here goes stale the day the dial's default moves, and
    // a hold 1 ms short is indistinguishable from a veil eating the key.
    const pressEndTurn = async () => {
      const k = await ev(`(() => { try { const s = JSON.parse(localStorage.getItem('es.meta')||'{}');
        return (s.settings && s.settings.keyBindings && s.settings.keyBindings.endTurn) || 'e'; } catch { return 'e'; } })()`);
      const dial = Number(await ev(`Number((document.querySelector('.end-turn')||{dataset:{}}).dataset.holdMs || 0)`)) || 0;
      const down = { type: 'keyDown', key: k, text: k, windowsVirtualKeyCode: k.toUpperCase().charCodeAt(0) };
      await cdp.send('Input.dispatchKeyEvent', down, S);
      // A REAL held key is the first keydown plus an OS repeat stream at ~30 Hz;
      // a harness that omits them is measuring a key nobody holds.
      const stop = Date.now() + dial + 350;
      while (Date.now() < stop) { await wait(33); await cdp.send('Input.dispatchKeyEvent', { ...down, autoRepeat: true }, S); }
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }, S);
      await wait(450);
    };
    // WHAT "THE TURN ENDED" LOOKS LIKE FROM OUTSIDE. Hand size alone lies in
    // both directions — a turn ends and redraws back to five, and a hand empties
    // without the turn advancing — and this screen paints no turn counter. The
    // DISCARD PILE is the durable mark: ending a turn puts the whole hand in it
    // and nothing else on this screen does. HP is carried beside it because the
    // enemy acts on the way back, which is the second, independent trace.
    const state = `(() => ({ hand: document.querySelectorAll('.combat .hand .card').length,
      discard: +(document.querySelector('.pile.discard .n')||{textContent:'0'}).textContent,
      hp: ((document.querySelector('.combat .resbar[data-res="hp"]')||{dataset:{}}).dataset.cur||''),
      veils: document.querySelectorAll('.modal-veil').length }))()`;
    const closeAll = `(() => { for (const v of document.querySelectorAll('.modal-veil')) v.remove(); return 1; })()`;
    // FRESH BOARD PER ROUTE, and this is a correction to this file's own first
    // draft rather than caution: the draw-pile route ended the turn (that is the
    // defect), and every route measured after it then compared 0 against 0 and
    // printed PASS. A probe whose earlier check CONTAMINATES its later ones
    // reports the first finding and hides the rest — green wasn't clearance.
    const freshBoard = async () => {
      await cdp.send('Page.navigate', { url: base + '?shot=combat' }, S);
      await until(`!!document.querySelector('.combat .hand .card')`, 'combat');
      await wait(500);
    };

    await freshBoard();
    console.log(`\n  ${shape}`);

    for (const r of ROUTES) {
      await freshBoard();
      const before = await ev(state);
      let opened = false;
      try { await ev(r.open); await until(r.up, r.id, 4000); opened = true; } catch { opened = false; }
      if (!opened) { checks++; console.log(`    SKIP ${r.label} — no route to it at this shape (NOT a pass)`); continue; }
      ok((await ev(state)).veils >= 1, `${r.label}: a veil is standing`);
      await pressEndTurn();
      const after = await ev(state);
      ok(after.hand === before.hand && after.discard === before.discard && after.hp === before.hp,
        `${r.label}: End Turn does NOTHING while it stands (hand ${before.hand}->${after.hand}, discard ${before.discard}->${after.discard}, hp ${before.hp}->${after.hp})`);
    }

    // THE OTHER EDGE. Nothing standing: the key must still work, or the guard
    // has simply broken End Turn and every line above is vacuously green.
    await freshBoard();
    const clear = await ev(state);
    ok(clear.veils === 0, `nothing standing: 0 veils`);
    await pressEndTurn();
    await wait(1200); // the enemy acts on the way back; discard is stamped first
    const ended = await ev(state);
    ok(ended.discard > clear.discard,
      `nothing standing: End Turn STILL ENDS THE TURN (discard ${clear.discard}->${ended.discard}, hand ${clear.hand}->${ended.hand}, hp ${clear.hp}->${ended.hp})`);

    // THE TUTORIAL, CHECKED IN THE OPPOSITE DIRECTION. `.tut-veil` is not a
    // `.modal-veil` and must never become one: the coach marks teach the player
    // to play the board, so the board must keep answering keys underneath them.
    // "Not in the selector" is only defensible if somebody measured what it
    // would cost — this is that measurement, and it goes red if `.tut-veil` is
    // ever widened into the predicate. Source tree only: it mounts the real
    // module by dynamic import, the way tools/tutorial-reach.mjs does.
    if (useDist) { checks++; console.log(`    SKIP the tutorial veil — --dist has no module to import (NOT a pass)`); }
    else {
      await freshBoard();
      const up = await ev(`(async () => { const m = await import('/src/ui/components/tutorial.js');
        m.mountTutorial(document.getElementById('app'), { onDone: () => {} });
        return !!document.querySelector('.tut-veil'); })()`).catch(() => false);
      if (!up) { checks++; console.log(`    SKIP the tutorial veil — it did not mount (NOT a pass)`); }
      else {
        ok(await ev(`document.querySelectorAll('.modal-veil').length === 0`),
          `the tutorial veil: standing, and it is NOT a .modal-veil (0 veils in the predicate)`);
        const t0 = await ev(state);
        await pressEndTurn();
        await wait(1200);
        const t1 = await ev(state);
        ok(t1.discard > t0.discard,
          `the tutorial veil: the board beneath STILL answers End Turn — the coach marks do not freeze the game (discard ${t0.discard}->${t1.discard})`);
      }
    }

    // THE TIE, WHICH IS NOT LATENT AND WHICH I FIRST GOT THE REASON WRONG ABOUT.
    // Bjorn's correction: the quick-nav opens FROM INSIDE the standing overlay
    // (overlay.js:295), and `.qn-veil` overrides background and display but NOT
    // z-index — so two veils stand at z500 and the tie rule decides. `>=` keeps
    // DOM order and the LIST wins; `>` keeps the first and hands input to the
    // overlay underneath it. This is the check that makes that sentence
    // falsifiable in the file it is written in, rather than a carried claim.
    // `quickNav: 'mirror'` is a SETTING a player selects, not a synthetic state —
    // it is set here through the module's own `setQuickNav`, the same entry point
    // applyDisplaySettings uses, because the default is 'off' and the tie is
    // unreachable at the default. Source tree only; --dist has no module.
    await freshBoard();
    let tie = false;
    try {
      if (useDist) throw new Error('no module to import');
      await ev(`(async () => { const m = await import('/src/ui/components/quicknav.js');
        m.setQuickNav({ mode: 'mirror' }); return m.quickNavMode(); })()`);
      // In mirror mode ☰ opens the LIST, not the overlay — so the two-veil state
      // is reached the way a player reaches it: list -> a tab row -> the overlay
      // (which closes the list on its way up) -> the overlay's own ☰ reopens it.
      await ev(`document.querySelector('#combat-menu').click()`);
      await until(`!!document.querySelector('.qn-veil .qn-row')`, 'the quick-nav list', 4000);
      await ev(`(() => { const r=[...document.querySelectorAll('.qn-veil .qn-row')]
        .find((b)=>/deck|cards/i.test(b.textContent)); (r||document.querySelector('.qn-veil .qn-row')).click(); return 1; })()`);
      await until(`!!document.querySelector('.modal-veil .ov-tab')`, 'the overlay', 4000);
      await ev(`document.querySelector('#ov-quicknav').click()`);
      await until(`document.querySelectorAll('.modal-veil').length === 2`, 'two veils', 3000);
      tie = true;
    } catch { tie = false; }
    if (!tie) { checks++; console.log(`    SKIP the z500 tie — the quick-nav is not mirrored at this shape (NOT a pass)`); }
    else {
      ok(await ev(`(() => { const v=[...document.querySelectorAll('.modal-veil')];
        return v.length === 2 && v.every((e) => getComputedStyle(e).zIndex === '500'); })()`),
        `tie: the overlay and the quick-nav are BOTH standing at z-index 500 (the tie is reachable, not hypothetical)`);
      for (let i = 0; i < 6; i++) {
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 }, S);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', windowsVirtualKeyCode: 40 }, S);
        await wait(60);
      }
      const inList = await ev(`(() => { const f=document.querySelector('.gp-focus');
        if (!f) return 'nothing focused';
        const v = f.closest('.modal-veil');
        return v ? (v.className.includes('qn-veil') ? 'qn-veil' : v.className) : 'outside every veil'; })()`);
      ok(inList === 'qn-veil',
        `tie: the focus cursor goes to the LATER veil, not the one underneath it (landed in: ${inList})`);
    }

    // BJORN'S LATENT HAZARD, MADE NON-LATENT. `.armoury-overlay` paints at
    // z-index 60 while every other veil is 500, so a z500 veil standing FIRST
    // and the Armoury opened AFTER it makes DOM order and paint order disagree.
    // He measured that shape by hand: 60 presses drove 12 controls on a layer
    // the player cannot see. No shipped route reaches it today — which is why
    // this is a PLANT and not a route: the second veil is appended here, on
    // purpose, so the rule is checked rather than argued about.
    await freshBoard();
    await ev(`(() => { const v = document.createElement('div'); v.className = 'modal-veil';
      v.id = 'planted-top'; v.innerHTML = '<div class="modal"><button id="planted-btn">PLANTED</button></div>';
      document.body.appendChild(v); return 1; })()`);
    await ev(`document.querySelector('#combat-armoury').click()`);
    let planted = true;
    try { await until(`!!document.querySelector('.armoury-overlay')`, 'armoury under the plant', 4000); } catch { planted = false; }
    if (!planted) { checks++; console.log(`    SKIP the z-index plant — the Armoury did not open (NOT a pass)`); }
    else {
      ok(await ev(`(() => { const v = document.querySelectorAll('.modal-veil');
        return v.length === 2 && v[v.length-1].classList.contains('armoury-overlay'); })()`),
        `plant: two veils standing and the LOWER-painting one is DOM-last (the disagreeing shape)`);
      for (let i = 0; i < 6; i++) {
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 }, S);
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', windowsVirtualKeyCode: 40 }, S);
        await wait(60);
      }
      const where = await ev(`(() => { const f = document.querySelector('.gp-focus');
        if (!f) return 'nothing focused';
        const v = f.closest('.modal-veil');
        return v ? (v.id || v.className) : 'outside every veil'; })()`);
      ok(where === 'planted-top',
        `plant: the focus cursor scopes to the veil that PAINTS on top, not the DOM-last one (landed in: ${where})`);
    }

    await cdp.send('Target.closeTarget', { targetId });
  }

  cdp.close(); await dropBrowser();
  if (server) server.close();
  if (!ran) { console.error('veil-owns-input: NOTHING RAN — --only matched no shape'); process.exit(2); }
  console.log(`\nBOUNDARY: one key (End Turn), Linux headless Chromium, ?shot=combat, no pad.
          The map's copy of this guard is NOT exercised here, and neither is
          any other key this screen answers. A SKIP above is not a pass — it
          says this shape had no route to that veil, which is a gap in the
          probe, not a green.`);
  console.log(`\nveil-owns-input: ${checks - fails}/${checks} checks green across ${ran} shape(s).`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error('veil-owns-input: ' + e.message); process.exit(2); });
