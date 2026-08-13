#!/usr/bin/env node
// tools/hudbars.mjs — does the HUD bar's LENGTH actually track the maximum?
//
// Constantine, 2026-08-08: "the size of that bar should scale depending on the
// max total. much like elden ring's hud". That is a claim about how the HUD
// behaves ACROSS maxima, and no reading at one maximum can support it — every
// scale, and every constant, looks identical at a single value. So this tool
// exists to vary the maximum and watch the bar.
//
// ---------------------------------------------------------------------------
// WHAT IT ASSERTS
//
//   A1 TRACKING     Sweep real maxima through the run's own maxHp and require
//                   the rendered trough width to be STRICTLY MONOTONE in max.
//                   This is the assertion that catches a constant-width bar.
//   A2 PROPORTION   Require width/max to be constant across the sweep (linear
//                   scale) within tolerance — the shape claim, not just the
//                   direction. Reported per pair so a curve is legible as a
//                   curve rather than as a failure.
//   A3 CEILING      A bar at its own domain maximum must fill its derived cell
//                   (his "max size filling up the full top row"), and no bar may
//                   ever exceed it. The cell is MEASURED off the bar's own
//                   containing block, never typed — since the hybrid HUD
//                   (2026-08-13) that is the .restrack beside the label plate,
//                   and two banded bars on one line do not share a track.
//   A4 NO COLLISION The visible label must fit the box that holds it, at every
//                   max in the sweep. Hybrid units: the plate must not clip its
//                   own text (the reserve or a degradation stage is missing).
//                   Strip/legacy bars: the label must not outgrow its trough —
//                   Marina rendered maxMana = 2 at 48 px and watched "MANA"
//                   collide with "1/2"; this is that finding, mechanised.
//   A5 TAP FLOOR    Law 4 — the two top-row buttons stay at or above the floor.
//                   The bars must not push them under it.
//   A6 FLOOR MARK   Every bar the minimum-width clause caught must carry the
//                   broken-axis mark. A floored bar is no longer to scale, and
//                   one that does not say so is the lie the clause exists to
//                   prevent.
//
// ---------------------------------------------------------------------------
// HOW THE KNOWN-BAD ENTERS — and it enters by the real door, with no fixture.
//
// The house's amended instrument rule (development.md): a known-bad handed to
// the function under test, downstream of the load and render the real input
// travels through, exercises the half that was never in doubt. Eleven
// instruments in one session ran dead and printed a plausible number.
//
// THIS TOOL'S KNOWN-BAD IS THE SHIPPED TREE. Before this change, the combat
// health bar was `.topbar .hpbar { width: 19rem }` — A CONSTANT. It rendered
// the same length at 72 max HP and at 250. That is precisely the defect A1
// asserts against, it is real code that really shipped, and it needs nothing
// authored to produce it:
//
//     node tools/hudbars.mjs --tree <a checkout at dev=08e184a>   → A1 RED
//     node tools/hudbars.mjs --tree <this branch>                 → A1 GREEN
//
// THE HYBRID ASSERTIONS WERE ALSO WATCHED RED BY THE SAME DOOR (2026-08-13,
// each planted as a scratch stylesheet edit, rebuilt, swept via ?shotMaxHp,
// then reverted — never committed):
//   typed-constant trough (width: 40% !important)  → A1 "2 distinct widths",
//       A2 78.8 % spread, A3 30.84 px of a 77.11 px cell — all RED.
//   over-wide plate reserve (min-width: 30ch)      → A4 "plate clips its own
//       label" RED on every bar, both shapes.
//   the un-reserved plate itself (commit d2e61aa)  → A1 RED: max 88 -> 120
//       shrank the bar 92.91 -> 88.53 px, because the label's digit count was
//       moving the trough's track. That observation is why the plate reserve
//       exists (resbars.js) and why A2 deliberately reads RAW px, never
//       cell-normalised — normalising would have hidden exactly this defect.
//
// The maximum enters through `?shotMaxHp=`, which writes `run.maxHp` — the same
// field a curse (engine/actions.js:549) and an armour mod (model/loadout.js
// runMods) write. It is not injected into the renderer. Every stage the real
// number travels — run creation, combat entity creation, the paced snapshot,
// the resource table, the plan, the DOM — runs exactly as it does in play.
//
// AND THE DENOMINATOR IS GUARDED ON EVERY RUN, not behind a flag. A1 fails if
// the sweep produced fewer than MIN_POINTS distinct rendered widths: measuring
// one maximum N times is how a sweep goes dead, and this repo has done exactly
// that (a sweep that measured one seed 24 times, 2026-08-08). The DOOR line at
// the foot of every run says where the input entered.
//
//   node tools/hudbars.mjs                  → the sweep, human table
//   node tools/hudbars.mjs --falsifier      → Law 0: one reader + one row, zero UI
//   node tools/hudbars.mjs --scales         → what a curved transpose would do
//   node tools/hudbars.mjs --model-scale    → every enemy, if the under-model
//                                             surface scaled by max
//   node tools/hudbars.mjs --tree DIR       → measure another checkout
//   node tools/hudbars.mjs --json out.json
//
// BOUNDARY, printed on every run including the clean ones: headless Chromium on
// Linux, dist/AshenSpire.html, the shapes listed below, the reaver class, one
// seed. It says nothing about Windows, about a real finger, about whether the
// LINEAR scale is the one he meant, or about any screen that is not combat.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { printArtifactProvenance } from './artifact-provenance.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const TREE = resolve(val('--tree', ROOT));
const SHAPES = flag('--desktop') ? [[320, 640], [390, 844], [1200, 730]] : [[320, 640], [390, 844]];
const JSON_OUT = val('--json', null);
const SHOTS_OUT = val('--shots', null);

