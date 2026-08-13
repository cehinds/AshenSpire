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
import { createRunState, initializeRunFlaskCharges, validateRunShape } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { reallocateFlaskCharges } from '../src/model/gracerefill.js';
import { flaskGrowthTable, flaskGrowthPlan, syncFlaskGrowth } from '../src/model/flaskgrowth.js';
import { FLASK_GROWTH_SOURCES } from '../src/model/schemas.js';
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
  console.log('about screens, and nothing about balance — no live row exists to balance yet.');
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
  // The mutant: prove the contract regex can fail — a push with no sync.
  contract('MUTANT: the contract goes red on a push with no sync',
    !(() => {
      const planted = 'if (relicId) {\n  run.relics.push(relicId);\n}\n';
      const idx = [...planted.matchAll(/run\.relics\.push\(/g)].map((m) => m.index);
      return idx.length > 0 && idx.every((i) => /syncFlaskGrowth\(/.test(planted.slice(i, i + 200)));
    })());

  console.log(`\nRESULT ${fails === 0 ? 'all plants behaved' : `${fails} MISBEHAVED`} — ${counts.refusal} refusal plants (door 1), ${counts.behaviour} behaviour plants (door 2), ${counts.contract} source contracts (counted at run time, never typed).`);
  console.log('Boundary: no pixel was asserted (the equipment and reward screens are browser');
  console.log('surfaces); no balance claim is made (zero live rows ship); and the reversal');
  console.log('plant enters below a door that does not exist yet — both named above, in place.');
  process.exit(fails === 0 ? 0 : 1);
}

if (SELFTEST) selftest(); else report();
