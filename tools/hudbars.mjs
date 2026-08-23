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
//   A2 PROPORTION   PER RESOURCE (his word, 2026-08-13: "bar scaling per
//                   resource" — family repo directions.md D19 C6). For EACH
//                   resource with a door — hp via ?shotMaxHp, mana via
//                   ?shotMaxMana, stamina via ?shotMaxStamina — width/max is
//                   constant across that resource's own sweep (linear scale)
//                   within tolerance, over the points that are neither floored
//                   nor above the resource's own derived domain. The at-domain
//                   point is ON the line (max/domain = 100 % exactly) and is
//                   included. A resource with fewer than two usable points at
//                   a shape says so by name; fewer than two at EVERY shape is
//                   red, not silence.
//   A2X CROSS-RES   The NEGATIVE CONTROL the per-resource ruling demands:
//                   (a) two resources standing at different maxes MUST render
//                   different px-per-point — under the dead shared-rate
//                   alternative (Elden Ring's literal read) they must not,
//                   which is exactly why this asserts they DO; and (b) a
//                   resource AT its own derived domain fills its OWN cell —
//                   the clause a shared-scale regression cannot pass even
//                   when the 16 px floor masks (a), because 2/91 of a mana
//                   cell floors while 2/3 of it does not.
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
//   A11 PLAYER VESSEL  D10.4 — "poise (very skinny bar) under the health bar",
//                   and "the hud under the character models should really just
//                   show health and poise" (his words, 2026-08-08; the player
//                   half ruled answered by D17 q5, 2026-08-08, over the mock's
//                   silence). On the default pose: (a) the main HUD carries a
//                   poise bar whose data-max EQUALS the posed combat entity's
//                   own poiseMeter.max (DOM ↔ model, never a typed number),
//                   whose data-cur is 0 — the VALUE has no writer; the vessel
//                   is real-but-empty, and this asserts the emptiness rather
//                   than hiding it — and whose trough renders STRICTLY LOWER
//                   than the hp trough ("very skinny" is a rendered fact, not
//                   a stylesheet intention: the main-surface height rule
//                   outranks .resbar-skinny by specificity, so only a
//                   measurement can claim this). (b) the player's under-model
//                   strip shows EXACTLY hp and poise. (c) THE REFUSAL EDGE:
//                   ?shotMaxPoise=0 removes the vessel — the bar is ABSENT,
//                   not an empty trough, while hp stands. (d) poise's A2 sweep
//                   stands AT its own derived domain and must fill its own
//                   cell there (same clause as A2X (b), poise's copy).
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
// THE PER-RESOURCE MIGRATION WAS ALSO WATCHED RED FIRST (2026-08-14, with the
// D19 C6 ruling; plant a scratch edit to resourceBarPlan, rebuilt, swept by
// ?shotMaxMana/?shotMaxStamina, then reverted — never committed):
//   shared cross-resource rate (every row divided by the surface's LARGEST
//   domain, 91, instead of its own) → mana and stamina floored at 16 px at
//   EVERY point of both sweeps on both shapes (A2 "fewer than two usable
//   points at every shape" ×2, RED); mana AT its own domain rendered 16 px
//   floored of its own cell — 21.78 px at 390x844, 5.81 px at 320x640
//   (A2X (b), RED both shapes); no shape offered an unfloored hp+mana pair
//   (A2X (a) premise dead, RED). And the number that justifies the whole
//   migration: hp STAYED GREEN under that plant — 91 IS the shared max, so
//   the pre-migration hp-only A2 could not see this class at all. 21 failing
//   planted; 18 ok after revert, same door.
//
// A11 WAS WATCHED RED BY BOTH OF ITS DOORS (2026-08-14, with the vessel):
//   the SHIPPED PRE-VESSEL TREE (dev = acb8ffe, real code, nothing authored)
//   → 5 FAILING: no player poiseMeter, model strip [hp] only, both shapes,
//   plus A2 "poise: fewer than two usable points at every shape" — which is
//   what the usableByResource seed below exists for: without it, a tree whose
//   model derives no poise domain skipped the sweep in SILENCE.
//   the shared-rate plant re-run WITH poise aboard (same scratch edit as
//   above, rebuilt, reverted) → 23 FAILING, and the row that matters: poise
//   at its OWN domain 33 rendered 25.42/39.55 px of its cell (A11 (d), RED
//   both shapes) while hp STAYED GREEN — poise's domain (33) differs from the
//   shared max (91), so the vessel's at-domain clause sees exactly the class
//   the hp sweep is structurally blind to. The control lives on the resource
//   whose domain does NOT equal the shared value; keep it there.
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
//   node tools/hudbars.mjs --selftest       → plant each arm's known-bad by the
//                                             real door, require the named red,
//                                             revert, and prove the tree clean
//
// ---------------------------------------------------------------------------
// THE ARMS THAT HAD NO WATCHED RED UNTIL 2026-08-15 — and why --selftest exists.
//
// Everything above records a red somebody watched: A1/A2/A2X/A3 by the typed-
// constant and shared-rate plants, A6 and A6W by the dead-floor plants, A11 by
// the pre-vessel tree. A4 and A5 had NONE. They have asserted green on every run
// of this tool's life, and a green nobody has watched go red is `unknown`, not
// green (development.md, *The instrument rule*) — Vira's doors audit put this
// whole file in the SAME-DOOR column on the strength of the arms that WERE
// watched, which is the neighbour-inheriting-the-green shape, in my own tool.
//
// So --selftest plants each of them, and the plant is a REAL EDIT TO A REAL
// SHIPPED FILE, rebuilt through launch.mjs and re-rendered — the same door the
// stylesheet and the content table enter by. Nothing is handed to judge().
// Each arm restores its file in a finally and rebuilds, then the run ends with a
// CLEAN CONTROL: the unplanted tree must produce zero fails, or a red that never
// goes green is not a measurement either.
//
// AND EACH ARM PRINTS WHAT STAYED GREEN. That is not decoration: the dead-floor
// plant (2026-08-14) went red on two assertions while every other one stayed
// green, and that silence is the whole argument for watching each arm on its
// own rather than trusting a suite's total.
//
// STILL UNWATCHED AFTER THIS ACT — A7, A8, A9, A10, and they are named here
// rather than quietly left, because an instrument that hides its own gaps is the
// thing this whole batch was called to fix:
//   A7 mana identity · A8 co-op seat identity — each HAS a declared negative
//     control (proveManaNumericDriftFails, proveAnonymousLabelFails,
//     proveMissingSeatIdentityFails) and each is DOWNSTREAM by construction: a
//     hand-built object goes straight to the judging function, below the render
//     and the read the real defect would travel through. They are honest about
//     being controls; they are not same-door known-bads.
//   A9 battlefield crop · A10 co-op action floor — NO control of any kind.
// All four run only under --shots, which serves the source tree and writes PNGs,
// so planting them needs the capture path driven from the selftest as well as a
// plant. That is a second act, not a line. Until it is done these four arms are
// `unknown`, not green, and this comment is the debt — not a note in a log
// nobody greps. (Freja, 2026-08-15. The same discipline as flaskSeed's unwaked
// refusal: say the gap in the instrument's own home, do not force a plant that
// would prove the half that was never in doubt.)
//
// BOUNDARY, printed on every run including the clean ones: headless Chromium on
// Linux, dist/AshenSpire.html, the shapes listed below, the reaver class, one
// seed. It says nothing about Windows, about a real finger, about whether the
// LINEAR scale is the one he meant, or about any screen that is not combat.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
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
// 88 is a reaver in the one outfit that carries `self.maxHp=+4`.
const SWEEP_CONTENT = [40, 56, 72, 78, 84, 88];
// THE TWO CEILING POSES USED TO BE TYPED — `120, 160`, with the comment "sit
// above the domain to prove the ceiling clamps rather than overflows". They
// were above the domain when the domain was the derived population (94ish) and
// they are BELOW IT NOW: E9 / #254 made the hp domain a REFERENCE of 500
// (src/content/resources.js HUD_REFERENCE_MAX), and A3's premise — "at max 160,
// above the derived domain" — silently became false. The check went red while
// nothing about the screen was wrong.
//
// So the two ceiling poses are DERIVED from the domain the tree actually has,
// which is what the comment always meant. This is a strengthening, not a
// relaxation: the sweep now reaches the real ceiling (500) and one pose above
// it instead of stopping at a third of the way up. A tree that derives no
// domain (the legacy shape) keeps the old typed pair, because there is nothing
// to derive from and a silent shorter sweep would be worse than a stale one.
const LEGACY_CEILING_POSES = [120, 160];
function sweepFor(domain) {
  if (!Number.isFinite(domain) || domain <= 0) return [...SWEEP_CONTENT, ...LEGACY_CEILING_POSES];
  const ceiling = Math.max(Math.round(domain), SWEEP_CONTENT[SWEEP_CONTENT.length - 1] + 1);
  return [...SWEEP_CONTENT.filter((v) => v < ceiling), ceiling, Math.round(ceiling * 1.25)];
}
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


