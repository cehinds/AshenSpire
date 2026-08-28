#!/usr/bin/env node
// tools/runcreation.mjs — WHO WROTE THIS NUMBER, AND WHAT DID THEY OVERWRITE?
//
// THE DEFECT, FOUND FROM TWO ENDS BY TWO SEATS WHO EACH SAW HALF (Marina's
// ruling, 2026-08-15, R-1/R-2 as one act):
//
//   · Vira: three fields are optional in RUN_SHAPE with NO schemaVersion gate,
//     so a heal written for old saves fires on a CURRENT-schema save too. Delete
//     the allocation from a v4 save and it loads with the class preset. Silently.
//   · Sten: a planted double-count in the max-HP chain was SWALLOWED, because
//     `reconcileRunLoadoutHp` is the LAST writer at run creation. His instrument
//     went green on a real defect.
//
// One defect: **a last-writer-wins reconcile at run creation that keeps no
// record of what it overwrote.** Nobody owned run creation. This tool does.
//
// WHAT THIS TOOL IS FOR, AND WHAT IT DELIBERATELY IS NOT.
//   IT IS: the observer of that record. src/model/healLedger.js makes each
//     writer state what it computed and what it replaced; this drives BOTH
//     doors — createRunState AND createSaveManager.loadRun — and goes red when
//     they disagree, when a home stops reporting, or when a heal fires without
//     naming itself (Sten's A7).
//   IT IS NOT the collapse. The max-HP formula still lives in three homes and
//     this act does not merge them: *you cannot safely collapse what you cannot
//     watch drift*, and the swallowed plant is the proof. Collapse is the next
//     act, and it is safe to attempt only once this is green and has been red.
//   IT IS NOT a refusal. Refuse-vs-heal is a false dichotomy (Constantine, C6).
//     The defect is the SILENCE, not the heal. tests/engine.test.js 28 and 50
//     stay GREEN — this tool asserts that they should, in group C.
//
// THE DOOR — printed by door() below, in this run's own output, because an
// observation that cannot name its entry point has not made the claim
// (commons/development.md, *The instrument rule*, same-door clause):
//
//   Doors driven: createRunState({seed,classId,registries}) for the born case,
//   and BYTES under the real key 'sote_run_v1' written by
//   createSaveManager(storage).saveRun and read by .loadRun(registries) for the
//   restored case — the same two calls the game makes at src/main.js persist()
//   and resumeRun(). Registries are the real content boot. Every damaged save
//   in group C is produced by taking a save THIS BUILD WROTE and deleting a
//   field from the JSON, then putting the bytes back under the real key:
//   nothing is handed to normalizeRunAttributes, initializeRunDerivedStats,
//   initializeRunFlaskCharges or reconcileRunLoadoutHp directly. Those are the
//   stages under test.
//
// FOUR GROUPS:
//   A. run creation says what it did — the three-writer chain is on the record
//   B. the two doors agree — every home that spoke said the same number, and a
//      run comes back with the pools it was born with (A7)
//   C. every ungated heal NAMES ITSELF through saves.runStatus(), and a clean
//      save reports 'ok' with zero heals (both edges)
//   D. THE WAKE — see the block above wake() below
//
// SELFTEST: `node tools/runcreation.mjs --selftest` plants five known-bads into
// a COPY of the real tree via tools/doorplant.mjs and runs this whole file from
// that copy, so each plant enters as source bytes on the road the real input
// travels.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day run creation and the
// load door have ONE writer per field — no last writer, nothing to overwrite,
// nothing to witness. Collapsing the three homes earns that; this is what makes
// the collapse safe to attempt, not a permanent fixture.

import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { createMemoryStorage, createSaveManager, RUN_KEY } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { readLedger, describeLedger, maxHpHomeValues, MAX_HP_HOMES } from '../src/model/healLedger.js';

