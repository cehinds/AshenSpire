#!/usr/bin/env node
// tools/coop-hand-parity.mjs — the renderer collapse's own check, and the one
// risk it carries.
//
// From 2026-08-14 to 2026-08-15 the hand had TWO renderers: combat.js's
// template (the machinery — inspect hold, key hints, the overlap arm, the
// mode word) and coop.js's own `.hand` (fan and click, none of it). The
// collapse gives both surfaces src/ui/components/hand.js. That buys two
// things and RISKS one, and this file is about all three:
//
//   PARITY (the seam that rode the collapse) — a co-op hand now honours
//     balance.ui.handLayout like solo: overlap OVERLAPS (travel 0), paging
//     PAGES (travel > 0). Before the collapse the co-op strip paged under
//     BOTH words — two behaviours behind one settings word, and axisfit's
//     green was honest about geometry and silent about that split (Vega's
//     scary thing, 2026-08-14).
//   MACHINERY — the hold and the positional key hints arrive on the co-op
//     hand because they live in the component, not in one caller.
//   THE RISK, AND IT IS THE REASON THIS FILE EXISTS — a shared renderer
//     could quietly hand co-op the SOLO play path. A co-op client is a thin
//     client: it renders server snapshots and SENDS INTENTS. If a played card
//     ever resolved locally, the client would be authoritative about a fight
//     it does not own — the whole architecture, undone by one shared handler.
//     So the claim checked here is not "a card was clicked" but "the play
//     LEFT THE MACHINE": the frame is read off the real WebSocket, and the
//     client's own board must not move until the server's snapshot lands.
//
// THE DOOR (development.md, the instrument rule, both clauses). Nothing is
// posed and nothing is handed downstream:
//   · the run is a REAL LAN game — tools/serve.mjs in process, the app's own
//     lobby, host lights a fire, a second browser JOINS it, both ready, the
//     shared map, a fork vote, one shared fight. Two real clients, one real
//     server. No ?shot= state is used anywhere in this file.
//   · the MODE enters through the door a stored preference enters: the app's
//     own `sote_meta_v1` settings blob, seeded before boot, resolved by
//     main.js's own guard against balance.ui.handLayoutModes. (?shotSettings
//     is read only under a ?shot= boot and so cannot reach a real LAN run —
//     which is the point: this is the player's door, not the harness's.)
//   · the WIRE is read by wrapping WebSocket.prototype.send in the page
//     BEFORE any app code runs, so every frame the client actually emits is
//     recorded — not a hook the app was asked to call.
//
// OBSERVED RED, and the plant is a source edit entering by the same door a
// regression would (`--root` a disposable copy of the tree, one line of
// coop.js's wireCard changed from `send({t:'playCard'…})` to a LOCAL board
// mutation — the exact defect the collapse could have introduced):
//
//     node tools/coop-hand-parity.mjs --root /tmp/plant-localdispatch
//     -> exit 1, 8 findings by name across BOTH modes: 0 playCard frames on
//        the wire, no `as` seat, and the guest's board never moved — while
//        EVERY parity and machinery check stayed green.
//
// That is the shape worth naming, and it is why this file is not a geometry
// tool: the geometry checks CANNOT see this defect. A locally-dispatched hand
// overlaps and pages exactly as correctly as a networked one. Two of the
// checks below cannot see it either and print LIVENESS ONLY in their own
// text, because they passed on the plant — a check that reads like evidence
// of the door while being blind to it is the graceful fallback in check form.
// Only three lines discriminate: the wire frame, its `as` seat, and the
// second client's board.
//
// Usage
//   node tools/coop-hand-parity.mjs                 this tree
//   node tools/coop-hand-parity.mjs --root DIR      another tree (the plant)
//   node tools/coop-hand-parity.mjs --only overlap  one mode
//   CHROME=/usr/bin/chromium node tools/coop-hand-parity.mjs
//
// Exit: 0 all green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// BOUNDARY — what a green here does NOT mean. One shape (390x844) and the
// shipping text size; headless Chromium on one Linux box, no thumb and no OS
// gesture layer. The hold is proven ARMED (the component's own state
// attribute through a real press), not that a human can read the expanded
// card. Two clients, two seats, one fight, at the FIRST combat of a seeded
// run — a late-run hand is more content in the same box and is not swept
// here. This file says nothing about the solo hand: tools/handlayout.mjs and
// tools/inspecthold.mjs own that corpus, and tools/axisfit.mjs owns the Law 5
// verdict on every container.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day co-op stops being a
// thin client — if the client ever legitimately resolves its own combat,
// the wire claim below has no subject and this file is measuring a design
// that no longer exists.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const only = argOf('--only');
// --shots DIR writes one 390x844 PNG per mode, taken from the REAL fight this
// run drove — not a ?shot= pose. The picture and the assertions are then the
// same frame, so a reader cannot be shown one screen while another was
// measured (the contrast-audit lesson, main.js's shotSettings header).
const shotsDir = argOf('--shots');

