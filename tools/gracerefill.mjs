#!/usr/bin/env node
// tools/gracerefill.mjs — what a grace hands back, and proof it refuses.
// Sten, 2026-08-08.
//
// Legacy inventory-refill instrument retained for migration coverage. The
// active fixed-capacity charge contract lives in tools/flask-reallocation.mjs.
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
//   (src/main.js:69) against the bundle from `src/content/index.js`. Every data
//   plant below mutates a deep copy of THAT bundle — the real one, with all 7
//   flasks and the real balance in it — and is handed to THAT function. No
//   synthetic `{ balance: { graceRefill: … } }` object is constructed anywhere
//   in this file: a hand-built bundle would prove the refusal reads its own
//   argument and nothing about whether the shipped bundle ever reaches it.
//
//   DOOR 2 — THE SHRINE. The refill is applied by `applyGraceRefill`
//   (src/engine/encounters.js), called from `showRest()` in src/main.js on
//   arrival at a shrine node, against registries built by `createRegistries`.
//   Every behaviour plant below goes through `createRegistries(bundle)` and
//   `createRunState`, so a plant that breaks the registry build fails here the
//   way it would fail in the game, not in a fixture.
//
// WHAT AN AUTHOR WRITES: nothing. The refusal corpus is a list of mutations,
// each naming the key it expects; adding a refusal to model/gracerefill.js
// without adding a plant here leaves the count visibly short — the selftest
// prints refusals-covered / refusals-declared and goes red when they differ.
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
  reallocateFlaskCharges,
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

// Each plant: mutate the REAL bundle copy, hand it to the REAL validator, and
// require an error whose key matches. `expect` is a substring of the key, so a
// renamed index does not silently pass — the key path is asserted, not the
// prose, and the prose is printed so a human reads what a maintainer would.
const PLANTS = [
  { name: 'kind nothing carries',
    expect: 'balance.graceRefill[0].kind',
    mutate: (b) => { b.balance.graceRefill[0].kind = 'stamina'; } },
  { name: 'kind misspelt (the typo case)',
    expect: 'balance.graceRefill[0].kind',
    mutate: (b) => { b.balance.graceRefill[0].kind = 'HP'; } },
  { name: 'two rows for one kind',
    expect: 'balance.graceRefill[2].kind',
    mutate: (b) => { b.balance.graceRefill.push({ kind: 'hp', count: 1 }); } },
  { name: 'count is not a number',
    expect: 'balance.graceRefill[0].count',
    mutate: (b) => { b.balance.graceRefill[0].count = 'three'; } },
  { name: 'count is negative',
    expect: 'balance.graceRefill[0].count',
    mutate: (b) => { b.balance.graceRefill[0].count = -1; } },
  { name: 'count is fractional',
    expect: 'balance.graceRefill[0].count',
    mutate: (b) => { b.balance.graceRefill[0].count = 2.5; } },
  { name: 'one row above the carry cap',
    expect: 'balance.graceRefill[0].count',
    mutate: (b) => { b.balance.graceRefill[0].count = b.balance.flaskSlots + 1; } },
  { name: 'row is not an object',
    expect: 'balance.graceRefill[1]',
    mutate: (b) => { b.balance.graceRefill[1] = 'mana'; } },
  { name: 'table is not an array',
    expect: 'balance.graceRefill',
    mutate: (b) => { b.balance.graceRefill = { hp: 3 }; } },
  { name: 'flaskId override is not a flask',
    expect: 'balance.graceRefill[0].flaskId',
    mutate: (b) => { b.balance.graceRefill[0].flaskId = 'crimsonFlaskk'; } },
  { name: 'flaskId override is of the wrong kind',
    expect: 'balance.graceRefill[0].flaskId',
    mutate: (b) => { b.balance.graceRefill[0].flaskId = 'flaskOfStone'; } },
  // A legacy aggregate table above its inventory cap must fail
  // loudly rather than letting row order starve the Azure refill.
  { name: 'the aggregate: lowering the cap below the legacy table refuses',
    expect: 'balance.graceRefill',
    mutate: (b) => { b.balance.flaskSlots = 5; } },
  // A kind declared in FLASK_KINDS with no member is LEGAL and must NOT refuse.
  // Planted as a negative so the corpus proves the refusal is discriminating
  // rather than merely loud — the shipped tree is already in this state.
  { name: 'NEGATIVE — an inert declared kind is legal', expectClean: true,
    mutate: (b) => { b.balance.graceRefill.push({ kind: 'utility', count: 0 }); } },
];