async function open() {
  const browser = BROWSERS.find((p) => existsSync(p));
  if (!browser) throw new Error('no Chromium/Chrome found — set CHROME=<path>');
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'hudbars-', browser: browser,
    args: ['--allow-file-access-from-files', '--disable-background-timer-throttling'],
    timeoutMs: 20000,
  });
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
  return { cdp, S, ev, until, close: () => { cdp.close(); dropBrowser(); } };
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
      asked: parseFloat(el.style.width),
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

async function sweepShape(b, href, [w, h], sweep) {
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, b.S);
  const rows = [];
  for (const max of sweep) {
    await b.cdp.send('Page.navigate', { url: `${href}?shot=combat&shotMaxHp=${max}` }, b.S);
    await b.until(`!!document.querySelector('.combat .topbar')`, `combat topbar @ max ${max}`);
    await wait(320); // the fill has a 200ms width transition; let it land
    const r = await b.ev(READ);
    rows.push({ max, ...r });
  }
  return rows;
}

// THE PER-RESOURCE SWEEP (A2, migrated 2026-08-14 with the D19 C6 ruling;
// poise joined 2026-08-14 with the player vessel). Same door discipline as the
// hp sweep: the maximum enters through the shot param that writes the model's
// own seam (?shotMaxMana / ?shotMaxStamina write the RUN's field;
// ?shotMaxPoise writes the explicit override createCombat already owns — the
// receipt's output seam, Law 0 clause 3 — one stage above the entity, exactly
// where ?shotMaxHp sits relative to the derived-stat formula it bypasses),
// never the renderer. Small domains sweep every integer; a wide domain (poise,
// ~tens) is sampled at six spread values that INCLUDE the domain itself, so
// every resource's sweep stands at its own ceiling at least once — nothing
// invents a maximum past it.
const RESOURCE_DOORS = Object.freeze({ mana: 'shotMaxMana', stamina: 'shotMaxStamina', poise: 'shotMaxPoise' });
function sweepValues(domain) {
  if (domain <= 6) return Array.from({ length: domain }, (_, i) => i + 1);
  const vals = new Set();
  for (let i = 0; i < 6; i++) vals.add(Math.max(1, Math.round(((i + 1) / 6) * domain)));
  return [...vals].sort((a, b2) => a - b2);
}
async function sweepResource(b, href, [w, h], resId, door, domain) {
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, b.S);
  const points = [];
  for (const v of sweepValues(domain)) {
    await b.cdp.send('Page.navigate', { url: `${href}?shot=combat&${door}=${v}` }, b.S);
    await b.until(`!!document.querySelector('.combat .topbar .resbar')`, `combat @ ${door}=${v}`);
    await wait(320);
    const r = await b.ev(READ);
    const bar = r.bars.find((x) => x.id === resId);
    if (bar) points.push({ max: v, ...bar });
  }
  return points;
}

