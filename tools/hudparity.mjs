#!/usr/bin/env node
// tools/hudparity.mjs — ONE HUD: the map and the combat screen draw the same
// character's resource bars at the same proportions, at his reference scale.
// The rendered check on E9 / #254.
//
// HIS WORDS, 2026-08-15 (#254): "I'd like the hud to look the same both combat
// and map". HIS RULING, 2026-08-22: the upper references are 500 HP / 50 MP /
// 50 SP. Two halves of one ask, and they are INDEPENDENT — a repo can honour
// either one alone and still show the player two different HUDs.
//
// WHY IT EXISTS, and it is not "the map had no bars" — it had one.
//
// Before this change `src/ui/screens/map.js` hand-wrote its own health bar:
//
//     <div class="bar hpbar"><div class="fill" style="width:${hpPct}%">…
//
// with its own `width: 15rem` track in styles/map.css, beside a combat HUD
// rendered by ui/components/resbars.js against a derived track. TWO RENDERERS
// FOR ONE GRAMMAR. Each was internally consistent, so every instrument in this
// repo was green: hudbars.mjs sweeps the COMBAT bars and says nothing about the
// map, and nothing at all compared the two. The same character's health read at
// two different proportions depending on which screen you were looking at, and
// the only way to see it was to put the two screenshots side by side.
//
// So this file asserts the thing neither screen's own check can: that the two
// screens AGREE. It is not a second copy of hudbars.mjs — that tool asks
// whether ONE HUD's lengths track their maxima (monotonic, linear,
// capped). This asks whether TWO HUDs give the same answer about one character,
// and the gap between those questions is exactly where this defect lived.
//
// WHAT IT CHECKS, per cell (cell = shape x pose):
//   P0 POPULATION  both screens rendered a NON-EMPTY main-HUD bar set, and the
//                  declared cell count was reached. An empty HUD and a matching
//                  HUD look identical to a check that only hunts for
//                  mismatches, and they mean the opposite.
//   P1 ROWS        both top HUDs draw exactly HP, MP and SP. Combat poise stays
//                  on the player character card and must not enter this set.
//   P2 SAME ASK    for every shared row, the two screens ask for the SAME
//                  trough percentage and the SAME fill percentage, and report
//                  the same cur/max. EXACT equality, no tolerance: these are
//                  data, computed by one function from one table, and any
//                  difference at all means the two screens have stopped sharing
//                  it. THIS IS THE LOAD-BEARING CHECK AND IT HAS NO THRESHOLD.
//   P3 HIS SCALE   that trough percentage equals `max / reference`, with the
//                  reference IMPORTED from src/content/resources.js — so a row
//                  that stops carrying `domainMax` (the wire from his ruling to
//                  the render) goes red here even though both screens still
//                  agree with each other.
//   P3R REFERENCE  the reference table IS 500 HP / 50 MP / 50 SP. This is THE
//                  ONE PLACE his numbers are typed in this tool, deliberately:
//                  P3 alone would stay green if the constant were edited,
//                  because it reads the same constant the render reads. If he
//                  moves the reference, this line moves with it, by hand, in
//                  the same act — which is the point.
//   P4 PERCENTAGE  no absolute minimum width overrides the requested percentage
//                  on either screen. The canonical combat component owns this;
//                  the map inherits the same rule by mounting that component.
//   P5 INK         on each screen, a trough renders within PX_TOL of
//                  `ask% x track`, and its fill within PX_TOL of
//                  `fill% x trough content`. P2 says the two screens ask for
//                  the same thing; this says the ask arrived as ink.
//   P6 ONE RENDER  ZERO `.hpbar` inside any `.topbar`, on either screen — the
//                  second renderer is gone, not merely unused — and every map
//                  bar carries the shared component's machine-readable home
//                  (`data-res`, `data-cur`, `data-max`, role=img).
//
// BOTH EDGES, named because the gate requires it, and they are edges of the
// TROUGH's domain (0 .. reference), which is the quantity this change moves:
//   · LOW  — `?shotMaxHp=10&shotMaxMana=1&shotMaxStamina=1`: the bottom of his
//            own stated band ("a min of 10"). These short troughs are the edge
//            that proves an absolute pixel floor does not override percentage.
//   · HIGH — `?shotMaxHp=500&shotMaxMana=50&shotMaxStamina=50`: AT the
//            reference. Trough 100 %, fill partial. Nothing above it exists —
//            `lengthPct` clamps at 100 — so this is the ceiling, not a large
//            sample.
//   · and the SHIPPED pose in between, with no doors at all, because that is
//            the only one a player can actually reach.
//
// THE THRESHOLD'S OWN NEIGHBOURHOOD (Charter 2b), and the honest version of it:
//   · P2, P3, P3R, P1, P4 and P6 compare EXACTLY. They have
//     no threshold, so there is nothing to sample either side of.
//   · P5's `PX_TOL` IS a threshold, and its unit is one CSS pixel. MEASURED,
//     not asserted: plant 6 clamps a full-track trough and the run reports
//     1.813 px off; a clean run reports at most 0.305 px over all 9 cells (both
//     figures are printed in the runs' own `P5/ink` lines). At PX_TOL = 1 the
//     first is RED and the second GREEN; move the threshold ONE PIXEL up to 2
//     and the plant goes green, ONE PIXEL down to 0 and the clean run goes red.
//     A cell on each side, adjacent in the threshold's own unit, both entering
//     by the same door as every other input.
//
// THE DOOR: the SOURCE TREE over http in headless Chromium (tools/serve.mjs).
// Both screens are reached by their own `?shot=` state, the pools are posed
// through the run's own fields (main.js's reach doors, which write the same
// fields a curse and an armour mod write), and every box is read with
// getBoundingClientRect() off the live page. Nothing is injected, no module is
// imported to be asked a question about geometry, and the only thing imported
// at all is the reference table — which is a DATA read, and the whole point of
// P3 is that it comes from the same file the render reads.
// `--selftest` plants its known-bads as file bytes in a copied real tree
// (tools/doorplant.mjs) and runs this tool WHOLE from the copy.
//
// WHAT IT DOES NOT COVER — the boundary, printed every run, not a to-do list:
//   · THE TWO TOP ROWS SHARE THEIR GEOMETRY: resource host, Armoury, Menu. The
//     screens still carry different secondary chrome below that row. P4 holds
//     percentage authority at 1440x860, 390x844 and 320x640; P6 holds both controls
//     wholly inside the viewport.
//   · THE UNDER-MODEL SURFACE IS UNTOUCHED. `src/ui/screens/coop.js`
//     `meterBars()` still hand-writes `.bar.hpbar` for the co-op combatant
//     strips — a THIRD renderer for this grammar, named in styles/combat.css's
//     own comment since before this change. Out of E9's scope, still there,
//     and this tool's P6 census is scoped to `.topbar` so it will not catch it.
//   · WHETHER 500/50 IS A GOOD SCALE. It is his ruling, made with the cost in
//     front of him. This tool holds the number; it has no opinion about it.
//   · Headless Chromium, three shapes, one text size, no accent theme, no
//     colourblind palette. The runtime platform is printed in the boundary.
//   · NOT WIRED INTO ci.yml — see the PR. Between hand-runs, SOP 2's silence
//     guard makes this `unknown`, not green.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the map and the combat
// screen stop being two screens with two headers — one shared HUD component
// mounted by one caller has nothing left to disagree about. Also deleted if the
// trough stops encoding a maximum at all, since P3/P3R are then holding a
// ruling that no longer exists.
//
// Sunna Falk, 2026-08-22.

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const valuesOf = (flag) => {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== flag) continue;
    const value = args[i + 1];
    values.push(value && !value.startsWith('--') ? value : '');
  }
  return values;
};