let checks = 0;
let failures = 0;
// The denominators this tool refuses to lie about. A green over an empty
// comparison is the eleven-instruments shape (commons/development.md).
let ledgerEntriesRead = 0;
let homeReadings = 0;
const homesSeen = new Set();

function check(name, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name} — ${error?.message || error}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const j = (v) => JSON.stringify(v);

function door() {
  console.log(`DOOR — where the known-bad and the real input both enter:
  TWO doors are driven, because the defect lives in the joint between them.
  · BORN:     createRunState({ seed, classId, registries }) — the call
              src/main.js newRun() makes. Nothing else constructs a run.
  · RESTORED: BYTES under the real key '${RUN_KEY}', written by
              createSaveManager(storage).saveRun(run, rng, slot) and read by
              .loadRun(registries, slot) — src/main.js persist() and resumeRun().
  Registries come from the real content boot (src/content/index.js ->
  validateContent -> createRegistries).
  Group C's damaged saves are made by DELETING A FIELD FROM THE JSON THIS BUILD
  JUST WROTE and putting those bytes back under the real key, so the damage
  travels the whole scan/parse/migrate/heal road a real damaged save would.
  Nothing in this file calls normalizeRunAttributes, initializeRunDerivedStats,
  initializeRunFlaskCharges or reconcileRunLoadoutHp directly: those are the
  stages under test, and handing them a fixture would exercise the half that was
  never in doubt.
  What the tool READS is saves.runStatus() and readLedger(run) — the run door's
  own named state, the same thing a UI would read.\n`);
}

function ledgerOfBorn(run) {
  const summary = readLedger(run, { currentSchemaVersion: RUN_SCHEMA_VERSION });
  if (summary) ledgerEntriesRead += summary.entries.length;
  return summary;
}

function tally(summary) {
  for (const h of maxHpHomeValues(summary)) { homeReadings++; homesSeen.add(h.site); }
  return summary;
}

// ---------------------------------------------------------------------------
// A. run creation says what it did
// ---------------------------------------------------------------------------
function groupA(registries) {
  for (const cls of registries.classes.all()) {
    check(`run creation is on the record — ${cls.id}`, () => {
      const run = createRunState({ seed: 0x4100 + cls.id.length, classId: cls.id, registries });
      const summary = tally(ledgerOfBorn(run));
      assert(summary, `createRunState left NO ledger at all for ${cls.id} — the door did not open, so every claim below would be about an empty object`);
      assert(summary.door === 'createRunState', `the ledger names the wrong door: ${summary.door}`);
      assert(summary.open === false, 'the ledger is still OPEN after createRunState returned — it would keep recording all climb long');
      assert(summary.entries.length >= 3,
        `only ${summary.entries.length} entr(ies) recorded at birth; the writer chain is at least three (classDef+equipment, the derived rules, the reconcile) and a shorter record means a writer stopped reporting`);

      // The FIRST writer must be visible, because it is the one whose value the
      // later writers replace, and it is the only evidence of what was replaced.
      const first = summary.entries[0];
      assert(first.site === 'state.js:createRunState' && first.field === 'maxHp',
        `the first recorded act is ${first.site}/${first.field}, not the classDef+equipment maxHp write`);

      // And the last writer must be the reconcile, or the premise of this whole
      // act is wrong and the ordering claim in healLedger.js needs rewriting.
      const maxHpWrites = summary.entries.filter((e) => e.field === 'maxHp');
      const last = maxHpWrites[maxHpWrites.length - 1];
      assert(last.site === 'loadout.js:reconcileRunLoadoutHp',
        `the LAST writer of maxHp at birth is ${last.site}, not reconcileRunLoadoutHp — the swallow this tool was built around has moved, and every comment naming it is now wrong`);
      assert(last.now === run.maxHp,
        `the last recorded write says maxHp ${last.now} but the run carries ${run.maxHp} — a writer after the last recorded one`);
      return `${summary.entries.length} acts recorded, ${maxHpWrites.length} of them maxHp, last writer ${last.site} @ ${last.now}`;
    });
  }
}

