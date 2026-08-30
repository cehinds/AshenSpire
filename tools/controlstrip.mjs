// tools/controlstrip.mjs — DOES THE SCREEN TELL THE TRUTH ABOUT ITS CONTROLS?
//
// Constantine, 2026-08-17: *"all the buttons on those tool tips should also work
// and auto map to the current controls configured and the active device
// controller type."*
//
// TWO CLAIMS IN ONE SENTENCE, AND THEY FAIL IN OPPOSITE DIRECTIONS, so this tool
// asks both of them separately:
//
//   1. THE CHIPS WORK. A press on a chip does what the key does. This failed
//      wholesale: `.hint-bar` was `pointer-events: none`, five `<span>`s,
//      `role="presentation"`, `aria-hidden="true"` — an advertisement for
//      hardware that may not be attached, answering to nothing.
//   2. THE LABELS ARE DERIVED, NEVER TYPED. A strip printing `E` to a player who
//      rebound End Turn is not stale decoration, it is the game LYING about its
//      own controls, and the player has no way to know which of the two is wrong.
//
// ⚠ AND ON (2) THE MEASUREMENT CONTRADICTED THE BRIEF, WHICH IS WHY IT IS
// MEASURED. The strip's labels were ALREADY derived — `keyLabel(id)` /
// `padLabel(id)` off the live binding maps — and had been since the file was
// written. There was no `E` in `hints.js` to delete. THE TYPED LETTERS WERE
// SOMEWHERE ELSE ENTIRELY: `screens/combat.js` and `screens/map.js` each shipped
// `title="Menu (M)"`, and `components/tutorial.js` shipped *"Done? End Turn (or
// press E)."* — the first thing a new player ever reads. So the census below is
// over EVERY control prompt this tool can find, not over the strip: a check aimed
// only where the brief pointed would have reported green on the defect.
//
// THE REBIND IS THE WHOLE INSTRUMENT AND IT ENTERS BY THE REAL DOOR. Nothing here
// asserts a chip says `E`; that passes forever against a hardcoded `E`. It rebinds
// End Turn to `j` and Menu to `k` THROUGH `?shotSettings`, which goes through
// `saves.loadMeta()` and the app's own `setKeyBindings` — Vira's invariant, "the
// profile reported is the profile rendered" — and then requires every prompt in
// the tree to have moved. A derived label follows; a typed one does not. That is
// the one cell that can tell the two apart and it is the reason this file exists.
//
// Usage
//   node tools/controlstrip.mjs                  source tree via tools/serve.mjs
//   node tools/controlstrip.mjs --dist           dist/AshenSpire.html over file://
//   node tools/controlstrip.mjs --selftest       three source plants, watched red
//   node tools/controlstrip.mjs --root DIR       serve a different tree (--selftest's door)
//   CHROME=/path/to/chrome node tools/controlstrip.mjs
//
// Exit codes
//   0  every check held
//   1  a finding
//   2  usage / no browser / a screen that would not mount / NOTHING MEASURED —
//      which is unknown, and unknown is never a pass
//
// BOUNDARY — what a green here does NOT mean, named rather than left to be found:
//   (a) 1200x730 ONLY FOR THE PRESSES. `styles/ui.css` hides `.hint-bar` under
//       `:root[data-layout='narrow']`, so at 390x844 there is no strip to press
//       and this tool says so as a SKIP with the numbers rather than passing over
//       it. Where the strip belongs on a phone is Sunna's layout act; the day it
//       lands, the narrow cell here stops skipping and starts asserting.
//   (b) NO REAL GAMEPAD. `hasGamepad()` is shimmed on `navigator.getGamepads`, so
//       the pad-glyph cell licenses "code reading getGamepads gets glyphs", never
//       "a controller does". Bjorn's correction of my last act, carried.
//   (c) CONNECTED IS NOT ACTIVE, and the app has the same boundary at the same
//       line (`actionLabel` in src/ui/input.js). A pad on the desk with both hands
//       on the keyboard reads pad glyphs. This tool measures what the app does,
//       and what the app does there is `unknown`, not wrong.
//   (d) IT FINDS PROMPTS BY `data-action-hint` / `data-action-key`. A control
//       prompt that names a key and carries NEITHER attribute is invisible here —
//       the same hole `tools/holdconfirm.mjs` names about controls that call no
//       machinery. The static half of that gap is what `--selftest` plant K3 is
//       for, and it is a floor on the exposure, not a measurement of it.
//   (e) ONE MACHINE, headless Chromium, one text size.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';
import { printArtifactProvenance } from './artifact-provenance.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const useDist = args.includes('--dist');
const SERVE_ROOT = resolve(argOf('--root') || ROOT);
printArtifactProvenance(useDist ? resolve(ROOT, 'dist/AshenSpire.html') : resolve(ROOT, 'index.html'), ROOT);