// HIS RULING, TYPED ONCE, HERE, ON PURPOSE. See P3R in the header: everything
// else in this file reads the reference out of the tree so it cannot drift from
// the render, and that is precisely why one line has to say what the number is
// supposed to BE.
const HIS_REFERENCE = Object.freeze({ hp: 500, pool: 50 });

// ROWS WHOSE READER LEGITIMATELY REFUSES OFF THE BATTLEFIELD. Not a waiver
// list — a statement about model/resources.js's refusal path, which returns
// null when there is no meter and makes the bar ABSENT. A row added here
// without that property would be this tool lying for the screen.

// ONE CSS PIXEL. P5's tolerance and the only threshold in this file; its
// neighbourhood is plant 6 (a 2 px nudge) against a clean run at <= 0.05 px.
const PX_TOL = 1.0;

const ALL_SHAPES = [
  { tag: '1440x860', w: 1440, h: 860, d: 1, mobile: false },
  { tag: '844x340', w: 844, h: 340, d: 1, mobile: false },
  { tag: '390x844', w: 390, h: 844, d: 3, mobile: true },
  { tag: '320x640', w: 320, h: 640, d: 3, mobile: true },
];
// THE POSES ARE THE EDGES, AND THE MIDDLE ONE IS THE SHIPPED GAME.
const ALL_POSES = [
  { tag: 'shipped', q: '' },
  { tag: 'low', q: '&shotMaxHp=10&shotMaxMana=1&shotMaxStamina=1' },
  { tag: 'high', q: '&shotMaxHp=500&shotMaxMana=50&shotMaxStamina=50' },
];
const SCREENS = [
  { tag: 'map', shot: 'map', ready: '.mapscreen' },
  { tag: 'combat', shot: 'combat', ready: '.combat' },
];

// The selftest narrows the population so eight whole-tool browser runs finish
// in a sensible time. DECLARED, never implied: both flags print in the header
// of every run that uses them, and P0 counts against the narrowed declaration
// rather than pretending the full one was measured.
const selectorErrors = [];
const shapeValues = valuesOf('--only-shape');
const poseValues = valuesOf('--only-pose');
if (shapeValues.length > 1) selectorErrors.push(`--only-shape was supplied ${shapeValues.length} times; supply it once`);
if (poseValues.length > 1) selectorErrors.push(`--only-pose was supplied ${poseValues.length} times; supply it once`);
const onlyShape = shapeValues[0] || null;
// A COMMA LIST, not a single tag: the corpus needs two poses at once (the
// shipped one carries the floored cells, the `high` one carries the 100 %
// troughs the PX_TOL plant bites), and a flag that can only name one would have
// forced two corpora or a plant aimed at whatever the single pose happened to
// reach. Still declared in the header of every run that uses it.
const onlyPose = poseValues[0] || null;
const wantPoses = onlyPose ? onlyPose.split(',').map((x) => x.trim()).filter(Boolean) : null;
const shapeTags = new Set(ALL_SHAPES.map((s) => s.tag));
const poseTags = new Set(ALL_POSES.map((p) => p.tag));
if (shapeValues.length && !onlyShape) selectorErrors.push('--only-shape requires a non-empty value');
if (onlyShape && !shapeTags.has(onlyShape)) {
  selectorErrors.push(`unknown --only-shape ${JSON.stringify(onlyShape)}; choose ${JSON.stringify([...shapeTags])}`);
}
if (poseValues.length && (!onlyPose || !wantPoses?.length)) selectorErrors.push('--only-pose requires a non-empty comma list');
if (wantPoses) {
  const duplicates = [...new Set(wantPoses.filter((tag, i) => wantPoses.indexOf(tag) !== i))];
  const unknown = [...new Set(wantPoses.filter((tag) => !poseTags.has(tag)))];
  if (duplicates.length) selectorErrors.push(`duplicate --only-pose value(s) ${JSON.stringify(duplicates)}`);
  if (unknown.length) selectorErrors.push(`unknown --only-pose value(s) ${JSON.stringify(unknown)}; choose ${JSON.stringify([...poseTags])}`);
}
const SHAPES = onlyShape ? ALL_SHAPES.filter((s) => s.tag === onlyShape) : ALL_SHAPES;
const POSES = wantPoses ? ALL_POSES.filter((p) => wantPoses.includes(p.tag)) : ALL_POSES;
const HIS_MAX_VIEWPORT_PCT = 40;

// THE LATCH. `bad` never goes down; nothing reads it to decide whether to keep
// going. Every exit path below closes the browser and the server, prints the
// boundary, and only then ends — a green may never overwrite a non-green.
let bad = 0;
let checks = 0;
let unknown = 0;
const fail = (line) => { bad++; console.error(`RED  ${line}`); };
const ok = (line) => { checks++; console.log(`  ok  ${line}`); };
const unk = (line) => { unknown++; console.log(`  ??  ${line}`); };

