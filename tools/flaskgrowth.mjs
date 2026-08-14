#!/usr/bin/env node
// tools/flaskgrowth.mjs — the growth chain's corpus, and proof it refuses.
// Sten, 2026-08-13.
//
// Subject: balance.flaskGrowth (model/flaskgrowth.js) — D17 message 6's chain:
// relics · quest events · talismans · flask seeds → max charges. The capacity
// topology is DECIDED — POOL, his word (D19, 2026-08-13: "3 total (with
// future unlocks for larger total amount)"; C1 — CLOSED) — and bound in
// exactly one function, syncFlaskGrowth. The overflow rule that pool forces
// (reallocate a grown charge away, then lose the source) is load-bearing and
// gated below, both edges, observed red first per the instrument rule.
//
// THE DOORS (development.md, *The instrument rule*, same-door clause). A
// known-bad handed below the defect exercises the half that was never in
// doubt, so every plant here states its door:
//
//   DOOR 1 — CONTENT. The game boots `validateContent(contentBundle)` against
//   the bundle from src/content/index.js. Every refusal plant mutates a deep
//   copy of THAT bundle and hands it to THAT function. No synthetic bundle is
//   built anywhere in this file.
//
//   DOOR 2 — THE RUN. Growth binds through `createRunState` (birth and the
//   starting relic), `initializeRunFlaskCharges` (load), and the relic-gain
//   sites, of which `executeRunEffects` op `addRelic` is the engine one.
//   Behaviour plants enter there, through `createRegistries(bundle)`.
//
//   DOOR 3 — THE SAVE. Every save enters play through serializeRun →
//   deserializeRun → createSaveManager.loadRun (engine/save.js), and since
//   run schema v3 that door enforces the CAPACITY LEDGER: capacity ===
//   base + grown.hp + grown.mana + granted (validateRunShape). The ledger
//   plants below build their runs through the real op doors (a shipped
//   keepsake's own effects, the addRelic opcode) and push them through the
//   real save manager on a storage shim.
//
//   THE HONEST CEILING, named: relic LOSS has no real door (no opcode removes
//   a relic), and talisman swap's real door is the equipment screen, which is
//   a browser surface this headless file cannot walk. Those two plants mutate
//   run state directly below their screens and SAY SO in their own names; the
//   wiring from screen to sync is held instead by the source contracts at the
//   bottom, flask-data-authority's pattern.
//
// Usage:
//   node tools/flaskgrowth.mjs              # what the shipped chain contains
//   node tools/flaskgrowth.mjs --selftest   # plants; exits 1 on any miss

import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, initializeRunFlaskCharges, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { createSaveManager } from '../src/engine/save.js';
import { KEEPSAKES } from '../src/content/keepsakes.js';
import { reallocateFlaskCharges } from '../src/model/gracerefill.js';
import { flaskGrowthTable, flaskGrowthPlan, flaskGrowthClause, syncFlaskGrowth } from '../src/model/flaskgrowth.js';
import { FLASK_GROWTH_SOURCES } from '../src/model/schemas.js';
// The REAL tooltip renderer — imports headless (no DOM at module top), so the
// clause is proven on the same function the reward, shop, map and combat
// tooltips call, not on a helper beside it.
import { relicText } from '../src/ui/components/card.js';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');

function realBundleCopy() {
  const { scripts, ...rest } = contentBundle;
  const copy = structuredClone(rest);
  copy.scripts = scripts;
  return copy;
}

function freshRun(registries, classId = 'reaver') {
  return createRunState({ seed: 1, classId, registries });
}

// The save manager's storage, in memory — the same shim shape the suite's
// save tests use, so door 3 walks the REAL save manager, not a stand-in.
function memStorage() {
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    key: (i) => [...mem.keys()][i] || null,
    get length() { return mem.size; },
  };
}

// The shipped moment door: the first keepsake whose authored effects carry the
// addFlaskCapacity op — DERIVED from content, never named by id, so a keepsake
// rename retunes this helper for free. Returns null if none ships.
function shippedMomentGrant() {
  return KEEPSAKES.find((k) => (k.effects || []).some((e) => e && e.op === 'addFlaskCapacity')) || null;
}

// A fictional relic + a growth row for it, entered as DATA into a real-bundle
// copy — the Law 0 falsifier's raw material. Zero code is edited to make it
// exist; that is the point.
function plantGrowthRelic(b, { kind = 'mana', amount = 1 } = {}) {
  b.relics.push({ id: 'fixtureCharm', name: 'Fixture Charm', icon: '◈', rarity: 'common', textTemplate: 'The vessel remembers being larger.', triggers: [] });
  b.balance.flaskGrowth = [{ source: 'relic', id: 'fixtureCharm', kind, amount }];
}