// THE SWEEP. Real maxima, and the range is not invented: 40 is a cursed reaver
// (actions.js loseMaxHpPct halves it), 72/78/84 are the three shipped classes,
// 88 is a reaver in the one outfit that carries `self.maxHp=+4`, and 120/160 sit
// above the domain to prove the ceiling clamps rather than overflows.
const SWEEP = [40, 56, 72, 78, 84, 88, 120, 160];
const MIN_POINTS = 5; // distinct rendered widths required before this reports

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BROWSERS = [process.env.CHROME, '/usr/bin/chromium', '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser'].filter(Boolean);

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(`${m.error.message} (${m.error.code})`)); else res(m.result);
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
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-400)}`)), 20000);
  });
}

async function open() {
  const browser = BROWSERS.find((p) => existsSync(p));
  if (!browser) throw new Error('no Chromium/Chrome found — set CHROME=<path>');
  const profile = mkdtempSync(join(tmpdir(), 'hudbars-'));
  const { child, wsUrl } = await launchChrome(browser, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (x, what, ms = 20000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return true; await wait(120); }
    throw new Error(`timed out waiting for ${what}`);
  };
  // The profile is removed on close: four instruments filled this box in one
  // session by leaving theirs behind.
  return { cdp, S, ev, until, close: () => { cdp.close(); child.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ } } };
}

// THE READ. Every number is rendered — getBoundingClientRect for device px,
// offsetWidth for local px. The TRACK is measured off the host element rather
// than computed from the row minus the buttons, because computing it here would
// be a second copy of the layout's own arithmetic and would agree with a broken
// layout (Law 0 clause 4: one home per fact).
const READ = `(() => {
  const n = (v) => Math.round(v * 100) / 100;
  const host = document.querySelector('.combat .topbar .resbars-host');
  // THE PRE-CHANGE TREE HAS NO HOST. That is not an error and must not be
  // silently treated as zero bars: it is the known-bad shape, and the tool
  // falls back to the bar the old HUD actually drew so A1 can go RED on it
  // rather than green-on-nothing.
  const legacy = !host;
  const track = host || document.querySelector('.combat .topbar');
  const bars = [...document.querySelectorAll(
    legacy ? '.combat .topbar .hpbar' : '.combat .topbar .resbar'
  )].map((el) => {
    // THE BAR'S OWN TRACK. Since the hybrid HUD (2026-08-13) the trough lives
    // in a .restrack cell beside its label plate, and two banded bars on one
    // line do not share a track — so the track is the bar's own CONTAINING
    // BLOCK, measured per bar, never the host. On the pre-hybrid structures
    // the parent is the stack/host and this reads the same width it always did.
    const cellW = el.parentElement ? el.parentElement.getBoundingClientRect().width : 0;
    // THE LABEL SUBJECT differs by structure: hybrid units carry the label on
    // a .resplate beside the trough (overflow = the plate or unit clipping
    // its own visible text); strip/legacy bars carry it inside the trough
    // (overflow = label wider than trough).
    const unit = el.closest('.resunit');
    const plate = unit && unit.querySelector('.resplate');
    const labelHost = plate || el.querySelector('.label') || null;
    const vis = labelHost
      ? [...labelHost.querySelectorAll(':scope > span')].filter((s) => s.offsetParent !== null || s.offsetWidth > 0)
      : [];
    const labelW = vis.length ? Math.max(...vis.map((s) => s.getBoundingClientRect().width))
      : (labelHost ? labelHost.scrollWidth : 0);
    const overflow = plate
      ? (plate.scrollWidth > plate.clientWidth + 0.5 || unit.scrollWidth > unit.clientWidth + 0.5)
      : n(labelW) > n(el.getBoundingClientRect().width) + 0.5;
    return {
      id: el.dataset.res || 'hp(legacy)',
      w: n(el.getBoundingClientRect().width),
      wLocal: n(el.offsetWidth),
      cellW: n(cellW),
      plated: !!plate,
      visibleLabel: vis.length ? vis.map((s) => s.textContent.trim()).join(' ') : '',
      cur: el.dataset.cur != null ? Number(el.dataset.cur) : null,
      max: el.dataset.max != null ? Number(el.dataset.max) : null,
      floored: el.dataset.floored === '1',
      dashed: getComputedStyle(el).borderTopStyle === 'dashed',
      labelW: n(labelW),
      overflow,
    };
  });
  const btns = [...document.querySelectorAll('.combat .topbar .topbar-btn')]
    .map((b) => n(b.getBoundingClientRect().height));
  // The floor, MEASURED off a probe element — never parsed out of the calc().
  const p = document.createElement('div');
  p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;padding:0;border:0;height:var(--tap-floor)';
  document.body.appendChild(p);
  const floor = n(p.getBoundingClientRect().height);
  p.remove();
  return {
    legacy,
    trackW: n(track ? track.getBoundingClientRect().width : 0),
    bars, btns, floor,
    docOverflowX: n(document.documentElement.scrollWidth - document.documentElement.clientWidth),
  };
})()`;

const fails = [];
const notes = [];
const fail = (id, msg) => { fails.push(`${id}  ${msg}`); };

function seatIdentityFailures(seats, expectedName = 'Wren') {
  const errors = [];
  for (const seat of seats) {
    if (!seat.identity) {
      errors.push(`seat "${seat.rawText || '?'}" has no .coop-seat-name identity span`);
      continue;
    }
    if (seat.line.left < -0.5 || seat.line.right > seat.viewport + 0.5
      || seat.identity.left < -0.5 || seat.identity.right > seat.viewport + 0.5) {
      errors.push(`seat "${seat.text}" leaves the viewport (${seat.line.left.toFixed(1)}..${seat.line.right.toFixed(1)} of ${seat.viewport})`);
    }
  }
  if (!seats.some((seat) => seat.identity && seat.text.includes(expectedName))) {
    errors.push(`${expectedName}'s seat identity is absent`);
  }
  return errors;
}