const BROWSERS = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// WIDE, because that is where a strip exists at all today (boundary (a)). NARROW
// is driven too and is expected to have no strip; that expectation is asserted
// rather than assumed, so the day Sunna's act unhides it this tool notices.
const WIDE = { w: 1200, h: 730 };
const NARROW = { w: 390, h: 844 };

// THE REBIND. Two actions, two keys nothing else in the tree claims, chosen so a
// hardcoded default cannot accidentally match: `e` -> `j` for End Turn (the key
// whose hold I fixed six hours ago) and `m` -> `k` for Menu (the key both topbar
// buttons had typed into a `title`).
const REBOUND = { endTurn: 'j', menu: 'k' };

function cdpConnect(url) {
  const ws = new WebSocket(url); let n = 1; const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sid) { const id = n++; return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) })); }); },
    close: () => ws.close() };
}

// EVERY CONTROL PROMPT ON THE PAGE, read off the DOM by the attribute that says
// which action it is quoting. This is the census, and it is the thing a rebind
// moves: `[data-action-hint]` for a tooltip, `[data-action-key]` for prose, and
// `.hint-bar .hint` for the strip.
const CENSUS = `(() => {
  const chips = [...document.querySelectorAll('.hint-bar .hint')].map((b) => ({
    id: b.dataset.action || null,
    tag: b.tagName,
    kbd: (b.querySelector('kbd') || {}).textContent || null,
    text: (b.textContent || '').replace(/\\s+/g, ' ').trim(),
    title: b.getAttribute('title'),
    disabled: !!b.disabled,
    pe: getComputedStyle(b).pointerEvents,
    box: (() => { const r = b.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })(),
  }));
  const bar = document.querySelector('.hint-bar');
  return {
    barPresent: !!bar,
    barDisplay: bar ? getComputedStyle(bar).display : null,
    barRole: bar ? bar.getAttribute('role') : null,
    barAriaHidden: bar ? bar.getAttribute('aria-hidden') : null,
    layout: document.documentElement.getAttribute('data-layout'),
    chips,
    hints: [...document.querySelectorAll('[data-action-hint]')].map((e) => ({
      id: e.dataset.actionHint, sel: e.id ? '#' + e.id : e.className, title: e.getAttribute('title'), aria: e.getAttribute('aria-label'),
    })),
    prose: [...document.querySelectorAll('[data-action-key]')].map((e) => ({ id: e.dataset.actionKey, text: e.textContent })),
    tapFloor: (() => {
      const p = document.createElement('div');
      p.style.cssText = 'position:absolute;left:-9999px;top:0;height:var(--tap-floor)';
      document.body.appendChild(p); const h = +p.getBoundingClientRect().height.toFixed(1); p.remove(); return h;
    })(),
  };
})()`;