function report() {
  const reg = createRegistries(contentBundle);
  const rows = flaskGrowthTable(reg.balance);
  console.log(`flaskgrowth: ${rows.length} authored row${rows.length === 1 ? '' : 's'} in balance.flaskGrowth.`);
  if (rows.length === 0) {
    console.log('  none ship — if this is unexpected, someone deleted the live rows: C1 closed POOL (D19) and the first rows shipped with it.');
    console.log(`  the closed source set is declared: ${FLASK_GROWTH_SOURCES.join(', ')} (D17 message 6, his four words).`);
  }
  const run = freshRun(reg);
  const plan = flaskGrowthPlan(reg, run);
  for (const r of plan.rows) {
    console.log(`  ${r.source} '${r.id}' → ${r.kind} +${r.amount} — ${r.binding ? 'BINDING' : `not binding: ${r.why}`}`);
  }
  console.log(`  a fresh reaver run: capacity ${run.flaskCharges.capacity}, hp ${run.flaskCharges.hp}, mana ${run.flaskCharges.mana}, grown { hp: ${run.flaskCharges.grown.hp}, mana: ${run.flaskCharges.grown.mana} }.`);
  console.log('\nBoundary: this reports the shipped table and a fresh run. It asserts nothing');
  console.log('about screens; the shipped rows are PROVISIONAL and unweighed — whether +1 on');
  console.log('a common relic is right is the M3 balance pass\'s question, not this tool\'s.');
}

