// tools/mapplan.mjs — the data-driven tooling for map config (SPEC §6).
//
// Constantine: "make this configurable by data driven tooling." Marina's ruling
// is that a knob-turning preview REQUIRES a readout, so this is one tool with
// two halves and neither ships without the other:
//
//   READOUT   what every floor rule RESOLVES TO at a given act length —
//             "fixed treasure -> floor 9 (fraction 0.64 of 14 rollable)".
//             Turn `floors` to 10 and read floor 6. That is the feature.
//   CHECK     whether the resulting maps hold their promises, ACROSS A
//             DISTRIBUTION and never on one seed.
//
// WHY A DISTRIBUTION IS THE WHOLE POINT (Marina, from Freja's 24-seed run):
// node count per act is 57.3 mean over a 46-64 range. A tool that generates one
// seed and reports 46 has said nothing, and a tool that generates one seed and
// reports 57 has said nothing either — it is the same green a tool gives when
// it checked nothing (`verify-shipped: OK - 0 checks passed`). Every number
// below is n seeds with its range printed beside it, and the range is not
// decoration: a promise that holds at the mean and fails at the tail is broken.
//
// Usage
//   node tools/mapplan.mjs                      readout + check, shipped acts
//   node tools/mapplan.mjs --floors 10          preview a different act length
//   node tools/mapplan.mjs --floors 10 --columns 6 --paths 6
//   node tools/mapplan.mjs --seeds 48           widen the distribution
//   node tools/mapplan.mjs --selftest           the known-bad corpus, only
//   node tools/mapplan.mjs --shape floors=8,columns=4,elite=40
//                                               DEFAULT vs SHAPED — the debug
//                                               run-shape knobs, asserted
//   node tools/mapplan.mjs --shape-selftest     the run-shape known-bad corpus
//   node tools/mapplan.mjs --selftest           the known-bad corpora, only
//   node tools/mapplan.mjs --margins            the pair census; exit 1 on a collision
//
// Exit codes
//   0  every act resolves, and every promise holds across the distribution
//   1  a finding
//   2  usage, or NOTHING RUN — which is unknown, never a pass
//
// OBSERVED RED: `--selftest` carries the corpus this tool exists to turn red —
// six inputs that `floorRules: opt(any)` accepted in silence, plus the shipped
// `15: 'shrine'` rule that had never fired. Numbers in the handback. The corpus
// is Vira's from the #43 audit and Viki's `requires: opt(any)` is its second
// instance, so it is not fitted to the one case we happened to find.
//
// AND THE MARGINS, 2026-08-08. A derived refusal that prints a VERDICT and not a
// MARGIN cannot be watched: `columns ≤ 9` said accepted and never "by 2%", and
// the circles that grew to meet the tap floor closed the space between them in
// the same stroke. Both axes compute a margin with a floor that can go red now,
// and the rows that falsify them are in this file — the corpus
// `model/validate.js` already points at, so its pointer is not a dangling one.
//
// THE PAIR CENSUS IS THE PART THAT CAUGHT SOMETHING REAL, and it caught it only
// after Sunna corrected the shape: the first version measured `ROW_H - 2*NODE_R`,
// two identical circles, on a screen whose one colliding pair is the BOSS over
// the top shrine — different radius, so the invariant could not express the pair
// that was actually red. `--margins` ranges over the pairs that exist and EXITS 1
// TODAY on that overlap: -3.7 SVG units, rendered in every act since #107.
//
// REMOVAL CONDITION: deleted the day floor rules carry no anchors (nothing to
// resolve, so no readout to print), or on Constantine's word.

import { mapConfigs, MAP_SHAPE_LIMITS } from '../src/content/mapconfig.js';
import { balance } from '../src/content/balance.js';
import { resolveFloorPlan, describePlan, rollableFloors, applyRunShape, minViableFloors } from '../src/model/floorplan.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { createRng, sweepSeed } from '../src/engine/rng.js';
import {
  viewRefusals, geometryRefusals, spanWidth, maxFanoutSpan, PHONE_VIEW_W, ZOOM_MIN,
  fanoutMargin, maxFittingColumns, maxSafeColumns, FANOUT_SLACK_MIN,
  pairAir, maxTapDefault, NODE_AIR_MIN_PX, BOOT_GATED_PAIRS, COL_X, ROW_H, NODE_R, REF_ZOOM,
  ZOOM_STEPS, MAP_ZOOM_DEFAULT, mapZoomDefaultIsLegal,
  PHONE_UI_ZOOM, PHONE_UI_ZOOM_MIN, TAP_TARGET_DEFAULT,
} from '../src/model/mapview.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../src/model/validate.js';

const args = process.argv.slice(2);
const argOf = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const numOf = (f, d) => { const v = argOf(f); return v == null ? d : Number(v); };
const SEEDS = numOf('--seeds', 24);
const selftestOnly = args.includes('--selftest');

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
// createRng takes a uint32 — `createRng('mapplan-3')` is `'mapplan-3' >>> 0`,
// which is 0, for every i. My first run of this tool reported 24 seeds with a
// range of 52-52 and I nearly shipped it: that was ONE seed measured 24 times,
// wearing a distribution's clothes. The referent gate below exists because of
// it, and it is the same failure this tool was written to catch in content.
//
// THE FUNCTION MOVED, THE STORY STAYED. `seedOf` used to be defined here, and
// then the Custom Climb screen needed the same sweep to print a live estimate —
// at which point a second copy of this arithmetic would have been two sweeps
// that could disagree about what "24 seeds" means. It is `sweepSeed` in
// engine/rng.js now, imported below, and the paragraph above is why it exists.
const seedOf = (i) => sweepSeed(i);
const rng2 = (i) => createRng(seedOf(i));

// --------------------------------------------------------------------- probes
// Reachability, MEASURED. `minElites` counts nodes in the whole graph — Freja
// found the old name `minReachableElites` promised a property nothing checked,
// and that 8 of 104 starts at 15x7 can reach no Elite at all. Renaming it was
// the honest half; this is the other half. Reported, never gated: changing what
// the generator produces is a design call and it is not mine tonight.
function reachableTypes(graph, startId) {
  const seen = new Set([startId]);
  const stack = [startId];
  const types = new Set();
  while (stack.length) {
    const n = graph.nodes[stack.pop()];
    if (!n) continue;
    types.add(n.type);
    for (const id of n.next) if (!seen.has(id)) { seen.add(id); stack.push(id); }
  }
  return types;
}

/** How many columns a set of nodes spans — geometry-free, the camera's input. */
function colSpan(graph, ids) {
  const cs = ids.map((id) => graph.nodes[id].col);
  return Math.max(...cs) - Math.min(...cs) + 1;
}

function measure(config, seeds) {
  const rows = [];
  for (let i = 0; i < seeds; i++) {
    const g = generateActMap({ config, rng: rng2(i) });
    const all = Object.values(g.nodes);
    const byType = {};
    for (const n of all) byType[n.type] = (byType[n.type] || 0) + 1;
    const starts = g.startIds.map((id) => reachableTypes(g, id));
    rows.push({
      nodes: all.length,
      stops: Math.max(...all.map((n) => n.floor)),
      byType,
      // THE WHOLE GRAPH, not its node count — see the referent gate below.
      sig: all.map((n) => `${n.id}:${n.type}>${[...n.next].sort().join(',')}`).sort().join('|'),
      // The framing the camera will be asked to draw, in COLUMNS: the widest
      // (node + everything it connects to), and the entrance row on its own,
      // which is the frame a player meets first and the one Bjorn measured.
      startSpan: colSpan(g, g.startIds),
      fanSpan: Math.max(...all.filter((n) => n.next.length).map((n) => colSpan(g, [n.id, ...n.next]))),
      starts: starts.length,
      noElite: starts.filter((t) => !t.has('elite')).length,
      noMerchant: starts.filter((t) => !t.has('merchant')).length,
      // E13, THE PER-PATH NUMBER THE PROMISE DOES NOT MAKE. `restBeforeElite`
      // guarantees a rest on a floor BELOW the first Elite — a fact about the
      // graph. A walker can still choose a route that reaches an Elite without
      // stopping at one, and that count belongs somewhere a reader can see it
      // rather than in a claim the rule cannot keep (the same split that
      // renamed `minReachableElites` to `minElites`).
      unrestedStarts: g.startIds.filter((id) => reachesEliteWithoutRest(g, id)).length,
      minFloorOf: (type) => { const f = all.filter((n) => n.type === type).map((n) => n.floor); return f.length ? Math.min(...f) : null; },
      floorsOf: (type) => all.filter((n) => n.type === type).map((n) => n.floor),
    });
  }
  return rows;
}

/**
 * Can a walker leaving this node meet an Elite before any Shrine? Only
 * shrine-free prefixes are traversed, so a node in `seen` was already reached
 * without a rest and revisiting it can only repeat the answer.
 */