// A2, one resource at one shape: constant percentage-points-per-stat-point
// against the resource's OWN domain. The containing track may change when a
// synthetic sweep crosses a label digit, but the inline percentage must not.
// The at-domain point is ON the line (max/domain is exactly 100 %) and stays
// in; the floor and the over-domain clamp are the two named exceptions, and
// both are exclusions this function prints rather than performs silently.
// Returns the usable-point count so the caller can refuse a claim that was
// never measured at any shape.
function judgeResourceProportion(tag, resId, points, domain) {
  if (!points.length) { fail('A2', `${tag}: ${resId} — NO bar rendered anywhere in its own sweep`); return 0; }
  const usable = points.filter((p) => !p.floored && p.max <= domain);
  const excluded = points.length - usable.length;
  if (usable.length < 2) {
    notes.push(`A2 ${tag}: ${resId} — only ${usable.length} usable point(s) of ${points.length} (domain ${domain}, ${excluded} floored/over-domain); linearity is not claimable at this shape`);
    return usable.length;
  }
  const ratios = usable.map((p) => p.asked / p.max);
  const lo = Math.min(...ratios), hi = Math.max(...ratios);
  const spread = (hi - lo) / hi;
  if (spread > 0.03) {
    fail('A2', `${tag}: ${resId} PROPORTION — percentage-points-per-stat-point ranges ${lo.toFixed(3)}..${hi.toFixed(3)} (${(spread * 100).toFixed(1)} % spread) against its OWN domain ${domain}. `
      + `Per-resource linearity is the ruled shape (D19 C6); if the transpose scale was deliberately curved, this assertion changes with it.`);
  } else {
    notes.push(`A2 ${tag}: ${resId} PROPORTION ok — linear at ${((lo + hi) / 2).toFixed(3)} percentage points per stat point (domain ${domain}, ${usable.length} points, spread ${(spread * 100).toFixed(1)} %)`);
  }
  return usable.length;
}

// A2X — the cross-resource negative control the per-resource ruling demands.
//   (a) hp and mana, standing at DIFFERENT maxes, must ask DIFFERENT percentage
//       per point. The dead shared-rate alternative says they must not differ;
//       per resource says they must. Floored bars are excluded — a floored
//       length encodes nothing. A shape with no unfloored pair says so by
//       name (at 320x640 real content's mana legitimately floors — the floor
//       doing its ruled job, marked dashed by A6, and clause (b) still
//       carries the control there); NO shape ever offering a pair is RED,
//       because then the premise died everywhere and nothing measured (a).
//   (b) mana AT its own derived domain fills its OWN cell. This is the clause
//       a shared-scale regression cannot pass even where the floor masks (a):
//       mana at 100 % of its own domain fills its cell; mana at its domain
//       over a shared 91-point rate asks ~3 % and floors at 16 px.
function judgeCrossResource(tag, hpRows, manaPoints, domains) {
  let hadPairs = false;
  const pairs = hpRows
    .map((r) => ({ max: r.max, hp: r.bars.find((x) => x.id === 'hp'), mana: r.bars.find((x) => x.id === 'mana') }))
    .filter((p) => p.hp && p.mana && !p.hp.floored && !p.mana.floored
      && p.hp.max <= domains.hp && p.mana.max <= domains.mana && p.hp.max !== p.mana.max);
  if (!pairs.length) {
    notes.push(`A2X ${tag}: no unfloored hp+mana pair at this shape (mana floors here by design, dashed per A6) — clause (a) not claimable at this shape; clause (b) below still binds`);
  } else {
    hadPairs = true;
    const worst = pairs.reduce((a, p) => {
      const hpRate = p.hp.asked / p.hp.max, manaRate = p.mana.asked / p.mana.max;
      const rel = Math.abs(hpRate - manaRate) / Math.max(hpRate, manaRate);
      return rel < a.rel ? { rel, p, hpRate, manaRate } : a;
    }, { rel: Infinity });
    if (worst.rel < 0.25) {
      fail('A2X', `${tag}: hp at max ${worst.p.hp.max} asks ${worst.hpRate.toFixed(3)} pct-pt/stat and mana at max ${worst.p.mana.max} asks ${worst.manaRate.toFixed(3)} pct-pt/stat — `
        + `only ${(worst.rel * 100).toFixed(1)} % apart. Two pools at different maxes sharing a rate is the SHARED scale, which is dead by his word (D19 C6).`);
    } else {
      notes.push(`A2X ${tag}: CROSS-RESOURCE ok — hp ${worst.hpRate.toFixed(3)} vs mana ${worst.manaRate.toFixed(3)} percentage-points/stat (${pairs.length} pairs; rates differ ≥ ${(worst.rel * 100).toFixed(0)} %), which per-resource requires and a shared rate forbids`);
    }
  }
  const atDomain = manaPoints.find((p) => p.max === domains.mana);
  if (!atDomain) {
    fail('A2X', `${tag}: the mana sweep never stood AT its own domain ${domains.mana} — the fills-own-cell clause was not measured`);
  } else if (Math.abs(atDomain.w - atDomain.cellW) > 1.0) {
    fail('A2X', `${tag}: mana at its OWN domain ${domains.mana} rendered ${atDomain.w} px of its ${atDomain.cellW} px cell${atDomain.floored ? ' (floored)' : ''} — `
      + `a resource at 100 % of its own ceiling must fill its own cell; a shared rate is the usual way this goes red`);
  } else {
    notes.push(`A2X ${tag}: AT-OWN-DOMAIN ok — mana at max ${domains.mana} fills its ${atDomain.cellW} px cell exactly`);
  }
  return hadPairs;
}