// ---------------------------------------------------------------------------
// The page-side read. Everything comes off the live page; nothing is computed
// from a module and compared against itself.
// ---------------------------------------------------------------------------
const READ = `(() => {
  const bars = [];
  for (const el of document.querySelectorAll('.topbar .resbars[data-surface="main"] .resbar')) {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    const fillEl = el.querySelector('.fill');
    const fb = fillEl ? fillEl.getBoundingClientRect() : null;
    const track = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
    const unitEl = el.closest('.resunit');
    const unitBox = unitEl ? unitEl.getBoundingClientRect() : null;
    const frameEl = unitEl ? unitEl.querySelector(':scope > .rescard-frame') : null;
    const frameBox = frameEl ? frameEl.getBoundingClientRect() : null;
    const bl = parseFloat(cs.borderLeftWidth) || 0;
    const br = parseFloat(cs.borderRightWidth) || 0;
    bars.push({
      id: el.dataset.res || null,
      cur: el.dataset.cur == null ? null : Number(el.dataset.cur),
      max: el.dataset.max == null ? null : Number(el.dataset.max),
      role: el.getAttribute('role'),
      aria: el.getAttribute('aria-label'),
      askTrough: el.style.width || null,
      askFill: fillEl ? (fillEl.style.width || null) : null,
      trough: b.width, fill: fb ? fb.width : null,
      track: track ? track.width : null,
      inset: bl + br,
      minWidth: cs.minWidth,
      unitWidth: unitBox ? unitBox.width : null,
      frame: frameBox ? { width: frameBox.width, right: frameBox.right, padAfterBar: frameBox.right - b.right } : null,
      floored: el.dataset.floored === '1',
      dashed: cs.borderTopStyle === 'dashed' && cs.borderRightStyle === 'dashed'
        && cs.borderBottomStyle === 'dashed' && cs.borderLeftStyle === 'dashed',
    });
  }
  return {
    bars,
    lines: [...document.querySelectorAll('.topbar .resbars[data-surface="main"] .resline')]
      .map((line) => [...line.querySelectorAll(':scope > .resunit .resbar')]
        .map((bar) => bar.dataset.res || null)),
    lineBoxes: [...document.querySelectorAll('.topbar .resbars[data-surface="main"] .resline')]
      .map((line) => {
        const b = line.getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
      }),
    topButtons: [...document.querySelectorAll('.topbar .hud-top .topbar-btn')].map((el) => {
      const b = el.getBoundingClientRect();
      return { id: el.id || null, left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
    }),
    hostBox: (() => {
      const el = document.querySelector('.topbar .hud-top .resbars-host');
      const b = el ? el.getBoundingClientRect() : null;
      return b ? { left: b.left, right: b.right, width: b.width } : null;
    })(),
    meta: (() => {
      const el = document.querySelector('.topbar .hud-top .hud-center');
      const b = el ? el.getBoundingClientRect() : null;
      return b ? {
        left: b.left, right: b.right, width: b.width, center: (b.left + b.right) / 2,
        cinders: el.querySelectorAll('.hud-cinders').length,
        floor: el.querySelectorAll('.hud-floor').length,
      } : null;
    })(),
    configuredCap: getComputedStyle(document.documentElement).getPropertyValue('--hud-resource-max-vw').trim(),
    // THE SECOND RENDERER'S CENSUS. Scoped to .topbar because that is where the
    // duplicate lived; the under-model strips are named in the boundary.
    legacyHpbars: document.querySelectorAll('.topbar .hpbar').length,
    hosts: document.querySelectorAll('.topbar .resbars-host').length,
    vp: { w: window.innerWidth, h: window.innerHeight },
  };
})()`;

function connectCdp(wsUrl, { sendTimeoutMs = 15000 } = {}) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  let closedError = null;
  const rejectPending = (error) => {
    closedError = closedError || error;
    for (const { rej, timer } of pending.values()) {
      clearTimeout(timer);
      rej(closedError);
    }
    pending.clear();
  };
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej, timer } = pending.get(m.id); pending.delete(m.id); clearTimeout(timer);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    }
  });
  ws.addEventListener('close', () => rejectPending(new Error('CDP WebSocket closed before pending commands completed')));
  ws.addEventListener('error', () => rejectPending(new Error('CDP WebSocket error before pending commands completed')));
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      if (closedError) return Promise.reject(closedError);
      if (ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error(`CDP WebSocket is not open for ${method} (state ${ws.readyState})`));
      }
      const id = nextId++;
      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rej(new Error(`CDP command ${method} exceeded ${sendTimeoutMs} ms`));
        }, sendTimeoutMs);
        pending.set(id, { res, rej, timer });
        try {
          ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        } catch (error) {
          clearTimeout(timer);
          pending.delete(id);
          rej(error);
        }
      });
    },
    close: () => { try { ws.close(); } catch { /* already gone */ } },
  };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The reference this row is measured against, or null for a derived row. */
function referenceFor(id, table) {
  if (id === 'hp') return table.hp;
  if (id === 'mana' || id === 'stamina') return table.pool;
  return null;
}

/**
 * Judge one cell: the map read against the combat read.
 * Every branch either fails or counts a check; nothing falls through silently.
 */