function reachesEliteWithoutRest(graph, startId) {
  const seen = new Set();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const n = graph.nodes[id];
    if (n.type === 'shrine') continue;
    if (n.type === 'elite') return true;
    for (const nx of n.next) stack.push(nx);
  }
  return false;
}

function dist(rows, pick) {
  const xs = rows.map(pick);
  return { mean: +mean(xs).toFixed(2), min: Math.min(...xs), max: Math.max(...xs), xs };
}
const show = (d) => `${String(d.mean).padStart(6)}  (range ${d.min}-${d.max})`;

// ----------------------------------------------------------------- margins
// Two readouts, one per axis, and they print on the ACCEPTED path — which is the
// whole finding. `columns ≤ 9` said "accepted" and never said "by 2%, with no
// spare column"; `NODE_R` grew to meet the tap floor and closed the gap between
// two adjacent taps to under 3 px, correctly and in silence. A verdict has no
// derivative; a margin does, so both are printed with the NEXT VALUE that takes
// them red beside them.
function printFanoutMargin(config, pad = '  ') {
  const m = fanoutMargin(config);
  if (!m) return;
  console.log(`${pad}MARGIN horizontal   ${(m.headroom * 100).toFixed(1)}% of zoom above the floor`
    + ` · ${m.slack} spare column(s), floor ${m.slackFloor}${m.ok ? '' : '  <-- BELOW THE FLOOR'}`);
  console.log(`${pad}  ^ the ${m.span}-column fan-out MEASURED here survives ${m.slack} more;`
    + ` ${m.span + m.slack + 1} columns needs ${m.nextFit.toFixed(2)}x against a ${ZOOM_MIN}x floor.`);
  console.log(`${pad}  ^ COL_X may reach ${m.maxColX.toFixed(1)} before this width loses its last spare column (today ${COL_X}).`);
}

// THE PAIR CENSUS — every pair of circles this map draws next to each other, not
// the one pair the formula assumed. Sunna found the boss/shrine overlap RENDERED
// while my invariant computed `ROW_H - 2 * NODE_R` and could not express it.
// Returns the number of pairs below the floor, so a caller can exit on it rather
// than print red and return zero.
function printPairAir(pad = '  ', opts = {}) {
  const a = pairAir(opts);
  if (!a.pairs.length) {
    console.log(`${pad}PAIR CENSUS   UNANSWERABLE (${a.why}) — reference zoom ${a.refZoom}, tap default ${JSON.stringify(a.tapPx)}.`);
    return 1;
  }
  console.log(`${pad}PAIR CENSUS   circles solved from balance.ui.tapSize.def = ${a.tapPx} at REF_ZOOM ${a.refZoom}:`
    + ` node r ${a.r}, boss r ${a.bossR}. Floor ${NODE_AIR_MIN_PX} device px of air at 320x640.`);
  let bad = 0;
  for (const p of a.pairs) {
    if (!p.ok) bad++;
    const gated = BOOT_GATED_PAIRS.includes(p.id);
    console.log(`${pad}  ${p.ok ? 'ok  ' : 'RED '} ${p.id.padEnd(11)} ${p.label.padEnd(46)}`
      + ` ${p.gap.toFixed(1).padStart(6)} SVG · ${p.px390.toFixed(2).padStart(6)} px @390 · ${p.px320.toFixed(2).padStart(6)} px @320`
      + `${gated ? '' : '  [not gated at boot]'}`);
  }
  console.log(`${pad}  ^ the tap default may reach ${maxTapDefault()} px before a BOOT-GATED pair goes red.`);
  console.log(`${pad}  ^ 'live' is the only pair that can both be clickable at once — every edge runs floor -> floor+1,`);
  console.log(`${pad}    so a reachable set is one floor (Sunna: 987 live pairs over 2,601 decision moments, all on one floor).`);
  console.log(`${pad}  ^ this arithmetic MATCHES THE RENDERED PAINT to the hundredth on all three pairs. My earlier`);
  console.log(`${pad}    "derivation is the optimistic half" was written against a rounded 2.9 and is withdrawn.`);
  return bad;
}