// ---------------------------------------------------------------------------
// B. the two doors agree — Sten's A7
// ---------------------------------------------------------------------------
// "A7" HERE MEANS THE ACT, not a check — the dispatch item that built this
// whole tool. Until 2026-08-15 a CHECK inside tools/onevocab.mjs also wore the
// name, and Vira nearly gated the wrong one; a finding reported as "A7 failed"
// named two artifacts. That check is now ONEANSWER (Marina MR-35). The act's
// name is in the packets and the thread and is not recalled — only the check
// moved, because only the check lived in one file. If you are holding a report
// dated before 2026-08-15: "A7" there is this tool OR onevocab's ONEANSWER, and
// the report has to say which.
// "Drive createRunState AND createSaveManager.loadRun, fail if they disagree."
// Two disagreements are possible and both are checked:
//   1. WITHIN a door: two homes computing the same field to different numbers.
//      This is the one Sten's plant hid in — the later home overwrites the
//      earlier and the run looks fine.
//   2. ACROSS the doors: a run does not come back with the pools it was born
//      with, even though nothing happened to it in between.
function groupB(registries) {
  for (const cls of registries.classes.all()) {
    check(`the three max-HP homes agree, at both doors — ${cls.id}`, () => {
      const born = createRunState({ seed: 0x4200 + cls.id.length, classId: cls.id, registries });
      const bornLedger = tally(ledgerOfBorn(born));
      const storage = createMemoryStorage();
      const saves = createSaveManager(storage);
      saves.saveRun(born, createRng(born.seed), 1);
      const loaded = saves.loadRun(registries, 1);
      assert(loaded, `a save this build just wrote was REFUSED by its own load door`);
      const loadLedger = tally(saves.runStatus().ledger);
      assert(loadLedger, 'loadRun left no ledger — runStatus() cannot answer for a door that never opened');
      ledgerEntriesRead += loadLedger.entries.length;

      const readings = [...maxHpHomeValues(bornLedger), ...maxHpHomeValues(loadLedger)];
      assert(readings.length > 0,
        `NO max-HP home reported on either door for ${cls.id}. An empty census is not agreement — it is the query with no referent (SOP 2's ⚙ clause).`);
      const distinct = [...new Set(readings.map((r) => r.value))];
      assert(distinct.length === 1,
        `the max-HP homes DISAGREE for ${cls.id}: ${readings.map((r) => `${r.site}@${r.door} = ${r.value}`).join(' · ')}. `
        + `The run itself carries ${loaded.maxHp}, so whichever home is wrong was overwritten by call order and nothing else would have told you.`);
      assert(distinct[0] === loaded.maxHp,
        `every home agreed on ${distinct[0]} and the run carries ${loaded.maxHp} — a fourth writer, unrecorded`);

      // Across the doors: born and restored are the same run.
      for (const key of ['maxHp', 'hp', 'maxMana', 'mana', 'maxStamina', 'stamina', 'energyMax', 'drawPerTurn', 'maxHpAdjustment']) {
        assert(born[key] === loaded[key],
          `${key} disagrees across the doors: born ${born[key]}, restored ${loaded[key]} — nothing happened to this run in between`);
      }
      return `${readings.length} home reading(s), all ${distinct[0]}; 9 pool fields identical across born/restored`;
    });
  }

  check('every one of the three max-HP homes was actually observed, not merely absent', () => {
    const missing = Object.keys(MAX_HP_HOMES).filter((site) => !homesSeen.has(site));
    assert(missing.length === 0,
      `${missing.length} home(s) never reported in this whole run: ${missing.join(', ')}. `
      + 'A home that says nothing and a home that agrees are the same output, and they mean the opposite — the agreement checks above are silent about it.');
    return `${homesSeen.size}/${Object.keys(MAX_HP_HOMES).length} homes observed across ${homeReadings} reading(s)`;
  });
}