function judgeCell(cell, mapR, comR, refTable) {
  // ---- P0 POPULATION ------------------------------------------------------
  if (!mapR || !comR) {
    fail(`FINDING P0/population cell=${cell} map=${mapR ? 'read' : 'MISSING'} combat=${comR ? 'read' : 'MISSING'} `
      + '— one screen was never read, so nothing below it is evidence about agreement.');
    return;
  }

  // P8 SHARED TOP-ROW COMPOSITION — one data value caps the resource reference
  // track, while cinders + floor sit at the viewport centre on both screens.
  // The 40 is his ruling, held independently from the app config so moving the
  // config cannot move the expectation with it.
  for (const [screen, read] of [['map', mapR], ['combat', comR]]) {
    const capPx = read.vp.w * HIS_MAX_VIEWPORT_PCT / 100;
    if (read.configuredCap !== `${HIS_MAX_VIEWPORT_PCT}vw`) {
      fail(`FINDING P8/top-row ${cell} ${screen} configured cap=${JSON.stringify(read.configuredCap)} — expected the one authored ${HIS_MAX_VIEWPORT_PCT}vw HUD cap.`);
    } else if (!read.hostBox || read.hostBox.width > capPx + 1) {
      fail(`FINDING P8/top-row ${cell} ${screen} resource host=${read.hostBox ? read.hostBox.width.toFixed(2) : 'MISSING'} px, viewport cap=${capPx.toFixed(2)} px — shared HUD exceeds ${HIS_MAX_VIEWPORT_PCT}% viewport.`);
    } else {
      ok(`P8/top-row ${cell} ${screen} — resource host ${read.hostBox.width.toFixed(2)} px <= ${HIS_MAX_VIEWPORT_PCT}% viewport (${capPx.toFixed(2)} px)`);
    }
    const centreMiss = read.meta ? Math.abs(read.meta.center - read.vp.w / 2) : Infinity;
    if (!read.meta || read.meta.cinders !== 1 || read.meta.floor !== 1 || centreMiss > 1) {
      fail(`FINDING P8/top-row ${cell} ${screen} meta=${JSON.stringify(read.meta)} viewportCentre=${(read.vp.w / 2).toFixed(2)} — exactly one cinder and one floor receipt must be centred in the top row.`);
    } else {
      ok(`P8/top-row ${cell} ${screen} — cinders + floor centred (miss ${centreMiss.toFixed(2)} px)`);
    }
  }
  // ---- P6 ONE RENDERER, AND IT RUNS BEFORE P0'S RETURN --------------------
  //
  // ORDER IS LOAD-BEARING HERE, and the corpus is what taught me: with this
  // census below the empty-bars return, planting the pre-E9 hand-written
  // `.hpbar` back into map.js made the map render zero `.resbar`, P0 returned
  // first, and the tool went red WITHOUT EVER SAYING a second renderer was
  // back. Red for the wrong reason is not a catch (SOP 14 §3) — and worse, the
  // reader is sent to "the map has no HUD" when the truth is "the map has a
  // different HUD". The more specific diagnosis has to be reachable in the
  // state that produces it.
  const legacy = mapR.legacyHpbars + comR.legacyHpbars;
  if (legacy) {
    fail(`FINDING P6/one-renderer cell=${cell} .topbar .hpbar count map=${mapR.legacyHpbars} combat=${comR.legacyHpbars} `
      + '— a hand-written health bar is back inside a top bar. Two renderers for one grammar is the defect E9 closed; '
      + 'it does not matter that the second one looks right on its own screen.');
  } else {
    ok(`P6/one-renderer ${cell} — zero .topbar .hpbar on either screen`);
  }

  if (!mapR.bars.length || !comR.bars.length) {
    fail(`FINDING P0/population cell=${cell} mapBars=${mapR.bars.length} combatBars=${comR.bars.length} `
      + `(hosts map=${mapR.hosts} combat=${comR.hosts}) — a screen rendered NO main-HUD bars. An empty `
      + 'HUD and an agreeing HUD are indistinguishable to a check that only hunts for mismatches.');
    return;
  }
  ok(`P0/population ${cell} — map ${mapR.bars.length} bar(s), combat ${comR.bars.length} bar(s)`);

  if (mapR.hosts !== 1 || comR.hosts !== 1) {
    fail(`FINDING P6/one-renderer cell=${cell} host count map=${mapR.hosts} combat=${comR.hosts} — each top bar `
      + 'must mount exactly one resource-bar host. A second host is a second HUD even when both use the shared renderer.');
  } else {
    ok(`P6/one-renderer ${cell} — exactly one resource-bar host on each screen`);
  }

  for (const [screen, read] of [['map', mapR], ['combat', comR]]) {
    const clipped = read.topButtons.filter((b) => b.left < -0.5 || b.right > read.vp.w + 0.5
      || b.top < -0.5 || b.bottom > read.vp.h + 0.5);
    if (read.topButtons.length !== 2 || clipped.length) {
      fail(`FINDING P6/one-renderer cell=${cell} screen=${screen} top-row buttons=${JSON.stringify(read.topButtons)} `
        + `viewport=${read.vp.w}x${read.vp.h} — the shared HUD row must keep Armoury and Menu present and wholly inside the viewport.`);
    } else {
      ok(`P6/one-renderer ${cell} ${screen} — Armoury and Menu are whole inside the viewport`);
    }
  }

  const unmarked = mapR.bars.filter((b) => !b.id || b.cur == null || b.max == null || b.role !== 'img' || !b.aria);
  if (unmarked.length) {
    fail(`FINDING P6/one-renderer cell=${cell} — ${unmarked.length} map bar(s) carry no machine-readable home `
      + `(data-res/data-cur/data-max/role=img). Sample: ${JSON.stringify(unmarked[0])}. That home is what makes the map `
      + 'bars readable by this tool and by assistive tech, and a bar without it is not the shared component.');
  } else {
    ok(`P6/one-renderer ${cell} — every map bar carries data-res/data-cur/data-max/role=img`);
  }

  // ---- P1 ROWS ------------------------------------------------------------
  const mapIds = mapR.bars.map((b) => b.id);
  const comIds = comR.bars.map((b) => b.id);
  const duplicatesOf = (ids) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  const duplicateMap = duplicatesOf(mapIds);
  const duplicateCombat = duplicatesOf(comIds);
  const missing = comIds.filter((id) => !mapIds.includes(id));
  const extra = mapIds.filter((id) => !comIds.includes(id));
  if (duplicateMap.length || duplicateCombat.length || missing.length || extra.length) {
    fail(`FINDING P1/rows cell=${cell} map=${JSON.stringify(mapIds)} combat=${JSON.stringify(comIds)} `
      + `duplicates map=${JSON.stringify(duplicateMap)} combat=${JSON.stringify(duplicateCombat)} `
      + `missing-from-map=${JSON.stringify(missing)} extra-on-map=${JSON.stringify(extra)} — the two screens no longer `
      + 'draw exactly one copy of the same top-HUD rows. Poise belongs on the combat player card, not here.');
  } else {
    ok(`P1/rows ${cell} — map and combat both ${JSON.stringify(mapIds)}`);
  }

  // P1V VERTICAL ORDER — each resource owns one row. The flattened order is
  // already held above; this closes the structural gap where MP and SP kept the
  // right sequence while sharing one horizontal band.
  for (const [screen, read, ids] of [['map', mapR, mapIds], ['combat', comR, comIds]]) {
    const flat = read.lines.flat();
    const onePerLine = read.lines.every((line) => line.length === 1);
    const renderedVertical = read.lineBoxes.length === read.lines.length
      && read.lineBoxes.every((box, i, boxes) => i === 0 || box.top > boxes[i - 1].top + PX_TOL);
    if (!onePerLine || JSON.stringify(flat) !== JSON.stringify(ids) || !renderedVertical) {
      fail(`FINDING P1V/vertical cell=${cell} screen=${screen} lines=${JSON.stringify(read.lines)} boxes=${JSON.stringify(read.lineBoxes)} rows=${JSON.stringify(ids)} `
        + '— the canonical HUD must stack HP, MP, SP vertically, one resource per row; MP must be above SP, never beside it.');
    } else {
      ok(`P1V/vertical ${cell} ${screen} — ${JSON.stringify(read.lines)}; one rendered resource row below the prior row`);
    }
  }

  // ---- per shared row -----------------------------------------------------
  for (const id of [...new Set(mapIds.filter((x) => comIds.includes(x)))]) {
    const m = mapR.bars.find((b) => b.id === id);
    const c = comR.bars.find((b) => b.id === id);
    const tag = `${cell} ${id}`;

    // P2 SAME ASK — the RAW inline values, compared as strings, exact, no
    // tolerance. Strings and not parsed numbers, because the corpus caught that
    // too: a plant that wrote `calc(4% + 2px)` produced NaN on both screens,
    // and `NaN === NaN` is false, so two IDENTICAL asks were reported as a
    // divergence. The claim here is "the two screens asked for the same thing",
    // and that is a claim about what the renderer wrote, not about what this
    // tool could parse of it.
    const askM = parseFloat(m.askTrough);
    const askC = parseFloat(c.askTrough);
    if (m.cur !== c.cur || m.max !== c.max) {
      fail(`FINDING P2/same-ask ${tag} map=${m.cur}/${m.max} combat=${c.cur}/${c.max} — the two screens are not `
        + 'showing the same character, so every comparison below it is about two different states.');
      continue;
    }
    if (m.askTrough !== c.askTrough) {
      fail(`FINDING P2/same-ask ${tag} trough map=${m.askTrough} combat=${c.askTrough} (cur/max ${m.cur}/${m.max}) `
        + '— the same character, the same resource, two different trough lengths. This is the E9 defect itself: '
        + 'one plan builder, one reference table, and the two screens disagree about what the length should be.');
    } else if (m.askFill !== c.askFill) {
      fail(`FINDING P2/same-ask ${tag} fill map=${m.askFill} combat=${c.askFill} (cur/max ${m.cur}/${m.max}) `
        + '— the troughs agree and the fills do not.');
    } else {
      ok(`P2/same-ask ${tag} — trough ${m.askTrough}, fill ${m.askFill}, ${m.cur}/${m.max}, identical on both screens`);
    }

    // P2B THE ASK IS READABLE AS A PERCENTAGE. Everything below reads these two
    // as numbers; an unreadable one must be a NAMED finding rather than a NaN
    // quietly poisoning P3 and P5 with a message about the wrong subject.
    let readable = true;
    for (const [who, b] of [['map', m], ['combat', c]]) {
      const t = parseFloat(b.askTrough);
      const f = parseFloat(b.askFill);
      if (!Number.isFinite(t) || !Number.isFinite(f) || !/%\s*$/.test(String(b.askTrough))) {
        readable = false;
        fail(`FINDING P2B/readable ${tag} ${who} asked trough=${b.askTrough} fill=${b.askFill} — the renderer wrote `
          + 'a width this tool cannot read as a plain percentage. The trough length IS the claim about the maximum; '
          + 'a length nothing can read back is not a claim anyone can check.');
      }
    }

    // P7 VISIBLE CARD — the full reference track is geometry only. The visible
    // bordered card must stop just after the scaled trough instead of drawing a
    // full-width empty box that makes every maximum look identical.
    for (const [who, b] of [['map', m], ['combat', c]]) {
      if (!b.frame) {
        fail(`FINDING P7/card ${tag} ${who} — no .rescard-frame; the full reference track is still the visible bordered card.`);
        continue;
      }
      const pad = b.frame.padAfterBar;
      if (pad < 2 || pad > 12) {
        fail(`FINDING P7/card ${tag} ${who} right-padding=${pad.toFixed(2)} px — the visible card must end after the scaled trough with only small right padding.`);
      } else if (askM < 99 && b.frame.width >= b.unitWidth - 1) {
        fail(`FINDING P7/card ${tag} ${who} frame=${b.frame.width.toFixed(2)} px reference=${b.unitWidth.toFixed(2)} px — the full reference track is visible instead of remaining invisible.`);
      } else {
        ok(`P7/card ${tag} ${who} — frame ${b.frame.width.toFixed(2)} px of ${b.unitWidth.toFixed(2)} px reference; ${pad.toFixed(2)} px after bar`);
      }
    }
    if (readable) ok(`P2B/readable ${tag} — both asks are plain percentages`);

    // P2C THE FILL IS cur/max. P2 proves the two screens agree about the fill;
    // it cannot tell agreement from agreeing on the WRONG number, and P5 only
    // asks whether the ask arrived as ink. Without this, a renderer that
    // computed the fill at 0.9x would pass every other check in this file.
    {
      const wantFillPct = m.max > 0 ? Math.max(0, Math.min(100, (m.cur / m.max) * 100)) : 0;
      const gotFillPct = parseFloat(m.askFill);
      if (readable && Math.abs(gotFillPct - wantFillPct) > 0.01) {
        fail(`FINDING P2C/fill-is-cur-over-max ${tag} asked fill=${m.askFill} want=${wantFillPct.toFixed(2)}% `
          + `(${m.cur} of ${m.max}) — the fill has stopped being the fraction of the pool that is left.`);
      } else if (readable) {
        ok(`P2C/fill-is-cur-over-max ${tag} — ${m.cur}/${m.max} = ${m.askFill}`);
      }
    }
    if (!readable) continue;

    // P3 HIS SCALE — the wire from the reference table to the render.
    const ref = referenceFor(id, refTable);
    if (ref == null) {
      unk(`P3/his-scale ${tag} — this row has no reference in his ruling (its ceiling stays derived from content); `
        + 'not measured here and counts toward nothing.');
    } else {
      const want = Math.min(100, (m.max / ref) * 100);
      // The renderer prints three decimals; compare at that resolution rather
      // than exactly, because the difference between 18 and 18.000 is the
      // formatter and not the game.
      const near = (a, b2) => Math.abs(a - b2) < 0.001;
      if (!near(askM, want)) {
        fail(`FINDING P3/his-scale ${tag} asked=${askM}% want=${want.toFixed(3)}% (max ${m.max} of reference ${ref}) `
          + '— the trough is no longer measured against his reference. The usual cause is the row losing its '
          + '`domainMax`, at which point the ceiling silently reverts to the derived population and BOTH screens '
          + 'agree with each other about the wrong number.');
      } else {
        ok(`P3/his-scale ${tag} — ${m.max} of ${ref} = ${askM}%`);
      }
    }

    // P4 PERCENTAGE AUTHORITY — no absolute width floor may override the ask.
    for (const [who, b] of [['map', m], ['combat', c]]) {
      const minWidth = parseFloat(b.minWidth);
      if (b.floored || b.dashed || (Number.isFinite(minWidth) && minWidth > 0.01)) {
        fail(`FINDING P4/percentage ${tag} ${who} min-width=${b.minWidth} floored=${b.floored} dashed=${b.dashed} `
          + '— an absolute-width override is replacing the max/reference percentage. Different maxima must not collapse to one pixel floor.');
      } else {
        ok(`P4/percentage ${tag} ${who} — min-width 0, no floor stamp, solid percentage trough`);
      }
    }

    // P5 INK — the ask arrived as pixels.
    for (const [who, b] of [['map', m], ['combat', c]]) {
      const wantTrough = (parseFloat(b.askTrough) / 100) * b.track;
      const dT = Math.abs(b.trough - wantTrough);
      if (dT > PX_TOL) {
        fail(`FINDING P5/ink ${tag} ${who} trough rendered ${b.trough.toFixed(3)} px, asked ${b.askTrough} of a `
          + `${b.track.toFixed(3)} px track = ${wantTrough.toFixed(3)} px, off by ${dT.toFixed(3)} px (tolerance ${PX_TOL}) `
          + '— the proportion the two screens agree on is not the proportion either of them drew.');
      } else {
        ok(`P5/ink ${tag} ${who} trough ${b.trough.toFixed(3)} px vs asked ${wantTrough.toFixed(3)} px (${dT.toFixed(3)} px)`);
      }
      const content = b.trough - b.inset;
      const wantFill = (parseFloat(b.askFill) / 100) * content;
      const dF = Math.abs(b.fill - wantFill);
      if (dF > PX_TOL) {
        fail(`FINDING P5/ink ${tag} ${who} fill rendered ${b.fill.toFixed(3)} px, asked ${b.askFill} of a `
          + `${content.toFixed(3)} px trough interior = ${wantFill.toFixed(3)} px, off by ${dF.toFixed(3)} px `
          + `(tolerance ${PX_TOL}).`);
      } else {
        ok(`P5/ink ${tag} ${who} fill ${b.fill.toFixed(3)} px vs asked ${wantFill.toFixed(3)} px (${dF.toFixed(3)} px)`);
      }
    }
  }
}