// ------------------------------------------------------------------- the run
function runAct(label, config, seeds) {
  const findings = [];
  console.log(`\n=== ${label} ===`);
  for (const line of describePlan(config)) console.log(`  ${line}`);

  const { plan, errors } = resolveFloorPlan(config);
  // The view knobs refuse in the same shape and are read out in the same place —
  // one resolution, three readers (the generator, the boot validator, this tool).
  const vrs = viewRefusals(config);
  for (const e of vrs) console.log(`  REFUSED ${e.key}: ${e.msg}`);
  for (const e of errors) findings.push(`${label}: ${e.key} — ${e.msg}`);
  for (const e of vrs) findings.push(`${label}: ${e.key} — ${e.msg}`);
  if (!plan || errors.length || vrs.length) return { findings, cells: 0 };

  const rows = measure(config, seeds);
  const nodes = dist(rows, (r) => r.nodes);
  const stops = dist(rows, (r) => r.stops);

  // REFERENT GATE — a "distribution" with no variance is one seed counted n
  // times, and it is indistinguishable in every printed number from a generator
  // that is genuinely tight. An empty result and a clean result look identical
  // and mean the opposite (SOP 2's ⚙ clause), so the harness proves it moved
  // before any number below is allowed to mean anything.
  //
  // AND IT USED TO ASK THE WRONG QUESTION, which Viki found by turning a knob:
  // `pathCount: 1` builds a corridor whose NODE COUNT is invariant by
  // construction — 13, every seed — while its TYPES vary seed to seed. The gate
  // read the count, concluded the harness was dead, returned `cells: 0`, and the
  // tool exited 2. Exit 2 means unknown. The content was knowable and the tool
  // said it could not look. THREE STATES, not two, and they are separated by
  // asking each question of the thing that can answer it:
  //
  //   the harness      did distinct seeds produce distinct rng streams?
  //   the content      did the whole GRAPH move — ids, types and edges — and
  //                    not merely one summary statistic derived from it?
  //
  // A count that does not move is now a printed fact, never a verdict.
  const shapes = new Set(rows.map((r) => r.sig)).size;
  if (seeds >= 8 && shapes === 1) {
    const streams = new Set(Array.from({ length: seeds }, (_, i) => rng2(i).int('map', 0, 1e9))).size;
    if (streams <= 1) {
      findings.push(`${label}: ${seeds} seeds produced one rng stream. `
        + `That is one seed measured ${seeds} times, not a distribution — the harness is not varying and no number in this block means anything.`);
      return { findings, cells: 0 };
    }
    console.log(`\n  ${seeds} seeds — INVARIANT BY CONSTRUCTION: ${streams} distinct rng streams produced one identical graph.`);
    console.log(`    Not a dead harness and not a finding: this act's knobs leave the generator nothing to vary.`);
    console.log(`    Every promise below is still checked; it is simply checked once and it holds ${seeds} times.`);
  }
  console.log(`\n  ${seeds} seeds`);
  console.log(`    nodes per act       ${show(nodes)}`);
  console.log(`    stops per run       ${show(stops)}    (floors + 1 = ${config.floors + 1})`);
  for (const type of ['monster', 'event', 'elite', 'shrine', 'merchant', 'treasure']) {
    const d = dist(rows, (r) => r.byType[type] || 0);
    console.log(`    ${type.padEnd(20)}${show(d)}`);
  }
  // THE FRAMING, in the same block as the promises, because it IS one: the
  // reachable nodes are the only decision on that screen, and a frame that
  // cannot hold them hides the choice rather than making the act harder. Widths
  // are local px at the map's own scale; the viewport is the measured phone.
  const startSpan = dist(rows, (r) => r.startSpan);
  const fanSpan = dist(rows, (r) => r.fanSpan);
  const need = (cols) => spanWidth(cols);
  const zoomFor = (cols) => (PHONE_VIEW_W / need(cols));
  console.log(`    entrance row spans  ${show(startSpan)} columns  = ${Math.round(need(startSpan.max))} px at its widest, wants ${zoomFor(startSpan.max).toFixed(2)}x`);
  console.log(`    widest fan-out      ${show(fanSpan)} columns  = ${Math.round(need(fanSpan.max))} px at its widest, wants ${zoomFor(fanSpan.max).toFixed(2)}x`);
  console.log(`      ^ against ${PHONE_VIEW_W} local px of map viewport at 390x844, ladder floor ${ZOOM_MIN}x`
    + ` — anything under ${ZOOM_MIN.toFixed(2)}x cannot be framed and the screen says so (data-framing="clipped").`);
  // THE MARGIN, PRINTED ON THE ACCEPTED PATH TOO. A refusal only speaks when it
  // fires; the number that matters is how close an ACCEPTED width is to firing,
  // and that number had no reader anywhere (Vira, 2026-08-08).
  printFanoutMargin(config, '    ');
  if (zoomFor(startSpan.max) < ZOOM_MIN) {
    // REPORTED, NOT GATED, and the reason is the same one that keeps the
    // reachability figures above ungated: gating this would REFUSE THE SHIPPED
    // ACT at boot, and which act shape ships is a Tier-2 direction call, not a
    // number this tool gets to enforce. It is the defect Bjorn measured — 9 of
    // 12 seeds hiding a next step at 390x844 — and it is a GRAPH fact, not a
    // camera fact: `pathCount` walkers land on up to `columns` distinct doors.
    // `--entries 1` collapses the entrance row to one column and closes it.
    console.log(`      ^ THE ENTRANCE ROW CANNOT BE FRAMED at its widest (${startSpan.max} columns, ${zoomFor(startSpan.max).toFixed(2)}x).`
      + ` This is the hidden-choice defect, and it is the GRAPH, not the camera:`);
    console.log(`        ${config.pathCount} walkers may open up to ${Math.min(config.pathCount, config.columns)} doors.`
      + ` \`--entries 1\` makes it one door — measured 0 of 12 seeds hiding a step, against 9 of 12 today.`);
  }
  if (zoomFor(fanSpan.max) < ZOOM_MIN) {
    findings.push(`${label}: the widest fan-out (${fanSpan.max} columns) wants ${zoomFor(fanSpan.max).toFixed(2)}x, below the ladder floor ${ZOOM_MIN}x — a node's own choices cannot be framed on a phone at any setting`);
  }

  const noElite = rows.reduce((a, r) => a + r.noElite, 0);
  const noMerch = rows.reduce((a, r) => a + r.noMerchant, 0);
  const startsTotal = rows.reduce((a, r) => a + r.starts, 0);
  console.log(`    starts that can reach NO elite     ${noElite} of ${startsTotal} (${((noElite / startsTotal) * 100).toFixed(1)}%)`);
  console.log(`    starts that can reach NO merchant  ${noMerch} of ${startsTotal} (${((noMerch / startsTotal) * 100).toFixed(1)}%)`);
  console.log(`      ^ REPORTED, NOT GATED — 'minElites' counts the whole graph and says so now.`);
  const unrested = rows.reduce((a, r) => a + r.unrestedStarts, 0);
  console.log(`    starts with a route to an elite past no rest  ${unrested} of ${startsTotal} (${((unrested / startsTotal) * 100).toFixed(1)}%)`);
  console.log(`      ^ REPORTED, NOT GATED, and it is the honest edge of 'restBeforeElite': the rule promises a rest`);
  console.log(`        on a floor BELOW the first elite — a fact about the GRAPH. Which route a walker takes is theirs.`);

  // ---- the promises, checked across the distribution, not on a seed --------
  // STOPS PER RUN IS EXACTLY floors + 1, ALWAYS (Freja, 24 seeds; pathCount and
  // columns move it by nothing). Stated as an invariant because a property that
  // is exact is worth more than a mean: it goes red on the first exception.
  if (stops.min !== config.floors + 1 || stops.max !== config.floors + 1) {
    findings.push(`${label}: stops per run is ${stops.min}-${stops.max}, not exactly floors+1 = ${config.floors + 1}`);
  }
  // EVERY FIXED RANK LANDS, IN EVERY SEED. This is the treasure cliff's check:
  // at floors < 10 the old absolute `9: 'treasure'` produced 0.0 treasure nodes
  // across 24/24 seeds and nothing said a word.
  for (const [floor, type] of Object.entries(plan.fixed)) {
    const bad = rows.filter((r) => !r.floorsOf(type).includes(Number(floor))).length;
    if (bad) findings.push(`${label}: fixed ${type} on floor ${floor} is absent in ${bad} of ${seeds} seeds`);
    const d = dist(rows, (r) => r.byType[type] || 0);
    if (d.min === 0) findings.push(`${label}: '${type}' is absent entirely in at least one seed (range ${d.min}-${d.max})`);
  }
  // THE GATES ACTUALLY GATE, at the tail and not just at the mean. Two of them
  // since the split: a rest may open below the floor an Elite may.
  for (const [type, from] of [['elite', plan.eliteFrom], ['shrine', plan.shrineFrom]]) {
    const below = rows.filter((r) => r.floorsOf(type).some((f) => f < from)).length;
    if (below) findings.push(`${label}: '${type}' appears below floor ${from} in ${below} of ${seeds} seeds`);
  }
  // E13's promise, gated because it IS a promise: a map holding an Elite holds
  // a Shrine on some earlier floor. The pre-boss Shrine does not count for it —
  // it is above every rollable floor, which is the whole reason the ask was
  // still open with "definitely before a boss" already kept.
  if (plan.restBeforeElite) {
    const broken = rows.filter((r) => {
      const elite = r.minFloorOf('elite');
      if (elite == null) return false;
      const shrine = r.minFloorOf('shrine');
      return shrine == null || shrine >= elite;
    }).length;
    if (broken) findings.push(`${label}: an Elite stands with no Shrine on any earlier floor in ${broken} of ${seeds} seeds, against floorRules.restBeforeElite`);
  }
  if (plan.noShrineOn > 0) {
    const on = rows.filter((r) => r.floorsOf('shrine').includes(plan.noShrineOn)).length;
    if (on) findings.push(`${label}: shrine appears on the barred floor ${plan.noShrineOn} in ${on} of ${seeds} seeds`);
  }
  for (const [type, min] of [['elite', plan.minElites], ['merchant', plan.minMerchants]]) {
    const d = dist(rows, (r) => r.byType[type] || 0);
    if (d.min < min) findings.push(`${label}: '${type}' count falls to ${d.min} against a promised minimum of ${min} (mean ${d.mean})`);
  }
  return { findings, cells: seeds };
}

// ---------------------------------------------------------------- the corpus
// KNOWN-BAD. Every one of these was ACCEPTED by `floorRules: opt(any)` with
// nothing named. They are the reason this file exists, and the tool is not
// trusted until they have been WATCHED going red (the instrument rule).
const BASE = mapConfigs[1];
const KNOWN_BAD = [
  ['a bare string', { ...BASE, floorRules: 'not a rules object' }],
  ['a number (42)', { ...BASE, floorRules: 42 }],
  ['fixed index 999', { ...BASE, floorRules: { ...BASE.floorRules, fixed: [{ at: 'floor', index: 999, type: 'monster' }] } }],
  ['a negative index', { ...BASE, floorRules: { ...BASE.floorRules, fixed: [{ at: 'floor', index: -3, type: 'treasure' }] } }],
  ['a node kind that does not exist', { ...BASE, floorRules: { ...BASE.floorRules, fixed: [{ at: 'first', type: 'notARealKind' }] } }],
  ['floors halved to 8 while fixed names 9', { ...BASE, floors: 8, floorRules: { ...BASE.floorRules, fixed: [{ at: 'floor', index: 9, type: 'treasure' }] } }],
  // THE SEVENTH IS THE SHIPPED RULE ITSELF. `15: 'shrine'` sat in the table for
  // the life of the project and had never once fired, because floor 15 is not
  // rollable. Deleting it changed 0 of 24 seeds at 10, 12 and 15 floors
  // (Freja). This is the check that would have caught it, run against it.
  ['the shipped `15: shrine` rule, which never fired', { ...BASE, floorRules: { ...BASE.floorRules, fixed: [{ at: 'floor', index: 15, type: 'shrine' }] } }],
  // And the fallback that is gone: floorRules absent is a named outcome now,
  // not an empty object that generates a map nobody authored.
  ['floorRules missing entirely', { ...BASE, floorRules: undefined }],
  ['unknownWeights summing to zero', { ...BASE, unknownWeights: { event: 0, fight: 0 } }],
  // E13'S TWO. The first is the split key itself: an act still authoring
  // `noEliteOrShrineBefore` gets a named error, not a silent reading of it as
  // both gates — the same standard `minReachableElites` is held to.
  ['the pre-split `noEliteOrShrineBefore` key', { ...BASE, floorRules: { ...BASE.floorRules, noEliteOrShrineBefore: { at: 'fraction', of: 0.43 } } }],
  // The second is the promise made impossible by the act's OWN other rules:
  // rests and Elites opening on the same floor leaves nowhere for the rest to
  // land, and force-placing it onto a floor another rule claims is exactly the
  // quiet fallback this corpus exists to keep out.
  ['restBeforeElite with no floor left to hold the rest', { ...BASE, floorRules: { ...BASE.floorRules, noShrineBefore: { at: 'fraction', of: 0.43 }, noEliteBefore: { at: 'fraction', of: 0.43 } } }],
  // VIKI'S WITHHOLD, #anchors branch: the schema said opt, the resolver said
  // nothing, and resolveUnknownNode THREW at act build — a clean boot and a
  // crash at runtime, on the key this branch itself moved. The corpus went
  // green on it, so it is a corpus gap too, and this row is its fixture.
  ['unknownWeights missing entirely', (() => { const { unknownWeights, ...rest } = BASE; return rest; })()],
];