// Negative control for A8: deleting the authored identity span must make both
// the per-seat and expected-name clauses fail. This prevents a future optional
// lookup from turning an absent identity into a green containment reading.
function proveMissingSeatIdentityFails() {
  const mutant = [{
    line: { left: 0, right: 100 }, identity: null, text: '', rawText: 'Wren (you)', viewport: 320,
  }];
  const errors = seatIdentityFailures(mutant);
  if (!errors.some((error) => error.includes('identity span'))
    || !errors.some((error) => error.includes("Wren's seat identity is absent"))) {
    throw new Error('A8 negative control is dead: deleting the co-op identity did not fail');
  }
}

function compactResourceIdentityFailures(label, expected, glyph, name) {
  const errors = [];
  // Identity may be carried by the glyph OR the row's name — the approved
  // hybrid's full plate reads "MP 2/2" with no glyph (the owner pixels), and
  // the narrow degradations read "◆ 2/2" / "◆". Either mark identifies the
  // pool; NEITHER is anonymous numbers, which is what this fails on.
  if (!label.includes(glyph) && !(name && label.includes(name))) {
    errors.push(`neither glyph "${glyph}" nor name "${name || ''}" is present — the pool is anonymous`);
  }
  const number = `${expected.cur}/${expected.max}`;
  if (!label.includes(number)) errors.push(`value is not authoritative ${number}`);
  return errors;
}

// Negative control for A7: an old numeric expectation must fail even when the
// glyph and current value still look plausible.
function proveManaNumericDriftFails() {
  const errors = compactResourceIdentityFailures('◆ 20/40', { cur: 20, max: 42 }, '◆', 'MP');
  if (!errors.some((error) => error.includes('20/42'))) {
    throw new Error('A7 negative control is dead: a stale Mana maximum did not fail');
  }
}

// Second negative control for A7: an anonymous label — right numbers, no glyph
// and no name — must fail. This is what stops the name-or-glyph widening from
// quietly becoming "any text with the right digits passes".
function proveAnonymousLabelFails() {
  const errors = compactResourceIdentityFailures('1/2', { cur: 1, max: 2 }, '◆', 'MP');
  if (!errors.some((error) => error.includes('anonymous'))) {
    throw new Error('A7 negative control is dead: an anonymous pool label did not fail');
  }
}

async function sweepShape(b, href, [w, h]) {
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, b.S);
  const rows = [];
  for (const max of SWEEP) {
    await b.cdp.send('Page.navigate', { url: `${href}?shot=combat&shotMaxHp=${max}` }, b.S);
    await b.until(`!!document.querySelector('.combat .topbar')`, `combat topbar @ max ${max}`);
    await wait(320); // the fill has a 200ms width transition; let it land
    const r = await b.ev(READ);
    rows.push({ max, ...r });
  }
  return rows;
}