// ---------------------------------------------------------------------------
// C. every ungated heal names itself, through the real door
// ---------------------------------------------------------------------------
// The three heals are RIGHT to heal — engine.test.js 28 deletes `loadout` from a
// current-schema run and requires it back, and throwing away a climb over a
// missing field is worse than filling it in. What was wrong is that nothing
// downstream could tell it had happened. Each case below damages a save THIS
// BUILD WROTE and requires the door to say, by name and by site, what it did.
const HEALS = [
  {
    name: 'the allocation',
    damage: (o) => { delete o.attributes; delete o.attributeMode; },
    site: 'attributes.js:normalizeRunAttributes',
    field: 'attributes+attributeMode',
  },
  {
    name: 'the loadout',
    damage: (o) => { delete o.loadout; },
    site: 'save.js:loadRun',
    field: 'loadout',
  },
  {
    name: 'the flask capacity ledger',
    damage: (o) => { delete o.flaskCharges; },
    site: 'state.js:initializeRunFlaskCharges',
    field: 'flaskCharges',
  },
];

function groupC(registries) {
  // The green edge first: an undamaged save must report 'ok' and ZERO heals, or
  // every red below is meaningless because the tool would say 'healed' always.
  check("a clean current-schema save reports 'ok' — the quiet edge", () => {
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    assert(saves.runStatus().state === 'none', `before any load, runStatus() should be 'none', got '${saves.runStatus().state}'`);
    const run = createRunState({ seed: 0x4301, classId: 'reaver', registries });
    saves.saveRun(run, createRng(run.seed), 1);
    const loaded = saves.loadRun(registries, 1);
    assert(loaded, 'the save this build just wrote was refused by its own door');
    const st = saves.runStatus();
    assert(st.state === 'ok', `an undamaged save reported '${st.state}' (${st.reason}) — if a clean load reports healed, the healed verdict below means nothing`);
    assert(st.ledger.healed === 0, `${st.ledger.healed} heal(s) on a save nothing was done to: ${j(st.ledger.entries.map((e) => e.site))}`);
    ledgerEntriesRead += st.ledger.entries.length;
    return `state 'ok', 0 heals, ${st.ledger.entries.length} act(s) recorded`;
  });

  for (const h of HEALS) {
    check(`the heal NAMES ITSELF through the real door — ${h.name}`, () => {
      const storage = createMemoryStorage();
      const saves = createSaveManager(storage);
      const run = createRunState({ seed: 0x4302, classId: 'reaver', registries });
      saves.saveRun(run, createRng(run.seed), 1);

      const before = JSON.parse(storage.getItem(RUN_KEY));
      h.damage(before);
      // Prove the damage is real before believing anything the door says about
      // it: a `delete` on a key that had been renamed would leave the save whole
      // and this check would pass over nothing.
      const after = JSON.stringify(before);
      assert(after.length < storage.getItem(RUN_KEY).length,
        `the damage removed nothing from the save (${after.length} bytes, unchanged) — this case has no referent`);
      storage.setItem(RUN_KEY, after);

      const loaded = saves.loadRun(registries, 1);
      assert(loaded, `the damaged save was ARCHIVED. That may one day be the right answer, but it is not today's behaviour and tests 28/50 require the heal — this tool has drifted from the tree.`);

      const st = saves.runStatus();
      ledgerEntriesRead += st.ledger ? st.ledger.entries.length : 0;
      assert(st.state === 'healed',
        `the door filled in ${h.name} and reported state '${st.state}' — THE SILENCE IS THE DEFECT, not the heal`);
      const entry = st.ledger.entries.find((e) => e.kind === 'heal' && e.site === h.site && e.field === h.field);
      assert(entry,
        `nothing in the ledger names ${h.site}/${h.field}. Recorded instead: ${j(st.ledger.entries.map((e) => `${e.kind} ${e.site}/${e.field}`))}`);
      assert(entry.was === undefined, `the heal claims it replaced ${j(entry.was)}; it filled an ABSENCE and must say so`);
      assert(entry.now !== undefined && entry.now !== null, 'the heal recorded no value for what it put there');
      assert(entry.why && entry.why.length > 20, `the heal's reason is '${entry.why}' — a site with no sentence is a log line, not an explanation`);
      assert(entry.savedSchemaVersion === RUN_SCHEMA_VERSION,
        `the heal recorded savedSchemaVersion ${entry.savedSchemaVersion}; this save was written by THIS build (v${RUN_SCHEMA_VERSION}) and the whole parked question turns on that number being right`);
      assert(st.ledger.healedOnCurrentSchema >= 1,
        'healedOnCurrentSchema is 0 on a current-schema save that was demonstrably healed — the predicate the wake condition rides on is not counting');
      return `state 'healed', ${h.site} named, v${entry.savedSchemaVersion}, reason ${entry.why.length} chars`;
    });
  }

  check('a save that is REFUSED still reports what the door did before it gave up', () => {
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const run = createRunState({ seed: 0x4303, classId: 'reaver', registries });
    saves.saveRun(run, createRng(run.seed), 1);
    const o = JSON.parse(storage.getItem(RUN_KEY));
    o.schemaVersion = 99; // a version no migration knows
    storage.setItem(RUN_KEY, JSON.stringify(o));
    assert(saves.loadRun(registries, 1) === null, 'an unknown schemaVersion was accepted');
    const st = saves.runStatus();
    assert(st.state === 'archived', `a refused save reported '${st.state}'`);
    assert(st.reason && /schemaVersion 99/.test(st.reason), `the refusal did not name the version: ${j(st.reason)}`);
    assert(st.archiveId, 'the refusal reported no archive id, so the drawer cannot be reached from the status');
    return `state 'archived', reason names schemaVersion 99, archive ${st.archiveId}`;
  });
}