// THE SECOND CORPUS, AND IT DID NOT EXIST — Vira, #107. Every row above
// exercises `resolveFloorPlan`; `viewRefusals` had 215 lines, two knobs and a
// derived refusal edge, and NOTHING ANYWHERE FALSIFIED IT. The suite has no
// reference to model/mapview.js, and validate.js points at this corpus for its
// known-bad while the row it needed was not in it. A refusal nobody has watched
// go red is `unknown`, not green, whatever it prints (the instrument rule).
//
// The pairs matter more than the rows: each bad value sits next to the largest
// value that must STILL BE ACCEPTED, because a refusal that fires one step early
// is the same defect wearing the other face — and `columns: 9` is exactly the
// edge `maxFittingColumns()` derives, so the pair proves the derivation rather
// than the constant.
//
// THE COLUMNS ROWS ARE DERIVED NOW, AND THAT IS THE SECOND HALF OF THE FIX.
// `columns 9 — the derived edge itself` was a PINNED known-good: it names the
// edge as a literal, so the day a constant moves the edge it goes red for being
// out of date rather than for being wrong, somebody edits the 9, and the fixture
// has quietly stopped testing anything. That is the same hazard that made my own
// `--mutate` run report NOT CAUGHT, 0 of 24 earlier tonight. The pairs below ask
// `maxSafeColumns()` and `maxSafeColumns() + 1` instead, so they move with the
// constants and can never need editing — and the LITERAL far-out rows stay,
// because a corpus made entirely of derived rows is one a broken derivation can
// green in both directions.
const VIEW_KNOWN_BAD = [
  ['columns one past the derived safe edge', { ...BASE, columns: maxSafeColumns() + 1 }, 'columns'],
  ['columns at the OLD edge — fits, zero spare columns', { ...BASE, columns: maxFittingColumns() }, 'columns'],
  ['columns 12 — literal, immune to a derivation bug', { ...BASE, columns: 12 }, 'columns'],
  ['entries 0', { ...BASE, entries: 0 }, 'entries'],
  ['entries -1', { ...BASE, entries: -1 }, 'entries'],
  ['entries 1.5 — not an integer', { ...BASE, entries: 1.5 }, 'entries'],
  ['entries as a string', { ...BASE, entries: '1' }, 'entries'],
  ['entries 7 — more doors than walkers', { ...BASE, pathCount: 6, entries: 7 }, 'entries'],
  ['entries 8 — more doors than columns', { ...BASE, columns: 7, pathCount: 9, entries: 8 }, 'entries'],
];
// AND THE OTHER FACE. A refusal that fires one step early is as broken as one
// that never fires, and neither shows up in a corpus of bad inputs alone.
const VIEW_MUST_ACCEPT = [
  ['columns at the derived safe edge', { ...BASE, columns: maxSafeColumns() }],
  ['columns 7 — what ships', { ...BASE, columns: 7 }],
  ['entries 1 — what ships', { ...BASE, entries: 1 }],
  ['entries 6 — one door per walker', { ...BASE, pathCount: 6, entries: 6 }],
  ['entries absent', (() => { const { entries, ...rest } = BASE; return rest; })()],
];

// ---------------------------------------- THE THIRD CORPUS: CIRCLES COLLIDING
// The collision known-bad, and it is a BALANCE bundle rather than a map config
// because every radius on this map is solved from `balance.ui.tapSize.def` — one
// data entry, and turning it up grows every circle while the pitches they are
// measured against do not move.
//
// `maxTapDefault() + 1` is the derived edge; `96` is a literal far past it that
// no plausible arithmetic bug can make fit, and `0` is the unanswerable input.
// Derived rows prove there is no off-by-one; literal rows survive a broken
// derivation. Neither kind alone is a corpus.
const AIR_KNOWN_BAD = [
  ['tap default one past the derived edge', maxTapDefault() + 1],
  ['tap default 96 — the circles overlap outright', 96],
  ['tap default 0 — no radius can be solved', 0],
];
const AIR_MUST_ACCEPT = [
  ['what ships', TAP_TARGET_DEFAULT],
  ['the derived edge itself', maxTapDefault()],
  ['the smallest size the dial offers', Math.min(...balance.ui.tapSize.sizes)],
];

// AND BOTH FACES OF THE PAIR THE FIRST VERSION COULD NOT EXPRESS. `pairAir` takes
// every geometry input as a parameter precisely so the boss pair can be planted
// green as well as observed red — a pair that is red at every input a fixture can
// reach is a check nobody has watched PASS, which is the same silence one face
// over (the instrument rule, read in both directions).
const PAIR_PLANTS = [
  ['boss pair as it ships — green after the wider floor pitch', {}, 'floor-boss', true],
  ['boss pair on the pre-spacing pitch still collides', { rowH: 46 }, 'floor-boss', false],
  ['boss pair with the pre-#107 ratio restored', { bossRatio: 1 }, 'floor-boss', true],
  ['boss pair with room made in the pitch', { rowH: 56 }, 'floor-boss', true],
  ['live pair with the columns closed up', { colX: 43 }, 'live', false],
  ['live pair as it ships', {}, 'live', true],
];

// --------------------------------------------- THE ANCHORS, AND WHY THEY EXIST
// A corpus of inputs proves a check FIRES. It cannot prove the check is asking a
// real question — every row above routes through `maxFanoutSpan` or
// `nodeRadiusFromTap`, and a derivation that under-reports greens all of them at
// once. Earlier tonight my own `--mutate` came back NOT CAUGHT 0 of 24 because
// `entries: 1` had made a mutation stop being a lie; this is the same failure
// asked in advance. Two kinds of answer:
//
//   PROPERTIES  relations that must hold WHATEVER the constants are, so they
//               cannot rot into a number that stopped being true.
//   GENERATIVE  the only anchor that leaves the arithmetic entirely: generate
//               real graphs and check the observed fan-out against the formula
//               the horizontal margin is built on. `--spans` does this over a
//               108-cell grid; this does it on the shipped shape, cheaply, so a
//               green selftest cannot coexist with a formula that under-reports
//               on the act we actually ship.
const gated = (a) => a.pairs.filter((p) => BOOT_GATED_PAIRS.includes(p.id));
const PROPERTIES = [
  ['spanWidth is monotone in columns', () => [1, 2, 3, 4, 5, 6, 7, 8].every((n) => spanWidth(n + 1) > spanWidth(n))],
  ['the horizontal slack IS its definition, recomputed independently', () => {
    const m = fanoutMargin(mapConfigs[1]);
    return PHONE_VIEW_W / spanWidth(m.span + m.slack) >= ZOOM_MIN
      && PHONE_VIEW_W / spanWidth(m.span + m.slack + 1) < ZOOM_MIN;
  }],
  ['the safe column edge is an EDGE — it clears and edge+1 does not', () => {
    const e = maxSafeColumns();
    return e >= 1 && fanoutMargin({ columns: e }).ok && !fanoutMargin({ columns: e + 1 }).ok;
  }],
  ['air shrinks on EVERY pair as the tap default grows', () => {
    const a = pairAir(), b = pairAir({ tapPx: TAP_TARGET_DEFAULT + 8 });
    return a.pairs.every((p, i) => b.pairs[i].gap < p.gap);
  }],
  ['the tap edge is an EDGE — it clears and edge+1 does not', () => {
    const t = maxTapDefault();
    return t >= 1 && gated(pairAir({ tapPx: t })).every((p) => p.ok)
      && gated(pairAir({ tapPx: t + 1 })).some((p) => !p.ok);
  }],
  ['a reference zoom that is not a number is NAMED, never NaN-shaped', () => {
    const a = pairAir({ refZoom: Number('Fit') / 100 });
    return a.pairs.length === 0 && a.why === 'no-reference-zoom';
  }],
  // ---- SUNNA'S SPLIT, AND THE CHECKS THAT KEEP IT TRUE ----------------------
  // "The fix is what makes the comment true; the check is what keeps it true."
  ['REF_ZOOM is finite and a rung the ladder actually has', () => Number.isFinite(REF_ZOOM) && ZOOM_STEPS.includes(REF_ZOOM)],
  ['MAP_ZOOM_DEFAULT is a legal token — Fit, or a ladder rung', () => mapZoomDefaultIsLegal()],
  ["the geometry does NOT read the map-zoom default — flipping it to 'Fit' leaves every derived constant finite", () => {
    // A SOURCE CHECK, and it says so: the runtime cannot flip a module const, so
    // the only way to prove the geometry never learns the word is to read the
    // file. Her fixture asked for the flip; this is the half that survives it.
    const src = readFileSync(fileURLToPath(new URL('../src/model/mapview.js', import.meta.url)), 'utf8');
    const reads = /Number\s*\(\s*MAP_ZOOM_DEFAULT\s*\)/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
    return !reads && Number.isFinite(NODE_R) && Number.isFinite(REF_ZOOM) && pairAir().pairs.every((p) => Number.isFinite(p.gap));
  }],
  // ---- THE LATCH ON THE BOOT EXEMPTION --------------------------------------
  // An excused row is worse than a red one, because nobody re-reads an excuse.
  // `floor-boss` is out of the boot door only while it is red; the day someone
  // clears it this fails and names the exemption to delete.
  ['no pair keeps a stale boot exemption after the wider pitch clears the boss', () => {
    const a = pairAir();
    return a.pairs.every((p) => p.ok && BOOT_GATED_PAIRS.includes(p.id));
  }],
];