// Behaviour plants: door 2. Each drives applyGraceRefill through registries
// built from a mutated real bundle and asserts what the run ends up holding.
const BEHAVIOUR = [
  {
    name: 'a fresh run at a grace is topped up to the hp count',
    run: (reg) => {
      const run = emptyRun(reg);
      const plan = applyGraceRefill(reg, run);
      const hp = run.flasks.filter((f) => flaskKindOf(reg.flasks.get(f.flaskId)) === 'hp').length;
      const mana = run.flasks.filter((f) => flaskKindOf(reg.flasks.get(f.flaskId)) === 'mana').length;
      return { ok: hp === 3 && mana === 3 && plan.total === 6, saw: `${hp} hp, ${mana} mana, plan.total ${plan.total}` };
    },
  },
  {
    name: 'it is a TOP-UP, not a grant: arriving with 2 gets you 1',
    run: (reg) => {
      const run = emptyRun(reg);
      run.flasks.push({ flaskId: 'crimsonFlask' }, { flaskId: 'crimsonFlask' });
      const plan = applyGraceRefill(reg, run);
      return { ok: plan.total === 4 && run.flasks.length === 6, saw: `granted ${plan.total}, holding ${run.flasks.length}` };
    },
  },
  {
    name: 'idempotent: a second grace at the same stop grants nothing',
    run: (reg) => {
      const run = emptyRun(reg);
      applyGraceRefill(reg, run);
      const again = applyGraceRefill(reg, run);
      return { ok: again.total === 0 && run.flasks.length === 6, saw: `second pour ${again.total}, holding ${run.flasks.length}` };
    },
  },
  {
    name: 'slots full of other flasks: grants 0 and SAYS SO (no silent clamp)',
    run: (reg) => {
      const run = emptyRun(reg);
      for (let i = 0; i < 6; i++) run.flasks.push({ flaskId: 'flaskOfStone' });
      const plan = applyGraceRefill(reg, run);
      const said = plan.shortfalls.some((s) => s.kind === 'hp' && s.short === 3);
      return { ok: plan.total === 0 && said, saw: `granted ${plan.total}, shortfalls ${JSON.stringify(plan.shortfalls.map((s) => `${s.kind}:${s.short}`))}` };
    },
  },
  {
    name: 'the real Azure Flask binds the Mana row',
    run: (reg) => {
      const plan = graceRefillPlan(reg, emptyRun(reg));
      const mana = plan.rows.find((r) => r.kind === 'mana');
      return { ok: !!mana && mana.binding === true && mana.flaskId === 'azureFlask' && mana.granted === 3, saw: mana ? `${mana.flaskId} × ${mana.granted}` : 'no mana row' };
    },
  },
  {
    name: 'the debug count reaches the shrine: counts { hp: 0 } grants nothing',
    run: (reg) => {
      const run = emptyRun(reg);
      const plan = applyGraceRefill(reg, run, { counts: { hp: 0, mana: 0 } });
      return { ok: plan.total === 0 && run.flasks.length === 0, saw: `granted ${plan.total}` };
    },
  },
  {
    // HIS FOURTH CLAUSE, and the plant enters at `createRunState` — the door
    // every run comes through, in the game, in co-op and in every sim.
    name: 'legacy run start: ON by data, so every fresh class holds its authored table',
    run: (reg) => {
      const rows = reg.classes.ids().map((classId) => {
        const run = freshRun(reg, classId);
        const hp = run.flasks.filter((f) => flaskKindOf(reg.flasks.get(f.flaskId)) === 'hp').length;
        const mana = run.flasks.filter((f) => flaskKindOf(reg.flasks.get(f.flaskId)) === 'mana').length;
        return { classId, hp, mana, total: run.flasks.length };
      });
      return { ok: rows.every((r) => r.total === 6 && r.hp === 3 && r.mana === 3), saw: rows.map((r) => `${r.classId}:${r.hp}+${r.mana}`).join(', ') };
    },
  },
  {
    name: 'run start: the data switch turns the allocation off without code',
    bundle: (b) => { b.balance.graceRefillAtRunStart = false; },
    run: (reg) => {
      const run = freshRun(reg);
      return { ok: run.flasks.length === 0, saw: `${run.flasks.length} flask(s)` };
    },
  },
  {
    // THE DEBUG ROW'S DEFAULT MUST BE A POSITION ON ITS OWN LADDER, or the chip
    // strip opens on a value it cannot show and the setting reads as unset.
    // Asked here rather than in settings.js because the ladder lives in the
    // model and this needs no DOM; the refusal above (count > cap) is what
    // makes it true, and this is the assertion that says so out loud.
    name: 'every table row\'s count is a position on the debug ladder it generates',
    run: (reg) => {
      const ladder = graceRefillLadder(reg.balance);
      const bad = graceRefillTable(reg.balance).filter((r) => !ladder.includes(String(r.count)));
      return { ok: bad.length === 0, saw: bad.length ? `off-ladder: ${bad.map((r) => `${r.kind}=${r.count}`).join(', ')}` : `ladder ${ladder.join('/')} covers every row` };
    },
  },
  {
    // LAW 0's FALSIFIER FOR THIS FEATURE: a fictional entry of a brand-new
    // kind, one content row, ZERO code commits — it appears and works. The row
    // enters `src/content/flasks.js`'s array through the real bundle and the
    // real registry build, and the refill picks it up with nothing else edited.
    name: 'LAW 0: an explicit Mana flask override can replace Azure with no engine edit',
    bundle: (b) => {
      b.flasks.push({
        id: 'ceruleanFlask', name: 'Cerulean Flask', rarity: 'common', kind: 'mana', icon: '🔵',
        effects: [{ op: 'restoreMana', amount: 5 }], textTemplate: 'Restore 5 Mana.',
      });
      b.balance.graceRefill[1].flaskId = 'ceruleanFlask';
      b.balance.graceRefillAtRunStart = false;
    },
    run: (reg) => {
      const run = emptyRun(reg);
      const plan = applyGraceRefill(reg, run);
      const mana = plan.rows.find((r) => r.kind === 'mana');
      const held = run.flasks.filter((f) => f.flaskId === 'ceruleanFlask').length;
      return { ok: !!mana && mana.binding === true && held === 3 && plan.total === 6, saw: `mana binding ${mana && mana.binding}, holding ${held}, total ${plan.total}` };
    },
  },
];

