#!/usr/bin/env node
// tools/gracerefill.mjs — what a grace hands back, and proof it refuses.
// Sten, 2026-08-08. Corpus ported to the charge model by Sten, 2026-08-15.
//
// THE DOOR, AND IT IS THE WHOLE REASON THIS FILE IS SHAPED LIKE THIS.
// `development.md`, *The instrument rule*, same-door clause: a known-bad handed
// straight to the function under test exercises the half that was never in
// doubt. Eleven instruments in this house ran dead on 2026-08-08 and printed a
// plausible number; six of them planted BELOW the defect.
//
// So every plant here enters where the real input enters, and there are two
// real doors, because this feature has two:
//
//   DOOR 1 — CONTENT. The game boots `validateContent(contentBundle)`
//   (src/main.js) against the bundle from `src/content/index.js`. Every data
//   plant below mutates a deep copy of THAT bundle — the real one, with the
//   real flasks and the real balance in it — and is handed to THAT function. No
//   synthetic `{ balance: { graceRefill: … } }` object is constructed anywhere
//   in this file: a hand-built bundle would prove the refusal reads its own
//   argument and nothing about whether the shipped bundle ever reaches it.
//
//   DOOR 2 — THE SHRINE. The refill is applied by `applyGraceRefill`
//   (src/engine/encounters.js), called from `showRest()` in src/main.js on
//   arrival at a shrine node, against registries built by `createRegistries`
//   and a run built by `createRunState` — the door every run comes through.
//
// THE CORPUS'S OWN HISTORY, because a corpus that silently stopped running is
// the eleven-instruments shape and this one did exactly that. The original
// 13 content plants + 10 behaviour plants were written against the slot-
// inventory model. When the fixed-capacity charge model landed, the selftest
// grew an `if (Number.isInteger(balance.flaskCapacity))` branch that returned
// early, and the whole corpus went dead — still in the file, never run, while
// the RESULT count silently shrank 15+20 → 3+2. Vira's doors audit
// (2026-08-14) found it. Disposition, mine to make as the owner:
//
//   PORTED  — the Door-1 refusal corpus. `graceRefillRefusals` is still called
//             on every boot (model/validate.js) and the table idiom is kept on
//             purpose: settings derives its chip rows from the table, and the
//             wake red below guards its NOT BINDING promise. The old plants
//             mutated rows of a populated table; the shipped table is now `[]`,
//             so each plant POSES its rows into a real bundle copy instead —
//             same door, current tree shape.
//   PORTED  — the Law 0 falsifier, restated for the charge model: a content
//             row, zero engine edits, changes which flask every screen
//             presents (chargeFlaskDefinition resolves authored-first).
//   RETIRED — the slot-inventory behaviour plants (top-up, idempotent,
//             shortfall, slot semantics, run-start allocation). Every real run
//             carries flaskCharges from birth (model/state.js createRunState)
//             or is given them at the load door (engine/save.js loadRun), and
//             applyGraceRefill takes the charges branch whenever they exist
//             (engine/encounters.js) — so the slot pour has NO door a real
//             input can enter, and a plant on it would be downstream-by-
//             construction: the same-door clause's own verdict, applied to a
//             branch instead of a fixture. They also could not run at all
//             against the shipped bundle: mutating `graceRefill[0]` of an
//             empty table is a TypeError, not a red.
//
// WHAT AN AUTHOR WRITES: nothing. Adding a refusal to model/gracerefill.js
// without adding a plant here leaves the covered-paths count visibly short.
//
// Usage:
//   node tools/gracerefill.mjs              # what the shipped table does
//   node tools/gracerefill.mjs --selftest   # plants; exits 1 on any miss

import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { applyGraceRefill } from '../src/engine/encounters.js';
import {
  graceRefillPlan, graceRefillTable, graceRefillLadder, flaskKindOf, flaskSlotCap,
  reallocateFlaskCharges, chargeFlaskDefinition, chargeKindForFlask,
} from '../src/model/gracerefill.js';
import { FLASK_KINDS } from '../src/model/schemas.js';