async function captureLayoutPage(b, href, [w, h], state, tree) {
  const outDir = resolve(SHOTS_OUT);
  mkdirSync(outDir, { recursive: true });
  const query = state === 'solo' ? 'shot=combat&shotMana=1' : 'shot=coop';
  const ready = state === 'solo'
    ? `!!document.querySelector('.combat .topbar .resbar[data-res="mana"]')`
    : `document.querySelectorAll('.combat.coop .coop-seat-name').length === 2`;
  await b.cdp.send('Page.navigate', { url: `${href}?${query}` }, b.S);
  await b.until(ready, `${tree} ${state} @ ${w}x${h}`);
  await wait(320);

  if (state === 'solo') {
    const compact = await b.ev(`(() => {
      const bar = document.querySelector('.combat .topbar .resbar[data-res="mana"]');
      // The label host moved with the hybrid: plate beside the trough on the
      // main HUD, inside it on older structures. Read whichever exists.
      const unit = bar.closest('.resunit');
      const labelHost = (unit && unit.querySelector('.resplate')) || bar.querySelector('.label') || bar;
      const visible = [...labelHost.querySelectorAll(':scope > span')].find((s) => getComputedStyle(s).display !== 'none');
      const player = window.__combat && window.__combat.player;
      return {
        label: visible ? visible.textContent.trim() : '',
        expected: player ? { cur: player.mana, max: player.maxMana } : null,
      };
    })()`);
    if (!compact.expected) {
      fail('A7', `${tree} ${w}x${h}: posed combat entity is absent; Mana identity authority is unknown`);
    } else {
      const errors = compactResourceIdentityFailures(compact.label, compact.expected, '◆', 'MP');
      if (errors.length) {
        fail('A7', `${tree} ${w}x${h}: compact Mana identity is "${compact.label}"; ${errors.join(', ')}`);
      } else {
        notes.push(`A7 ${tree} ${w}x${h}: MANA IDENTITY ok — visible compact label is "${compact.label}", matching the posed combat entity`);
      }
    }
  } else {
    const seats = await b.ev(`(() => {
      const n = (r) => ({ left: r.left, right: r.right, width: r.width });
      return [...document.querySelectorAll('.combat.coop .coop-seat')].map((seat) => {
        const line = seat.querySelector('.coop-seat-name');
        const identity = line && line.querySelector(':scope > span');
        return {
          seat: n(seat.getBoundingClientRect()),
          line: n(line.getBoundingClientRect()),
          identity: identity ? n(identity.getBoundingClientRect()) : null,
          text: identity ? identity.textContent.trim() : '',
          rawText: line.textContent.trim(),
          viewport: innerWidth,
        };
      });
    })()`);
    for (const error of seatIdentityFailures(seats)) fail('A8', `${tree} ${w}x${h}: ${error}`);
    if (!fails.some((f) => f.startsWith('A8') && f.includes(`${tree} ${w}x${h}`))) {
      notes.push(`A8 ${tree} ${w}x${h}: SEAT CONTAINMENT ok — Wren and both seat lines stay inside the viewport`);
    }

    // A seat label fitting is weaker than the battlefield fitting. At 320 px
    // the old side-by-side field kept both names in view while its min-content
    // width pushed the last enemy off the right edge. Cards are deliberately a
    // horizontal strip, so they pass when every whole card has a feasible
    // scroll position; fighters have no horizontal scroller and must fit now.
    const battlefield = await b.ev(`(() => {
      const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
      const hand = document.querySelector('.combat.coop .hand');
      const field = document.querySelector('.combat.coop .field');
      const hr = rect(hand);
      const fr = rect(field);
      const handScale = hand.clientWidth ? hr.width / hand.clientWidth : 1;
      const fieldScale = field.clientHeight ? fr.height / field.clientHeight : 1;
      const maxScroll = Math.max(0, hand.scrollWidth - hand.clientWidth) * handScale;
      const cards = [...hand.querySelectorAll('.card')].map((card) => {
        const r = rect(card);
        const left = r.left - hr.left + hand.scrollLeft * handScale;
        const right = r.right - hr.left + hand.scrollLeft * handScale;
        const lo = Math.max(0, right - hr.width);
        const hi = Math.min(maxScroll, left);
        return { name: card.querySelector('.cname')?.textContent.trim() || '?', width: r.width, left, right, reachable: r.width <= hr.width + 0.5 && lo <= hi + 0.5 };
      });
      const maxFieldScroll = Math.max(0, field.scrollHeight - field.clientHeight) * fieldScale;
      const fighters = [...document.querySelectorAll('.combat.coop .field .combatant')].map((el) => {
        const r = rect(el);
        const top = r.top - fr.top + field.scrollTop * fieldScale;
        const bottom = r.bottom - fr.top + field.scrollTop * fieldScale;
        const lo = Math.max(0, bottom - fr.height);
        const hi = Math.min(maxFieldScroll, top);
        return {
          kind: el.classList.contains('player') ? 'player' : 'enemy',
          name: el.querySelector('.coop-seat-player, .nm')?.textContent.trim() || '?',
          ...r, verticalReachable: r.height <= fr.height + 0.5 && lo <= hi + 0.5,
        };
      });
      return { viewport: innerWidth, field: { ...fr, clientHeight: field.clientHeight, scrollHeight: field.scrollHeight }, hand: { ...hr, clientWidth: hand.clientWidth, scrollWidth: hand.scrollWidth }, cards, fighters };
    })()`);
    const cropped = battlefield.fighters.filter((f) => f.left < -0.5 || f.right > battlefield.viewport + 0.5);
    const verticallyUnreachable = battlefield.fighters.filter((f) => !f.verticalReachable);
    const unreachableCards = battlefield.cards.filter((card) => !card.reachable);
    const handCropped = battlefield.hand.left < -0.5 || battlefield.hand.right > battlefield.viewport + 0.5;
    if (cropped.length || verticallyUnreachable.length || unreachableCards.length || handCropped) {
      fail('A9', `${tree} ${w}x${h}: BATTLEFIELD HORIZONTAL CROP — viewport ${battlefield.viewport}px; `
        + `${cropped.map((f) => `${f.kind} ${f.name} ${f.left.toFixed(1)}..${f.right.toFixed(1)}`).join(', ') || 'fighters fit'}; `
        + `${verticallyUnreachable.length ? `vertically unreachable ${verticallyUnreachable.map((f) => `${f.kind} ${f.name}`).join(', ')}` : `field vertical reach ${battlefield.field.clientHeight}/${battlefield.field.scrollHeight}`}; `
        + `hand ${battlefield.hand.left.toFixed(1)}..${battlefield.hand.right.toFixed(1)} client/scroll ${battlefield.hand.clientWidth}/${battlefield.hand.scrollWidth}; `
        + `${unreachableCards.length ? `unreachable cards ${unreachableCards.map((c) => c.name).join(', ')}` : 'all cards have a whole-card scroll position'}`);
    } else {
      notes.push(`A9 ${tree} ${w}x${h}: BATTLEFIELD REACH ok — ${battlefield.fighters.length} fighters fit horizontally and are vertically reachable; ${battlefield.cards.length} cards each have a whole-card scroll position`);
    }

    // Leave plus both fixed charge controls are always visible; utility
    // consumables may add more controls and must obey the same floor.
    // Read the floor from the same custom property they must obey; a typed 44
    // here would disagree as soon as UI zoom changes.
    const actions = await b.ev(`(() => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;height:var(--tap-floor)';
      document.body.appendChild(probe);
      const floor = probe.getBoundingClientRect().height;
      probe.remove();
      return { floor, controls: [...document.querySelectorAll('.combat.coop .coop-leave, .combat.coop .coop-flask')].map((el) => ({
        text: el.textContent.trim(), height: el.getBoundingClientRect().height,
      })) };
    })()`);
    const undersized = actions.controls.filter((control) => control.height < actions.floor - 0.5);
    const names = actions.controls.map((control) => control.text);
    const required = ['Leave', 'Crimson Flask', 'Azure Flask'].filter((name) => !names.some((text) => text.includes(name)));
    if (required.length || undersized.length) {
      fail('A10', `${tree} ${w}x${h}: CO-OP ACTION FLOOR — missing ${required.join(', ') || 'none'} or below ${actions.floor}px; `
        + `${actions.controls.map((control) => `${control.text}=${control.height.toFixed(1)}`).join(', ') || 'no controls'}`);
    } else {
      notes.push(`A10 ${tree} ${w}x${h}: CO-OP ACTION FLOOR ok — Leave, Crimson and Azure are at/above ${actions.floor}px`);
    }
  }

  const shot = await b.cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, b.S);
  const out = join(outDir, `${tree}-${state}-${w}x${h}.png`);
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`    shot   ${out}`);
}