// A11 — the player's poise vessel (D10.4 + D17 q5). One READ of the default
// pose plus one navigation through the refusal edge. Every number is rendered;
// the expected max comes from the posed combat entity itself, never typed.
const READ_VESSEL = `(() => {
  const n = (v) => Math.round(v * 100) / 100;
  const grab = (el) => el && {
    cur: Number(el.dataset.cur), max: Number(el.dataset.max),
    h: n(el.getBoundingClientRect().height), w: n(el.getBoundingClientRect().width),
    cellW: el.parentElement ? n(el.parentElement.getBoundingClientRect().width) : 0,
    floored: el.dataset.floored === '1',
  };
  const main = document.querySelector('.combat .topbar .resbars-host');
  const player = window.__combat && window.__combat.player;
  return {
    poise: grab(main && main.querySelector('.resbar[data-res="poise"]')),
    hp: grab(main && main.querySelector('.resbar[data-res="hp"]')),
    meter: player && player.poiseMeter ? { value: player.poiseMeter.value, max: player.poiseMeter.max } : null,
    modelRows: [...document.querySelectorAll('.combatant.player .meters .resbar')].map((el) => el.dataset.res),
  };
})()`;
async function judgePlayerVessel(b, href, [w, h]) {
  const tag = `${w}x${h}`;
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, b.S);
  await b.cdp.send('Page.navigate', { url: `${href}?shot=combat` }, b.S);
  await b.until(`!!document.querySelector('.combat .topbar')`, `combat @ ${tag} (A11)`);
  await wait(320);
  const r = await b.ev(READ_VESSEL);
  // (a) present on the main HUD, DOM agreeing with the entity, empty, skinny.
  if (!r.meter) {
    fail('A11', `${tag}: the posed player entity carries NO poiseMeter — the model seat this vessel reads is absent`);
  } else if (!r.poise) {
    fail('A11', `${tag}: player poiseMeter is {${r.meter.value}/${r.meter.max}} but the main HUD renders NO poise bar — "poise (very skinny bar) under the health bar" is his layout, twice asked (D10.4, D17 q5)`);
  } else {
    if (r.poise.max !== r.meter.max || r.poise.cur !== r.meter.value) {
      fail('A11', `${tag}: DOM says poise ${r.poise.cur}/${r.poise.max}, the entity says ${r.meter.value}/${r.meter.max} — the bar is not reading the model seat`);
    }
    if (r.poise.cur !== 0) {
      fail('A11', `${tag}: poise cur is ${r.poise.cur} — nothing writes player poise build-up yet; a non-zero value here means a writer landed and this assertion must MOVE with the mechanics, not be relaxed`);
    }
    if (!r.hp) fail('A11', `${tag}: no hp bar beside the poise vessel — the pose itself is broken`);
    else if (!(r.poise.h < r.hp.h)) {
      fail('A11', `${tag}: poise trough renders ${r.poise.h} px tall against hp's ${r.hp.h} px — "very skinny" is not a rendered fact here (the main-surface height rule outranks .resbar-skinny by specificity; only this measurement can claim it)`);
    }
  }
  // (b) the under-model strip: exactly hp and poise, his sentence.
  const rows = [...new Set(r.modelRows)];
  if (!(rows.length === 2 && rows.includes('hp') && rows.includes('poise'))) {
    fail('A11', `${tag}: the player's under-model strip shows [${r.modelRows.join(', ')}] — "should really just show health and poise", his words (D10.4)`);
  }
  // (c) THE REFUSAL EDGE: threshold 0 → the vessel is ABSENT, not empty.
  await b.cdp.send('Page.navigate', { url: `${href}?shot=combat&shotMaxPoise=0` }, b.S);
  await b.until(`!!document.querySelector('.combat .topbar')`, `combat @ ${tag} shotMaxPoise=0 (A11)`);
  await wait(320);
  const z = await b.ev(READ_VESSEL);
  if (z.poise) fail('A11', `${tag}: at threshold 0 the main HUD still renders a poise bar (${z.poise.cur}/${z.poise.max}) — a zero-threshold player has no vessel; drawing one is the empty-trough lie the refusal exists to prevent`);
  if (z.meter) fail('A11', `${tag}: at threshold 0 the entity still carries a poiseMeter {${z.meter.value}/${z.meter.max}} — the refusal must live in the model, not the paint`);
  if (!z.hp) fail('A11', `${tag}: hp vanished with the poise vessel at shotMaxPoise=0 — the refusal took the wrong bar with it`);
  if (!fails.some((f) => f.startsWith('A11') && f.includes(tag))) {
    notes.push(`A11 ${tag}: PLAYER VESSEL ok — poise ${r.poise.cur}/${r.poise.max} = entity {${r.meter.value}/${r.meter.max}}, trough ${r.poise.h} px < hp ${r.hp.h} px, model strip [${rows.join('+')}], and threshold 0 renders ABSENT with hp standing`);
  }
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