const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');

// A deep copy of the REAL bundle. structuredClone drops the `scripts` functions
// (they are not cloneable), so they are re-attached by reference — the plants
// are all data, and a script identity is exactly what must NOT change.
function realBundleCopy() {
  const { scripts, ...rest } = contentBundle;
  const copy = structuredClone(rest);
  copy.scripts = scripts;
  return copy;
}

function freshRun(registries, classId = 'reaver') {
  return createRunState({ seed: 1, classId, registries });
}

function emptyRun(registries, classId = 'reaver') {
  const run = freshRun(registries, classId);
  run.flasks = [];
  return run;
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
function report() {
  const reg = createRegistries(contentBundle);
  const bal = reg.balance;
  const cap = flaskSlotCap(bal);
  console.log('gracerefill: what a Shrine of Emberlight hands back.\n');
  console.log(`  carry cap (balance.flaskSlots)  ${cap}`);
  console.log(`  debug ladder per row            ${graceRefillLadder(bal).join(' ')}`);
  console.log(`  flask kinds (closed set)        ${FLASK_KINDS.join(', ')}\n`);

  console.log('  KIND MEMBERSHIP — derived from each entry, nothing authored:');
  for (const k of FLASK_KINDS) {
    const ids = reg.flasks.all().filter((d) => flaskKindOf(d) === k).map((d) => d.id);
    console.log(`    ${k.padEnd(8)} ${ids.length ? ids.join(', ') : '(no entry declares this kind)'}`);
  }

  console.log('\n  THE TABLE (balance.graceRefill), against a fresh run with 0 flasks:');
  const plan = graceRefillPlan(reg, emptyRun(reg));
  for (const r of plan.rows) {
    const head = `    ${r.kind}×${r.count}`.padEnd(16);
    console.log(`${head}${r.binding ? `grants ${r.granted} × ${r.flaskId}` : 'NOT BINDING'}`);
    if (r.why) console.log(`                  ${r.why}`);
  }
  console.log(`\n  A fresh run leaving a grace holds ${plan.total} of ${cap} flask slots.`);
  if (graceRefillTable(bal).length === 0) console.log('  (no table: a grace refills nothing)');

  const inert = plan.rows.filter((r) => !r.binding).length;
  console.log(`\nRESULT: ${plan.rows.length} refill row(s) — ${plan.total} flask(s) poured into an empty run's `
    + `${cap} slot(s), ${inert} row(s) NOT BINDING.`);

  console.log('\nBOUNDARY — what this report does NOT say:');
  console.log('  · it reports the SHIPPED table at one run state (fresh, 0 flasks held).');
  console.log('    Whether the refusals can go red is --selftest, and nothing else here claims it.');
  console.log('  · it says nothing about release balance. The old no-Mana A/B is stale; a');
  console.log('    Mana-aware run simulation and player review remain separate gates.');
  console.log('  · co-op refills every living member at enterShrine (tools/session.mjs) with the');
  console.log('    AUTHORED counts — the server has no meta.settings — and this report does not');
  console.log('    open a session.');
}

// ---------------------------------------------------------------------------
// selftest — every refusal, planted through the real door
// ---------------------------------------------------------------------------

// THE POSE, and it is the port's whole mechanic. The shipped table is `[]`
// today, so a plant that mutates `graceRefill[0]` throws instead of refusing —
// that is how the old corpus died. Each row plant now AUTHORS its table into a
// real bundle copy, exactly as a content author would, and hands the whole
// bundle to the real boot validator. Same door as before; current tree shape.
function poseTable(bundle, rows) {
  bundle.balance.graceRefill = rows;
  return bundle;
}

// Each plant: mutate the REAL bundle copy, hand it to the REAL validator, and
// require an error whose key matches. `expect` is matched against the whole
// `path: msg` line, so a renamed index does not silently pass — the key path is
// asserted, not the prose, and the prose is printed so a human reads what a
// maintainer would.
const PLANTS = [
  // ---- the charge model's own refusals: live on the shipped tree ----------
  { name: 'capacity zero',
    expect: /balance\.flaskCapacity/,
    mutate: (b) => { b.balance.flaskCapacity = 0; } },
  { name: 'class allocation above capacity',
    expect: /startingFlaskAllocation/,
    mutate: (b) => { b.classes[0].startingFlaskAllocation = { hp: 3, mana: 1 }; } },
  { name: 'fractional class allocation',
    expect: /startingFlaskAllocation/,
    mutate: (b) => { b.classes[0].startingFlaskAllocation = { hp: 1.5, mana: 1.5 }; } },

  // ---- the ported table refusals: the row is POSED, then really validated --
  { name: 'kind nothing carries',
    expect: /^balance\.graceRefill\[0\]\.kind:/m,
    mutate: (b) => poseTable(b, [{ kind: 'stamina', count: 1 }]) },
  { name: 'kind misspelt (the typo case)',
    expect: /^balance\.graceRefill\[0\]\.kind:/m,
    mutate: (b) => poseTable(b, [{ kind: 'HP', count: 1 }]) },
  { name: 'two rows for one kind',
    expect: /^balance\.graceRefill\[1\]\.kind:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 1 }, { kind: 'hp', count: 1 }]) },
  { name: 'count is not a number',
    expect: /^balance\.graceRefill\[0\]\.count:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 'three' }]) },
  { name: 'count is negative',
    expect: /^balance\.graceRefill\[0\]\.count:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: -1 }]) },
  { name: 'count is fractional',
    expect: /^balance\.graceRefill\[0\]\.count:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 2.5 }]) },
  { name: 'one row above the carry cap',
    expect: /^balance\.graceRefill\[0\]\.count:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: b.balance.flaskSlots + 1 }]) },
  { name: 'row is not an object',
    expect: /^balance\.graceRefill\[1\]:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 1 }, 'mana']) },
  { name: 'table is not an array',
    expect: /^balance\.graceRefill:/m,
    mutate: (b) => { b.balance.graceRefill = { hp: 3 }; } },
  { name: 'flaskId override is not a flask',
    expect: /^balance\.graceRefill\[0\]\.flaskId:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 1, flaskId: 'crimsonFlaskk' }]) },
  { name: 'flaskId override is of the wrong kind',
    expect: /^balance\.graceRefill\[0\]\.flaskId:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 1, flaskId: 'azureFlask' }]) },
  { name: 'the aggregate: two satisfiable rows over the carry cap refuse',
    expect: /^balance\.graceRefill:/m,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 2 }, { kind: 'mana', count: 2 }]) },

  // NEGATIVES. A corpus that never checks the clean case cannot tell "the
  // refusal fires" from "the refusal always fires".
  { name: 'NEGATIVE — a legal posed table does not refuse', expectClean: true,
    mutate: (b) => poseTable(b, [{ kind: 'hp', count: 2 }, { kind: 'mana', count: 1 }]) },
  { name: 'NEGATIVE — a zero-count row is legal', expectClean: true,
    mutate: (b) => poseTable(b, [{ kind: 'utility', count: 0 }]) },
];