function selftest() {
  if (Number.isInteger(contentBundle.balance.flaskCapacity)) {
    console.log('gracerefill --selftest: fixed-capacity charge model.\n');
    let fails = 0;
    // Counted, never typed (the cf3fe6d defect class): these move with the
    // checks below, so a check added without them leaves the RESULT visibly off.
    let contentPlants = 0;
    let behaviourChecks = 0;
    const refuse = (name, mutate, pattern) => {
      contentPlants++;
      const b = realBundleCopy(); mutate(b);
      const said = validateContent(b).errors.map((e) => `${e.path}: ${e.msg}`).join(' | ');
      const ok = pattern.test(said); if (!ok) fails++;
      console.log(`  ${ok ? 'RED  ' : 'MISS '} ${name}${ok ? '' : ` — ${said || 'no refusal'}`}`);
    };
    refuse('capacity zero', (b) => { b.balance.flaskCapacity = 0; }, /flaskCapacity/);
    refuse('class allocation above capacity', (b) => { b.classes[0].startingFlaskAllocation = { hp: 3, mana: 1 }; }, /startingFlaskAllocation/);
    refuse('fractional class allocation', (b) => { b.classes[0].startingFlaskAllocation = { hp: 1.5, mana: 1.5 }; }, /startingFlaskAllocation/);
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    behaviourChecks++;
    run.flaskCharges.hpCurrent = 0; run.flaskCharges.manaCurrent = 0;
    applyGraceRefill(reg, run);
    const refilled = run.flaskCharges.hpCurrent === run.flaskCharges.hp && run.flaskCharges.manaCurrent === run.flaskCharges.mana;
    if (!refilled) fails++;
    console.log(`  ${refilled ? 'green' : 'MISS '} Grace refills current charges to allocation`);
    behaviourChecks++;
    reallocateFlaskCharges(run.flaskCharges, { hp: 1, mana: run.flaskCharges.capacity - 1 });
    const invariant = run.flaskCharges.hp + run.flaskCharges.mana === run.flaskCharges.capacity;
    if (!invariant) fails++;
    console.log(`  ${invariant ? 'green' : 'MISS '} reallocation preserves hp + mana = capacity`);

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

    console.log(`\nRESULT: ${fails === 0 ? 'all plants behaved' : `${fails} MISS`} — ${contentPlants} content plants, ${behaviourChecks} behaviour checks (counted at run time, never typed).`);
    return fails;
  }
  console.log('gracerefill --selftest: every refusal planted through the door the real input uses.\n');
  let fails = 0;

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
    const mine = res.errors.filter((e) => String(e.path).startsWith('balance.graceRefill'));
    if (p.expectClean) {
      const ok = mine.length === 0;
      if (!ok) fails++;
      console.log(`    ${ok ? 'green' : 'MISS '}  ${p.name}${ok ? '' : ` — refused when it should not: ${mine[0].path}`}`);
      continue;
    }
    const hit = mine.find((e) => String(e.path) === p.expect);
    if (!hit) {
      fails++;
      console.log(`    MISS   ${p.name} — expected a refusal at ${p.expect}, got ${mine.length ? mine.map((e) => e.path).join(', ') : 'NOTHING'}`);
    } else {
      console.log(`    RED    ${p.name}`);
      console.log(`             ${hit.path}: ${hit.msg}`);
    }
  }

  console.log('\n  DOOR 2 — the shrine, through createRegistries + applyGraceRefill:');
  for (const t of BEHAVIOUR) {
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

  // The count that goes red when a refusal is added without a plant. It reads
  // the refusal keys the module can emit by planting, so it cannot drift into
  // agreeing with itself.
  const covered = new Set(PLANTS.filter((p) => !p.expectClean).map((p) => p.expect.replace(/\[\d+\]/g, '[i]')));
  console.log(`\n  refusal paths covered: ${covered.size} distinct (${[...covered].join(', ')})`);

  console.log('\nBOUNDARY — what a green from --selftest does NOT mean:');
  console.log('  · it proves the refusals FIRE and the shrine POURS. It says nothing about');
  console.log('    whether a legacy refill table is right release balance — that needs a Mana-aware');
  console.log('    simulation and player review, not the stale no-Mana A/B.');
  console.log('  · no browser ran. The settings rows and shrine sentence');
  console.log('    are rendered HTML and are photographed, not asserted, here.');
  console.log('  · the co-op path (tools/session.mjs enterShrine) is covered by');
  console.log('    `node tools/session-smoke.mjs`, not by this file.');

  console.log(`\nRESULT: ${fails === 0 ? 'all plants behaved' : `${fails} MISS`} — ${PLANTS.length} content plants, ${BEHAVIOUR.length} behaviour plants.`);
  return fails;
}

if (SELFTEST) {
  process.exit(selftest() === 0 ? 0 : 1);
} else {
  report();
}
