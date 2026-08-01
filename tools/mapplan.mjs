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
  for (const e of errors) findings.push(`${label}: ${e.key} — ${e.msg}`);
  if (!plan || errors.length) return { findings, cells: 0 };

  const rows = measure(config, seeds);
  const nodes = dist(rows, (r) => r.nodes);
  const stops = dist(rows, (r) => r.stops);

  // REFERENT GATE — a "distribution" with no variance is one seed counted n
  // times, and it is indistinguishable in every printed number from a generator
  // that is genuinely tight. An empty result and a clean result look identical
  // and mean the opposite (SOP 2's ⚙ clause), so the harness proves it moved
  // before any number below is allowed to mean anything. Freja's 24-seed run is
  // the referent: 57.3 mean over a 46-64 range, so a real spread is expected
  // here and its absence is the harness, not the content.
  if (seeds >= 8 && nodes.min === nodes.max) {
    findings.push(`${label}: ${seeds} seeds produced identical maps (${nodes.min} nodes every time). `
      + `That is one seed measured ${seeds} times, not a distribution — the harness is not varying and no number in this block means anything.`);
    return { findings, cells: 0 };
  }
  console.log(`\n  ${seeds} seeds`);
  console.log(`    nodes per act       ${show(nodes)}`);
  console.log(`    stops per run       ${show(stops)}    (floors + 1 = ${config.floors + 1})`);
  for (const type of ['monster', 'event', 'elite', 'shrine', 'merchant', 'treasure']) {
    const d = dist(rows, (r) => r.byType[type] || 0);
    console.log(`    ${type.padEnd(20)}${show(d)}`);
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

function selftest() {
  console.log('mapplan --selftest — the corpus `floorRules: opt(any)` accepted in silence\n');
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
  const pass = red === KNOWN_BAD.length && clean;
  console.log(`\n  ${pass ? `PASS — ${red}/${KNOWN_BAD.length} known-bad observed red, control clean`
    : `FAIL — ${red}/${KNOWN_BAD.length} red, control ${clean ? 'clean' : 'DIRTY'}`}`);
  return pass ? 0 : 1;
}

// ------------------------------------------------------------------- driver
function main() {
  if (selftestOnly) process.exit(selftest());
  if (!Number.isFinite(SEEDS) || SEEDS < 1) { console.error('mapplan: --seeds must be a positive integer'); process.exit(2); }

  const overrideFloors = numOf('--floors', null);
  const overrideCols = numOf('--columns', null);
  const overridePaths = numOf('--paths', null);
  const previewing = overrideFloors != null || overrideCols != null || overridePaths != null;

  const acts = previewing
    ? [['PREVIEW act 1', { ...mapConfigs[1],
      ...(overrideFloors != null ? { floors: overrideFloors } : {}),
      ...(overrideCols != null ? { columns: overrideCols } : {}),
      ...(overridePaths != null ? { pathCount: overridePaths } : {}) }]]
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
  if (cells === 0) {
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