function fanoutAnchor(seeds = 24) {
  const cfg = mapConfigs[1];
  let obs = 0;
  for (let i = 0; i < seeds; i++) {
    const g = generateActMap({ config: cfg, rng: rng2(i) });
    for (const n of Object.values(g.nodes)) {
      if (n.next.length) obs = Math.max(obs, colSpan(g, [n.id, ...n.next]));
    }
  }
  const formula = maxFanoutSpan(cfg);
  return { obs, formula, seeds, ok: obs <= formula && obs >= 1 };
}

function selftest() {
  console.log('mapplan --selftest — three corpora and their anchors: the one `floorRules: opt(any)` accepted in silence,\n'
    + '  the one `viewRefusals` never had, and the one THE MARGINS never had — plus the properties and the\n'
    + '  generative check that stop all three from going green together.\n');
  let red = 0;
  for (const [label, cfg] of KNOWN_BAD) {
    const { errors } = resolveFloorPlan(cfg);
    const ok = errors.length > 0;
    if (ok) red++;
    console.log(`  ${ok ? 'RED ' : 'GREEN'}  ${label.padEnd(42)} ${ok ? errors.map((e) => `${e.key}: ${e.msg}`)[0] : '<-- ACCEPTED, nothing named'}`);
  }
  // A GREEN CONTROL, or "everything is red" proves only that the check is
  // broken in the other direction. The shipped config must stay clean.
  const clean = resolveFloorPlan(mapConfigs[1]).errors.length === 0;
  console.log(`\n  ${clean ? 'CLEAN' : 'RED  '}  shipped mapConfigs[1] (the control — a checker that reds everything is not a checker)`);

  console.log(`\n  --- viewRefusals: the view knobs, and BOTH faces of each edge ---\n`);
  let vred = 0;
  for (const [label, cfg, key] of VIEW_KNOWN_BAD) {
    const errs = viewRefusals(cfg);
    const ok = errs.length > 0 && errs.some((e) => e.key === key);
    if (ok) vred++;
    console.log(`  ${ok ? 'RED ' : 'GREEN'}  ${label.padEnd(42)} ${ok ? errs.find((e) => e.key === key).msg.slice(0, 96) : `<-- ACCEPTED, nothing named for '${key}'`}`);
  }
  let vclean = 0;
  for (const [label, cfg] of VIEW_MUST_ACCEPT) {
    const errs = viewRefusals(cfg);
    const ok = errs.length === 0;
    if (ok) vclean++;
    console.log(`  ${ok ? 'CLEAN' : 'RED  '} ${label.padEnd(42)} ${ok ? '' : `<-- REFUSED, and it must not be: ${errs[0].msg.slice(0, 80)}`}`);
  }
  // THE VALIDATOR IS THE CONSUMER, so the corpus is run through the door the
  // game actually uses as well as through the function. A refusal that exists in
  // `viewRefusals` and never reaches validate.js is a check with no reader, and
  // that gap is exactly what this row's absence hid for a night.
  // Only the mapConfigs branch is fed, so the bundle is otherwise empty and the
  // validator will name plenty of other absences — irrelevant. What is asserted
  // is narrow and is the whole question: does an error carrying THIS row's path
  // come out of the door the game boots through.
  const wired = VIEW_KNOWN_BAD.every(([, cfg, key]) => {
    const res = validateContent({ mapConfigs: { 1: cfg } });
    const list = (res && res.errors) || [];
    return list.some((e) => String(e.path || '').startsWith(`mapConfigs.1.${key}`));
  });
  console.log(`\n  ${wired ? 'WIRED' : 'LOOSE'}  every view known-bad also fails the BOOT VALIDATOR, not just the function`);

  // --- THE MARGINS: the air corpus, both faces, and the same validator door ---
  let absentRed = false;
  console.log(`\n  --- the margins: every pair of circles this map draws next to each other, both faces of each ---\n`);
  printFanoutMargin(mapConfigs[1], '  ');
  printPairAir('  ');
  console.log('');
  // BOTH FACES OF EVERY PAIR, PLANTED. The boss pair is red at every input a
  // corpus of tap defaults can reach, so without planting the geometry it is a
  // check nobody has watched go GREEN — and a check with one observed face is
  // half an instrument.
  let plants = 0;
  for (const [label, opts, id, want] of PAIR_PLANTS) {
    const p = pairAir(opts).pairs.find((x) => x.id === id);
    const got = !!(p && p.ok);
    if (got === want) plants++;
    console.log(`  ${got === want ? 'AS TOLD' : 'WRONG  '}  ${label.padEnd(46)} ${id} ${got ? 'clears' : 'collides'}`
      + `${p ? ` at ${p.gap.toFixed(1)} SVG` : ''}${got === want ? '' : `  <-- expected it to ${want ? 'clear' : 'collide'}`}`);
  }
  console.log('');
  // The absent-entry row is separate because it is not a `def` VALUE — it is the
  // shape of a check dying green, and it must be watched from both doors too.
  {
    const errs = geometryRefusals({ ui: {} });
    const ok = errs.some((e) => e.key === 'balance.ui.tapSize.def');
    const res = validateContent({ balance: { ui: {} } });
    const door = ((res && res.errors) || []).some((e) => String(e.path || '').startsWith('balance.ui.tapSize.def'));
    absentRed = ok && door;
    console.log(`  ${absentRed ? 'RED ' : 'GREEN'}  ${'tapSize absent entirely'.padEnd(42)} ${ok ? errs[0].msg.slice(0, 96) : '<-- ACCEPTED, and NODE_R is NaN'}`);
  }
  let ared = 0;
  for (const [label, def] of AIR_KNOWN_BAD) {
    const errs = geometryRefusals({ ui: { tapSize: { def } } });
    const ok = errs.some((e) => e.key === 'balance.ui.tapSize.def');
    if (ok) ared++;
    console.log(`  ${ok ? 'RED ' : 'GREEN'}  ${`${label} (def ${def})`.padEnd(42)} ${ok ? errs[0].msg.slice(0, 96) : '<-- ACCEPTED, nothing named'}`);
  }
  let aclean = 0;
  for (const [label, def] of AIR_MUST_ACCEPT) {
    const errs = geometryRefusals({ ui: { tapSize: { def } } });
    const ok = errs.length === 0;
    if (ok) aclean++;
    console.log(`  ${ok ? 'CLEAN' : 'RED  '} ${`${label} (def ${def})`.padEnd(42)} ${ok ? '' : `<-- REFUSED, and it must not be: ${errs[0].msg.slice(0, 80)}`}`);
  }
  const airWired = AIR_KNOWN_BAD.every(([, def]) => {
    const res = validateContent({ balance: { ui: { tapSize: { def } } } });
    return ((res && res.errors) || []).some((e) => String(e.path || '').startsWith('balance.ui.tapSize.def'));
  });
  console.log(`\n  ${airWired ? 'WIRED' : 'LOOSE'}  every air known-bad also fails the BOOT VALIDATOR, not just the function`);

  // --- the anchors: a corpus proves a check FIRES, not that it asks anything ---
  console.log(`\n  --- anchors: what stops all of the above from dying green together ---\n`);
  let props = 0;
  for (const [label, fn] of PROPERTIES) {
    let ok = false;
    try { ok = fn() === true; } catch { ok = false; }
    if (ok) props++;
    console.log(`  ${ok ? 'HOLDS' : 'BROKE'}  ${label}`);
  }
  const anchor = fanoutAnchor();
  console.log(`  ${anchor.ok ? 'HOLDS' : 'BROKE'}  the formula the horizontal margin is built on, against ${anchor.seeds} REAL graphs`
    + ` — observed fan-out ${anchor.obs} columns, maxFanoutSpan says ${anchor.formula}`);

  const pass = red === KNOWN_BAD.length && clean
    && vred === VIEW_KNOWN_BAD.length && vclean === VIEW_MUST_ACCEPT.length && wired
    && ared === AIR_KNOWN_BAD.length && aclean === AIR_MUST_ACCEPT.length && airWired && absentRed
    && plants === PAIR_PLANTS.length
    && props === PROPERTIES.length && anchor.ok;
  console.log(`\n  ${pass ? `PASS — ${red}/${KNOWN_BAD.length} floor-rule known-bad red, ${vred}/${VIEW_KNOWN_BAD.length} view known-bad red, ${vclean}/${VIEW_MUST_ACCEPT.length} must-accept clean, `
    + `${ared}/${AIR_KNOWN_BAD.length} air known-bad red (+ the absent entry), ${aclean}/${AIR_MUST_ACCEPT.length} air must-accept clean, `
    + `${plants}/${PAIR_PLANTS.length} planted pairs behaved, `
    + `${props}/${PROPERTIES.length} properties hold, the formula anchor holds, both validator doors wired, control clean`
    : `FAIL — floor ${red}/${KNOWN_BAD.length} · view ${vred}/${VIEW_KNOWN_BAD.length} · must-accept ${vclean}/${VIEW_MUST_ACCEPT.length} · `
    + `air ${ared}/${AIR_KNOWN_BAD.length} · air must-accept ${aclean}/${AIR_MUST_ACCEPT.length} · plants ${plants}/${PAIR_PLANTS.length} · properties ${props}/${PROPERTIES.length} · `
    + `anchor ${anchor.ok ? 'holds' : 'BROKE'} · validators ${wired ? 'wired' : 'LOOSE'}/${airWired ? 'wired' : 'LOOSE'} · control ${clean ? 'clean' : 'DIRTY'}`}`);
  console.log(`\n  BOUNDARY — the horizontal rows all route through \`maxFanoutSpan\`, so a formula that`);
  console.log(`  UNDER-reports greens every one of them at once. The generative anchor above closes that`);
  console.log(`  on the shipped act shape only; \`node tools/mapplan.mjs --spans\` is the grid, and it is`);
  console.log(`  the thing this corpus stands on. Nothing here was rendered — but the pair census is NOT`);
  console.log(`  optimistic arithmetic: Sunna's rendered readings match it to the hundredth on all three`);
  console.log(`  pairs, and my earlier caveat to the contrary was written against a rounded 2.9. Rendered`);
  console.log(`  composition and paint remain outside this arithmetic gate.`);
  return pass ? 0 : 1;
}