// Behaviour plants: door 2. Each drives the charge model through registries
// built from a real bundle copy and a run built by `createRunState` — the door
// every real run comes through, in the game, in co-op and in every sim.
const BEHAVIOUR = [
  {
    name: 'a grace refills current charges to the run\'s allocation',
    run: (reg) => {
      const run = freshRun(reg);
      run.flaskCharges.hpCurrent = 0;
      run.flaskCharges.manaCurrent = 0;
      applyGraceRefill(reg, run);
      const ok = run.flaskCharges.hpCurrent === run.flaskCharges.hp
        && run.flaskCharges.manaCurrent === run.flaskCharges.mana;
      return { ok, saw: `hp ${run.flaskCharges.hpCurrent}/${run.flaskCharges.hp}, mana ${run.flaskCharges.manaCurrent}/${run.flaskCharges.mana}` };
    },
  },
  {
    name: 'reallocation preserves hp + mana = capacity',
    run: (reg) => {
      const run = freshRun(reg);
      reallocateFlaskCharges(run.flaskCharges, { hp: 1, mana: run.flaskCharges.capacity - 1 });
      const f = run.flaskCharges;
      return { ok: f.hp + f.mana === f.capacity, saw: `${f.hp} + ${f.mana} vs capacity ${f.capacity}` };
    },
  },
  {
    // LAW 0's FALSIFIER, PORTED. The slot-model version proved a content row
    // could replace which flask a grace POURED. The charge model pours no
    // flasks — so the same claim, on the surface that survived: one content
    // row, ZERO engine commits, and every screen that names the Mana charge
    // (rest.js, combat.js, coop.js all call chargeFlaskDefinition) names the
    // new entry instead. The row enters `src/content/flasks.js`'s array
    // through the real bundle and the real registry build.
    name: 'LAW 0: one content row re-points the Mana charge, no engine edit',
    bundle: (b) => {
      b.flasks.unshift({
        id: 'ceruleanFlask', name: 'Cerulean Flask', rarity: 'common', icon: '🔵',
        effects: [{ op: 'restoreMana', amount: 5 }], textTemplate: 'Restore 5 Mana.',
      });
    },
    run: (reg) => {
      const def = chargeFlaskDefinition(reg, 'mana');
      const backwards = chargeKindForFlask(reg, 'ceruleanFlask');
      const hpUntouched = chargeFlaskDefinition(reg, 'hp').id === 'crimsonFlask';
      const ok = def.id === 'ceruleanFlask' && backwards === 'mana' && hpUntouched;
      return { ok, saw: `mana charge resolves to '${def.id}', reverse '${backwards}', hp still '${chargeFlaskDefinition(reg, 'hp').id}'` };
    },
  },
];