// ---------------------------------------------------------------------------
// D. THE WAKE
// ---------------------------------------------------------------------------
// *The wake condition* (commons/development.md, Freja, 2026-08-14): a refusal
// mechanism ships with its wake written as an observable predicate, and the wake
// carries a RED OF ITS OWN — because the refusing half is always green and
// absence never fails a test written to expect absence.
//
// WHAT IS BEING CARRIED, precisely. Marina parked one question: *should a
// current-schema save missing a field be REFUSED instead of healed?* Today it
// heals, deliberately, and tests 28 and 50 say so. That parked call is a
// refusal-to-refuse, and its premise is:
//
//   ┌ THE PREMISE ─────────────────────────────────────────────────────────┐
//   │ No save this build WRITES is a save this build has to HEAL. Every    │
//   │ current-schema heal observed so far exists because a test deleted a  │
//   │ field on purpose. Nothing in the shipped write path produces one.    │
//   └──────────────────────────────────────────────────────────────────────┘
//
// While that holds, healing costs nothing real and refusing buys nothing real —
// which is exactly why the call could be parked. THE DAY IT DIES, it wakes: a
// build that writes saves its own door must repair is a build whose players are
// silently getting plausible allocations, and the refuse question is live.
//
// The check below is the red on the WAKE, not on the refusing: it round-trips
// UNTOUCHED saves through the real door and fails the moment
// `healedOnCurrentSchema` is non-zero. Nothing here asserts that heals happen —
// group C does that, and a suite that only re-proves the refusal watches the
// premise never.
//
// THE HALF A MACHINE CANNOT WATCH, stated rather than implied. Marina's ruling
// gave the wake a second trigger: *the day anyone measures torn writes or quota
// in a browser.* No check in this file can fire on that — every save here lives
// in an in-memory stub. What would count, written down so a third party can
// evaluate it: a run under a real localStorage that observes EITHER a
// QuotaExceededError from saveRun, OR a partially-written value under
// '<RUN_KEY>' after an interrupted write. Either is a shipped writer producing
// a save its own door must heal, i.e. the same premise-death by another road.
// Owner: this seat. It is unmeasured today and that is `unknown`, not green.
function wake(registries) {
  const cases = [];
  for (const cls of registries.classes.all()) {
    cases.push({ what: `a fresh ${cls.id}`, build: () => createRunState({ seed: 0x4400 + cls.id.length, classId: cls.id, registries }) });
  }
  cases.push({
    what: 'a played reaver (curse ledger, HP deficit, spent purse)',
    build: () => {
      const run = createRunState({ seed: 0x4401, classId: 'reaver', registries });
      run.hp = run.maxHp - 26;
      run.cinders = 137;
      run.maxHpAdjustment = -9;
      run.maxHp = Math.max(1, run.maxHp - 9);
      return run;
    },
  });
  cases.push({
    what: 'a herald with every flask charge spent',
    build: () => {
      const run = createRunState({ seed: 0x4402, classId: 'herald', registries });
      run.flaskCharges.hpCurrent = 0;
      run.flaskCharges.manaCurrent = 0;
      return run;
    },
  });

  for (const c of cases) {
    check(`WAKE — this build writes no save its own door must heal: ${c.what}`, () => {
      const storage = createMemoryStorage();
      const saves = createSaveManager(storage);
      const run = c.build();
      saves.saveRun(run, createRng(run.seed), 1);
      const bytes = storage.getItem(RUN_KEY);
      assert(typeof bytes === 'string' && bytes.length > 500,
        `nothing was written under '${RUN_KEY}' — a wake check with no save to read is the query with no referent`);
      const loaded = saves.loadRun(registries, 1);
      assert(loaded, 'this build wrote a save its own door REFUSED — the premise is dead in the loudest possible way');
      const st = saves.runStatus();
      ledgerEntriesRead += st.ledger ? st.ledger.entries.length : 0;
      assert(st.ledger, 'no ledger, so this check observed nothing');
      assert(st.ledger.savedSchemaVersion === RUN_SCHEMA_VERSION,
        `the save reported schemaVersion ${st.ledger.savedSchemaVersion}, not the current v${RUN_SCHEMA_VERSION} — this case is not testing the premise it claims to`);
      assert(st.ledger.healedOnCurrentSchema === 0,
        `THE PREMISE HAS DIED. This build wrote a save and its own load door had to HEAL ${st.ledger.healedOnCurrentSchema} field(s) in it: `
        + `${j(st.ledger.entries.filter((e) => e.kind === 'heal' || e.kind === 'rename').map((e) => `${e.site}/${e.field}`))}. `
        + 'The parked refuse-vs-heal call (Marina, 2026-08-15) is now LIVE: healing is no longer a courtesy to old saves, it is repairing this build\'s own output, '
        + 'and a player is silently getting a plausible value instead of theirs. Take it back to the table; do not fix this line.');
      return `v${st.ledger.savedSchemaVersion} save, 0 heals, ${st.ledger.entries.length} act(s) recorded, ${bytes.length} bytes`;
    });
  }
}