// ------------------------------------------------------------------- driver
// ------------------------------------------------------------------- spans
// THE MEASUREMENT model/mapview.js's `maxFanoutSpan` IS, and the reason it is a
// function there rather than a number. It sweeps acts, reports the widest
// framing the generator can ask the camera to draw, and checks the formula
// against what it just measured. An observed maximum is a FLOOR under the true
// worst case, so this run can only ever falsify the formula, never confirm it —
// and that asymmetry is the point: the day an act produces a wider fan-out than
// the formula claims, this goes red and the refusal edge moves rather than
// quietly becoming optimistic.
//
// IT SWEEPS A GRID NOW, NOT A LINE — Vira, #107. The formula is closed in
// `columns`, but the quantity depends on three knobs: `columns` bounds the
// spread, `pathCount` decides how many walkers can merge into one node, and
// `floors` decides how many chances the walk gets to do it. Sweeping only
// `columns` validated a one-knob claim along one line of a three-dimensional
// space and printed a confident PASS. The other two are swept here, and the
// verdict line says how many cells the pass covers rather than how many widths.
const SWEEP_PATHS = [2, 4, 6, 9];
const SWEEP_FLOORS = [6, 12, 18];

function spans() {
  const cols = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  const cells = cols.length * SWEEP_PATHS.length * SWEEP_FLOORS.length;
  console.log(`mapplan --spans · ${cells} acts x ${SEEDS} seeds = ${cells * SEEDS} graphs\n`);
  console.log(`  columns ${cols[0]}-${cols[cols.length - 1]}  x  pathCount ${SWEEP_PATHS.join('/')}  x  floors ${SWEEP_FLOORS.join('/')}`);
  console.log(`  viewport ${PHONE_VIEW_W} local px (.map-scroll at 390x844) · ladder floor ${ZOOM_MIN}x\n`);
  console.log('  cols  entrance row        widest fan-out      formula  fan-out px  wants   spare  verdict');
  let bad = 0;
  let run = 0;
  for (const columns of cols) {
    // Reported per WIDTH because that is what the refusal keys on, but the
    // maximum behind each row is taken over every pathCount and floors in the
    // grid — so a row that says 4 means "4 was the widest anything in this
    // column produced", not "4 at the one act shape that ships".
    const st = [];
    const fan = [];
    for (const pathCount of SWEEP_PATHS) {
      for (const floors of SWEEP_FLOORS) {
        const cfg = { ...mapConfigs[1], columns, pathCount, floors };
        // An act shape the floor rules cannot resolve is not a fan-out finding;
        // skip it by name rather than crashing the sweep on it.
        if (resolveFloorPlan(cfg).errors.length) continue;
        for (let i = 0; i < SEEDS; i++) {
          const g = generateActMap({ config: cfg, rng: rng2(i) });
          run++;
          st.push(colSpan(g, g.startIds));
          fan.push(Math.max(...Object.values(g.nodes).filter((n) => n.next.length).map((n) => colSpan(g, [n.id, ...n.next]))));
        }
      }
    }
    if (!fan.length) continue;
    const obs = Math.max(...fan);
    const formula = maxFanoutSpan({ columns });
    const px = spanWidth(obs);
    const wants = PHONE_VIEW_W / px;
    const over = obs > formula;
    if (over) bad++;
    // THE VERDICT READS THE MARGIN, not the cliff. It used to print `fits` for
    // every width at or above the ladder floor, so 8 and 9 came back `fits`
    // while the boot validator refused them — a tool contradicting the refusal
    // it exists to explain, which is the same defect one layer up.
    const m = fanoutMargin({ columns });
    console.log(`  ${String(columns).padStart(4)}  ${`${Math.min(...st)}..${Math.max(...st)}`.padEnd(19)}`
      + ` ${`${Math.min(...fan)}..${obs}`.padEnd(19)} ${String(formula).padStart(7)}  ${String(Math.round(px)).padStart(10)}`
      + `  ${wants.toFixed(2)}x  ${String(m.slack).padStart(5)}  `
      + `${over ? 'FORMULA TOO LOW' : m.ok ? 'fits' : wants >= ZOOM_MIN ? `REFUSED — no spare column` : 'REFUSED — cannot be framed'}`);
  }
  console.log(`\n  The entrance row is the wider frame and it is NOT what the refusal is about:`);
  console.log(`  it is a graph fact, not a camera fact — walkers landing on up to 'columns'`);
  console.log(`  distinct doors. \`entries: 1\` collapses it to 1 column, and that is what ships.`);
  console.log(`\n  ${bad ? `FAIL — maxFanoutSpan is below the observed maximum at ${bad} width(s)`
    : `PASS — maxFanoutSpan matched the observed maximum over ${run} graphs across all three knobs`}`);
  return bad ? 1 : 0;
}

/* ------------------------------------------------------------- THE RUN SHAPE
 *
 * Constantine: "I only have the patience for 30 min runs. perhaps add an
 * advanced debug feature to limit the amount of max columns, rows, and or
 * columns with percent chance of certain nodes being more likely."
 *
 * The knobs ship on Custom Climb. THIS is the half that says whether they did
 * anything, and it is the half that is easy to skip: a weighting table that is
 * read and never changes what the generator produces is the exact failure this
 * family keeps catching. So the mode below does not print two tables and invite
 * a reader to compare them — it ASSERTS the comparison and can go red:
 *
 *   the harness moved      distinct rng streams AND distinct graphs, both arms
 *   the shape moved        a shape that leaves the population identical is a
 *                          FINDING, not a tidy result
 *   the weights moved      every type NAMED in the shape must move its share of
 *                          the map in the direction its weight moved, measured
 *                          on a weights-only arm so the floors/columns caps
 *                          cannot be what shifted it
 *
 * `--shape-selftest` is the known-bad corpus for all three (observed red before
 * any of it is cited — the instrument rule).
 *
 * Usage
 *   node tools/mapplan.mjs --shape floors=8,columns=4
 *   node tools/mapplan.mjs --shape elite=40,monster=5 --seeds 300
 *   node tools/mapplan.mjs --shape-selftest
 */

/** Parse `floors=8,columns=4,elite=40` → the run-shape entry, or an error. */
function parseShape(str, weightKeys) {
  const entry = {};
  const weights = {};
  for (const part of String(str).split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = part.split('=').map((s) => (s == null ? s : s.trim()));
    const n = Number(v);
    if (!Number.isFinite(n)) return { error: `'${part}' — a knob is name=number` };
    if (k === 'floors' || k === 'columns') entry[k] = n;
    else if (weightKeys.includes(k)) weights[k] = n;
    else return { error: `'${k}' is not a knob — floors, columns, or one of ${weightKeys.join(', ')}` };
  }
  if (Object.keys(weights).length) entry.typeWeights = weights;
  return { entry };
}