function boundary() {
  console.log('');
  console.log('BOUNDARY — printed every run, green or red, because a gate that prints only PASS is');
  console.log('  "green wasn\'t clearance" shipped as infrastructure:');
  console.log('  · THE MAP AND COMBAT TRACKS SHARE THE SAME TOP-ROW GEOMETRY. Their secondary chrome still');
  console.log('    differs below that row, but P4 refuses any absolute-width override of the requested');
  console.log('    percentage. The sweep includes the 320x640 narrow edge.');
  console.log('  · P1 holds top-HUD HP/MP/SP equality. Combat poise is dynamic on the player character card;');
  console.log('    this tool does not judge that model-surface placement (hudbars A11 does).');
  console.log('  · coop.js meterBars() still hand-writes .bar.hpbar for the under-model strips — a THIRD');
  console.log('    renderer for this grammar. Out of scope here; P6 is scoped to .topbar and cannot see it.');
  console.log('  · WHETHER 500/50 IS A GOOD SCALE IS NOT ASSERTED. It is his ruling; this holds the number.');
  console.log(`  · Headless Chromium on ${process.platform}, one text size, default accent, no colourblind palette.`);
  console.log('  · NOT WIRED INTO ci.yml — between hand-runs SOP 2\'s silence guard makes this `unknown`.');
  if (unknown) console.log(`  · ${unknown} check(s) resolved UNKNOWN in this run and counted toward nothing.`);
  console.log('');
}