// ---------------------------------------------------------------------------
// Boundary
// ---------------------------------------------------------------------------
function boundary() {
  console.log(`
BOUNDARY — what this green does NOT cover.

  · IT IS VISIBILITY, NOT A COLLAPSE AND NOT A FIX. The max-HP formula still
    lives in three homes (${Object.keys(MAX_HP_HOMES).length}, named in src/model/healLedger.js). This tool proves
    they AGREE on every case it drives; it does not prove they cannot drift, and
    nothing here merges them. A case this file never builds is a case no home
    was compared on.
  · IT IS SILENT ON WHETHER THE NUMBERS ARE RIGHT. If D22 derives the wrong HP,
    all three homes derive it identically and this tool says PASS. tools/conhp.mjs
    holds the formula; this holds the joint.
  · THE HEALS STILL HEAL. Nothing here refuses anything. A current-schema save
    missing a field still loads with a plausible substitute — it now says so.
    Whether it should refuse is a parked design call (Marina, 2026-08-15) and
    the wake above is what will re-open it.
  · NO BROWSER, ONE RUNTIME. In-memory storage, Node ${process.version} on ${process.platform}.
    Quota refusals and torn writes are UNMEASURED — and they are the second half
    of the wake condition, so that half is 'unknown', not green.
  · THE LEDGER IS OPEN ONLY AT THE TWO DOORS. A writer that touches maxHp
    mid-climb — an event, a relic, a rest — records nothing and is invisible
    here. That is deliberate (bounded cost) and it is a real blind spot.
  · schemaVersion 1 IS STILL ACCEPTED BY migrateRunSchema AND NO FIXTURE IN THIS
    TREE WAS WRITTEN BY A v1 BUILD. Recorded by Marina 2026-08-15 as a refusal
    mechanism with no wake, parked with no seat this wave: either a v1 build
    produces a fixture, or the v1 branch is deleted so v1 fails loud by name.
    Unknown, not green, and aging will not fix it.
`);
}