const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 390, H = 844, DPR = 3;

const fails = [];
let ran = 0;
const ok = (cond, msg) => { console.log(`    ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };

// THE MODES ARE THE APP'S CLOSED SET, DERIVED — balance.ui.handLayoutModes,
// the same home main.js guards a stored setting against and axisfit derives
// its mode axis from. Typed here it would be a second copy that outlives the
// feature; derived, it dies loudly with its home.
async function appHandModes() {
  const { balance } = await import(pathToFileURL(join(ROOT, 'src/content/balance.js')).href);
  return (balance.ui.handLayoutModes || []).slice();
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); }
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

// Seeded before ANY app code runs, in both tabs:
//   1. the stored display setting — the app's own meta blob, the door a
//      settings row would write through. main.js resolves it (and rejects a
//      value outside the closed set) exactly as it would a real player's.
//   2. the wire recorder — WebSocket.prototype.send wrapped, so every frame
//      the client emits is captured whether or not anything asks it to.
const preamble = (mode) => `(() => {
  try {
    const K = 'sote_meta_v1';
    const cur = JSON.parse(localStorage.getItem(K) || '{}') || {};
    localStorage.setItem(K, JSON.stringify({ ...cur, settings: { ...(cur.settings || {}), handLayout: ${JSON.stringify(mode)} } }));
  } catch (e) { /* a storage-less browser is not this check's subject */ }
  window.__wire = [];
  const S = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try { window.__wire.push(String(data)); } catch (e) { /* never break the app to watch it */ }
    return S.apply(this, arguments);
  };
})()`;

async function main() {
  if (!browserPath) { console.error('coop-hand-parity: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }
  const modes = await appHandModes();
  if (!modes.length) {
    console.error('\ncoop-hand-parity: derived ZERO hand-layout modes from src/content/balance.js (ui.handLayoutModes).');
    console.error('That closed set IS the parity claim. Unread, this run would silently check one mode and');
    console.error('call the seam closed. If the word left the app, delete this file in the same act.');
    process.exit(1);
  }
  const swept = modes.filter((m) => !only || m === only);
  if (only && !swept.length) {
    console.error(`coop-hand-parity: --only ${only} is not one of the app's modes (${modes.join(', ')}). Nothing ran — unknown, not a pass.`);
    process.exit(2);
  }

  console.log(`\ncoop-hand-parity — root ${ROOT}`);
  console.log(`  MODE AXIS — balance.ui.handLayoutModes, DERIVED: ${modes.join(', ')}${only ? `  (running ${swept.join(', ')})` : ''}`);
  console.log('  Every run below is a REAL LAN game: two browser clients, one in-process server,');
  console.log('  the app\'s own lobby/vote/combat flow. The mode enters by the stored-settings door.');

  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'coophand-', browser: browserPath,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;

  const newTab = async (mode) => {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true }, sessionId);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: preamble(mode) }, sessionId);
    return { sessionId, targetId };
  };
  const ev = async (tab, e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, tab.sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (tab, expr, what, ms = 25000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await ev(tab, expr).catch(() => false)) return true; await wait(150); }
    throw new Error(`timeout waiting for ${what}`);
  };
  // THE SAME WAIT, AS A FINDING RATHER THAN A CRASH — and the difference is
  // the whole point of the check below. When the play never leaves the
  // machine, the guest's board never moves; `until` would abort the run at
  // exit 2 (usage/unknown) and the operator would meet a timeout instead of
  // the defect. Observed on the planted local-dispatch tree: the wire check
  // went red and this one crashed the run one line later. A check that can
  // only report its own defect by dying is not a located finding.
  const okUntil = async (tab, expr, msg, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await ev(tab, expr).catch(() => false)) { ok(true, msg); return true; } await wait(150); }
    ok(false, `${msg} — never happened within ${ms} ms`);
    return false;
  };
  const click = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`;

  let port = 8291;
  for (const mode of swept) {
    ran++;
    // ONE SERVER PER MODE, and it is not tidiness. `lan: true` starts the real
    // LAN server beside the file server — it is what the client's own
    // WebSocket connects to and what lights the LAN door. That server keeps
    // the fire it was lit with, so a second mode reusing it joins the FIRST
    // mode's room and the roster never readies. Observed: the overlap run
    // timed out at "host sees all ready" while paging had just passed 13/13.
    // A fresh fire per mode is the only way each cell is its own run.
    const s = await serve({ root: ROOT, port: port++, open: false, lan: true });
    const base = `http://localhost:${s.port}/`;
    console.log(`\n  ${mode} @ ${W}x${H} — a real two-client fight (${base})`);
    const host = await newTab(mode);
    const guest = await newTab(mode);

    // ---- the real flow: fire → join → ready → start → vote → one fight ----
    await cdp.send('Page.navigate', { url: base }, host.sessionId);
    await until(host, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'host sees LAN');
    await ev(host, click('#lan-play'));
    await until(host, `!!document.querySelector('#lb-name')`, 'host lobby');
    await ev(host, `(() => { const n = document.querySelector('#lb-name'); n.value = 'Wren'; n.dispatchEvent(new Event('input')); return true; })()`);
    await ev(host, click('#lb-host'));
    await until(host, `document.querySelector('h2')?.textContent === 'AT THE FIRE'`, 'host at the fire');

    await cdp.send('Page.navigate', { url: base }, guest.sessionId);
    await until(guest, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'guest sees LAN');
    await ev(guest, click('#lan-play'));
    await until(guest, `!!document.querySelector('#lb-name')`, 'guest lobby');
    await ev(guest, `(() => { const n = document.querySelector('#lb-name'); n.value = 'Fenn'; n.dispatchEvent(new Event('input')); return true; })()`);
    await until(guest, `!!document.querySelector('.lb-join')`, 'guest sees the fire');
    await ev(guest, click('.lb-join'));
    await until(guest, `!!document.querySelector('#lb-ready')`, 'guest in the room');
    await ev(guest, click('#lb-ready'));
    await until(host, `!document.querySelector('#lb-start')?.disabled`, 'host sees all ready');
    await ev(host, click('#lb-start'));
    await until(host, `!!document.querySelector('.mapscreen')`, 'host on the shared map');
    await until(guest, `!!document.querySelector('.mapscreen')`, 'guest on the shared map');
    await ev(host, click('.map-node.reachable'));
    await ev(guest, click('.map-node.reachable'));
    await until(host, `!!document.querySelector('.combat.coop')`, 'host in the shared fight');
    await until(guest, `!!document.querySelector('.combat.coop')`, 'guest in the shared fight');
    await until(host, `!!document.querySelector('.combat.coop .hand .card')`, 'the co-op hand drew');
    await wait(700);
    ok(true, 'a real two-client LAN fight is on both screens (no ?shot= anywhere)');

    // ---- 1. the mode reached the page by the player's own door -------------
    const word = await ev(host, `document.documentElement.dataset.handLayout || null`);
    ok(word === mode, `the stored setting resolved: <html data-hand-layout> = '${word}' for the seeded '${mode}'`);

    // ---- 2. PARITY — the co-op hand obeys the word, like solo --------------
    const geom = await ev(host, `(() => {
      const hand = document.querySelector('.combat.coop .hand');
      const cards = [...hand.querySelectorAll(':scope > .card')];
      return {
        n: cards.length,
        travelX: hand.scrollWidth - hand.clientWidth,
        travelY: hand.scrollHeight - hand.clientHeight,
        hints: hand.querySelectorAll('.key-hint').length,
        declared: hand.getAttribute('data-scroll-axis'),
        declaredMode: hand.getAttribute('data-scroll-axis-mode'),
        narrow: document.documentElement.getAttribute('data-layout') === 'narrow',
      };
    })()`);
    ok(geom.narrow, `the shape rendered narrow (the only shape the word arranges): data-layout=narrow`);
    if (mode === 'overlap') {
      ok(geom.travelX === 0, `PARITY — overlap OVERLAPS on the co-op hand: horizontal travel ${geom.travelX} local px (was 211 px, i.e. it paged, before the collapse)`);
      ok(geom.travelY === 0, `overlap buys no hidden vertical scroller either: ${geom.travelY} local px`);
      ok(geom.declared === null, `and the strip declares NO Law 5 exemption under overlap (it asserts zero like any container) — got ${JSON.stringify(geom.declared)}`);
    } else {
      ok(geom.travelX > 0, `PARITY — paging PAGES on the co-op hand: horizontal travel ${geom.travelX} local px`);
      ok(geom.declared === 'x' && geom.declaredMode === 'paging',
        `and the strip carries the MODE-SCOPED exemption from its one home: axis=${JSON.stringify(geom.declared)} mode=${JSON.stringify(geom.declaredMode)}`);
    }

    // ---- 3. MACHINERY — what the second template never had ----------------
    ok(geom.hints === Math.min(geom.n, 10), `key hints arrived on the co-op hand: ${geom.hints} badges over ${geom.n} cards (the fork had none)`);
    // The hold is proven ARMED through a real press on a real card: the
    // component's own state attribute, not a claim about armInspect existing.
    const held = await ev(host, `(async () => {
      const card = document.querySelector('.combat.coop .hand .card');
      const r = card.getBoundingClientRect();
      const at = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, pointerId: 1, bubbles: true, isPrimary: true };
      card.dispatchEvent(new PointerEvent('pointerdown', at));
      await new Promise((res) => setTimeout(res, 120));
      const armed = card.dataset.inspect || null;
      card.dispatchEvent(new PointerEvent('pointercancel', at));
      return armed;
    })()`);
    ok(held === 'pending' || held === 'open',
      `the inspect hold ARMS on a co-op card (a real press → data-inspect='${held}'; the fork had no reader at all)`);
    await wait(300);

    // ---- 4. THE RISK — the play must LEAVE THE MACHINE ---------------------
    // Read off the real socket, and paired with the board: a thin client may
    // not move its own fight. Both halves matter — a client that mutated
    // locally AND sent would still be authoritative about the frame between.
    await ev(host, `window.__wire.length = 0`);
    // THE WITNESS IS THE WHOLE BOARD, not the enemy row — a first affordable
    // card is often a BLOCK card, which moves no enemy HP at all, and a
    // witness that cannot see the play it just made would report the server
    // silent while it was answering. Enemy HP + every seat's energy: whatever
    // the card did, one of them moved.
    const boardOf = `[...document.querySelectorAll('.enemy-row .hpbar .label')].map((l) => l.textContent).join('|')`
      + ` + ' ⚡' + [...document.querySelectorAll('.coop-seat-name')].map((n) => (n.textContent.match(/⚡\\d+\\/\\d+/) || [''])[0]).join(',')`;
    const beforeBoard = await ev(host, boardOf);
    const beforeHand = await ev(host, `document.querySelectorAll('.combat.coop .hand .card').length`);
    await ev(host, click('.combatant.enemy:not(.dead)'));
    await wait(150);
    const clicked = await ev(host, `(() => {
      const card = [...document.querySelectorAll('.combat.coop .hand .card')].find((c) => !c.classList.contains('unaffordable'));
      if (!card) return false;
      card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })()`);
    ok(clicked, 'an affordable card was clicked on the co-op hand');
    // The frame, off the wire the client actually wrote to.
    const frames = await ev(host, `window.__wire.map((f) => { try { return JSON.parse(f); } catch (e) { return null; } }).filter(Boolean)`);
    const plays = (frames || []).filter((f) => f && f.t === 'playCard');
    ok(plays.length === 1,
      `THE NETWORK DOOR — the play left the machine: ${plays.length} playCard frame(s) on the real socket${plays.length ? ` (${JSON.stringify(plays[0]).slice(0, 90)})` : ' — a locally-dispatched hand emits NONE, and every geometry check above stays green while it does'}`);
    ok(plays.length === 1 && !!plays[0].as,
      'the frame carries the ACTIVE SEAT (`as`) — the server validates ownership, the client never assumes it');
    // The guest is the witness that the SERVER moved the fight, not the host.
    // A finding, never a crash: on a locally-dispatched hand this is exactly
    // what does not happen, and it must be readable as the defect.
    await okUntil(guest, `(${boardOf}) !== ${JSON.stringify(beforeBoard)}`,
      "THE SECOND CLIENT SAW IT — the guest's board moved, so the SERVER resolved the play (a local mutation moves the host's screen alone)");
    const hostBoard = await ev(host, boardOf);
    const guestBoard = await ev(guest, boardOf);
    ok(hostBoard === guestBoard, `both clients render the identical shared fight after the play (${guestBoard})`);
    // THE TWO CHECKS BELOW CANNOT SEE THIS DEFECT, AND THEY SAY SO. Measured
    // on the planted local-dispatch tree: both stayed GREEN while the wire was
    // silent, because a local mutation moves the host's own board and drops a
    // card from the host's own hand — the two facts they read. They are here
    // as liveness (the play did SOMETHING), never as evidence of the door, and
    // a reader citing either as authority-placement coverage is citing the
    // wrong check. The wire frame and the guest's board are the discriminators.
    ok(hostBoard !== beforeBoard, 'the fight moved on this screen (LIVENESS ONLY — a local mutation passes this too)');
    const afterHand = await ev(host, `document.querySelectorAll('.combat.coop .hand .card').length`);
    ok(afterHand === beforeHand - 1, `the played card left the hand: ${beforeHand} → ${afterHand} (LIVENESS ONLY — a local mutation passes this too)`);

    // The picture, of the fight that was just measured. Taken BEFORE the tabs
    // close and AFTER the play, so what a reader sees is the state the
    // assertions above ruled on.
    if (shotsDir) {
      mkdirSync(shotsDir, { recursive: true });
      await cdp.send('Page.bringToFront', {}, host.sessionId);
      await wait(500);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, host.sessionId);
      const name = `coop-hand-${mode}-${W}x${H}.png`;
      writeFileSync(join(shotsDir, name), Buffer.from(data, 'base64'));
      console.log(`    shot ${name} — the real two-client fight, ${mode}`);
    }
    await cdp.send('Target.closeTarget', { targetId: host.targetId });
    await cdp.send('Target.closeTarget', { targetId: guest.targetId });
    s.server.close();
  }

  cdp.close(); await dropBrowser();
  if (!ran) { console.error('coop-hand-parity: NOTHING RAN — unknown, not a pass'); process.exit(2); }
  console.log(`\n  BOUNDARY — one shape (${W}x${H}), shipping text size, headless Chromium on one box; the hold is`);
  console.log('  proven ARMED, not readable; the first fight of a seeded run, not a late-run hand; nothing here');
  console.log('  measures the SOLO hand (handlayout/inspecthold) or any other container (axisfit).');
  console.log(`\n  ${fails.length ? `FAIL — ${fails.length} finding(s)` : `PASS — every claim held over ${ran} real two-client fight(s)`}`);
  for (const f of fails) console.log(`    - ${f}`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`coop-hand-parity: ${e.message}`); process.exit(2); });
