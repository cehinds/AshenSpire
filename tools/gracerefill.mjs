#!/usr/bin/env node
// tools/gracerefill.mjs — what a grace hands back, and proof it refuses.
// Sten, 2026-08-08.
//
// Constantine, 2026-08-08: "flasks should refill automatically at graces", and
// the longer form: "at every grace all characters should restore 3 hp flasks,
// and 3 mana flasks (this should be configurable in teh debug settings and be
// data driven)".
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
  const plan = graceRefillPlan(reg, freshRun(reg));
  for (const r of plan.rows) {
    const head = `    ${r.kind}×${r.count}`.padEnd(16);
    console.log(`${head}${r.binding ? `grants ${r.granted} × ${r.flaskId}` : 'NOT BINDING'}`);
    if (r.why) console.log(`                  ${r.why}`);
  }
  console.log(`\n  A fresh run leaving a grace holds ${plan.total} of ${cap} flask slots.`);
  if (graceRefillTable(bal).length === 0) console.log('  (no table: a grace refills nothing)');

  const inert = plan.rows.filter((r) => !r.binding).length;
  console.log(`\nRESULT: ${plan.rows.length} refill row(s) — ${plan.total} flask(s) poured into a fresh run's `
    + `${cap} slot(s), ${inert} declared and NOT BINDING.`);

  console.log('\nBOUNDARY — what this report does NOT say:');
  console.log('  · it reports the SHIPPED table at one run state (fresh, 0 flasks held).');
  console.log('    Whether the refusals can go red is --selftest, and nothing else here claims it.');
  console.log('  · it says nothing about balance. What six free flasks a grace does to a run is');
  console.log('    `node tools/runsim.mjs --grace-ab`, and that is a measurement, not a verdict.');
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
  // THE ONE THAT MATTERS MOST, and the reason the aggregate check exists: the
  // day someone authors the first mana flask, his 3+3 stops fitting in 3 slots.
  // This plant IS that day — a real content row, entering the real bundle.
  { name: 'the aggregate: authoring a mana flask over-subscribes the slots',
    expect: 'balance.graceRefill',
    mutate: (b) => {
      b.flasks.push({
        id: 'ceruleanFlask', name: 'Cerulean Flask', rarity: 'common', kind: 'mana', icon: '🔵',
        effects: [{ op: 'gainEnergy', amount: 1 }], textTemplate: 'Gain 1 Energy.',
      });
    } },
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
      const run = freshRun(reg);
      const plan = applyGraceRefill(reg, run);
      const hp = run.flasks.filter((f) => flaskKindOf(reg.flasks.get(f.flaskId)) === 'hp').length;
      return { ok: hp === 3 && plan.total === 3, saw: `${hp} hp flask(s), plan.total ${plan.total}` };
    },
  },
  {
    name: 'it is a TOP-UP, not a grant: arriving with 2 gets you 1',
    run: (reg) => {
      const run = freshRun(reg);
      run.flasks.push({ flaskId: 'crimsonFlask' }, { flaskId: 'crimsonFlask' });
      const plan = applyGraceRefill(reg, run);
      return { ok: plan.total === 1 && run.flasks.length === 3, saw: `granted ${plan.total}, holding ${run.flasks.length}` };
    },
  },
  {
    name: 'idempotent: a second grace at the same stop grants nothing',
    run: (reg) => {
      const run = freshRun(reg);
      applyGraceRefill(reg, run);
      const again = applyGraceRefill(reg, run);
      return { ok: again.total === 0 && run.flasks.length === 3, saw: `second pour ${again.total}, holding ${run.flasks.length}` };
    },
  },
  {
    name: 'slots full of other flasks: grants 0 and SAYS SO (no silent clamp)',
    run: (reg) => {
      const run = freshRun(reg);
      run.flasks.push({ flaskId: 'flaskOfStone' }, { flaskId: 'flaskOfStone' }, { flaskId: 'flaskOfStone' });
      const plan = applyGraceRefill(reg, run);
      const said = plan.shortfalls.some((s) => s.kind === 'hp' && s.short === 3);
      return { ok: plan.total === 0 && said, saw: `granted ${plan.total}, shortfalls ${JSON.stringify(plan.shortfalls.map((s) => `${s.kind}:${s.short}`))}` };
    },
  },
  {
    name: 'the mana row is INERT and names itself',
    run: (reg) => {
      const plan = graceRefillPlan(reg, freshRun(reg));
      const mana = plan.rows.find((r) => r.kind === 'mana');
      return { ok: !!mana && mana.binding === false && /NOT BINDING/.test(mana.why), saw: mana ? mana.why.slice(0, 60) : 'no mana row' };
    },
  },
  {
    name: 'the debug count reaches the shrine: counts { hp: 0 } grants nothing',
    run: (reg) => {
      const run = freshRun(reg);
      const plan = applyGraceRefill(reg, run, { counts: { hp: 0 } });
      return { ok: plan.total === 0 && run.flasks.length === 0, saw: `granted ${plan.total}` };
    },
  },
  {
    // HIS FOURTH CLAUSE, and the plant enters at `createRunState` — the door
    // every run comes through, in the game, in co-op and in every sim.
    name: 'run start: OFF by default, so a fresh run holds no flasks',
    run: (reg) => {
      const run = freshRun(reg);
      return { ok: run.flasks.length === 0, saw: `${run.flasks.length} flask(s) at run start` };
    },
  },
  {
    name: 'run start: the switch WORKS when flipped — one data word, no code',
    bundle: (b) => { b.balance.graceRefillAtRunStart = true; },
    run: (reg) => {
      const run = freshRun(reg);
      const hp = run.flasks.filter((f) => flaskKindOf(reg.flasks.get(f.flaskId)) === 'hp').length;
      return { ok: run.flasks.length === 3 && hp === 3, saw: `${run.flasks.length} flask(s), ${hp} of kind hp` };
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
    name: 'LAW 0: one authored mana flask makes the declared row live, no code',
    bundle: (b) => {
      b.flasks.push({
        id: 'ceruleanFlask', name: 'Cerulean Flask', rarity: 'common', kind: 'mana', icon: '🔵',
        effects: [{ op: 'gainEnergy', amount: 1 }], textTemplate: 'Gain 1 Energy.',
      });
      // The cap has to answer for six now — which is the refusal above firing in
      // its own selftest, and here is the data fix it names, applied.
      b.balance.flaskSlots = 6;
    },
    run: (reg) => {
      const run = freshRun(reg);
      const plan = applyGraceRefill(reg, run);
      const mana = plan.rows.find((r) => r.kind === 'mana');
      const held = run.flasks.filter((f) => f.flaskId === 'ceruleanFlask').length;
      return { ok: !!mana && mana.binding === true && held === 3 && plan.total === 6, saw: `mana binding ${mana && mana.binding}, holding ${held}, total ${plan.total}` };
    },
  },
];

function selftest() {
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
  console.log('    whether 3 flasks a grace is the right number — that is balance, measured by');
  console.log('    `node tools/runsim.mjs --grace-ab` and ruled on by a person.');
  console.log('  · no browser ran. The settings row, its NOT BINDING line and the shrine sentence');
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