function judge(shape, rows) {
  const tag = `${shape[0]}x${shape[1]}`;
  const hp = rows.map((r) => ({ max: r.max, bar: r.bars.find((x) => x.id === 'hp' || x.id === 'hp(legacy)') }))
    .filter((r) => r.bar);
  if (hp.length < rows.length) {
    fail('A0', `${tag}: ${rows.length - hp.length} of ${rows.length} renders produced NO health bar — nothing below is a measurement`);
    return;
  }
  const widths = hp.map((r) => r.bar.w);
  const distinct = new Set(widths).size;

  // ---- the denominator guard: a sweep that measured one thing N times -------
  if (distinct < MIN_POINTS) {
    fail('A1', `${tag}: TRACKING — ${SWEEP.length} maxima from ${SWEEP[0]} to ${SWEEP[SWEEP.length - 1]} produced only ${distinct} distinct rendered widths `
      + `(${widths.join(', ')} px). The bar's length is not a function of the maximum. `
      + (rows[0].legacy ? 'This tree has no .resbars-host — it is the pre-change HUD, whose health bar is a typed constant.' : ''));
  } else {
    notes.push(`A1 ${tag}: TRACKING ok — ${distinct} distinct widths across ${SWEEP.length} maxima`);
  }

  // ---- A1 strict monotonicity below the domain ceiling ----------------------
  // Above the ceiling the bar CLAMPS, so monotonicity is only required while the
  // asked-for length is under 100 %. Stated rather than quietly skipped.
  // "Clamped" is judged against the bar's OWN cell (r.bar.cellW) — since the
  // hybrid the trough's containing block is a cell beside the label plate, and
  // the host width would misread every clamped point as unclamped.
  let prev = null;
  for (const r of hp) {
    const clamped = Math.abs(r.bar.w - r.bar.cellW) < 0.5;
    if (prev && !clamped && r.bar.w <= prev.bar.w) {
      fail('A1', `${tag}: max ${prev.max} -> ${r.max} did not lengthen the bar (${prev.bar.w} -> ${r.bar.w} px)`);
    }
    if (!clamped) prev = r;
  }

  // ---- A2 proportionality (the LINEAR shape claim) --------------------------
  // Raw rendered px per point of max, deliberately NOT normalised by the cell:
  // the claim is about the LENGTH the player sees, and normalising would hide
  // a track that moves under the bar (the digit-reserve defect, observed
  // 2026-08-13: an unreserved plate shrank the bar 92.91 -> 88.53 px across
  // max 88 -> 120). A constant cell is part of what this asserts.
  const unclamped = hp.filter((r) => Math.abs(r.bar.w - r.bar.cellW) > 0.5);
  if (unclamped.length >= 2) {
    const ratios = unclamped.map((r) => r.bar.w / r.max);
    const lo = Math.min(...ratios), hi = Math.max(...ratios);
    const spread = (hi - lo) / hi;
    if (spread > 0.03) {
      fail('A2', `${tag}: PROPORTION — px-per-point ranges ${lo.toFixed(3)}..${hi.toFixed(3)} (${(spread * 100).toFixed(1)} % spread). `
        + `A LINEAR transpose scale is a constant ratio; this is not one. If the scale was deliberately changed to a curve, this assertion is what has to change with it.`);
    } else {
      notes.push(`A2 ${tag}: PROPORTION ok — linear at ${((lo + hi) / 2).toFixed(3)} px per point of max (spread ${(spread * 100).toFixed(1)} %)`);
    }
  } else {
    fail('A2', `${tag}: PROPORTION — only ${unclamped.length} unclamped point(s); the sweep never sat below the ceiling long enough to have a shape`);
  }

  // ---- A3 ceiling: fills its own cell at domain max, never exceeds it -------
  // The cell is the bar's containing block — the whole row pre-hybrid, the
  // derived track beside the plate since. Both claims survive: never outside
  // the container (Law 2), and a maxed stat fills what the layout dealt it.
  for (const r of hp) {
    if (r.bar.w > r.bar.cellW + 0.5) {
      fail('A3', `${tag}: max ${r.max} rendered ${r.bar.w} px in its ${r.bar.cellW} px cell — a bar outside its own container (Law 2)`);
    }
  }
  const top = hp[hp.length - 1];
  if (Math.abs(top.bar.w - top.bar.cellW) > 1.0) {
    fail('A3', `${tag}: at max ${top.max} (above the derived domain) the bar is ${top.bar.w} px of its ${top.bar.cellW} px cell — `
      + `"the max size filling up the full top row" is not satisfied`);
  } else {
    notes.push(`A3 ${tag}: CEILING ok — a maxed stat fills its derived ${top.bar.cellW} px cell exactly`);
  }

  // ---- A4 label never collides with its own bar -----------------------------
  // Two structures, one claim: the visible label variant must fit the box that
  // holds it. Hybrid units: the plate/unit must not clip its text. Strip and
  // legacy bars: the label must not be wider than its trough.
  for (const r of rows) {
    for (const bar of r.bars) {
      if (bar.overflow) {
        fail('A4', bar.plated
          ? `${tag}: at max ${r.max} the "${bar.id}" plate clips its own label ("${bar.visibleLabel}", ${bar.labelW} px) — the degradation stage (or its reserve) for this width is missing.`
          : `${tag}: at max ${r.max} the "${bar.id}" label is ${bar.labelW} px inside a ${bar.w} px trough — it collides with itself. `
            + `The degradation stage for this width is missing.`);
      }
    }
  }
  if (!fails.some((f) => f.startsWith('A4'))) notes.push(`A4 ${tag}: NO COLLISION ok — ${rows.reduce((a, r) => a + r.bars.length, 0)} bars measured, none overflowing`);

  // ---- A5 tap floor ---------------------------------------------------------
  for (const r of rows) {
    if (!r.btns.length) { fail('A5', `${tag}: at max ${r.max} the top row has NO buttons — the armament and menu buttons he placed there are gone`); continue; }
    const worst = Math.min(...r.btns);
    if (worst < r.floor - 0.5) fail('A5', `${tag}: at max ${r.max} a top-row button is ${worst} px against a ${r.floor} px floor (Law 4)`);
  }
  if (!fails.some((f) => f.startsWith('A5'))) notes.push(`A5 ${tag}: TAP FLOOR ok — ${rows[0].btns.length} top-row buttons at/above ${rows[0].floor} px`);

  // ---- A6 a floored bar wears the broken-axis mark --------------------------
  for (const r of rows) {
    for (const bar of r.bars) {
      if (bar.floored && !bar.dashed) {
        fail('A6', `${tag}: at max ${r.max} the "${bar.id}" bar is at its minimum width but is drawn solid — a bar that has stopped being to scale must say so`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// --falsifier — LAW 0's TEST FOR THIS FEATURE, run rather than asserted.
//
// The claim: a resource that exists on the combat entity becomes a bar for ONE
// READER plus ONE ROW, and ZERO UI CODE. Not "just a row" — the reader is an
// engine change and Law 0 clause 2 says so; the half that is genuinely free is
// the UI, and that is the half this measures.
//
// It edits the two real source files, REBUILDS THE BUNDLE, renders, and looks
// for a third bar. The known-bad enters by the door content enters. `energy` is
// used because it is a real resource with a real current and max on the player
// (state.js: energy / energyMax) that has no bar today, so nothing is faked.
//
// Restores both files in a finally, and prints the diff it made either way.
async function runFalsifier(href) {
  const RES_MODEL = resolve(TREE, 'src/model/resources.js');
  const RES_DATA = resolve(TREE, 'src/content/resources.js');
  const before = { model: readFileSync(RES_MODEL, 'utf8'), data: readFileSync(RES_DATA, 'utf8') };
  const READER = `  energy: Object.freeze({
    read: (view, entity) => {
      const max = entity && entity.energyMax;
      if (!Number.isFinite(max) || max <= 0) return null;
      return { cur: (view && view.energy) != null ? view.energy : entity.energy, max };
    },
    domain: () => 5,
  }),
`;
  const ROW = `  {
    id: 'energy',
    name: 'ENERGY',
    glyph: '◆',
    tint: 'var(--gold)',
    weight: 'normal',
    order: 50,
    surfaces: ['main'],
    source: 'energy',
  },
`;
  let b = null;
  try {
    writeFileSync(RES_MODEL, before.model.replace('export const RESOURCE_SOURCES = Object.freeze({\n', `export const RESOURCE_SOURCES = Object.freeze({\n${READER}`));
    writeFileSync(RES_DATA, before.data.replace('export const resources = [\n', `export const resources = [\n${ROW}`));
    console.log('\n  FALSIFIER — added 1 reader (engine) + 1 row (data). ZERO UI files touched.');
    console.log(`    edited: ${['src/model/resources.js', 'src/content/resources.js'].join(', ')}`);
    const built = spawn(process.execPath, [resolve(TREE, 'tools/launch.mjs'), '--build-only'], { cwd: TREE, stdio: 'ignore' });
    await new Promise((res, rej) => { built.on('exit', (c) => (c === 0 ? res() : rej(new Error(`build failed (${c})`)))); built.on('error', rej); });
    b = await open();
    await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, b.S);
    await b.cdp.send('Page.navigate', { url: `${href}?shot=combat` }, b.S);
    await b.until(`!!document.querySelector('.combat .topbar .resbar')`, 'combat');
    await wait(400);
    const bars = await b.ev(`JSON.stringify([...document.querySelectorAll('.combat .topbar .resbar')].map((e) => ({ id: e.dataset.res, w: Math.round(e.getBoundingClientRect().width * 100) / 100, cur: e.dataset.cur, max: e.dataset.max })))`);
    const parsed = JSON.parse(bars);
    console.log(`    rendered bars: ${parsed.map((x) => `${x.id} ${x.cur}/${x.max} @ ${x.w}px`).join('  ·  ')}`);
    const got = parsed.find((x) => x.id === 'energy');
    if (!got) {
      console.log('\n    FALSIFIED — the row was added and NO bar appeared. Law 0 clause 1 is not satisfied by this design.');
      return 1;
    }
    console.log(`\n    PASSES — an ENERGY bar appeared at ${got.w} px reading ${got.cur}/${got.max}, from a reader and a row.
    No file under src/ui/ was edited. The renderer, the stylesheet and the combat
    screen are byte-identical to the shipped ones. THE ENGINE COST IS REAL AND IS
    NOT HIDDEN: the reader is 7 lines in model/resources.js and it is why this
    report does not say stamina is "just a row".`);
    return 0;
  } finally {
    if (b) b.close();
    writeFileSync(RES_MODEL, before.model);
    writeFileSync(RES_DATA, before.data);
    const rebuilt = spawn(process.execPath, [resolve(TREE, 'tools/launch.mjs'), '--build-only'], { cwd: TREE, stdio: 'ignore' });
    await new Promise((res) => rebuilt.on('exit', res));
    console.log('    (both files and the bundle restored)');
  }
}

// ---------------------------------------------------------------------------
// --scales — WHAT CHANGES IF HE ANSWERS "CURVED".
// Printed from the tree's OWN resourceScale(), plus the two candidates, so the
// table in model/resources.js cannot drift from the function it describes.
async function printScales(trackPx) {
  const { resourceScale } = await import(pathToFileURL(resolve(TREE, 'src/model/resources.js')).href);
  const CANDIDATES = { 'linear  x': (x) => x, 'sqrt    √x': Math.sqrt, 'log     ln(1+x)': Math.log1p };
  const DOMAIN = 88; // the derived player-health ceiling in this tree
  const POINTS = [2, 8, 40, 56, 72, 78, 84, 88];
  console.log(`\n  TRANSPOSE SCALE — track ${trackPx} px, domain ${DOMAIN} (derived player max HP)\n`);
  console.log('    max   ' + Object.keys(CANDIDATES).map((k) => k.padStart(16)).join(''));
  for (const m of POINTS) {
    const cells = Object.values(CANDIDATES).map((f) => `${(Math.min(1, f(m) / f(DOMAIN)) * trackPx).toFixed(1)} px`.padStart(16));
    console.log(`    ${String(m).padStart(3)}   ${cells.join('')}`);
  }
  const inTree = POINTS.map((m) => (Math.min(1, resourceScale(m) / resourceScale(DOMAIN)) * trackPx).toFixed(1));
  console.log(`\n    THE TREE'S OWN resourceScale() renders: ${inTree.join(', ')} px`);
  console.log(`    A curve COMPRESSES the low end upward. Switching is ONE line — the return in
    src/model/resources.js resourceScale(). Nothing else moves: the layout, the
    floor, the label degradation and every assertion here are scale-agnostic,
    EXCEPT hudbars A2, which asserts a constant px-per-point and is the
    assertion that must change with the scale rather than be relaxed.`);
}

// --model-scale — every enemy, if the under-model surface scaled by max.
// The number behind `balance.ui.hudBars.model.scaleByMax: false`, so that
// default is a measurement and not a preference.
async function printModelScale() {
  const { contentBundle } = await import(pathToFileURL(resolve(TREE, 'src/content/index.js')).href);
  const { createRegistries } = await import(pathToFileURL(resolve(TREE, 'src/model/registries.js')).href);
  const { resourceDomains, resourceScale } = await import(pathToFileURL(resolve(TREE, 'src/model/resources.js')).href);
  const reg = createRegistries(contentBundle);
  const d = resourceDomains(reg).model;
  // The under-model track at 390x844: `.combatant .meters` is 9.4rem on narrow.
  // MEASURED in the sweep above and repeated here rather than typed; run the
  // main sweep for the rendered number.
  const TRACK = 84.6;
  const FLOOR = 16;
  console.log(`\n  UNDER-MODEL SURFACE, IF scaleByMax WERE ON — track ${TRACK} px (measured at 390x844), floor ${FLOOR} px\n`);
  console.log('    enemy                        hp   hp bar    poise   poise bar   floored');
  let flooredCount = 0, n = 0;
  for (const e of reg.enemies.all()) {
    const hp = Array.isArray(e.hp) ? e.hp[1] : e.hp;
    const hpW = Math.max(FLOOR, (resourceScale(hp) / resourceScale(d.hp)) * TRACK);
    const pW = e.poiseMax ? Math.max(FLOOR, (resourceScale(e.poiseMax) / resourceScale(d.poise)) * TRACK) : 0;
    const fl = [hpW, pW].filter((w) => w > 0 && w <= FLOOR + 0.01).length;
    flooredCount += fl; n += e.poiseMax ? 2 : 1;
    console.log(`    ${String(e.id).padEnd(24)} ${String(hp).padStart(5)}   ${hpW.toFixed(1).padStart(6)}   ${String(e.poiseMax || '—').padStart(6)}   ${(pW ? pW.toFixed(1) : '—').padStart(9)}   ${fl ? `${fl} at floor` : ''}`);
  }
  console.log(`\n    ${flooredCount} of ${n} bars would sit ON the floor — ${((flooredCount / n) * 100).toFixed(0)} %.
    A scale most of whose values are pinned to its minimum is not a scale, which
    is why balance.ui.hudBars.model.scaleByMax ships false. It is a one-word data
    edit if he wants it, and the main HUD is unaffected either way.`);
}

// --floor — WHY 16 px, MEASURED. Renders one bar at a tiny maximum with the
// floor overridden to each candidate, and reports what the fill actually is.
async function printFloor(b, href) {
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, b.S);
  await b.cdp.send('Page.navigate', { url: `${href}?shot=combat&shotMaxHp=2` }, b.S);
  await b.until(`!!document.querySelector('.combat .topbar .resbar')`, 'combat');
  await wait(320);
  console.log('\n  MINIMUM-WIDTH FLOOR — a half-empty bar at max 2, rendered at each candidate\n');
  console.log('    floor px   trough px   fill px   verdict');
  for (const cand of [8, 10, 12, 14, 16, 20, 24, 32]) {
    // THE TRANSITION IS KILLED BEFORE THE READ, and this line is here because
    // the first draft of this flag did not have it. `.bar > .fill` carries
    // `transition: width 200ms`; measuring straight after setting the width
    // read the frame it was LEAVING, and printed a 14 px fill inside a 16 px
    // trough — a plausible number, off by 2x, that made 8 px look survivable.
    // Found by disbelieving the arithmetic, not by the tool complaining.
    await b.ev(`(() => {
      const el = document.querySelector('.combat .topbar .resbar');
      el.style.setProperty('--resbar-min', 'calc(${cand}px / var(--ui-zoom, 1))');
      const f = el.querySelector('.fill');
      f.style.transition = 'none';
      f.style.width = '50%';
      return 1;
    })()`);
    await wait(120);
    const r = await b.ev(`(() => {
      const el = document.querySelector('.combat .topbar .resbar');
      const n = (v) => Math.round(v * 100) / 100;
      const f = el.querySelector('.fill');
      return { w: n(el.getBoundingClientRect().width), fill: n(f.getBoundingClientRect().width) };
    })()`);
    // 4 px is the threshold, and it is an EYE call, not a computed one: below
    // it the fill is thinner than the trough's own rounded corner radius and
    // stops reading as a quantity. Freja's call; Sunna holds the veto on
    // whether it reads at all.
    const verdict = r.fill < 4 ? 'fill under 4 px — thinner than the corner radius, reads as noise'
      : r.fill < 6 ? 'marginal' : 'fill legible';
    console.log(`    ${String(cand).padStart(8)}   ${String(r.w).padStart(9)}   ${String(r.fill).padStart(7)}   ${verdict}`);
  }
  console.log(`\n    Read the FILL column, not the trough. The shipped floor is the smallest
    candidate whose half-fill clears 6 px; anything under that is a sliver in a
    box. This flag is the justification for --resbar-min in styles/combat.css,
    and if the number here disagrees with the stylesheet, the stylesheet is
    wrong — this is the measurement and that is a copy of its conclusion.`);
}

// ---------------------------------------------------------------------------
async function main() {
  proveMissingSeatIdentityFails();
  proveManaNumericDriftFails();
  proveAnonymousLabelFails();
  const artifact = resolve(TREE, 'dist/AshenSpire.html');
  if (!existsSync(artifact)) {
    console.error(`hudbars: no dist/AshenSpire.html under ${TREE} — run node tools/launch.mjs --build-only first`);
    process.exit(2);
  }
  console.log('hudbars — does the HUD bar length track the maximum?\n');
  printArtifactProvenance(artifact, TREE);
  const href = pathToFileURL(artifact).href;

  if (flag('--model-scale')) { await printModelScale(); return; }
  if (flag('--falsifier')) { process.exit(await runFalsifier(href)); }

  const b = await open();
  if (flag('--scales') || flag('--floor')) {
    try {
      if (flag('--floor')) await printFloor(b, href);
      if (flag('--scales')) {
        await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, b.S);
        await b.cdp.send('Page.navigate', { url: `${href}?shot=combat` }, b.S);
        await b.until(`!!document.querySelector('.combat .topbar .resbars-host')`, 'combat');
        await wait(300);
        const track = await b.ev(`Math.round(document.querySelector('.combat .topbar .resbars-host').getBoundingClientRect().width * 100) / 100`);
        await printScales(track);
      }
    } finally { b.close(); }
    return;
  }
  const all = {};
  const source = SHOTS_OUT ? await serve({ root: TREE, port: 8317, open: false }) : null;
  try {
    for (const shape of SHAPES) {
      const rows = await sweepShape(b, href, shape);
      all[`${shape[0]}x${shape[1]}`] = rows;
      console.log(`\n  ${shape[0]}x${shape[1]}   track ${rows[0].trackW} px${rows[0].legacy ? '   [LEGACY HUD — no .resbars-host in this tree]' : ''}`);
      console.log('    max    bar px   px/point   bars  label   floored');
      for (const r of rows) {
        const hp = r.bars.find((x) => x.id === 'hp' || x.id === 'hp(legacy)');
        const ratio = hp ? (hp.w / r.max).toFixed(3) : '—';
        console.log(`    ${String(r.max).padStart(4)}   ${String(hp ? hp.w : '—').padStart(6)}   ${String(ratio).padStart(8)}   ${String(r.bars.length).padStart(4)}  `
          + `${String(hp ? hp.labelW : '—').padStart(5)}   ${hp && hp.floored ? 'yes' : 'no'}`);
      }
      judge(shape, rows);
      if (SHOTS_OUT) {
        await captureLayoutPage(b, source.url, shape, 'solo', 'source');
        await captureLayoutPage(b, source.url, shape, 'coop', 'source');
        await captureLayoutPage(b, href, shape, 'solo', 'dist');
        await captureLayoutPage(b, href, shape, 'coop', 'dist');
      }
    }
  } finally {
    b.close();
    if (source) source.server.close();
  }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(all, null, 2));

  console.log('');
  for (const n of notes) console.log(`  ok    ${n}`);
  for (const f of fails) console.log(`  FAIL  ${f}`);
  console.log(`\nDOOR: the maximum entered through ?shotMaxHp=, which writes run.maxHp — the same field a curse
      (engine/actions.js) and an armour mod (model/loadout.js) write. Not injected into the renderer:
      run creation, combat entity creation, the paced snapshot, the resource table, the plan and the
      DOM all ran as they do in play.
KNOWN-BAD: this tool's failing case is the SHIPPED PRE-CHANGE TREE, where the combat health bar was
      \`.topbar .hpbar { width: 19rem }\` — a constant. Run with --tree against a checkout at dev and
      A1 goes red on real code. Nothing was authored to make it fail.
BOUNDARY: headless Chromium on ${process.platform}, dist/AshenSpire.html, ${SHAPES.length} shape(s), the reaver class,
      one seed, Text size M, UI size Auto. Silent about packaged desktop builds, about a real finger, about whether
      LINEAR is the transpose scale he meant, and about every screen that is not combat.`);
  console.log(fails.length ? `\nRESULT: ${fails.length} FAILING` : `\nRESULT: ${notes.length} assertions ok`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`hudbars: ${e.message}`); process.exit(2); });