// RETIRED, and the reason is written rather than left as a gap (the header
// carries the long form). These slot-inventory behaviours have no door a real
// input can enter: every run carries `flaskCharges` from birth or is given
// them at the load door, and `applyGraceRefill` takes the charges branch
// whenever they exist — so a plant on the pour would be downstream by
// construction. Printed on every run so the shrinkage can never be silent
// again, which is exactly how this corpus died the first time.
const RETIRED = [
  'top-up semantics (arriving with 2 gets you 1)',
  'idempotence (a second grace at the same stop grants nothing)',
  'shortfall reporting when the slots are full of other flasks',
  'the debug counts override reaching the shrine',
  'run-start allocation by data (graceRefillAtRunStart)',
];


function selftest() {
  console.log('gracerefill --selftest: every refusal planted through the door the real input uses.\n');
  let fails = 0;
  // Counted, never typed (the cf3fe6d defect class): these move with the checks
  // themselves, so a check added without a plant leaves the RESULT visibly off.
  let behaviourChecks = 0;

  // The clean tree first. A corpus that never checks the negative case cannot
  // tell "the refusal fires" from "the refusal always fires".
  const clean = validateContent(contentBundle);
  const cleanGrace = clean.errors.filter((e) => String(e.path).startsWith('balance.graceRefill'));
  console.log(`  CLEAN TREE  ${cleanGrace.length === 0 ? 'ok' : 'RED'} — ${cleanGrace.length} graceRefill error(s) on the shipped bundle`);
  if (cleanGrace.length) { fails++; for (const e of cleanGrace) console.log(`      ${e.path}: ${e.msg}`); }
  if (!clean.ok) {
    console.log(`  NOTE: the shipped bundle has ${clean.errors.length} validation error(s) overall (not all mine).`);
  }

  console.log('\n  DOOR 1 — content, through validateContent(bundle):');
  for (const p of PLANTS) {
    const b = realBundleCopy();
    p.mutate(b);
    const res = validateContent(b);
    const said = res.errors.map((e) => `${e.path}: ${e.msg}`).join('\n');
    if (p.expectClean) {
      // A negative is judged on THIS feature's keys only: an unrelated refusal
      // elsewhere in the bundle must not be read as this row being refused.
      const mine = res.errors.filter((e) => String(e.path).startsWith('balance.graceRefill'));
      const ok = mine.length === 0;
      if (!ok) fails++;
      console.log(`    ${ok ? 'green' : 'MISS '}  ${p.name}${ok ? '' : ` — refused when it should not: ${mine[0].path}: ${mine[0].msg}`}`);
      continue;
    }
    const ok = p.expect.test(said);
    if (!ok) {
      fails++;
      console.log(`    MISS   ${p.name} — expected ${p.expect}, got ${res.errors.length ? res.errors.map((e) => e.path).join(', ') : 'NOTHING'}`);
    } else {
      const hit = res.errors.find((e) => p.expect.test(`${e.path}: ${e.msg}`));
      console.log(`    RED    ${p.name}`);
      console.log(`             ${hit.path}: ${hit.msg}`);
    }
  }

  console.log('\n  DOOR 2 — the run, through createRegistries + createRunState + applyGraceRefill:');
  for (const t of BEHAVIOUR) {
    behaviourChecks++;
    let reg;
    try {
      const b = realBundleCopy();
      if (t.bundle) t.bundle(b);
      reg = createRegistries(b);
    } catch (e) {
      fails++;
      console.log(`    MISS   ${t.name} — registry build threw: ${e.message}`);
      continue;
    }
    let out;
    try {
      out = t.run(reg);
    } catch (e) {
      fails++;
      console.log(`    MISS   ${t.name} — threw: ${e.message}`);
      continue;
    }
    if (!out.ok) fails++;
    console.log(`    ${out.ok ? 'green' : 'MISS '}  ${t.name} — ${out.saw}`);
  }

  // WAKE RED (development.md, *The wake condition*, Freja 2026-08-14). The
  // NOT BINDING idiom — graceRefillPlan's inert row and the settings
  // applied-line, both resolving membership through firstFlaskOfKind —
  // refuses a row whose kind has no member, and PROMISES to bind "the day
  // an entry carries the kind", zero code. Nothing here could fail when
  // that promise rots: a row that keeps printing NOT BINDING after its
  // binder appears is absence, and absence never fails a test written to
  // expect absence. The mana kind already lived this shape once — no
  // member on 2026-08-08, azureFlask derives 'mana' today.
  //
  // THE WITNESS IS DELIBERATELY INDEPENDENT of flaskKindOf: a binder is an
  // entry carrying the kind explicitly or carrying the kind's deriving op
  // (restoreMana → mana, heal → hp — flaskKindOf's own published rule,
  // restated HERE ON PURPOSE as a consistency witness). If the derivation
  // is retuned, move this witness WITH it or this goes red — that red is
  // the wake working, not a false alarm. A witness that resolved through
  // flaskKindOf itself would rot in lockstep with the thing it watches and
  // agree forever (the same-door clause's whole point).
  behaviourChecks++;
  const witnessKind = (d) => {
    if (typeof d.kind === 'string') return d.kind;
    const effects = Array.isArray(d.effects) ? d.effects : [];
    if (effects.some((e) => e && e.op === 'restoreMana')) return 'mana';
    if (effects.some((e) => e && e.op === 'heal')) return 'hp';
    return 'utility'; // the fallback IS part of the rule: utility is the everything-else kind
  };
  const hasBinder = (defs, kind) => defs.some((d) => d && witnessKind(d) === kind);
  const poseRow = (bundle, kind) => {
    bundle.balance.graceRefill = [{ kind, count: 1 }];
    bundle.balance.graceRefillAtRunStart = false;
    const r = createRegistries(bundle);
    const posed = freshRun(r);
    posed.flasks = [];
    return graceRefillPlan(r, posed).rows[0];
  };
  const wakeBad = [];
  for (const kind of FLASK_KINDS) {
    const b = realBundleCopy();
    const binder = hasBinder(b.flasks, kind);
    const row = poseRow(b, kind);
    if (binder && row.binding === false) wakeBad.push(`'${kind}' has a binder in content yet its row prints NOT BINDING — the premise died while the refusal stands`);
    if (!binder && row.binding === true) wakeBad.push(`'${kind}' has no binder yet its row binds ('${row.flaskId}') — the refusal dropped without its binder`);
  }
  // The refusal's own live negative: strip every mana binder from a real
  // bundle copy and the posed row must refuse — otherwise the NOT BINDING
  // branch itself is dead and the promise above is being kept by accident.
  {
    const b = realBundleCopy();
    b.flasks = b.flasks.filter((d) => !(d && (d.kind === 'mana' || (d.kind == null && Array.isArray(d.effects) && d.effects.some((e) => e && e.op === 'restoreMana')))));
    const row = poseRow(b, 'mana');
    if (row.binding !== false || !/NOT BINDING/.test(row.why)) {
      wakeBad.push(`with every mana binder stripped the row still binds ('${row.flaskId}') — the NOT BINDING branch is dead`);
    }
  }
  if (wakeBad.length) fails++;
  console.log(`  ${wakeBad.length ? 'MISS ' : 'green'} WAKE RED: every kind's NOT BINDING verdict agrees with binder existence, both directions${wakeBad.length ? ` — ${wakeBad.join('; ')}` : ` (${FLASK_KINDS.join(', ')} live; mana re-refuses when stripped)`}`);


  // The count that goes red when a refusal is added without a plant. It reads
  // the refusal keys the module can emit by planting, so it cannot drift into
  // agreeing with itself.
  // Printed, not just counted: a number nobody can check against the list it
  // came from is the same silence in a smaller font.
  const covered = new Set(PLANTS.filter((p) => !p.expectClean)
    .map((p) => String(p.expect)
      .replace(/^\/\^?/, '').replace(/:?\/[a-z]*$/, '')
      .replace(/\\\[\\d\+\\\]|\\\[\d+\\\]/g, '[i]')
      .replace(/\\\./g, '.')));
  console.log(`\n  refusal paths covered: ${covered.size} distinct — ${[...covered].join(', ')}`);

  // THE RETIRED PLANTS, NAMED IN THE OUTPUT — not only in the header. This
  // corpus once shrank in silence; a disposition a run never prints is the
  // same silence with a comment on it.
  console.log(`\n  RETIRED with the charge model (${RETIRED.length}, reason in this file's header —`);
  console.log('  the slot pour has no door a real input can enter):');
  for (const r of RETIRED) console.log(`    · ${r}`);

  console.log('\nBOUNDARY — what a green from --selftest does NOT mean:');
  console.log('  · it proves the boot refusals FIRE and the charge model refills. It says');
  console.log('    nothing about whether the allocation is right release balance — that needs');
  console.log('    a Mana-aware simulation and player review, not the stale no-Mana A/B.');
  console.log('  · the Door-1 plants are IN-MEMORY bundle copies handed to the real');
  console.log('    validator: the module LOAD stage carries no plant, so a defect in how');
  console.log('    src/content/index.js assembles the bundle is invisible here.');
  console.log('  · no browser ran. The settings rows and shrine sentence');
  console.log('    are rendered HTML and are photographed, not asserted, here.');
  console.log('  · the co-op path (tools/session.mjs enterShrine) is covered by');
  console.log('    `node tools/session-smoke.mjs`, not by this file.');

  console.log(`\nRESULT: ${fails === 0 ? 'all plants behaved' : `${fails} MISS`} — ${PLANTS.length} content plants, ${behaviourChecks} behaviour checks, ${RETIRED.length} retired (counted at run time, never typed).`);
  return fails;
}

if (SELFTEST) {
  process.exit(selftest() === 0 ? 0 : 1);
} else {
  report();
}