function judge(shape, rows, hpDomain) {
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
    fail('A1', `${tag}: TRACKING — ${rows.length} maxima from ${rows[0].max} to ${rows[rows.length - 1].max} produced only ${distinct} distinct rendered widths `
      + `(${widths.join(', ')} px). The bar's length is not a function of the maximum. `
      + (rows[0].legacy ? 'This tree has no .resbars-host — it is the pre-change HUD, whose health bar is a typed constant.' : ''));
  } else {
    notes.push(`A1 ${tag}: TRACKING ok — ${distinct} distinct widths across ${rows.length} maxima`);
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

  // ---- A2 proportionality (the LINEAR shape claim, PER RESOURCE) ------------
  // Raw rendered px per point of max, deliberately NOT normalised by the cell:
  // the claim is about the LENGTH the player sees, and normalising would hide
  // a track that moves under the bar (the digit-reserve defect, observed
  // 2026-08-13: an unreserved plate shrank the bar 92.91 -> 88.53 px across
  // max 88 -> 120). A constant cell is part of what this asserts.
  // Since the D19 C6 migration hp is judged like every other resource — by
  // judgeResourceProportion against ITS OWN derived domain (main() calls it).
  // The clamp-based reading below survives only for trees whose model cannot
  // export a domain (the legacy known-bad), where per-resource has no meaning.
  if (!Number.isFinite(hpDomain)) {
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
  } else {
    judgeResourceProportion(tag, 'hp', hp.map((r) => ({ max: r.max, ...r.bar })), hpDomain);
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

  // ---- A6 the percentage is authoritative -----------------------------------
  for (const r of rows) {
    for (const bar of r.bars) {
      if (bar.floored || bar.dashed) {
        fail('A6', `${tag}: at max ${r.max} the "${bar.id}" bar carries floored=${bar.floored}, dashed=${bar.dashed} — an absolute floor has replaced the max/reference percentage`);
      }
    }
  }
}

// ---- A6P THE PERCENTAGE OWNS EVEN THE LOW EDGE. The max-2 pose makes the
// requested trough only a fraction of the track. It must still render at that
// percentage: an absolute floor would collapse several different maxima to one
// length and recreate the eight REDs this decision closes.
async function judgePercentageAuthority(b, href, [w, h]) {
  const tag = `${w}x${h}`;
  const PROBE = `(() => {
    const n = (v) => Math.round(v * 100) / 100;
    const el = document.querySelector('.combat .topbar .resbar[data-res="hp"]');
    if (!el) return { missing: true };
    const cellW = el.parentElement ? el.parentElement.getBoundingClientRect().width : 0;
    const asked = parseFloat(el.style.width);
    return {
      minWidth: getComputedStyle(el).minWidth,
      wanted: n((asked / 100) * cellW),
      got: n(el.getBoundingClientRect().width),
      floored: el.dataset.floored === '1',
      dashed: getComputedStyle(el).borderTopStyle === 'dashed',
    };
  })()`;
  await b.cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, b.S);
  await b.cdp.send('Page.navigate', { url: `${href}?shot=combat&shotMaxHp=2` }, b.S);
  await b.until(`!!document.querySelector('.combat .topbar .resbar')`, 'combat @ shotMaxHp=2');
  await wait(320);
  const low = await b.ev(PROBE);
  if (low.missing) { fail('A6P', `${tag}: no hp resbar at the low percentage pose — the check has no subject`); return; }
  const minWidth = parseFloat(low.minWidth);
  if (Number.isFinite(minWidth) && minWidth > 0.01) fail('A6P', `${tag}: max-2 pose has min-width ${low.minWidth} — an absolute floor can override percentage`);
  if (Math.abs(low.got - low.wanted) > 0.75) fail('A6P', `${tag}: max-2 pose rendered ${low.got} px for a ${low.wanted} px percentage ask`);
  if (low.floored || low.dashed) fail('A6P', `${tag}: max-2 pose carries floored=${low.floored}, dashed=${low.dashed} — percentage is not authoritative`);
  if (!fails.some((f) => f.startsWith(`A6P  ${tag}`))) {
    notes.push(`A6P ${tag}: PERCENTAGE AUTHORITY ok — max-2 rendered ${low.got} px for ${low.wanted} px ask, min-width ${low.minWidth}`);
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
// --selftest — THE KNOWN-BADS FOR THE ARMS NOBODY HAD WATCHED FAIL.
//
// Each arm is a real defect this repo can actually ship, planted in the file
// that would really carry it, and it travels the whole road: source edit →
// launch.mjs rebuild → dist/AshenSpire.html → headless render → the same READ
// and the same judge() the standing run uses. The plant is NEVER handed to a
// function; there is no fixture in this block, only files.
//
// One shape (320x640) per arm, deliberately and stated in the output: it is the
// narrow edge where a label runs out of room, so it is the shape both arms are
// about. The standing run judges both shapes; this proves the assertion can
// fire, not that it fires everywhere.
const MUTANTS = Object.freeze({
  // A4 — THE LABEL COLLIDES WITH ITS OWN BOX. The real class, in A4's own
  // words, is "the degradation stage for this width is missing": the plate
  // shows its widest variant at a width that variant does not fit. This plant
  // is the one-line cleanup that causes it — force the full name+numbers on at
  // every width, exactly what deleting or mis-editing the container-query block
  // does. The reserve only applies inside the 6.75em window, so the widest
  // label lands in a plate that never reserved room for it.
  label: {
    file: 'styles/combat.css',
    find: '.resplate .l-full, .resplate .l-num, .resplate .l-glyph { display: none; }',
    replace: '.resplate .l-full, .resplate .l-num, .resplate .l-glyph { display: none; }\n'
      + '.resplate .l-full { display: inline !important; }',
    expect: 'A4',
    why: 'the widest label variant shown at every width — the missing degradation stage',
  },
  // A5 — THE TOP-ROW BUTTONS FALL UNDER THE TAP FLOOR. This is not invented:
  // `width/height: 3rem` is what those buttons WERE, and they rendered 27
  // device px against a 44 px floor on dev = 08e184a (the comment above the
  // rule in combat.css says so, from this tool). The plant deletes the
  // combat-scoped floor and lets them fall back to exactly that shipped defect.
  tapfloor: {
    file: 'styles/combat.css',
    find: '.topbar.combat-hud .topbar-btn {\n  width: auto; height: auto;\n  min-width: var(--tap-floor); min-height: var(--tap-floor);\n}',
    replace: '/* floor removed by --selftest */',
    expect: 'A5',
    why: 'the combat tap floor deleted — the buttons fall back to the 3rem that really shipped',
  },
});

async function build() {
  const built = spawn(process.execPath, [resolve(TREE, 'tools/launch.mjs'), '--build-only'], { cwd: TREE, stdio: 'ignore' });
  await new Promise((res, rej) => { built.on('exit', (c) => (c === 0 ? res() : rej(new Error(`build failed (${c})`)))); built.on('error', rej); });
}

// One measured verdict at one shape, from the tool's own sweep and judge.
// Returns the fail ids raised, so an arm can require its own and report the
// rest — the assertions that stay green under a plant are the finding.
async function verdictAt(href, shape, hpDomain) {
  fails.length = 0; notes.length = 0;
  const b = await open();
  try {
    const rows = await sweepShape(b, href, shape, sweepFor(hpDomain));
    judge(shape, rows, hpDomain);
  } finally { b.close(); }
  return { fails: [...fails], notes: [...notes] };
}

async function runSelftest(href) {
  const SHAPE = [320, 640];
  let hpDomain = null;
  try {
    const { contentBundle } = await import(pathToFileURL(resolve(TREE, 'src/content/index.js')).href);
    const { createRegistries } = await import(pathToFileURL(resolve(TREE, 'src/model/registries.js')).href);
    const { resourceDomains } = await import(pathToFileURL(resolve(TREE, 'src/model/resources.js')).href);
    hpDomain = resourceDomains(createRegistries(contentBundle)).main.hp;
  } catch { /* legacy tree: judge() falls back to its clamp reading */ }

  console.log(`\n  SELFTEST — each arm's known-bad planted in a real shipped file, rebuilt, re-rendered.`);
  console.log(`  Judged at ${SHAPE[0]}x${SHAPE[1]} (the narrow edge both arms are about).\n`);
  const results = [];
  for (const [arm, m] of Object.entries(MUTANTS)) {
    const path = resolve(TREE, m.file);
    const before = readFileSync(path, 'utf8');
    if (!before.includes(m.find)) {
      console.log(`  ${arm.padEnd(9)} PLANT DID NOT APPLY — the anchor is gone from ${m.file}.`);
      console.log(`            A known-bad that cannot be planted proves nothing; re-point it before trusting ${m.expect}.`);
      results.push({ arm, ok: false, reason: 'anchor absent' });
      continue;
    }
    let got = null;
    try {
      writeFileSync(path, before.replace(m.find, m.replace));
      await build();
      got = await verdictAt(href, SHAPE, hpDomain);
    } finally {
      writeFileSync(path, before);
      await build();
    }
    const mine = got.fails.filter((f) => f.startsWith(m.expect));
    const others = [...new Set(got.fails.map((f) => f.slice(0, 3).trim()))].filter((id) => id !== m.expect);
    const stayedGreen = [...new Set(got.notes.map((n) => n.slice(0, 3).trim()))];
    console.log(`  ${arm.padEnd(9)} ${m.file} — ${m.why}`);
    if (mine.length) {
      console.log(`            ${m.expect} RED, as required: ${mine[0].slice(0, 150)}${mine[0].length > 150 ? '…' : ''}`);
      console.log(`            (${mine.length} ${m.expect} failure(s); other reds: ${others.join(', ') || 'none'})`);
      // The sentence my own wake clause was written for: the arms that DID NOT
      // notice are the reason each arm needs its own plant.
      console.log(`            STAYED GREEN under this plant: ${stayedGreen.join(', ') || 'nothing'} — which is why ${m.expect} needed its own known-bad.`);
    } else {
      console.log(`            ${m.expect} DID NOT FIRE. The plant landed (anchor replaced, tree rebuilt) and the assertion stayed quiet.`);
      console.log(`            Reds seen instead: ${got.fails.map((f) => f.slice(0, 90)).join(' | ') || 'NONE — the whole run was green on a broken tree'}`);
    }
    results.push({ arm, ok: mine.length > 0 });
  }

  // THE CLEAN CONTROL. An assertion that is red on a healthy tree is not
  // evidence either — and the restore above has to be proven, not assumed.
  const clean = await verdictAt(href, SHAPE, hpDomain);
  const cleanOk = clean.fails.length === 0;
  console.log(`\n  control   the restored tree: ${cleanOk ? `CLEAN — ${clean.notes.length} assertions ok` : `${clean.fails.length} FAILING after restore`}`);
  if (!cleanOk) for (const f of clean.fails) console.log(`            ${f}`);

  const bad = results.filter((r) => !r.ok);
  console.log(`\nDOOR: every plant above is an edit to a REAL SHIPPED FILE (styles/combat.css), rebuilt through
      tools/launch.mjs into dist/AshenSpire.html and re-rendered in headless Chromium. The known-bad
      travels the stylesheet, the bundler, the browser, the cascade, the container queries and the same
      READ the standing run uses. NOTHING in this block is handed to judge() as a fixture.
NOT PASSED: the plants are judged at 320x640 only, on the reaver, one seed, Text size M — an arm proven
      able to fire, not proven to fire at every shape. A4 is planted through the STYLESHEET door; a
      long resource NAME through the content door (content/resources.js) would reach the same clause
      by a second road and is not planted here.
      AND FOUR ARMS ARE NOT PLANTED AT ALL: A7 and A8 hold DOWNSTREAM negative controls (a built object
      handed to the judging function, below the render); A9 and A10 hold none. All four run only under
      --shots. They are \`unknown\`, not green, and the header block above says why.
BOUNDARY: this proves A4 and A5 can go red on real code. It says nothing about whether they would catch
      a defect shaped differently from the one planted — full recall on a corpus of one is not recall.`);
  console.log(bad.length || !cleanOk
    ? `\nSELFTEST: ${bad.length} arm(s) did not go red${cleanOk ? '' : ' + the control is dirty'}`
    : `\nSELFTEST: ${results.length}/${results.length} arms observed RED by the real door, control clean`);
  return bad.length || !cleanOk ? 1 : 0;
}

// ---------------------------------------------------------------------------
// --scales — WHAT CHANGES IF HE ANSWERS "CURVED".
// Printed from the tree's OWN resourceScale(), plus the two candidates, so the
// table in model/resources.js cannot drift from the function it describes.
async function printScales(trackPx) {
  const { resourceScale, resourceDomains } = await import(pathToFileURL(resolve(TREE, 'src/model/resources.js')).href);
  const { contentBundle } = await import(pathToFileURL(resolve(TREE, 'src/content/index.js')).href);
  const { createRegistries } = await import(pathToFileURL(resolve(TREE, 'src/model/registries.js')).href);
  const CANDIDATES = { 'linear  x': (x) => x, 'sqrt    √x': Math.sqrt, 'log     ln(1+x)': Math.log1p };
  // DERIVED from the tree's own model — this line carried a typed 88 while the
  // tree had derived 91 (caught 2026-08-14): a copy that drifts is Law 0
  // clause 4's whole case, in the tool that exists to catch drift.
  const DOMAIN = resourceDomains(createRegistries(contentBundle)).main.hp;
  const POINTS = [2, 8, 40, 56, 72, 78, 84, DOMAIN];
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
  if (flag('--selftest')) { process.exit(await runSelftest(href)); }

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
  // THE DERIVED DOMAINS — imported from the tree's OWN model, never typed here
  // (Law 0 clause 4; --scales carried a typed 88 while the tree had derived 91,
  // which is exactly the drift a typed copy buys). A tree whose model exports
  // no domains is the legacy known-bad: per-resource A2/A2X have no subject
  // there, the tool says so, and A1 still judges it red.
  let domains = null;
  try {
    const { contentBundle } = await import(pathToFileURL(resolve(TREE, 'src/content/index.js')).href);
    const { createRegistries } = await import(pathToFileURL(resolve(TREE, 'src/model/registries.js')).href);
    const { resourceDomains } = await import(pathToFileURL(resolve(TREE, 'src/model/resources.js')).href);
    domains = resourceDomains(createRegistries(contentBundle)).main;
    console.log(`  derived main-surface domains: ${Object.entries(domains).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  } catch {
    console.log('  (this tree derives no resource domains — legacy shape; A2/A2X per-resource claims are not applicable and are not silently green)');
  }

  const all = {};
  const usableByResource = {}; // resId -> max usable points seen at any shape
  let crossPairsAnywhere = false; // A2X clause (a): did ANY shape offer a premise
  const source = SHOTS_OUT ? await serve({ root: TREE, port: 8317, open: false }) : null;
  try {
    for (const shape of SHAPES) {
      const rows = await sweepShape(b, href, shape, sweepFor(domains && domains.hp));
      all[`${shape[0]}x${shape[1]}`] = rows;
      console.log(`\n  ${shape[0]}x${shape[1]}   track ${rows[0].trackW} px${rows[0].legacy ? '   [LEGACY HUD — no .resbars-host in this tree]' : ''}`);
      console.log('    max    bar px   px/point   bars  label   floored');
      for (const r of rows) {
        const hp = r.bars.find((x) => x.id === 'hp' || x.id === 'hp(legacy)');
        const ratio = hp ? (hp.w / r.max).toFixed(3) : '—';
        console.log(`    ${String(r.max).padStart(4)}   ${String(hp ? hp.w : '—').padStart(6)}   ${String(ratio).padStart(8)}   ${String(r.bars.length).padStart(4)}  `
          + `${String(hp ? hp.labelW : '—').padStart(5)}   ${hp && hp.floored ? 'yes' : 'no'}`);
      }
      judge(shape, rows, domains ? domains.hp : null);
      await judgePercentageAuthority(b, href, shape);
      if (domains) {
        const tag = `${shape[0]}x${shape[1]}`;
        let manaPoints = [];
        for (const [resId, door] of Object.entries(RESOURCE_DOORS)) {
          // Seed 0 FIRST: a door whose resource never sweeps (no derived
          // domain — e.g. this tool against a tree from before that resource
          // reached the model) must land in the fewer-than-two-points RED
          // below, never in silence. The pre-poise tree is the live known-bad:
          // RESOURCE_DOORS names poise, the old model derives no poise domain,
          // and without this seed the loop's `continue` was a quiet green.
          usableByResource[resId] = usableByResource[resId] || 0;
          if (!Number.isFinite(domains[resId]) || domains[resId] <= 0) continue;
          const points = await sweepResource(b, href, shape, resId, door, domains[resId]);
          if (resId === 'mana') manaPoints = points;
          console.log(`    ${resId} sweep: ${points.map((p) => `${p.max}→${p.w}px${p.floored ? ' (floored)' : ''}`).join('  ')}`);
          const usable = judgeResourceProportion(tag, resId, points, domains[resId]);
          usableByResource[resId] = Math.max(usableByResource[resId], usable);
          // A11 (d) — poise AT its own domain fills its own cell: A2X (b)'s
          // clause, poise's copy, measured from the sweep's own at-domain
          // point (sweepValues always includes the domain).
          if (resId === 'poise') {
            const atDomain = points.find((p) => p.max === domains[resId]);
            if (!atDomain) fail('A11', `${tag}: the poise sweep never stood AT its own domain ${domains[resId]} — the fills-own-cell clause was not measured`);
            else if (Math.abs(atDomain.w - atDomain.cellW) > 1.0) {
              fail('A11', `${tag}: poise at its OWN domain ${domains[resId]} rendered ${atDomain.w} px of its ${atDomain.cellW} px cell${atDomain.floored ? ' (floored)' : ''} — a resource at 100 % of its own ceiling must fill its own cell`);
            } else notes.push(`A11 ${tag}: POISE AT-OWN-DOMAIN ok — max ${domains[resId]} fills its ${atDomain.cellW} px cell exactly`);
          }
        }
        crossPairsAnywhere = judgeCrossResource(tag, rows, manaPoints, domains) || crossPairsAnywhere;
        await judgePlayerVessel(b, href, shape);
      }
      if (SHOTS_OUT) {
        await captureLayoutPage(b, source.url, shape, 'solo', 'source');
        await captureLayoutPage(b, source.url, shape, 'coop', 'source');
        await captureLayoutPage(b, href, shape, 'solo', 'dist');
        await captureLayoutPage(b, href, shape, 'coop', 'dist');
      }
    }
    // A resource whose linearity was unclaimable at EVERY shape was never
    // measured — that is red, not a quiet note (the silence guard; a claim
    // with no measurement anywhere must not ride the other resources' green).
    for (const [resId, usable] of Object.entries(usableByResource)) {
      if (usable < 2) fail('A2', `${resId}: fewer than two usable points at every shape — per-resource linearity was never measured for this resource`);
    }
    if (domains && !crossPairsAnywhere) {
      fail('A2X', 'no shape ever offered an unfloored hp+mana pair at different maxes — clause (a) was never measured anywhere, and a control with no premise is red, not green');
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
      DOM all ran as they do in play. Poise's door (?shotMaxPoise=) enters ONE STAGE HIGHER than the
      others: it writes the explicit override createCombat owns (Law 0 clause 3), the receipt's
      OUTPUT seam — so the sweep bypasses the equipment-receipt derivation itself, which is proven
      separately, through the content door, by tools/player-poise-threshold.mjs. The default pose
      (no param) walks the full path: A11 checks the entity's own derived stamp against the DOM.
KNOWN-BAD: this tool's failing case is the SHIPPED PRE-CHANGE TREE, where the combat health bar was
      \`.topbar .hpbar { width: 19rem }\` — a constant. Run with --tree against a checkout at dev and
      A1 goes red on real code. Nothing was authored to make it fail.
BOUNDARY: headless Chromium on ${process.platform}, dist/AshenSpire.html, ${SHAPES.length} shape(s), the reaver class,
      one seed, Text size M, UI size Auto. Silent about packaged desktop builds, about a real finger, about whether
      LINEAR is the transpose scale he meant, and about every screen that is not combat.
PER-RESOURCE, ruled: "bar scaling per resource" — Constantine, 2026-08-13 (family repo directions.md D19 C6).
      The at-a-glance read — length tells pool size — survives WITHIN a resource across the run, not BETWEEN
      resources: two pools with different maxes legitimately render different px per point (A2X asserts they
      DO), so comparing the mana pill's length against the health bar's reads nothing, and that is the ruling,
      not a regression.`);
  console.log(fails.length ? `\nRESULT: ${fails.length} FAILING` : `\nRESULT: ${notes.length} assertions ok`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error(`hudbars: ${e.message}`); process.exit(2); });