/** Population of one arm: node count and each type's SHARE of the map. */
function population(config, seeds, rngFor = rng2) {
  let total = 0;
  const counts = [];
  const byType = {};
  const sigs = new Set();
  const streams = new Set();
  for (let i = 0; i < seeds; i++) {
    const rng = rngFor(i);
    const g = generateActMap({ config, rng });
    const all = Object.values(g.nodes);
    counts.push(all.length);
    total += all.length;
    for (const n of all) byType[n.type] = (byType[n.type] || 0) + 1;
    sigs.add(all.map((n) => `${n.id}:${n.type}>${[...n.next].sort().join(',')}`).sort().join('|'));
    streams.add(rngFor(i).int('map', 0, 1e9));
  }
  const share = {};
  for (const [t, n] of Object.entries(byType)) share[t] = n / total;
  return {
    seeds,
    nodes: { mean: +mean(counts).toFixed(2), min: Math.min(...counts), max: Math.max(...counts) },
    perAct: Object.fromEntries(Object.entries(byType).map(([t, n]) => [t, +(n / seeds).toFixed(2)])),
    share,
    graphs: sigs.size,
    streams: streams.size,
  };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

function runShapeMode(shapeStr, seeds, { quiet = false, rngFor = rng2 } = {}) {
  const findings = [];
  const base = mapConfigs[1];
  const weightKeys = Object.keys(base.typeWeights);
  const parsed = parseShape(shapeStr, weightKeys);
  if (parsed.error) { console.error(`mapplan --shape: ${parsed.error}`); return { findings: ['usage'], usage: true }; }
  const entry = parsed.entry;
  const say = (...a) => { if (!quiet) console.log(...a); };

  say(`\nmapplan --shape — DEFAULT vs SHAPED · ${seeds} seeds per act per arm`);
  say(`  entry: ${JSON.stringify(entry)}`);
  say(`  (the same object the Custom Climb screen hands the orchestrator, resolved by the same applyRunShape)`);

  // ---- resolve every act, and REFUSE loudly rather than measuring nonsense
  const arms = [];
  for (const [act, cfg] of Object.entries(mapConfigs)) {
    const shaped = applyRunShape(cfg, entry, MAP_SHAPE_LIMITS);
    if (shaped.errors.length) {
      for (const e of shaped.errors) {
        say(`  REFUSED act ${act}: ${e.key} — ${e.msg}`);
        findings.push(`act ${act}: ${e.key} — ${e.msg}`);
      }
      continue;
    }
    // The weights-only arm: the caps removed, so any share that moves moved
    // because of a weight and not because the act got smaller.
    const wOnly = entry.typeWeights
      ? applyRunShape(cfg, { typeWeights: entry.typeWeights }, MAP_SHAPE_LIMITS)
      : null;
    arms.push({ act: Number(act), cfg, shaped, wOnly });
  }
  if (!arms.length) return { findings, refusedAll: true };

  let defTotal = 0;
  let shpTotal = 0;
  for (const a of arms) {
    const d = population(a.cfg, seeds, rngFor);
    const s = population(a.shaped.config, seeds, rngFor);
    defTotal += d.nodes.mean;
    shpTotal += s.nodes.mean;

    say(`\n  === act ${a.act} ===`);
    for (const line of a.shaped.readout) say(`    ${line}`);
    say(`\n    ${'type'.padEnd(12)}${'default'.padStart(18)}${'shaped'.padStart(18)}${'share Δ'.padStart(12)}`);
    say(`    ${'nodes/act'.padEnd(12)}${`${d.nodes.mean} (${d.nodes.min}-${d.nodes.max})`.padStart(18)}`
      + `${`${s.nodes.mean} (${s.nodes.min}-${s.nodes.max})`.padStart(18)}`
      + `${`${(((s.nodes.mean / d.nodes.mean) - 1) * 100).toFixed(1)}%`.padStart(12)}`);
    const types = [...new Set([...Object.keys(d.perAct), ...Object.keys(s.perAct)])].sort();
    for (const t of types) {
      say(`    ${t.padEnd(12)}${String(d.perAct[t] || 0).padStart(18)}${String(s.perAct[t] || 0).padStart(18)}`
        + `${`${pct(d.share[t] || 0)}→${pct(s.share[t] || 0)}`.padStart(12)}`);
    }

    // ---- THE HARNESS MOVED. Both arms, both questions.
    for (const [name, arm] of [['default', d], ['shaped', s]]) {
      if (arm.streams <= 1 && seeds > 1) {
        findings.push(`act ${a.act} ${name}: ${seeds} seeds produced ${arm.streams} rng stream — one seed measured ${seeds} times, not a distribution`);
      } else if (arm.graphs <= 1 && seeds >= 8) {
        findings.push(`act ${a.act} ${name}: ${seeds} distinct streams produced ${arm.graphs} distinct graph`);
      }
    }

    // ---- THE SHAPE MOVED. Identical populations mean the knob is decoration.
    if (a.shaped.changed) {
      const same = d.nodes.mean === s.nodes.mean
        && types.every((t) => (d.perAct[t] || 0) === (s.perAct[t] || 0));
      if (same) {
        findings.push(`act ${a.act}: the shape resolved to a CHANGED config and produced an identical population — the knob is read and does nothing`);
      }
    }

    // ---- THE ACT'S OWN PROMISES, at the shape he chose. REPORTED, NEVER A
    // FINDING: `minElites: 2` is kept by force-placing into eligible Monster
    // nodes, and a 4x2 act does not have enough of them, so relaxPlace runs out
    // and stops. Measured 1.87 elites and 0.54 merchants a map at floors=4
    // columns=2. That is not the tool's to refuse — a 20-stop climb is exactly
    // what was asked for — but a promise breaking in silence is nobody's idea
    // of a debug knob, so it prints here and in the panel.
    const shaped = resolveFloorPlan(a.shaped.config).plan || {};
    for (const [t, want] of Object.entries(shaped.minima || {})) {
      const got = s.perAct[t] || 0;
      if (want > 0 && got < want) {
        say(`    ^ SHORTFALL: this act promises at least ${want} ${t} a map and this shape delivers ${got.toFixed(2)}.`
          + ` Not a finding — it is the shape you asked for — but it is not silent either.`);
      }
    }

    // ---- THE WEIGHTS MOVED, on the arm where nothing else could have.
    if (a.wOnly && !a.wOnly.errors.length) {
      const w = population(a.wOnly.config, seeds, rngFor);
      say(`\n    weights-only arm (floors/columns left at the act's own ${a.cfg.floors}x${a.cfg.columns}):`);
      for (const [t, want] of Object.entries(entry.typeWeights)) {
        const from = d.share[t] || 0;
        const to = w.share[t] || 0;
        const raised = want > a.cfg.typeWeights[t];
        const lowered = want < a.cfg.typeWeights[t];
        const moved = raised ? to > from : lowered ? to < from : null;
        say(`      ${t.padEnd(10)} weight ${String(a.cfg.typeWeights[t]).padStart(3)} → ${String(want).padStart(3)}`
          + `   share ${pct(from)} → ${pct(to)}   ${moved === null ? '(unchanged weight)' : moved ? 'MOVED' : 'DID NOT MOVE'}`);
        if (moved === false) {
          findings.push(`act ${a.act}: '${t}' weight went ${a.cfg.typeWeights[t]} → ${want} and its share went ${pct(from)} → ${pct(to)} — the wrong way, or not at all`);
        }
      }
    }
  }

  say(`\n  CLIMB TOTAL over ${arms.length} act(s): ${defTotal.toFixed(1)} stops → ${shpTotal.toFixed(1)}`
    + `  (${(((shpTotal / defTotal) - 1) * 100).toFixed(1)}%)`);
  say(`  Node count is the DRIVER of run length. It is not minutes, and nothing in this tree can measure minutes.`);
  return { findings, defTotal, shpTotal };
}

/**
 * The known-bad corpus for --shape. OBSERVED RED before any number above is
 * cited as coverage (the instrument rule). Each row must be caught; a row that
 * comes back clean is the tool failing, printed as such.
 */
function shapeSelftest() {
  const base = mapConfigs[1];
  const rows = [];
  const mv = minViableFloors(base);
  console.log('mapplan --shape-selftest — the corpus this mode must turn red\n');

  const refuseCase = (label, entry, expect) => {
    const r = applyRunShape(base, entry, MAP_SHAPE_LIMITS);
    const hit = r.errors.some((e) => `${e.key}: ${e.msg}`.toLowerCase().includes(expect.toLowerCase()));
    rows.push([hit, label, hit ? r.errors.map((e) => `${e.key}: ${e.msg}`).join(' · ') : `ACCEPTED (${r.errors.length} errors) — expected ${JSON.stringify(expect)}`]);
    // A refused shape must also leave the act untouched, never half-applied.
    if (r.errors.length && r.config !== base) rows.push([false, `${label} · config untouched`, 'a refused shape returned a modified config']);
  };

  refuseCase(`floors below the derived minimum (${mv.floors})`, { floors: (mv.floors || 4) - 1 }, 'is below');
  refuseCase('one column — a corridor', { columns: 1 }, 'corridor');
  refuseCase('every weight zero', { typeWeights: Object.fromEntries(Object.keys(base.typeWeights).map((k) => [k, 0])) }, 'every weight is zero');
  refuseCase('a node type this act does not roll', { typeWeights: { boss: 50 } }, 'is not a node type');
  refuseCase('a fractional floors cap', { floors: 8.5 }, 'whole number');
  refuseCase('a knob nobody declared', { rows: 8 }, 'is not a run-shape knob');
  refuseCase('a weight above the limit', { typeWeights: { elite: MAP_SHAPE_LIMITS.maxWeight + 1 } }, 'is above the');
  refuseCase('a negative weight', { typeWeights: { elite: -1 } }, 'weight of 0 or more');

  // A cap ABOVE the act is not an error — it is slack, and it must SAY SO.
  const slack = applyRunShape(base, { floors: base.floors + 3 }, MAP_SHAPE_LIMITS);
  rows.push([
    slack.errors.length === 0 && !slack.changed && slack.readout.some((l) => l.includes('NOT BINDING')),
    'a cap above the act is slack, and says NOT BINDING',
    slack.readout.join(' · ') || `${slack.errors.length} errors`,
  ]);

  // THE EFFECT GATE MUST BE ABLE TO FIRE. A dead sweep — every seed the same —
  // is what the referent gate exists for, so feed it one on purpose.
  const dead = runShapeMode('floors=8', 12, { quiet: true, rngFor: () => createRng(7) });
  rows.push([
    dead.findings.some((f) => f.includes('rng stream') || f.includes('distinct graph')),
    'a dead sweep (every seed identical) is caught by the referent gate',
    dead.findings[0] || 'NO FINDING — the gate cannot fire',
  ]);

  // A live sweep at a real shape must NOT be caught. A checker that reds
  // everything is not a checker (the control).
  const live = runShapeMode('floors=8,columns=4,elite=40', 12, { quiet: true });
  rows.push([live.findings.length === 0, 'the control: a real shape on a live sweep is clean', live.findings.join(' · ') || 'clean']);

  let bad = 0;
  for (const [ok, label, detail] of rows) {
    if (!ok) bad++;
    console.log(`  ${ok ? 'RED ' : 'MISS'}  ${label}`);
    console.log(`        ${detail}`);
  }
  console.log(`\n  ${bad ? `FAIL — ${bad} of ${rows.length} rows did not behave` : `PASS — all ${rows.length} rows behaved: every known-bad refused by name, the gates fire, the control is clean`}`);
  return bad ? 1 : 0;
}
// --------------------------------------------------------------- the census
// A COMMAND WHOSE EXIT CODE IS THE GEOMETRY, and it is separate from everything
// else on purpose. `--selftest` asks "do the refusals fire on their known-bads",
// which is a question about the instrument; this asks "does the tree collide",
// which is a question about the tree. They are two subjects and the night I
// merged them into one exit code is the night one of them stops being readable.
//
// IT EXITS 1 TODAY. That is not a regression I introduced — the boss/shrine
// overlap has been rendered in every act and every seed since #107 gave the
// radii their derivation, and it had 11 SVG units of air before that. What is
// new is that something says so. The fix is a proportion Freja owns; I am not
// picking a boss ratio at 4am to make my own instrument green.
function margins() {
  console.log(`mapplan --margins — every pair of circles this map draws next to each other\n`);
  printFanoutMargin(mapConfigs[1], '  ');
  console.log('');
  const bad = printPairAir('  ');
  console.log(`\n  ${bad ? `FAIL — ${bad} pair(s) below the ${NODE_AIR_MIN_PX} px floor` : 'PASS — every pair clears the floor'}`);
  console.log(`\n  BOUNDARY — arithmetic over the constants, and it agrees with Sunna's rendered readings to`);
  console.log(`  the hundredth on all three pairs. It is silent on whether an overlap READS as broken`);
  console.log(`  (Freja), on anything the generator can place that is not one of these three pairs, and`);
  console.log(`  on every shape between 320x640 and 390x844 — those two are the reference, not the range.`);
  return bad ? 1 : 0;
}

function main() {
  if (args.includes('--spans')) process.exit(spans());
  if (args.includes('--shape-selftest')) process.exit(shapeSelftest());
  if (argOf('--shape') != null) {
    const r = runShapeMode(argOf('--shape'), SEEDS);
    if (r.usage) process.exit(2);
    if (r.refusedAll) { console.log(`\n  FAIL — every act refused this shape`); process.exit(1); }
    if (r.findings.length) {
      console.log(`\n  FAIL — ${r.findings.length} finding(s)`);
      for (const f of r.findings) console.log(`    - ${f}`);
      process.exit(1);
    }
    console.log(`\n  PASS — the shape resolves, the harness varies, and every named weight moved its share the way it was pushed`);
    process.exit(0);
  }
  if (args.includes('--margins')) process.exit(margins());
  if (selftestOnly) process.exit(selftest());
  if (!Number.isFinite(SEEDS) || SEEDS < 1) { console.error('mapplan: --seeds must be a positive integer'); process.exit(2); }

  const overrideFloors = numOf('--floors', null);
  const overrideCols = numOf('--columns', null);
  const overridePaths = numOf('--paths', null);
  const overrideEntries = numOf('--entries', null);
  const previewing = overrideFloors != null || overrideCols != null || overridePaths != null || overrideEntries != null;

  const acts = previewing
    ? [['PREVIEW act 1', { ...mapConfigs[1],
      ...(overrideFloors != null ? { floors: overrideFloors } : {}),
      ...(overrideCols != null ? { columns: overrideCols } : {}),
      ...(overridePaths != null ? { pathCount: overridePaths } : {}),
      ...(overrideEntries != null ? { entries: overrideEntries } : {}) }]]
    : Object.entries(mapConfigs).map(([act, cfg]) => [`act ${act}`, cfg]);

  console.log(`mapplan — ${previewing ? 'PREVIEW (not shipped content)' : 'shipped acts'} · ${SEEDS} seeds each`);
  if (previewing) {
    const base = mapConfigs[1];
    console.log(`  base act 1: ${base.floors} floors x ${base.columns} columns, ${base.pathCount} paths`
      + ` · rollable band ${rollableFloors(base)}`);
  }
  // THE PAIR CENSUS IS NOT PER-ACT — one data input, the tap default — so it
  // prints once here for the same reason the boot validator asks it once. It is
  // NOT folded into `findings`: the collision it reports today is a code
  // constant's, and this run's exit code is about content promises. `--margins`
  // is the command whose exit code IS the census.
  {
    const bad = printPairAir('  ');
    // AND A RED HERE IS NOT CLEARED BY THIS RUN'S EXIT CODE — say so, rather
    // than letting a reader take `exit 0` for the whole verdict.
    if (bad) console.log(`  ^ ${bad} pair(s) BELOW THE FLOOR. This run's exit code is about content promises`
      + ` and does not cover them: \`node tools/mapplan.mjs --margins\` is the command whose exit code does.`);
  }


  const findings = [];
  let cells = 0;
  for (const [label, cfg] of acts) {
    const r = runAct(label, cfg, SEEDS);
    findings.push(...r.findings);
    cells += r.cells;
  }

  // A tool that measured nothing is UNKNOWN, never a pass (SOP 2's silence
  // guard, and screenreach's lesson). `0 checks passed` at exit 0 is the shape
  // this house has already been bitten by.
  // …AND A REFUSAL IS AN ANSWER, not a silence. The guard below used to read
  // `cells === 0` alone, so a config this tool correctly REFUSED exited 2 —
  // the same code as "the harness never ran", which means unknown. A finding
  // with nothing generated is a finding; only nothing-found-and-nothing-run is
  // unknown.
  if (cells === 0 && findings.length === 0) {
    console.error(`\nmapplan: nothing was generated. That is unknown, not a pass.`);
    process.exit(2);
  }

  console.log(`\n  BOUNDARY — what a green here does NOT mean:
  (a) NOT A PLAY TEST. Every number is a count over a generated graph. Whether a
      10-floor act FEELS like a climb is Sunna's call, and Freja measured that 12
      is the last shape that still leans upward rather than reading as a field.
      No number here can answer it.
  (b) REACHABILITY IS REPORTED, NOT ENFORCED. 'minElites' counts nodes in the
      whole graph. The starts-that-reach-nothing figures above are measured and
      printed; nothing fails on them, and making the generator honour them is a
      design change nobody has approved.
  (c) THE '?' NODES ARE NOT RESOLVED HERE. unknownWeights is read out and its
      total is checked; what a given '?' becomes is engine/encounters.js on the
      'events' stream, and this tool never runs it.
  (d) ONE PLATFORM, one RNG implementation, no browser. This is arithmetic over
      the generator, not evidence that a map renders.
  (e) NOT 'verified-at' ANY CI REF — hand-run, like everything on this repo.`);

  console.log(`\n  ${findings.length ? `FAIL — ${findings.length} finding(s) over ${cells} generated act(s)`
    : `PASS — ${cells} generated act(s): every rule resolves, every fixed rank lands in every seed, every gate holds at the tail`}`);
  for (const f of findings) console.log(`    - ${f}`);
  process.exit(findings.length ? 1 : 0);
}

main();
