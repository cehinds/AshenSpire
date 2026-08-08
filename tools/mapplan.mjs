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
// REMOVAL CONDITION: deleted the day floor rules carry no anchors (nothing to
// resolve, so no readout to print), or on Constantine's word.

import { mapConfigs } from '../src/content/mapconfig.js';
import { resolveFloorPlan, describePlan, rollableFloors } from '../src/model/floorplan.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { createRng } from '../src/engine/rng.js';
import { viewRefusals, spanWidth, maxFanoutSpan, PHONE_VIEW_W, ZOOM_MIN } from '../src/model/mapview.js';
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
const seedOf = (i) => (Math.imul(i + 1, 2654435761) >>> 0);
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
      minFloorOf: (type) => { const f = all.filter((n) => n.type === type).map((n) => n.floor); return f.length ? Math.min(...f) : null; },
      floorsOf: (type) => all.filter((n) => n.type === type).map((n) => n.floor),
    });
  }
  return rows;
}

function dist(rows, pick) {
  const xs = rows.map(pick);
  return { mean: +mean(xs).toFixed(2), min: Math.min(...xs), max: Math.max(...xs), xs };
}
const show = (d) => `${String(d.mean).padStart(6)}  (range ${d.min}-${d.max})`;

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
  // THE GATE ACTUALLY GATES, at the tail and not just at the mean.
  for (const type of ['elite', 'shrine']) {
    const below = rows.filter((r) => r.floorsOf(type).some((f) => f < plan.eliteShrineFrom)).length;
    if (below) findings.push(`${label}: '${type}' appears below floor ${plan.eliteShrineFrom} in ${below} of ${seeds} seeds`);
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
const VIEW_KNOWN_BAD = [
  ['columns 10 — past the derived edge', { ...BASE, columns: 10 }, 'columns'],
  ['columns 12 — well past it', { ...BASE, columns: 12 }, 'columns'],
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
  ['columns 9 — the derived edge itself', { ...BASE, columns: 9 }],
  ['columns 7 — what ships', { ...BASE, columns: 7 }],
  ['entries 1 — what ships', { ...BASE, entries: 1 }],
  ['entries 6 — one door per walker', { ...BASE, pathCount: 6, entries: 6 }],
  ['entries absent', (() => { const { entries, ...rest } = BASE; return rest; })()],
];

function selftest() {
  console.log('mapplan --selftest — two corpora: the one `floorRules: opt(any)` accepted in silence, and the one `viewRefusals` never had\n');
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

  const pass = red === KNOWN_BAD.length && clean
    && vred === VIEW_KNOWN_BAD.length && vclean === VIEW_MUST_ACCEPT.length && wired;
  console.log(`\n  ${pass ? `PASS — ${red}/${KNOWN_BAD.length} floor-rule known-bad red, ${vred}/${VIEW_KNOWN_BAD.length} view known-bad red, ${vclean}/${VIEW_MUST_ACCEPT.length} must-accept clean, validator wired, control clean`
    : `FAIL — floor ${red}/${KNOWN_BAD.length} · view ${vred}/${VIEW_KNOWN_BAD.length} · must-accept ${vclean}/${VIEW_MUST_ACCEPT.length} · validator ${wired ? 'wired' : 'LOOSE'} · control ${clean ? 'clean' : 'DIRTY'}`}`);
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
  console.log('  cols  entrance row        widest fan-out      formula  fan-out px  wants   verdict');
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
    console.log(`  ${String(columns).padStart(4)}  ${`${Math.min(...st)}..${Math.max(...st)}`.padEnd(19)}`
      + ` ${`${Math.min(...fan)}..${obs}`.padEnd(19)} ${String(formula).padStart(7)}  ${String(Math.round(px)).padStart(10)}`
      + `  ${wants.toFixed(2)}x  ${over ? 'FORMULA TOO LOW' : wants >= ZOOM_MIN ? 'fits' : 'REFUSED at boot'}`);
  }
  console.log(`\n  The entrance row is the wider frame and it is NOT what the refusal is about:`);
  console.log(`  it is a graph fact, not a camera fact — walkers landing on up to 'columns'`);
  console.log(`  distinct doors. \`entries: 1\` collapses it to 1 column, and that is what ships.`);
  console.log(`\n  ${bad ? `FAIL — maxFanoutSpan is below the observed maximum at ${bad} width(s)`
    : `PASS — maxFanoutSpan matched the observed maximum over ${run} graphs across all three knobs`}`);
  return bad ? 1 : 0;
}

function main() {
  if (args.includes('--spans')) process.exit(spans());
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