// ---------------------------------------------------------------------------
// Selftest — five known-bads, each entering as source bytes in a copied tree
// ---------------------------------------------------------------------------
async function selftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  return doorSelftest({
    tool: 'runcreation.mjs',
    timeoutMs: 180000,
    plants: [
      {
        // STEN'S SWALLOW, PLANTED FOR REAL. Home 2 computes maxHp seven too
        // high; home 3 (reconcileRunLoadoutHp) runs last at run creation and
        // overwrites it.
        //
        // I FIRST WROTE THAT THE WHOLE SUITE STAYS GREEN UNDER THIS PLANT AND
        // THAT WAS FALSE — measured, at dev = 7e67de8: engine 82/1 (50c),
        // conhp 25/27, saveroundtrip 10/13. The true statement is narrower and
        // it is the actual finding:
        //
        //   THE SWALLOW IS EXACT WHERE NOTHING ELSE LOOKS. On a run being BORN
        //   and on a CURRENT-schema save coming back, all three classes are
        //   byte-for-byte unaffected — 96/96, 82/82, 90/90, runStatus 'ok'.
        //   The existing reds all come from the LEGACY load path, where
        //   stampDeck is skipped, home 3 never runs, and home 2's number
        //   survives to be compared against a fixture. So the tree catches this
        //   defect only if a player has an OLD save. A build with no legacy
        //   corpus ships it green.
        //
        // That is why this tool drives the born door at all, and why the
        // disagreement — not the outcome — is what it asserts on.
        //
        // A constant and not a doubling on purpose: the starting loadouts carry
        // a zero equipment maxHp bonus, so doubling it would plant nothing.
        name: "max-HP home 2 computes a different number and home 3 overwrites it — the swallow, exactly",
        file: 'src/model/state.js',
        find: '  const derivedMaxHp = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment);',
        replace: '  const derivedMaxHp = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment + 7);',
        expectRed: /max-HP homes DISAGREE/,
      },
      {
        // A home that stops reporting. Agreement and silence are the same
        // output and mean the opposite — the census is what separates them.
        name: 'max-HP home 3 stops recording, so its silence reads as agreement',
        file: 'src/model/loadout.js',
        find: "    site: 'loadout.js:reconcileRunLoadoutHp',",
        replace: "    site: 'loadout.js:reconcileRunLoadoutHpNOTAHOME',",
        expectRed: /never reported in this whole run|LAST writer of maxHp/,
      },
      {
        // The heal goes quiet again — the original defect, restored.
        name: 'the loadout heal stops naming itself',
        file: 'src/engine/save.js',
        find: "          field: 'loadout',",
        replace: "          field: 'loadoutQUIET',",
        expectRed: /nothing in the ledger names save\.js:loadRun\/loadout|THE SILENCE IS THE DEFECT/,
      },
      {
        // The allocation heal goes quiet, at a different site, so one plant
        // cannot be credited for the other's coverage.
        name: 'the allocation heal stops naming itself',
        file: 'src/model/attributes.js',
        find: "      kind: 'heal',\n      site: 'attributes.js:normalizeRunAttributes',",
        replace: "      kind: 'write',\n      site: 'attributes.js:normalizeRunAttributes',",
        expectRed: /nothing in the ledger names attributes\.js|THE SILENCE IS THE DEFECT/,
      },
      {
        // THE WAKE'S OWN RED, on a planted PREMISE-DEATH through the door the
        // real death would enter: the shipped writer drops a field, so this
        // build now writes saves its own door must heal. Group C would stay
        // green under this — it damages saves itself and would still see its
        // heal. Only the wake fires.
        name: "the shipped writer drops a field, so this build's own saves need healing (premise-death)",
        file: 'src/engine/save.js',
        find: '      storage.setItem(runKey(slot), serializeRun(run));',
        replace: '      const _p = JSON.parse(serializeRun(run)); delete _p.loadout;\n      storage.setItem(runKey(slot), JSON.stringify(_p));',
        expectRed: /THE PREMISE HAS DIED/,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  process.exit(await selftest());
}

console.log(`runcreation — who wrote this number, and what did they overwrite? (run schema v${RUN_SCHEMA_VERSION})\n`);
door();

const content = validateContent(contentBundle);
check('the real content boot is green, so every registry below is the shipped one', () => {
  assert(content.ok, `validateContent refused the shipped bundle: ${j(content.errors).slice(0, 300)}`);
  return `contentVersion ${contentBundle.version ?? '(unversioned)'}, ${Object.keys(MAX_HP_HOMES).length} declared max-HP homes`;
});
if (!content.ok) {
  console.log('\nruncreation: content boot is red — no question about run creation can be asked of a tree that will not boot.');
  process.exit(2);
}
const REGISTRIES = createRegistries(contentBundle);

console.log('\n-- A. run creation says what it did --');
groupA(REGISTRIES);

console.log('\n-- B. the two doors agree (Sten A7) --');
groupB(REGISTRIES);

console.log('\n-- C. every ungated heal names itself, through the real door --');
groupC(REGISTRIES);

console.log('\n-- D. the WAKE: this build writes no save its own door must heal --');
wake(REGISTRIES);

if (process.argv.includes('--show')) {
  console.log('\n-- the record, for one reaver born and restored --');
  const r = createRunState({ seed: 7, classId: 'reaver', registries: REGISTRIES });
  console.log(describeLedger(readLedger(r, { currentSchemaVersion: RUN_SCHEMA_VERSION })).join('\n'));
  const s = createMemoryStorage();
  const m = createSaveManager(s);
  m.saveRun(r, createRng(r.seed), 1);
  const o = JSON.parse(s.getItem(RUN_KEY));
  delete o.attributes; delete o.attributeMode;
  s.setItem(RUN_KEY, JSON.stringify(o));
  m.loadRun(REGISTRIES, 1);
  console.log(describeLedger(m.runStatus().ledger).join('\n'));
}

boundary();

// The floors on this tool's own denominators. A run that read three ledger
// entries and printed PASS would be the eleven-instruments shape. Set at ~80%
// of what was observed at dev = 7e67de8 (43 entries, 16 home readings) — high
// enough that deleting a group or losing a class trips it, low enough that
// re-tuning a comment does not. They are a coverage alarm, not a target.
const ENTRY_FLOOR = 35;
const HOME_FLOOR = 12;
console.log(`${checks - failures}/${checks} checks passed · ${ledgerEntriesRead} ledger entr(ies) read · ${homeReadings} max-HP home reading(s) across ${homesSeen.size}/${Object.keys(MAX_HP_HOMES).length} homes`);
if (ledgerEntriesRead < ENTRY_FLOOR || homeReadings < HOME_FLOOR) {
  console.log(`runcreation: RED — ${ledgerEntriesRead} entries (floor ${ENTRY_FLOOR}) and ${homeReadings} home readings (floor ${HOME_FLOOR}). A green over an empty record is not a green.`);
  process.exit(1);
}
if (failures) process.exit(1);