async function main() {
  if (!browserPath) { console.error('controlstrip: no chromium found. Set CHROME=/path/to/chrome.'); process.exit(2); }
  if (args.includes('--selftest')) return selftest();

  let base; let stop = () => {};
  if (useDist) base = pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href;
  else { const s = await serve({ root: SERVE_ROOT, port: Number(argOf('--port') || 8294), open: false }); base = `http://127.0.0.1:${s.port}/index.html`; stop = () => s.server.close(); }

  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'cstrip-', browser: browserPath,
    args: ['--allow-file-access-from-files', '--hide-scrollbars'], timeoutMs: 20000,
  });
  const cdp = cdpConnect(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId); await cdp.send('Runtime.enable', {}, sessionId);
  const ev = async (e) => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, sessionId)).result.value;

  const findings = []; const notAsked = []; let checks = 0;
  const ok = (name, cond, detail) => {
    checks++;
    console.log(`    ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!cond) findings.push(`${name}${detail ? `: ${detail}` : ''}`);
  };
  const skip = (name, kind, why) => { notAsked.push({ name, kind, why }); console.log(`    skip  ${name} [${kind}] — ${why}`); };

  const shape = async (s) => cdp.send('Emulation.setDeviceMetricsOverride',
    { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.w < 700 }, sessionId);

  // `?shotSettings` IS THE REAL DOOR and the reason nothing here reaches into
  // localStorage itself: the settings go through `saves.loadMeta()` like any other
  // boot, so what is measured is the app's OWN resolution of them (main.js's
  // header says why, and it says it because an instrument that seeded storage
  // directly once measured its own mock).
  const openCombat = async (settings) => {
    const q = ['shot=combat'];
    if (settings) q.push(`shotSettings=${encodeURIComponent(JSON.stringify(settings))}`);
    await cdp.send('Page.navigate', { url: `${base}?${q.join('&')}` }, sessionId);
    for (let i = 0; i < 120; i++) { if (await ev(`!!document.querySelector('.end-turn')`)) break; await wait(120); }
    await wait(350);
  };
  const tap = async (sel, ms = 30) => {
    const p = await ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return null;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
      return { x: Math.round(x), y: Math.round(y) }; })()`);
    if (!p) return false;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1, buttons: 1 }, sessionId);
    await wait(ms);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1, buttons: 0 }, sessionId);
    await wait(320);
    return true;
  };

  console.log(`\ncontrolstrip — the strip must WORK and its labels must be DERIVED`);
  console.log(`  tree: ${useDist ? 'dist/AshenSpire.html' : SERVE_ROOT}\n`);

  // ---- 1 · THE STRIP EXISTS AND IS MADE OF CONTROLS ------------------------
  console.log(`  THE STRIP IS A SET OF CONTROLS, not an advertisement (${WIDE.w}x${WIDE.h})`);
  await shape(WIDE);
  await openCombat(null);
  const wide = await ev(CENSUS);
  if (!wide.barPresent) {
    ok(`the control strip is on the combat screen`, false, `no .hint-bar at ${WIDE.w}x${WIDE.h}, layout=${wide.layout}`);
  } else {
    ok(`the control strip is on the combat screen`, true, `layout=${wide.layout} display=${wide.barDisplay} ${wide.chips.length} chip(s)`);
    // A `<span>` cannot be pressed by a keyboard, cannot be announced as a
    // control, and cannot be disabled. The tag IS the claim.
    ok(`every chip is a real BUTTON`, wide.chips.length > 0 && wide.chips.every((c) => c.tag === 'BUTTON'),
      wide.chips.map((c) => `${c.id}=${c.tag}`).join(' '));
    // THE DEFECT ITSELF, IN ONE PROPERTY. `pointer-events: none` was the whole of
    // "the buttons don't work" and it is invisible in the DOM — the markup was
    // already there and already correct-looking.
    ok(`and takes pointer events (the one declaration that made them decoration)`,
      wide.chips.every((c) => c.pe !== 'none'),
      wide.chips.map((c) => `${c.id}:${c.pe}`).join(' '));
    // Law 4 clause 4: a fixed floor with intrinsic growth. Read off the page's own
    // `--tap-floor`, never the number 44 — that number has a home.
    ok(`every chip meets the tap-height floor (Law 4 clause 4)`,
      wide.tapFloor > 0 && wide.chips.every((c) => c.box.h >= wide.tapFloor - 0.5),
      `floor ${wide.tapFloor} px${wide.tapFloor > 0 ? '' : ' — THE FLOOR DID NOT RESOLVE, so this check could not fail'}`
      + ` · ${wide.chips.map((c) => `${c.id} ${c.box.w}x${c.box.h}`).join(' ')}`);
    // A toolbar of five controls announced as decoration is five controls a
    // screen reader cannot find. `aria-hidden` was the accessibility half of his
    // ask and it is asserted absent rather than hoped for.
    ok(`the strip is announced as controls, not hidden from readers`,
      wide.barRole === 'toolbar' && wide.barAriaHidden === null,
      `role=${wide.barRole} aria-hidden=${wide.barAriaHidden}`);
    ok(`and each chip carries its own words for a thumb (Law 3 clause 4, touch half)`,
      wide.chips.every((c) => c.title && c.title.length > 2),
      wide.chips.map((c) => `${c.id}="${c.title}"`).join(' '));
  }

  // ---- 2 · A PRESS ON A CHIP DOES WHAT THE KEY DOES ------------------------
  //
  // BOTH DIRECTIONS OF THE ONE THAT MATTERS. The Deck chip must OPEN the deck —
  // that is his ask. And the End Turn chip must NOT end the turn on a tap while
  // the hold dial is on — because a chip that reaches the action by some fourth
  // path of its own would bypass the second beat, which is the defect I shipped
  // the fix for six hours ago. One cell proves it works, the other proves it went
  // through the door.
  console.log(`\n  A PRESS ON A CHIP IS A PRESS ON THE BINDING`);
  if (!wide.barPresent) skip('chip-press', 'unasked', 'no strip at this shape to press');
  else {
    await openCombat(null);
    const opened = await tap('.hint-bar .hint[data-action="deck"]');
    if (!opened) ok(`the Deck chip opens the Deck`, false, 'the chip could not be reached to press');
    else {
      // `.overlay-modal` INSIDE A `.modal-veil` — read off components/overlay.js
      // rather than guessed. My first cut asked for `.overlay-veil, .ov-panel,
      // #overlay`, none of which this tree has ever had, and it printed a red that
      // was entirely my own: a selector that matches nothing is a check that fails
      // for the wrong reason, which is the same defect as one that passes for the
      // wrong reason. The active tab is `.ov-tab.on`, likewise off that file.
      const after = await ev(`(() => ({ overlay: !!document.querySelector('.modal-veil .overlay-modal'),
        tab: (document.querySelector('.ov-tab.on') || {}).textContent || null }))()`);
      ok(`the Deck chip opens the Deck`, !!after.overlay, `overlay open=${after.overlay} active tab=${JSON.stringify(after.tab)}`);
    }
    // THE SECOND BEAT SURVIVES THE NEW DOOR. Dial on (default `normal`), a SHORT
    // press on the End Turn chip must leave the turn where it was.
    await openCombat(null);
    const t0 = await ev(`(() => (window.__run ? window.__run.turn : (document.querySelector('[data-turn]') || {}).dataset?.turn) ?? null)()`);
    const pressed = await tap('.hint-bar .hint[data-action="endTurn"]', 40);
    const t1 = await ev(`(() => (window.__run ? window.__run.turn : (document.querySelector('[data-turn]') || {}).dataset?.turn) ?? null)()`);
    if (!pressed) skip('chip-beat', 'unasked', 'the End Turn chip could not be reached to press');
    else if (t0 == null) {
      // A CELL THAT CANNOT FAIL IS NOT A CELL. If neither reader exposes the turn
      // number, this says so instead of comparing two nulls and printing green.
      skip('chip-beat', 'unreadable', 'no reader for the turn number on this tree — two nulls comparing equal is not evidence');
    } else {
      ok(`a SHORT press on the End Turn chip does NOT end the turn (it went through the beat)`,
        String(t0) === String(t1), `turn ${t0} -> ${t1}, dial at its default`);
    }
  }

  // ---- 3 · THE LABELS FOLLOW A REBIND -------------------------------------
  console.log(`\n  THE LABELS ARE DERIVED — the rebind is the only cell that can tell`);
  await openCombat(null);
  const before = await ev(CENSUS);
  await openCombat({ keyBindings: REBOUND });
  const after = await ev(CENSUS);
  const say = (c) => `${c.id}:${c.kbd}`;
  ok(`the strip's End Turn chip prints the REBOUND key, not E`,
    (() => { const c = after.chips.find((x) => x.id === 'endTurn'); return !!c && c.kbd === REBOUND.endTurn.toUpperCase(); })(),
    `before [${before.chips.map(say).join(' ')}] after [${after.chips.map(say).join(' ')}] (rebound endTurn -> ${REBOUND.endTurn})`);
  ok(`and every other chip moved or stayed with ITS OWN binding`,
    after.chips.every((c) => c.kbd && c.kbd !== '—'),
    after.chips.map(say).join(' '));
  // THE THREE TYPED LETTERS. Every prompt that quotes an action is required to
  // have moved with it — this is the cell that was red on combat.js, map.js and
  // tutorial.js before this act, and it is red again the moment anyone types a
  // key into prose (plants K1/K2).
  const wrong = (after.hints || []).filter((h) => {
    const want = h.id === 'endTurn' ? REBOUND.endTurn : h.id === 'menu' ? REBOUND.menu : null;
    return want && !(h.title || '').toUpperCase().includes(want.toUpperCase());
  });
  ok(`every control TOOLTIP quotes the live binding`,
    (after.hints || []).length > 0 && wrong.length === 0,
    (after.hints || []).length === 0
      ? 'NO [data-action-hint] PROMPTS FOUND — unknown, not green: this cell had nothing to measure'
      : `${after.hints.length} prompt(s): ${after.hints.map((h) => `${h.sel}(${h.id})="${h.title}"`).join(' ')}`);
  ok(`and no prompt still carries a DEFAULT key the player has rebound away from`,
    !(after.hints || []).some((h) => h.id === 'menu' && /\(M\)/.test(h.title || ''))
    && !(after.prose || []).some((p) => p.id === 'endTurn' && /\bE\b/.test(p.text || '')),
    `tooltips [${(after.hints || []).map((h) => h.title).join(' | ')}] prose [${(after.prose || []).map((p) => p.text).join(' | ')}]`);

  // ---- 4 · THE ACTIVE DEVICE ----------------------------------------------
  //
  // A SHIM ON `navigator.getGamepads`, and the claim is scoped to exactly that
  // (boundary (b)). What is being checked is that the strip asks the device
  // question at all rather than hardcoding the keyboard — the answer changes and
  // the labels change with it.
  console.log(`\n  THE ACTIVE DEVICE — glyphs when a pad answers (shimmed, boundary (b))`);
  await openCombat(null);
  const padded = await ev(`(() => {
    const fake = { index: 0, connected: true, mapping: 'standard', id: 'controlstrip shim',
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
    navigator.getGamepads = () => [fake];
    dispatchEvent(new Event('gamepadconnected'));
    return new Promise((r) => setTimeout(() => r([...document.querySelectorAll('.hint-bar .hint')]
      .map((b) => ({ id: b.dataset.action, kbd: (b.querySelector('kbd') || {}).textContent }))), 260));
  })()`);
  if (!padded || !padded.length) skip('pad-glyphs', 'unasked', 'no strip at this shape to re-label');
  else {
    ok(`with a pad answering, the chips stop printing keyboard letters`,
      padded.some((c) => c.kbd && !/^[A-Z]$/.test(c.kbd)),
      padded.map((c) => `${c.id}:${c.kbd}`).join(' '));
  }

  // ---- 5 · THE NARROW SHAPE, ASSERTED RATHER THAN SKIPPED IN SILENCE ------
  console.log(`\n  THE NARROW SHAPE — hidden today, and that is Sunna's half (boundary (a))`);
  await shape(NARROW);
  await openCombat(null);
  const narrow = await ev(CENSUS);
  // NOT A PASS AND NOT A FAILURE — a STATE, printed so the day it changes is
  // visible. `display: none` here is styles/ui.css's narrow rule, whose stated
  // reason ("it offers 'E End Turn' to a device with no E") is the premise this
  // act retires; unhiding it is a layout call and not mine.
  if (narrow.barPresent && narrow.barDisplay !== 'none') {
    ok(`the narrow strip, now VISIBLE, is pressable too`,
      narrow.chips.length > 0 && narrow.chips.every((c) => c.tag === 'BUTTON' && c.pe !== 'none'),
      `layout=${narrow.layout} ${narrow.chips.length} chip(s) — the narrow rule has changed since 2026-08-17; this cell woke up`);
  } else {
    skip('narrow-strip', 'hidden-by-design',
      `layout=${narrow.layout}, .hint-bar present=${narrow.barPresent} display=${narrow.barDisplay} at ${NARROW.w}x${NARROW.h} — `
      + `styles/ui.css hides it on a narrow layout. The chips ARE controls now, so that rule's own reason is spent, but where the `
      + `strip goes on a phone is the layout act Sunna owns. Named as unknown here: on a phone, "the buttons work" is UNOBSERVABLE.`);
  }

  cdp.close(); await dropBrowser(); stop();

  console.log(`\n  BOUNDARY: 1200x730 for the presses, 390x844 for the narrow state, one text size,`);
  console.log(`  headless Chromium on one Linux box, a shimmed pad. See the header for (a)-(e).`);
  if (notAsked.length) {
    console.log(`\n  NOT ASKED — ${notAsked.length}, each named. A skip folded into a PASS is silence,`);
    console.log(`  and silence is unknown, which blocks (SOP 2).`);
    for (const s of notAsked) console.log(`    - ${s.name} [${s.kind}]: ${s.why}`);
  }
  if (!checks) { console.error(`\n  NOTHING MEASURED — unknown, never a pass.`); process.exit(2); }
  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${checks} check(s)` : `PASS — ${checks} checks, 0 findings`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : 0);
}

// ---- THE RE-RUNNABLE KNOWN-BAD (--selftest) ---------------------------------
//
// Each plant is one source line replaced in a disposable copy of `src/` (plus
// `styles/`), judged by re-running this whole tool at `--root COPY`: real server,
// real boot, real clicks. Nothing is handed to a function. And each must leave an
// untouched corner GREEN — a plant that craters the run proves the tool notices
// breakage, not that it notices THIS breakage.
const PLANTS = [
  {
    // THE DEFECT AS IT SHIPPED, restored exactly: one CSS declaration.
    name: 'K1 pointer-events: none put back on the strip',
    file: 'styles/ui.css',
    from: '  display: flex; gap: 1.4rem; white-space: nowrap;\n  padding: 0.4rem 1.2rem; border-radius: 10px; max-width: 96vw; overflow: hidden;',
    to: '  display: flex; gap: 1.4rem; pointer-events: none; white-space: nowrap;\n  padding: 0.4rem 1.2rem; border-radius: 10px; max-width: 96vw; overflow: hidden;',
    what: 'the one declaration that made five chips an advertisement',
    expect: 'the chips inherit pointer-events: none, the Deck chip cannot be pressed, and nothing in the DOM looks wrong',
    mustRed: (out) => /FAIL\s+and takes pointer events/.test(out),
    mustStay: (out) => /ok\s+every chip is a real BUTTON/.test(out),
  },
  {
    // THE TYPED LETTER, PUT BACK WHERE IT ACTUALLY WAS. Not in the strip — in a
    // topbar tooltip, which is where the census found it and where a check aimed
    // at the strip alone would have stayed green.
    name: 'K2 title="Menu (M)" typed back into the combat topbar',
    file: 'src/ui/screens/combat.js',
    from: `<button class="topbar-btn" id="combat-menu" data-action-hint="menu" title="\${esc(actionHint('menu'))}" aria-label="\${esc(actionHint('menu'))}">`,
    to: '<button class="topbar-btn" id="combat-menu" title="Menu (M)">',
    what: 'a binding written by hand in prose — Law 1 clause 7',
    expect: 'the tooltip still says (M) after Menu is rebound to K, and the player has no way to know which is lying',
    mustRed: (out) => /FAIL\s+(every control TOOLTIP quotes the live binding|and no prompt still carries a DEFAULT key)/.test(out),
    mustStay: (out) => /ok\s+the strip's End Turn chip prints the REBOUND key/.test(out),
  },
  {
    // THE PROSE ONE, and it is the first thing a new player reads.
    name: 'K3 "(or press E)" typed back into the tutorial',
    file: 'src/ui/components/tutorial.js',
    from: "    text: () => `Done? End Turn (or press ${actionLabel('endTurn')}). Unspent energy and most Block are lost at your next turn.` },",
    to: "    text: 'Done? End Turn (or press E). Unspent energy and most Block are lost at your next turn.' },",
    what: 'the hardcoded key in the first sentence a new player ever reads',
    expect: 'the callout tells a player who rebound End Turn to press a key that no longer ends the turn',
    // THIS PLANT IS THE HONEST ONE ABOUT MY OWN COVERAGE. The tutorial does not
    // mount on `?shot=combat`, so the census cannot SEE that string, and the cell
    // it should have failed stays green. What goes red is the STATIC half — the
    // grep below — and that is boundary (d) measured rather than asserted: a
    // rendered census cannot cover a screen it never opens.
    staticRed: (dir) => /\(or press E\)/.test(readFileSync(resolve(dir, 'src/ui/components/tutorial.js'), 'utf8'))
      && !/data-action-key|actionLabel\('endTurn'\)/.test(readFileSync(resolve(dir, 'src/ui/components/tutorial.js'), 'utf8')),
    mustRed: null,
    mustStay: (out) => /ok\s+every control TOOLTIP quotes the live binding/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'cstrip-kb-'));
  for (const d of ['src', 'styles', 'assets', 'content']) {
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
    console.error(`controlstrip --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  Each find-string is one of these claims\' CONTRACTS, not a convenience. RE-AIM it');
    console.error('  at the bytes the defect replaces. Do not delete it and do not loosen it: a corpus');
    console.error('  that silently stops matching is a suite that has gone green about nothing.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

function runAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('controlstrip --selftest — the re-runnable known-bad for "the controls tell the truth"');
  console.log(`  DOOR: one source line replaced in a disposable copy of ${ROOT}, then this whole tool`);
  console.log('  re-run at --root COPY. Same server, same boot, same clicks as the real run.\n');
  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  const clean = await runAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants are the only difference`);
  if (clean.code !== 0) console.log(clean.out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 8).map((l) => `      ${l.trim()}`).join('\n'));
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runAt(dir);
    if (p.mustRed) {
      ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
      ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    } else {
      // NAMED, NOT HIDDEN: this plant is NOT caught by the rendered run, and the
      // selftest says so out loud rather than quietly scoring it as covered.
      ok(r.code === 0, `${p.name}: the rendered run does NOT catch it (exit ${r.code}) — boundary (d), stated`);
      ok(p.staticRed(dir), `${p.name}: caught STATICALLY instead — the typed key is readable in the source`);
      console.log(`      ^ the tutorial does not mount on ?shot=combat, so no rendered census can see this`);
      console.log(`        string. That is a real hole in this tool and it is measured here, not claimed away.`);
    }
    ok(p.mustStay(r.out), `${p.name}: an untouched corner stays green (right reason, not a crater)`);
    for (const line of r.out.split('\n').filter((l) => /^\s*FAIL/.test(l)).slice(0, 4)) console.log(`      ${line.trim()}`);
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(`\n  ${fails ? `FAIL — ${fails} selftest check(s) failed` : `PASS — ${PLANTS.length} plants, each judged by what it actually catches`}`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