async function main() {
  if (args.includes('--selftest')) return selftest();

  if (selectorErrors.length) {
    for (const error of selectorErrors) fail(`FINDING P0/selector — ${error}. A narrowed run may not silently `
      + 'discard requested cases or declare an empty population.');
    boundary();
    console.error(`hudparity: FAIL — ${bad} invalid selector finding(s); no browser work was started`);
    process.exit(1);
  }

  // THE REFERENCE COMES OUT OF THE TREE, NOT OUT OF THIS FILE. See P3.
  const { HUD_REFERENCE_MAX } = await import(pathToFileURL(join(ROOT, 'src/content/resources.js')).href);
  const refTable = HUD_REFERENCE_MAX || {};

  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')));
  const s = await serve({ root: ROOT, port: Number(argOf('--port') || 8477), open: false });
  const base = `http://localhost:${s.port}/`;
  console.log(`hudparity — ${base} (root ${ROOT})`);
  console.log('DOOR: source tree over http in headless Chromium; each screen reached by its own ?shot=');
  console.log('      state; pools posed through the run\'s own fields (main.js reach doors, the same fields');
  console.log('      a curse and an armour mod write); every box read with getBoundingClientRect() off the');
  console.log('      live page. The reference table is imported from src/content/resources.js so it cannot');
  console.log('      drift from the render — P3R is the one line that says what it should BE.');
  console.log(`      reference read from the tree: HP ${refTable.hp}, pools ${refTable.pool}`);
  if (onlyShape || onlyPose) {
    console.log(`      NARROWED POPULATION (declared): shape=${onlyShape || 'all'} pose=${onlyPose || 'all'}`);
  }

  // ---- P3R — HIS RULING, CHECKED AGAINST THE ONE TYPED COPY ---------------
  if (refTable.hp !== HIS_REFERENCE.hp || refTable.pool !== HIS_REFERENCE.pool) {
    fail(`FINDING P3R/reference src/content/resources.js HUD_REFERENCE_MAX = `
      + `{ hp: ${refTable.hp}, pool: ${refTable.pool} }, his ruling of 2026-08-22 is `
      + `{ hp: ${HIS_REFERENCE.hp}, pool: ${HIS_REFERENCE.pool} } — the reference moved without this gate moving `
      + 'with it. If he changed his mind, change this line in the same act; if he did not, the scale is wrong.');
  } else {
    ok(`P3R/reference — HP ${refTable.hp} / pools ${refTable.pool}, his ruling`);
  }

  const browserPath = resolveBrowser();
  if (!browserPath) {
    console.error('hudparity: UNKNOWN — no Chrome/Chromium found (tried $CHROME, $CHROME_PATH and the usual paths).');
    console.error('           Exit 2, not 1: nothing was measured, so this is not a verdict about the screen.');
    boundary();
    closeServer(s);
    process.exit(2);
  }
  console.log(`      browser: ${browserPath}`);

  const expected = SHAPES.length * POSES.length;
  let reached = 0;
  let cdp = null;
  let dropBrowser = null;
  let fatal = null;

  try {
    const launched = await launchBrowser({ prefix: 'hudparity-', browser: browserPath, timeoutMs: 15000 });
    dropBrowser = launched.close;
    cdp = connectCdp(launched.wsUrl);
    await cdp.ready;

    for (const vp of SHAPES) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      await cdp.send('Page.enable', {}, S);
      await cdp.send('Runtime.enable', {}, S);
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);

      const ev = async (e) => {
        const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
        return r.result.value;
      };
      // A HARD BOUND ON EVERY WAIT. A screen that never mounts is a finding, not
      // a hang: the run has to reach its boundary block either way.
      const until = async (x, what, ms = 25000) => {
        const t = Date.now();
        while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return true; await wait(150); }
        return false;
      };

      console.log(`\n  ${vp.tag}`);
      for (const pose of POSES) {
        const cell = `${vp.tag}/${pose.tag}`;
        const reads = {};
        for (const sc of SCREENS) {
          // about:blank BETWEEN SCREENS: two ?shot= boots in one tab otherwise
          // share a document that has already run its boot hook, and the second
          // read can be of the first screen still on the page.
          await cdp.send('Page.navigate', { url: 'about:blank' }, S);
          await wait(120);
          await cdp.send('Page.navigate', { url: `${base}?shot=${sc.shot}${pose.q}` }, S);
          const mounted = await until(`!!document.querySelector('${sc.ready} .resbar') || !!document.querySelector('${sc.ready}')`,
            `${sc.tag} ${cell}`);
          if (!mounted) {
            fail(`FINDING P0/population cell=${cell} screen=${sc.tag} never mounted within 25 s at `
              + `?shot=${sc.shot}${pose.q} — nothing was measured on this screen.`);
            reads[sc.tag] = null;
            continue;
          }
          await wait(700);
          reads[sc.tag] = await ev(READ).catch((e) => { fail(`FINDING P0/population cell=${cell} screen=${sc.tag} read threw — ${e.message}`); return null; });
        }
        reached++;
        judgeCell(cell, reads.map, reads.combat, refTable);
      }
      await cdp.send('Target.closeTarget', { targetId });
    }
  } catch (e) {
    // LATCH THE FATAL. It is counted as a finding and the run still closes what
    // it opened and prints its boundary — an exception must never be able to
    // leave a green behind it, and it must never skip the boundary either.
    fatal = e;
    fail(`FINDING P0/population — the run threw and stopped early: ${e && e.stack ? e.stack.split('\n')[0] : e}`);
  }

  if (reached !== expected) {
    fail(`FINDING P0/population reached=${reached} declared=${expected} — a check that quietly measures fewer `
      + 'cells than it declares prints a confident green over a smaller world.');
  } else {
    ok(`P0/population reached=${reached} declared=${expected} (${SHAPES.length} shape(s) x ${POSES.length} pose(s), 2 screens each)`);
  }

  cdp?.close();
  if (dropBrowser) await dropBrowser();
  closeServer(s);

  boundary();

  // ---- THE ONE EXIT, AND THE SHAPE IS DELIBERATE -------------------------
  //
  // LATCH THE FATAL, CLOSE WHAT YOU OPENED, PRINT, THEN END — in that order,
  // through ONE exit. `bad` only ever goes up and nothing consults it to decide
  // whether to keep going, so a green can never overwrite a non-green: the only
  // code this process can return is derived from the latch, once, here.
  //
  // AND THE EXIT IS EXPLICIT, WHICH IS THE PART I GOT WRONG FIRST. The advice I
  // was given was to drop `process.exit()` for a bare `process.exitCode` and
  // let the process end naturally. MEASURED: it does not end. `tools/serve.mjs`
  // returns `{ server, url, port }` and NO `close` — so the `await s.close?.()`
  // every browser tool in this tree writes is an optional-call on `undefined`,
  // a no-op, and the listening server holds the event loop open forever. Both
  // my first clean run and my first --selftest printed a correct verdict and
  // then HUNG until an outer timeout killed them; the selftest's per-plant
  // spawn timeout would have turned that into a 49-minute silence.
  // `process.exit()` is what has been hiding it tree-wide (displayfirst.mjs
  // calls it and is fine). So: close the server for real via `s.server.close()`,
  // AND exit explicitly. Exiting naturally is only correct when the process has
  // nothing left holding it, and that is a property of what you opened — not a
  // style rule.
  if (bad) {
    console.error(`hudparity: FAIL — ${bad} finding(s) across ${reached} cells, ${checks} checks passed`);
    process.exit(1);
  }
  if (fatal) {
    // Unreachable while the catch above counts a finding; kept because a future
    // edit that stops counting it must not silently become a pass.
    console.error(`hudparity: FAIL — the run threw: ${fatal}`);
    process.exit(1);
  }
  console.log(`hudparity: OK — ${checks} checks passed`);
  process.exit(0);
}