function selftest() {
  let fails = 0;
  // Counted, never typed: a RESULT line carrying a hand-written plant count
  // is a frozen baseline — it reads correct forever while plants come and go
  // (the cf3fe6d defect class). These three only ever increment in the
  // helpers below.
  const counts = { refusal: 0, behaviour: 0, contract: 0 };

  // ── DOOR 1: refusal plants — each enters validateContent on a real-bundle
  //    copy and must come back RED with the entry named. ──────────────────────
  console.log('DOOR 1 — validateContent(realBundleCopy) [src/main.js boot door]:');
  const refuse = (name, mutate, pattern) => {
    counts.refusal++;
    const b = realBundleCopy();
    mutate(b);
    const said = validateContent(b).errors.map((e) => `${e.path}: ${e.msg}`).join(' | ');
    const ok = pattern.test(said);
    if (!ok) fails++;
    console.log(`  ${ok ? 'RED  ' : 'MISS '} ${name}${ok ? '' : ` — ${said || 'no refusal'}`}`);
  };

  refuse('table is not an array', (b) => { b.balance.flaskGrowth = { relic: 1 }; }, /flaskGrowth.*must be an array/);
  refuse('row is not an object', (b) => { b.balance.flaskGrowth = ['grow please']; }, /flaskGrowth\[0\]/);
  refuse('unknown source word', (b) => { b.balance.flaskGrowth = [{ source: 'blessing', id: 'x', kind: 'hp', amount: 1 }]; }, /not a growth source/);
  refuse('kind utility has no maximum to grow', (b) => { b.balance.flaskGrowth = [{ source: 'relic', id: 'emberHeart', kind: 'utility', amount: 1 }]; }, /not a charge kind/);
  refuse('negative amount', (b) => { plantGrowthRelic(b, { amount: -1 }); }, /not positive/);
  refuse('zero amount', (b) => { plantGrowthRelic(b, { amount: 0 }); }, /not positive/);
  refuse('fractional amount', (b) => { plantGrowthRelic(b, { amount: 1.5 }); }, /fractional/);
  refuse('duplicate grant (same source, id, kind)', (b) => {
    plantGrowthRelic(b);
    b.balance.flaskGrowth.push({ source: 'relic', id: 'fixtureCharm', kind: 'mana', amount: 2 });
  }, /duplicate of balance\.flaskGrowth\[0\]/);
  refuse('dangling relic id', (b) => { b.balance.flaskGrowth = [{ source: 'relic', id: 'noSuchRelic', kind: 'hp', amount: 1 }]; }, /not a relic id/);
  refuse('dangling event id', (b) => { b.balance.flaskGrowth = [{ source: 'questEvent', id: 'noSuchEvent', kind: 'hp', amount: 1 }]; }, /not an event id/);
  refuse('two doors for one grant (event already has addFlaskCapacity)', (b) => {
    const ev = b.events.find((e) => e.id === 'goldboughAvatar');
    ev.choices[0].effects.push({ op: 'addFlaskCapacity', kind: 'hp', amount: 1 });
    b.balance.flaskGrowth = [{ source: 'questEvent', id: 'goldboughAvatar', kind: 'hp', amount: 1 }];
  }, /two doors for one grant/);
  refuse('talisman row naming a weapon (slot cannot hold it)', (b) => {
    const weapon = b.equipment.armaments.find((a) => a.kind === 'weapon');
    b.balance.flaskGrowth = [{ source: 'talisman', id: weapon.id, kind: 'hp', amount: 1 }];
  }, /talisman slot can hold/);
  refuse('flaskSeed row while no seed vocabulary exists', (b) => { b.balance.flaskGrowth = [{ source: 'flaskSeed', id: 'oldSeed', kind: 'hp', amount: 1 }]; }, /flask-seed item vocabulary/);
  refuse('malformed flaskGrowthMax', (b) => { b.balance.flaskGrowthMax = '9'; }, /flaskGrowthMax.*positive integer/);
  refuse('growth past the authored hard cap', (b) => {
    plantGrowthRelic(b, { amount: 3 });
    b.balance.flaskGrowthMax = 5; // base 3 + 3 > 5
  }, /flaskGrowthMax 5/);

  // ── DOOR 2: behaviour plants through the real registry and run doors. ─────
  console.log('DOOR 2 — createRegistries → createRunState / executeRunEffects:');
  const behave = (name, fn) => {
    counts.behaviour++;
    let saw = '';
    let ok = false;
    try { ({ ok, saw } = fn()); } catch (e) { saw = e.message; }
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS ' : 'FAIL '} ${name}${ok ? '' : ` — saw: ${saw}`}`);
  };

  behave('LAW 0 falsifier: fictional relic + one row, zero code — gained via the addRelic opcode, the mana maximum grows', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b, { kind: 'mana', amount: 1 });
    const v = validateContent(b);
    if (v.errors.length) return { ok: false, saw: v.errors.map((e) => e.path).join(',') };
    const reg = createRegistries(b);
    const run = freshRun(reg); // reaver starts hp2/mana1 in capacity 3
    const before = `${run.flaskCharges.capacity}/${run.flaskCharges.mana}`;
    executeRunEffects({ run, registries: reg, rng: null }, [{ op: 'addRelic', id: 'fixtureCharm' }]);
    const f = run.flaskCharges;
    return {
      ok: before === '3/1' && f.capacity === 4 && f.mana === 2 && f.manaCurrent === 2 && f.grown.mana === 1,
      saw: `before ${before}, after capacity ${f.capacity} mana ${f.mana}/${f.manaCurrent} grown ${JSON.stringify(f.grown)}`,
    };
  });

  behave('empty edge: zero rows — sync is a byte-level no-op beyond grown {0,0}', () => {
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    const before = JSON.stringify(run.flaskCharges);
    syncFlaskGrowth(reg, run);
    return { ok: JSON.stringify(run.flaskCharges) === before, saw: JSON.stringify(run.flaskCharges) };
  });

  behave('idempotent: sync twice is sync once', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b);
    const reg = createRegistries(b);
    const run = freshRun(reg);
    run.relics.push('fixtureCharm');
    syncFlaskGrowth(reg, run);
    const once = JSON.stringify(run.flaskCharges);
    syncFlaskGrowth(reg, run);
    return { ok: JSON.stringify(run.flaskCharges) === once, saw: JSON.stringify(run.flaskCharges) };
  });

  behave('a starting relic with a row grows the run at birth (createRunState)', () => {
    const b = realBundleCopy();
    const startingRelic = b.classes[0].startingRelic;
    b.balance.flaskGrowth = [{ source: 'relic', id: startingRelic, kind: 'hp', amount: 2 }];
    const reg = createRegistries(b);
    const run = freshRun(reg, b.classes[0].id);
    const f = run.flaskCharges;
    return { ok: f.capacity === 5 && f.grown.hp === 2 && f.hpCurrent === f.hp, saw: JSON.stringify(f) };
  });

  // ── THE OVERFLOW GATE — load-bearing since D19 closed C1 as POOL. ─────────
  // The rule: removal takes from the row's kind FIRST and overflows only the
  // remainder to the other kind, currents bounded. Two edges, because two
  // different halves of the arithmetic can rot independently:
  //   EDGE A (empty/no-overflow) is the only edge that can see the ORDER —
  //          a take that drains the other kind first passes edge B unchanged,
  //          because there the row's kind is already empty.
  //   EDGE B (max/full-overflow) is the only edge that can see the OVERFLOW —
  //          a take that stops at the row's kind passes edge A unchanged,
  //          because there the row's kind covers the whole take.
  // OBSERVED RED FIRST (the instrument rule), 2026-08-14, before trusting:
  //   sabotage 1 — deleted `f[other] -= take - fromKind` at the seam →
  //     edge B FAIL (saw capacity 3, hp 0, mana 4 — a phantom charge survives
  //     its source), edge A still green: B is the overflow's only witness.
  //   sabotage 2 — inverted kind-first (take from the other kind first) →
  //     edge A FAIL (saw hp 3, mana 0 — the wrong vessel paid), edge B still
  //     green: A is the order's only witness. Both reds entered through the
  //     same doors the green run uses; seam restored, both edges green.
  // DOORS, stated: reallocation is the REAL model door — the same
  // reallocateFlaskCharges call ui/screens/rest.js:114 makes at a grace.
  // Removal still enters BELOW a door, and says so: no opcode removes a
  // relic; the day one exists, these plants move up to it.

  behave('OVERFLOW GATE edge A (no overflow): lose the source with the grown charge still on its kind — the row\'s kind pays, the other kind is untouched', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b, { kind: 'hp', amount: 1 });
    const reg = createRegistries(b);
    const run = freshRun(reg);
    run.relics.push('fixtureCharm');
    syncFlaskGrowth(reg, run); // capacity 4, hp 3, mana 1
    run.relics = run.relics.filter((id) => id !== 'fixtureCharm');
    syncFlaskGrowth(reg, run);
    const f = run.flaskCharges;
    const sound = f.capacity === 3 && f.hp === 2 && f.mana === 1
      && f.hpCurrent <= f.hp && f.manaCurrent <= f.mana && f.grown.hp === 0;
    return { ok: sound, saw: JSON.stringify(f) };
  });

  behave('OVERFLOW GATE edge B (full overflow): reallocate the grown charge away, then lose the source — the remainder overflows to the other kind, currents bounded', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b, { kind: 'hp', amount: 1 });
    const reg = createRegistries(b);
    const run = freshRun(reg);
    run.relics.push('fixtureCharm');
    syncFlaskGrowth(reg, run); // capacity 4, hp 3, mana 1
    reallocateFlaskCharges(run.flaskCharges, { hp: 0, mana: 4 });
    run.relics = run.relics.filter((id) => id !== 'fixtureCharm');
    syncFlaskGrowth(reg, run);
    const f = run.flaskCharges;
    const sound = f.capacity === 3 && f.hp + f.mana === 3 && f.hp === 0 && f.mana === 3
      && f.hpCurrent <= f.hp && f.manaCurrent <= f.mana && f.grown.hp === 0;
    return { ok: sound, saw: JSON.stringify(f) };
  });

  behave('a loaded save re-derives the chain (initializeRunFlaskCharges door)', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b, { kind: 'mana', amount: 1 });
    const reg = createRegistries(b);
    const run = freshRun(reg);
    run.relics.push('fixtureCharm');
    // Simulate a pre-chain save of this run: no grown, ungrown numbers.
    delete run.flaskCharges.grown;
    initializeRunFlaskCharges(run, reg);
    const f = run.flaskCharges;
    return { ok: f.capacity === 4 && f.grown.mana === 1, saw: JSON.stringify(f) };
  });

  behave('the grown field survives the save shape (validateRunShape accepts, and refuses a corrupt one)', () => {
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    const clean = validateRunShape(run).length === 0;
    run.flaskCharges.grown = { hp: -1, mana: 0 };
    const dirty = validateRunShape(run).some((p) => p.includes('grown'));
    return { ok: clean && dirty, saw: `clean ${clean}, dirty-refused ${dirty}` };
  });

  // ── THE LIVE ROWS — D19's parenthesis made real. These two plants read the
  //    SHIPPED table and derive every expectation from it (no row is copied
  //    here, so a retune retunes the plants). OBSERVED RED FIRST, 2026-08-14:
  //    both written and run against the zero-row tree before the first live
  //    row existed — falsifier FAIL 'zero shipped relic rows', clause FAIL
  //    likewise — then green the moment the row shipped, with no tool edit. ──
  behave('LAW 0 falsifier, LIVE (D19): every SHIPPED relic row grows the maximum through the addRelic door — and at least one live row ships', () => {
    const reg = createRegistries(contentBundle);
    const shipped = flaskGrowthTable(reg.balance).filter((r) => r && r.source === 'relic');
    if (shipped.length === 0) {
      return { ok: false, saw: 'zero shipped relic rows — D19\'s first live rung is gone; if that was deliberate (Tier 0), retire this plant out loud in the same act' };
    }
    for (const row of shipped) {
      const run = freshRun(reg);
      if (run.relics.includes(row.id)) return { ok: false, saw: `'${row.id}' is a starting relic — this plant needs the gain door; use a birth plant instead` };
      const before = { cap: run.flaskCharges.capacity, k: run.flaskCharges[row.kind], cur: run.flaskCharges[`${row.kind}Current`] };
      executeRunEffects({ run, registries: reg, rng: null }, [{ op: 'addRelic', id: row.id }]);
      const f = run.flaskCharges;
      const sound = f.capacity === before.cap + row.amount && f[row.kind] === before.k + row.amount
        && f[`${row.kind}Current`] === before.cur + row.amount && f.grown[row.kind] >= row.amount;
      if (!sound) return { ok: false, saw: `'${row.id}': ${JSON.stringify(f)} from capacity ${before.cap}` };
    }
    return { ok: true, saw: '' };
  });

  behave('the tooltip clause is DERIVED from the shipped rows, follows a retune, and is silent for a relic with no row', () => {
    const b = realBundleCopy();
    const shipped = (Array.isArray(b.balance.flaskGrowth) ? b.balance.flaskGrowth : []).filter((r) => r && r.source === 'relic');
    if (shipped.length === 0) return { ok: false, saw: 'zero shipped relic rows — see the live falsifier above' };
    for (const row of shipped) {
      const clause = flaskGrowthClause(b.balance, b.flasks, row.id);
      if (!clause.includes(`+${row.amount} max`)) return { ok: false, saw: `'${row.id}' clause '${clause}' does not carry +${row.amount}` };
    }
    // The mutant that kills every hand-typed copy: retune the first row in the
    // COPY and the clause must follow — prose in a textTemplate cannot do this.
    const tuned = shipped[0].amount + 4;
    shipped[0].amount = tuned;
    const follows = flaskGrowthClause(b.balance, b.flasks, shipped[0].id).includes(`+${tuned} max`);
    const silent = flaskGrowthClause(b.balance, b.flasks, 'noSuchRelic') === '';
    return { ok: follows && silent, saw: `follows ${follows}, silent ${silent}` };
  });

  behave('SAME DOOR, short of the pixel: the REAL relicText renders every shipped row\'s clause (observed red 2026-08-14 with the card.js call removed — saw the bare heal sentence)', () => {
    const reg = createRegistries(contentBundle);
    const shipped = flaskGrowthTable(reg.balance).filter((r) => r && r.source === 'relic');
    if (shipped.length === 0) return { ok: false, saw: 'zero shipped relic rows — see the live falsifier above' };
    for (const row of shipped) {
      const def = contentBundle.relics.find((r) => r && r.id === row.id);
      const text = relicText(def);
      if (!text.includes(`+${row.amount} max`)) return { ok: false, saw: `'${row.id}' renders '${text}'` };
    }
    return { ok: true, saw: '' };
  });

  behave('REGISTRIES, not statics: relicText follows the registries it is handed, and falls back to the shipped statics without one', () => {
    // The trap (my 2026-08-14 log): relicText derived the growth clause from
    // the STATIC balance/flasks imports while the seam derives from
    // registries. One object today — createRegistries freezes a copy of the
    // one shipped bundle — so nothing failed; the day any mode forks balance
    // per-run, the tooltip would describe the shipped row while the seam
    // applied the forked one, both readings plausible, no red anywhere.
    // OBSERVED RED 2026-08-14 before the wire existed: this plant, run
    // against the unwired tree, saw the clause hold the shipped +1 while the
    // forked registries said +5.
    const b = realBundleCopy();
    const shipped = (Array.isArray(b.balance.flaskGrowth) ? b.balance.flaskGrowth : []).filter((r) => r && r.source === 'relic');
    if (shipped.length === 0) return { ok: false, saw: 'zero shipped relic rows — see the live falsifier above' };
    const tuned = shipped[0].amount + 4;
    shipped[0].amount = tuned;
    const reg = createRegistries(b);
    const def = reg.relics.get(shipped[0].id);
    const follows = relicText(def, reg).includes(`+${tuned} max`);
    // The fallback edge: no registries → the shipped statics, unchanged — the
    // non-run surfaces keep reading the one shipped bundle.
    const shippedAmount = flaskGrowthTable(createRegistries(contentBundle).balance)
      .find((r) => r && r.source === 'relic' && r.id === shipped[0].id).amount;
    const fallsBack = relicText(def).includes(`+${shippedAmount} max`);
    return { ok: follows && fallsBack, saw: `follows-fork ${follows} (wanted +${tuned}), falls-back ${fallsBack} — '${relicText(def, reg)}'` };
  });

  behave('a questEvent row on a clean event validates, and the plan says NOT BINDING by name', () => {
    const b = realBundleCopy();
    b.balance.flaskGrowth = [{ source: 'questEvent', id: 'goldboughAvatar', kind: 'hp', amount: 1 }];
    const v = validateContent(b);
    if (v.errors.length) return { ok: false, saw: v.errors.map((e) => `${e.path}`).join(',') };
    const reg = createRegistries(b);
    const run = freshRun(reg);
    const row = flaskGrowthPlan(reg, run).rows[0];
    return {
      ok: row.binding === false && /quest-event history/.test(row.why) && run.flaskCharges.capacity === 3,
      saw: `binding ${row.binding}, why '${row.why}', capacity ${run.flaskCharges.capacity}`,
    };
  });

  // ── DOOR 3: THE CAPACITY LEDGER at the save door — capacity must derive as
  //    base + grown + granted, or the save is refused BY NAME. Every plant
  //    builds its run through the real op doors and enters the check through
  //    serializeRun → deserializeRun / the real save manager.
  //
  //    OBSERVED RED FIRST (the instrument rule, same-door clause), 2026-08-14,
  //    by REAL MUTATION of each door before trusting any green:
  //      sabotage 1 — deleted the `granted += eff.amount` ledger line from the
  //        addFlaskCapacity opcode (engine/actions.js) → exit 1, three plants
  //        red; the grant entered through the shipped keepsake's own effects
  //        and the door refused: `Malformed run save: flaskCharges.capacity 4
  //        is not accounted for by its parts — base 3 + grown 0 + granted 0
  //        = 3`. Nothing between the op and the refusal was synthetic.
  //      sabotage 2 — double-applied the positive delta in syncFlaskGrowth
  //        (model/flaskgrowth.js seam: `f.capacity += d` landed twice) →
  //        exit 1, seven plants red including BOTH DOORS AT MAX through the
  //        real save manager: `flaskCharges.capacity 5 is not accounted for
  //        by its parts — base 3 + grown 1 + granted 0 = 4`. `grown` records
  //        the PLAN, not the mutation, which is why a double-counted row can
  //        never balance its own books.
  //    Both sabotages restored; all plants green on the clean tree. The two
  //    LEDGER RED plants below hold each saboteur's exact state as standing
  //    corpus, entering by serializeRun → deserializeRun like any real save. ──
  console.log('DOOR 3 — the capacity ledger at the save door (serializeRun → deserializeRun → loadRun):');

  behave('LEDGER: a shipped keepsake\'s moment grant writes its ledger line and survives the real save door', () => {
    const grant = shippedMomentGrant();
    if (!grant) return { ok: false, saw: 'no shipped keepsake carries addFlaskCapacity — this door\'s live witness is gone; if deliberate, retire this plant out loud' };
    const eff = grant.effects.find((e) => e.op === 'addFlaskCapacity');
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    const before = { cap: run.flaskCharges.capacity, base: run.flaskCharges.base, granted: run.flaskCharges.granted };
    executeRunEffects({ run, registries: reg, rng: null }, grant.effects);
    const saves = createSaveManager(memStorage());
    saves.saveRun(run, null, 1);
    const loaded = saves.loadRun(reg, 1);
    if (!loaded) return { ok: false, saw: 'the save was refused — the clean path must be green' };
    const f = loaded.flaskCharges;
    return {
      ok: before.granted === 0 && f.granted === eff.amount && f.capacity === before.cap + eff.amount
        && f.base === before.base && f.capacity === f.base + f.grown.hp + f.grown.mana + f.granted,
      saw: JSON.stringify(f),
    };
  });

  behave('LEDGER RED (moment door): the exact state a ledger-skipping grant writes is refused BY NAME at the save door', () => {
    const grant = shippedMomentGrant();
    if (!grant) return { ok: false, saw: 'no shipped moment grant — see the plant above' };
    const eff = grant.effects.find((e) => e.op === 'addFlaskCapacity');
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    executeRunEffects({ run, registries: reg, rng: null }, grant.effects);
    // The saboteur's state, byte for byte: capacity raised, ledger line skipped
    // (what sabotage 1 above produced through the door itself, observed red).
    run.flaskCharges.granted -= eff.amount;
    try {
      deserializeRun(serializeRun(run));
      return { ok: false, saw: 'an unaccountable capacity round-tripped GREEN — the very silence this ledger exists to end' };
    } catch (e) {
      return { ok: /not accounted for by its parts/.test(e.message), saw: e.message };
    }
  });

  behave('LEDGER RED (possession door): a chain row double-counted cannot balance its books at the save door', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b, { kind: 'hp', amount: 1 });
    const reg = createRegistries(b);
    const run = freshRun(reg);
    executeRunEffects({ run, registries: reg, rng: null }, [{ op: 'addRelic', id: 'fixtureCharm' }]);
    // The double-count's state: the seam applied the delta twice while grown
    // recorded the plan once (sabotage 2 above, observed red through the door).
    run.flaskCharges.capacity += 1;
    run.flaskCharges.hp += 1;
    run.flaskCharges.hpCurrent += 1;
    try {
      deserializeRun(serializeRun(run));
      return { ok: false, saw: 'a double-counted chain row round-tripped GREEN' };
    } catch (e) {
      return { ok: /not accounted for by its parts/.test(e.message), saw: e.message };
    }
  });

  behave('LEDGER floor: a current-version save missing its ledger is refused by name (no fourth silent state)', () => {
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    delete run.flaskCharges.base;
    delete run.flaskCharges.granted;
    try {
      deserializeRun(serializeRun(run));
      return { ok: false, saw: 'a ledgerless v3 save loaded green' };
    } catch (e) {
      return { ok: /missing its capacity ledger/.test(e.message), saw: e.message };
    }
  });

  behave('BOTH DOORS AT MAX: chain + moment + reallocation, then source loss — the ledger accounts at every step', () => {
    const b = realBundleCopy();
    plantGrowthRelic(b, { kind: 'hp', amount: 1 });
    const grant = shippedMomentGrant();
    if (!grant) return { ok: false, saw: 'no shipped moment grant' };
    const reg = createRegistries(b);
    const run = freshRun(reg);
    executeRunEffects({ run, registries: reg, rng: null }, [{ op: 'addRelic', id: 'fixtureCharm' }]);
    executeRunEffects({ run, registries: reg, rng: null }, grant.effects);
    reallocateFlaskCharges(run.flaskCharges, { hp: 0, mana: run.flaskCharges.capacity });
    const saves = createSaveManager(memStorage());
    saves.saveRun(run, null, 1);
    const grownFull = saves.loadRun(reg, 1);
    if (!grownFull) return { ok: false, saw: 'the fully grown save was refused' };
    const f1 = grownFull.flaskCharges;
    const maxSound = f1.capacity === 5 && f1.base === 3 && f1.grown.hp === 1 && f1.granted === 1
      && f1.capacity === f1.base + f1.grown.hp + f1.grown.mana + f1.granted;
    // Lose the chain source (below its missing door, stated at the overflow
    // gate above); the moment grant is permanent and must survive the shrink.
    grownFull.relics = grownFull.relics.filter((id) => id !== 'fixtureCharm');
    syncFlaskGrowth(reg, grownFull);
    saves.saveRun(grownFull, null, 2);
    const shrunk = saves.loadRun(reg, 2);
    if (!shrunk) return { ok: false, saw: 'the shrunk save was refused' };
    const f2 = shrunk.flaskCharges;
    return {
      ok: maxSound && f2.capacity === 4 && f2.grown.hp === 0 && f2.granted === 1
        && f2.capacity === f2.base + f2.grown.hp + f2.grown.mana + f2.granted,
      saw: `max ${JSON.stringify(f1)} → shrunk ${JSON.stringify(f2)}`,
    };
  });

  // ── DOOR 3b: THE MIGRATION — pre-ledger (v2) saves attributed once, by the
  //    stated rule, through the real save manager. The rule under test
  //    (initializeRunFlaskCharges): grown was always written, so the surplus
  //    base and chain cannot account for goes to `granted` (the untracked door
  //    owns the untracked charge); base is witnessed by the current authored
  //    balance.flaskCapacity, clamped so the attribution invents nothing. ────
  behave('MIGRATION: a v2 save with an untracked keepsake surplus loads, attributed granted=surplus — and round-trips as v3', () => {
    const grant = shippedMomentGrant();
    if (!grant) return { ok: false, saw: 'no shipped moment grant' };
    const eff = grant.effects.find((e) => e.op === 'addFlaskCapacity');
    const reg = createRegistries(contentBundle);
    const run = freshRun(reg);
    executeRunEffects({ run, registries: reg, rng: null }, grant.effects);
    // The v2 form of this exact run: same capacity, no ledger — what every
    // real pre-ledger save looks like after a keepsake grant.
    const v2 = JSON.parse(serializeRun(run));
    v2.schemaVersion = 2;
    delete v2.flaskCharges.base;
    delete v2.flaskCharges.granted;
    delete v2.flaskCharges.grown;
    const saves = createSaveManager(memStorage());
    saves.saveRun(v2, null, 1);
    const loaded = saves.loadRun(reg, 1);
    if (!loaded) return { ok: false, saw: 'the v2 save was refused at the door it must migrate through' };
    const f = loaded.flaskCharges;
    const attributed = loaded.schemaVersion === 3 && f.base === 3 && f.granted === eff.amount
      && f.capacity === f.base + f.grown.hp + f.grown.mana + f.granted;
    // And the attribution is ONE-time: re-save, re-load, same books.
    saves.saveRun(loaded, null, 2);
    const again = saves.loadRun(reg, 2);
    const stable = again && JSON.stringify(again.flaskCharges) === JSON.stringify(f);
    return { ok: attributed && stable, saw: `${JSON.stringify(f)} stable=${stable}` };
  });

  behave('MIGRATION edge (base retuned UP since the save): the clamp keeps the save\'s capacity and invents nothing — granted 0', () => {
    // A copy with flaskCapacity retuned 3 → 4. Only the LOAD door is walked
    // here (loads never re-create charges), so the class allocations staying
    // at 3 is fine for this plant and refused loudly anywhere else.
    const bumped = realBundleCopy();
    bumped.balance = { ...bumped.balance, flaskCapacity: 4 };
    const reg = createRegistries(contentBundle);
    const reg4 = createRegistries(bumped);
    const run = freshRun(reg); // born at base 3
    const v2 = JSON.parse(serializeRun(run));
    v2.schemaVersion = 2;
    v2.contentVersion = reg4.contentVersion;
    delete v2.flaskCharges.base;
    delete v2.flaskCharges.granted;
    delete v2.flaskCharges.grown;
    const saves = createSaveManager(memStorage());
    saves.saveRun(v2, null, 1);
    const loaded = saves.loadRun(reg4, 1);
    if (!loaded) return { ok: false, saw: 'refused' };
    const f = loaded.flaskCharges;
    return {
      ok: f.capacity === 3 && f.base === 3 && f.granted === 0,
      saw: JSON.stringify(f),
    };
  });

  // ── SOURCE CONTRACTS — flask-data-authority's pattern: the wiring that no
  //    headless run can walk is held as a source-level claim, with a mutant
  //    proving each contract can fail. ───────────────────────────────────────
  console.log('SOURCE CONTRACTS — the screen wiring, greppable because it is not walkable:');
  const contract = (name, ok, detail = '') => {
    counts.contract++;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS ' : 'FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const src = (p) => fs.readFileSync(p, 'utf8');
  // THE WHOLE TREE, not a list of known files: a named-file list is a
  // blacklist, and a fourth relic-gain site added in a new file tomorrow
  // would pass it silently. Every .js under src/ is scanned; the count is
  // asserted >= 3 so the walk itself cannot quietly find nothing (the
  // zero-referent failure SOP 2's ⚙ clause names).
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(p) : (e.name.endsWith('.js') ? [p] : []);
  });
  let pushCount = 0;
  let unwired = [];
  for (const p of walk('src')) {
    const text = src(p);
    for (const m of text.matchAll(/run\.relics\.push\(/g)) {
      pushCount++;
      if (!/syncFlaskGrowth\(/.test(text.slice(m.index, m.index + 200))) unwired.push(p);
    }
  }
  contract('every run.relics.push under src/ is followed by syncFlaskGrowth within its own act',
    pushCount >= 3 && unwired.length === 0,
    unwired.length ? `unwired: ${unwired.join(', ')}` : `${pushCount} sites, all wired`);
  contract('equipment.js commit() re-syncs the chain (the talisman door)',
    /function commit\(\) \{[\s\S]{0,400}syncFlaskGrowth\(registries, run\)/.test(src('src/ui/screens/equipment.js')));
  contract('relicText derives the growth clause (card.js calls flaskGrowthClause — the tooltip cannot silently omit a live row)',
    /flaskGrowthClause\(/.test(src('src/ui/components/card.js')));
  // Every relicText CALL in the tree passes its registries — the wire that
  // keeps the tooltip deriving from the object the seam derives from. Walked
  // over all of src/ (a named-file list is a blacklist); card.js is the
  // definition and the one legal bare mention. Floor of 5 call sites so the
  // walk cannot quietly find nothing.
  let relicTextCalls = 0;
  const bareCalls = [];
  for (const p of walk('src')) {
    if (p === 'src/ui/components/card.js') continue;
    for (const m of src(p).matchAll(/relicText\(([^)]*)\)/g)) {
      relicTextCalls++;
      if (!/,/.test(m[1])) bareCalls.push(`${p}: relicText(${m[1]})`);
    }
  }
  contract('every relicText call site under src/ hands over its registries (no static-only tooltip on a run surface)',
    relicTextCalls >= 5 && bareCalls.length === 0,
    bareCalls.length ? `bare: ${bareCalls.join(', ')}` : `${relicTextCalls} sites, all wired`);
  contract('MUTANT: the registries contract goes red on a bare relicText(def)',
    (() => {
      const planted = 'attachTooltip(el, () => relicText(def));';
      const m = [...planted.matchAll(/relicText\(([^)]*)\)/g)];
      return m.length > 0 && m.some((x) => !/,/.test(x[1]));
    })());
  // The mutant: prove the contract regex can fail — a push with no sync.
  contract('MUTANT: the contract goes red on a push with no sync',
    !(() => {
      const planted = 'if (relicId) {\n  run.relics.push(relicId);\n}\n';
      const idx = [...planted.matchAll(/run\.relics\.push\(/g)].map((m) => m.index);
      return idx.length > 0 && idx.every((i) => /syncFlaskGrowth\(/.test(planted.slice(i, i + 200)));
    })());

  console.log(`\nRESULT ${fails === 0 ? 'all plants behaved' : `${fails} MISBEHAVED`} — ${counts.refusal} refusal plants (door 1), ${counts.behaviour} behaviour plants (door 2), ${counts.contract} source contracts (counted at run time, never typed).`);
  console.log('Boundary: no pixel was asserted (the equipment and reward screens are browser');
  console.log('surfaces); the live rows are proven to WORK, not to be WELL-WEIGHED (the M3');
  console.log('balance pass owns the numbers); and the removal plants enter below a door that');
  console.log('does not exist yet — all named above, in place.');
  process.exit(fails === 0 ? 0 : 1);
}

if (SELFTEST) selftest(); else report();