/**
 * Close the dev server for real. `serve()` hands back `{ server, url, port }`
 * and nothing else, so the `s.close?.()` idiom this tree uses everywhere is a
 * silent no-op. Defensive about both shapes so this keeps working the day
 * serve.mjs grows a `close`.
 */
function closeServer(s) {
  try {
    if (s && typeof s.close === 'function') { s.close(); return; }
    if (s && s.server && typeof s.server.close === 'function') {
      s.server.closeAllConnections?.();
      s.server.close();
    }
  } catch { /* a janitor may not hold verdict power (tools/browser.mjs) */ }
}

// ---------------------------------------------------------------------------
// --selftest — the same-door known-bad corpus.
//
// FOURTEEN PLANTS/CLI EDGES, and each one is aimed at THIS TOOL'S SUBJECT rather than at a
// symptom near it. The question asked of every plant was: if the thing this
// check guards were deleted, would this go red? The subject is "the two screens
// draw the same character at the same proportions, at his reference".
// ---------------------------------------------------------------------------
async function selftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  const plants = [
    {
      // The cap is data, but the acceptance number is independent. Moving the
      // sole app authority must turn P8 red rather than moving its goalpost.
      name: 'the configurable shared HUD cap moves from 40 to 60 percent',
      file: 'src/content/balance.js',
      find: 'main: { scaleByMax: true, maxViewportPct: 40 },',
      replace: 'main: { scaleByMax: true, maxViewportPct: 60 },',
      expectRed: /FINDING P8\/top-row .*configured cap="60vw"/,
    },
    {
      // Both screens must carry the same centred floor/cinder receipt.
      name: 'the map drops the centred floor and cinder receipt',
      file: 'src/ui/screens/map.js',
      find: '          ${hudCenterHtml({ cinders: run.cinders, floor: run.floor, floorTotal: map.floors })}',
      replace: '          <!-- centred HUD receipt removed by plant -->',
      expectRed: /FINDING P8\/top-row .* map meta=null/,
    },
    {
      // 1 — THE SECOND RENDERER COMES BACK. The literal `git revert` of this
      // change's core edit: the map hand-writes its own health bar again.
      name: 'the map hand-writes its own .hpbar again (the pre-E9 shape)',
      file: 'src/ui/screens/map.js',
      find: '          <div class="resbars-host"></div>',
      replace: '          <div class="bar hpbar"><div class="fill" style="width:50%"></div><div class="label">HP</div></div>',
      expectRed: /FINDING P6\/one-renderer .*\.topbar \.hpbar count/,
    },
    {
      // Poise belongs on the combat player card, not in the canonical top HUD.
      name: 'poise returns to the combat top HUD',
      file: 'src/content/resources.js',
      find: "    surfaces: ['model'],\n    source: 'poise',",
      replace: "    surfaces: ['main', 'model'],\n    source: 'poise',",
      expectRed: /FINDING P1\/rows .*missing-from-map=\["poise"\]/,
    },
    {
      // The reference track may remain full width only if it is invisible.
      name: 'the visible card frame is removed, exposing the full reference track',
      file: 'src/ui/components/resbars.js',
      find: '  unit.appendChild(frame);',
      replace: '  /* card frame removed by plant */',
      expectRed: /FINDING P7\/card .*no \.rescard-frame/,
    },
    {
      // MP and SP must not silently return to their former horizontal band.
      name: 'the shared renderer groups SP beside MP again',
      file: 'src/ui/components/resbars.js',
      find: '    if (bar.band && prev && prev[0].band === bar.band) prev.push(bar);',
      replace: "    if (bar.id === 'stamina' && prev) prev.push(bar);",
      expectRed: /FINDING P1V\/vertical .*\[\["hp"\],\["mana","stamina"\]\]/,
    },
    {
      // The supported short-wide composition must not turn three DOM rows into
      // three rendered columns. The reader measures their real screen boxes.
      name: 'short-wide lays the three resource rows out as columns',
      file: 'styles/combat.css',
      append: ":root[data-composition='short-wide'] .resbars[data-surface='main'] { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); }",
      expectRed: /FINDING P1V\/vertical cell=844x340\/.*boxes=/,
    },
    {
      // A SECOND COPY OF THE SHARED RENDERER. Membership-only comparison used
      // to print this literal doubled HUD inside its own green P1 line.
      name: 'the map mounts the shared resource HUD twice',
      file: 'src/ui/screens/map.js',
      find: "    resHost.appendChild(resourceBars(mapPlan, { surface: 'main' }));",
      replace: "    resHost.appendChild(resourceBars(mapPlan, { surface: 'main' }));\n    resHost.appendChild(resourceBars(mapPlan, { surface: 'main' }));",
      expectRed: /FINDING P1\/rows .*duplicates map=/,
    },
    {
      // THE SHARED TOP-ROW CONTROLS LEAVE THE VIEWPORT. The bars can still
      // agree while the player-facing HUD is no longer usable.
      name: 'the map top-row controls are pushed outside the viewport',
      file: 'styles/map.css',
      append: '.map-header .hud-top .topbar-btn { transform: translateX(1000px); }',
      expectRed: /FINDING P6\/one-renderer .*screen=map top-row buttons=/,
    },
    {
      // 2 — THE SHARED RENDERER, THE MAP'S OWN CEILING. The map keeps
      // resbars.js and stops passing the domain table, so resourceBarPlan falls
      // back to `domain = val.max` and every map trough draws 100 %. THIS IS
      // THE DEFECT CLASS E9 EXISTS TO KILL and it is invisible to plant 1's
      // check: the map is using the shared component, and lying anyway.
      name: 'the map uses the shared renderer against its OWN ceiling (100 % everywhere)',
      file: 'src/ui/screens/map.js',
      find: "resourceBarPlan(registries, 'main', run, run, resourceDomains(registries))",
      replace: "resourceBarPlan(registries, 'main', run, run, null)",
      expectRed: /FINDING P2\/same-ask .*trough map=/,
    },
    {
      // 3 — THE WIRE FROM HIS RULING TO THE RENDER IS CUT. The row stops
      // carrying `domainMax`, so the ceiling silently reverts to the derived
      // population — and BOTH screens agree about the wrong number, so P2 is
      // green. Only P3 can see this one.
      name: 'the hp row loses domainMax, so the ceiling reverts to the derived population',
      file: 'src/content/resources.js',
      find: "    source: 'hp',\n    domainMax: HUD_REFERENCE_MAX.hp,",
      replace: "    source: 'hp',",
      expectRed: /FINDING P3\/his-scale .*no longer measured against his reference|FINDING P3\/his-scale .*want=/,
    },
    {
      // 4 — HIS NUMBER MOVES. Both screens agree, the wire is intact, and the
      // scale is not the one he ruled. Only the typed copy can see this.
      name: 'the reference is quietly changed from 500 to 200',
      file: 'src/content/resources.js',
      find: '  hp: 500,',
      replace: '  hp: 200,',
      expectRed: /FINDING P3R\/reference/,
    },
    {
      // 5 — AN ABSOLUTE FLOOR OVERRIDES THE PERCENTAGE. This is the pre-decision
      // shape that collapsed several maxima to the same 16 px trough.
      name: 'an absolute minimum width overrides the requested percentage',
      file: 'styles/combat.css',
      find: '  min-width: 0;\n}\n.resbar > .fill',
      replace: '  min-width: 16px;\n}\n.resbar > .fill',
      expectRed: /FINDING P4\/percentage .*min-width=16px/,
    },
    {
      // 6 — THE NEIGHBOURHOOD OF PX_TOL. A stray clamp takes exactly 2 px off
      // every trough that asks for its whole track, so the ask is still a plain
      // readable percentage and the INK is 2 px short of it — which is the one
      // thing P5 exists to see. It bites at the `high` pose, where every trough
      // asks 100 %, which is why the corpus runs two poses.
      //
      // ONE STEP OF THE THRESHOLD'S OWN UNIT EITHER SIDE, MEASURED: this cell
      // reports 1.813 px against PX_TOL = 1 and is RED; the clean cells report
      // at most 0.305 px and are GREEN. Move the threshold to 2 and the plant
      // goes green; move it to 0 and the clean run goes red. Both cells enter
      // by the same door — file bytes in a copied real tree. (1.813 and not a
      // round 2 because the clamp resolves against a sub-pixel track under
      // --ui-zoom; the number is the tool's own, not the plant's intention.)
      //
      // AN EARLIER VERSION OF THIS PLANT WROTE `calc(4% + 2px)` INTO THE INLINE
      // WIDTH and was a RED-FOR-WRONG-REASON: it made the ask itself
      // unparseable, so the tool went red about NaN in P3 instead of about ink
      // in P5. Recorded rather than quietly swapped — the corpus found a real
      // hole in the tool (P2B now names an unreadable ask) and a real hole in
      // the plant (it was aimed at the ask, not at the ink).
      name: 'a stray clamp takes 2 px of ink off every full-track trough (PX_TOL neighbourhood)',
      file: 'styles/combat.css',
      append: ".resbars[data-surface='main'] .resbar { max-width: calc(100% - 2px); }",
      expectRed: /FINDING P5\/ink .*trough rendered/,
    },
    {
      // 7 — THE EMPTY EDGE. The map's HUD host is never found, so the map draws
      // no bars at all. A check that only hunts for mismatches finds none here
      // and reports green over a screen with no HUD on it.
      name: 'the map HUD host is never found, so the map draws no bars (the empty edge)',
      file: 'src/ui/screens/map.js',
      find: "const resHost = app.querySelector('.map-header .resbars-host');",
      replace: "const resHost = app.querySelector('.map-header .resbars-host-gone');",
      expectRed: /FINDING P0\/population .*rendered NO main-HUD bars|FINDING P0\/population .*mapBars=0/,
    },
    {
      // A SOCKET DROPS BETWEEN TWO REAL CDP COMMANDS. The next send must reject
      // within its own bound, then the tool must print its boundary and exit
      // nonzero instead of leaving a promise in `pending` forever.
      name: 'the CDP socket drops between screen navigations',
      file: 'tools/hudparity.mjs',
      find: "          await cdp.send('Page.navigate', { url: 'about:blank' }, S);",
      replace: "          await cdp.send('Page.navigate', { url: 'about:blank' }, S);\n          cdp.close();",
      expectRed: /FINDING P0\/population — the run threw and stopped early: Error: CDP WebSocket/,
    },
  ];
  // NARROWED ON PURPOSE AND SAID OUT LOUD: sixteen file-byte plants plus the
  // clean re-run are seventeen browser boots. The four argv plants below start no browser.
  // The door population is ONE
  // shape and TWO poses — 844x340, shipped and high — and the pair is chosen,
  // not defaulted: `shipped` is the only cell carrying unfloored HP beside
  // FLOORED MP and SP with their dash (P4), and `high` is the only cell where every trough asks
  // for its whole track, which is what the PX_TOL plant needs to bite. Either alone
  // leaves a plant with nowhere to land. The DOOR is unnarrowed, which is the
  // axis the corpus is about.
  const code = await doorSelftest({
    tool: 'hudparity.mjs',
    args: ['--only-shape', '844x340', '--only-pose', 'shipped,high', '--port', '8478'],
    plants,
    timeoutMs: 420000,
  });
  // CLI selectors enter through argv, so these plants use that same door rather
  // than mutating source bytes. Every bad selector must fail before a browser
  // starts, and both the typo-only and mixed-valid-invalid shapes are held.
  const { spawnSync } = await import('node:child_process');
  const selectorCases = [
    { name: 'typo-only shape selector', args: ['--only-shape', '1440x680', '--only-pose', 'shipped'] },
    { name: 'mixed valid and invalid pose selector', args: ['--only-shape', '390x844', '--only-pose', 'shipped,typo'] },
    { name: 'repeated shape selector flag', args: ['--only-shape', '390x844', '--only-shape', '1440x860'] },
    { name: 'duplicate pose selector value', args: ['--only-shape', '390x844', '--only-pose', 'shipped,shipped'] },
  ];
  let selectorFailed = 0;
  for (const edge of selectorCases) {
    const run = spawnSync(process.execPath, [join(ROOT, 'tools/hudparity.mjs'), ...edge.args], {
      cwd: ROOT, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
    });
    const output = `${run.stdout || ''}\n${run.stderr || ''}`;
    if (run.status !== 0 && /FINDING P0\/selector/.test(output) && /BOUNDARY/.test(output)) {
      console.log(`  CAUGHT  "${edge.name}" -> argv — exit ${run.status}; selector red and boundary printed`);
    } else {
      selectorFailed++;
      console.error(`  UNCAUGHT  "${edge.name}" -> argv — exit ${run.status}; expected selector red and boundary`);
    }
  }
  // THE COUNTED VERDICT LINE, and the count is DERIVED from the corpus rather
  // than typed — `plants observed red` is one of tools/verdict.mjs's known
  // nouns, so this line survives readVerdict and a run that catches fewer
  // plants prints no verdict at all rather than a smaller confident one.
  const total = plants.length + selectorCases.length;
  if (code === 0 && selectorFailed === 0) console.log(`hudparity --selftest: OK — ${total}/${total} plants observed red`);
  process.exit(code || selectorFailed ? 1 : 0);
}

main().catch((e) => {
  // The top-level net. `main` already latches its own throws; this catches one
  // raised outside the try (an import, the server) and still ends non-green.
  console.error(`hudparity: ${(e && e.stack) || e}`);
  process.exitCode = 1;
});
