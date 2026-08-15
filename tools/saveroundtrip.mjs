#!/usr/bin/env node
// tools/saveroundtrip.mjs — IS A SAVE A FIXED POINT OF THE SAVE DOOR?
//
// THE ONE QUESTION. Write a save, read it back, write it again: are the two
// writes the same bytes? And: does a save written by an OLDER build come
// forward with every player-owned number intact — no field quietly dropped,
// no field quietly filled with a plausible default?
//
// WHY IT IS A DIFFERENT QUESTION FROM THE ONES ALREADY ASKED HERE. At
// dev = 7e67de8 (PR #178, CON restored, relic resource authority data-driven)
// tools/conhp.mjs proves the D22 formula and checks NAMED fields across a
// save/load — maxHp, hp, maxHpAdjustment, the allocation. tests/engine.test.js
// 50c proves a retired-name save loads healed and re-serializes with zero dead
// bytes. Both walk a LIST OF FIELDS SOMEBODY THOUGHT OF. Neither asks the
// whole-artifact question: is the SAVE — every byte of it — unchanged by a
// trip through the door? A field nobody listed is exactly the field a
// migration eats, and it goes on reading green in both of those tools forever.
//
// THE TRAP THIS IS POINTED AT — Law 1 clause 5 / Law 0 clause 5, verbatim:
// *"Silent plausible derivation is the dangerous failure. A missing field that
// fails loud is cheap; a generated thing that is wrong but reasonable is
// invisible."* A load door that fills a gap with a class preset does not crash,
// does not warn, and produces a run that is internally consistent with itself.
// Nothing downstream can tell. Only the BEFORE bytes can, which is why this
// tool keeps them and compares against them rather than against expectations.
//
// THE DOOR — printed by door() below, in this run's own output, because the
// instrument rule's same-door clause (commons/development.md, family repo) says
// an observation that cannot name its entry point has not made the claim:
//
//   Every save here enters as BYTES under the real storage key 'sote_run_v1'
//   (RUN_KEY, src/engine/save.js), written by createSaveManager(storage).saveRun
//   and read by .loadRun(registries) — the same two calls the game makes at
//   src/main.js:579 (persist) and src/main.js:755 (resumeRun). Registries come
//   from the real content boot: src/content/index.js -> validateContent ->
//   createRegistries. NOTHING is handed to deserializeRun, migrateRunSchema,
//   normalizeRunAttributes, initializeRunDerivedStats or initializeRunFlaskCharges
//   directly — those are the stages under test, not the entry point.
//
// THE OLD-VOCABULARY SAVES ARE NOT HAND-TYPED, AND THEY LIVE IN ONE HOME.
// tests/fixtures/run-save-vigour-window.json is the frozen Vigour-window
// corpus — every entry the exact bytes some build's own saveRun wrote, with its
// ref and its reason in the file's own `_provenance` block. This tool reads
// three of its entries plus the older Constitution-era fixture 50c reads:
//   · constitutionEra   schemaVersion 2, dev = 5f58bca — the last tree before
//                       the rename.
//   · vigourEraNative   schemaVersion 3, a run CREATED at dev = d7d1920, the
//                       build every player was on the hour before #178 merged.
//   · vigourEraPlayed   schemaVersion 3, same build, a PLAYED herald: floor 4,
//                       a real act map, 137 cinders, a loseMaxHpPct curse, an HP
//                       deficit and a spent flask charge. A fresh save is the
//                       easy case; every value this one carries is one a player
//                       would notice losing. Added for this tool.
//   · tests/fixtures/run-save-constitution-acb8ffe.json — schemaVersion 2,
//     frozen at dev = acb8ffe; already in the tree, and 50c's.
// A substituted string ("constitution" -> "vigour") is a guess about what the
// old build wrote. These are what it wrote.
//
// AND THE DEAD NAME IN THAT FILE IS DELIBERATE — said in the file's own first
// key, and now PLANTED. The frozen entries spell `vigour` because the population
// they stand for spells `vigour`; a corpus normalized to the live name would
// pass every check below while proving nothing about the saves that actually
// exist on players' disks. The corpus carries that warning at its first key, and
// the warning's central promise — "each reader goes RED BY NAME if the
// vocabulary is modernised" — was true by reading and never once observed. The
// --selftest corpus now plants that exact tidy-up ("the frozen corpus is
// normalized to the live name"), so groupB's `mustContain` gate is watched
// rather than merely asserted. Plant added by Sten on Marina's order,
// 2026-08-16; the warning and the fixtures are Vira's. A purpose that lives only
// in prose is one refactor from gone.
//
// I BUILT THE SECOND COPY MYSELF AND THEN COLLAPSED IT. Branching off dev, I
// regenerated Vigour-era fixtures my own earlier session had already frozen and
// pushed at 9c83856 — one fact, two homes, nothing keeping them in sync, which
// is the defect this house exists to catch. That branch is merged in here and
// its file is the single home; my two loose fixtures are deleted, and the one
// artifact of mine that was genuinely new (the played herald) moved into it.
//
// WHAT RED MEANS HERE. Not "a number is wrong" — this tool holds no opinion
// about any number. It only says: THIS number is not the number that went in.
// Every failure names the field, the fixture, and both values.
//
// SELFTEST: `node tools/saveroundtrip.mjs --selftest` plants six known-bads
// into a COPY of the real tree via tools/doorplant.mjs and runs this whole file
// from that copy, so each plant enters as file bytes on the road the real input
// travels. Five break the door; the sixth breaks the corpus. Observed red
// 2026-08-15 at dev = 7e67de8 for the first five — see the log entry
// gamedesign/vira/log/2026/2026-08-15_the-save-that-came-back-whole.md — and
// 2026-08-16 at 7e968f2 for the corpus plant.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the run save stops
// being a persisted artifact — no bytes, no fixed point, no subject.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, RUN_SCHEMA_VERSION, RUN_SHAPE } from '../src/model/state.js';
import { createMemoryStorage, createSaveManager, RUN_KEY } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { equipPiece, stampDeck } from '../src/model/loadout.js';
import { buildActMap } from '../src/engine/actmap.js';
import { retiredAttributeNames } from '../src/content/retiredNames.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let checks = 0;
let failures = 0;
// The denominator this tool refuses to lie about: how many FIELDS were actually
// compared. `verify-shipped: OK — 0 checks passed` at exit 0 is the shape this
// counter exists to make impossible (SOP 2's ⚙ clause — prove the query had a
// referent). A green with a small field count is not a green.
let fieldsCompared = 0;

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
const short = (v, n = 120) => { const s = j(v); return s == null ? String(v) : (s.length > n ? `${s.slice(0, n)}…` : s); };

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------
function door() {
  console.log(`DOOR — where the known-bad and the real input both enter:
  Every save is BYTES under the real key '${RUN_KEY}' in a storage object with the
  browser's getItem/setItem/removeItem shape. Writes go through
  createSaveManager(storage).saveRun(run, rng, slot); reads through
  .loadRun(registries, slot). Those are the same two calls the game makes —
  src/main.js:579 persist(), src/main.js:755 resumeRun(). The registries are the
  real content boot (src/content/index.js -> validateContent -> createRegistries).
  Nothing in this file calls deserializeRun, migrateRunSchema,
  normalizeRunAttributes, initializeRunDerivedStats or initializeRunFlaskCharges:
  those are the stages under test, so handing them a fixture would exercise the
  half that was never in doubt (the instrument rule's same-door clause).
  The three legacy fixtures are not hand-typed — each is the exact output of an
  older build's own saveRun, frozen under tests/fixtures/.\n`);
}

// ---------------------------------------------------------------------------
// The cycle: bytes -> load -> bytes. The whole tool is this function.
// ---------------------------------------------------------------------------
/**
 * cycle(saves, storage) → { bytes, run } — one trip through the real door.
 * The rng is rebuilt from the run's own persisted seed and counters exactly as
 * resumeRun does, so the second write is what the game would actually write.
 */
function cycle(saves, storage, registries, slot = 1) {
  const run = saves.loadRun(registries, slot);
  if (!run) return { run: null, bytes: null };
  saves.saveRun(run, createRng(run.seed, run.streamCounters), slot);
  // Slot 1 keeps the legacy key; save.js owns that rule and this mirrors it
  // rather than reaching past the door for the bytes.
  return { run, bytes: storage.getItem(slot === 1 ? RUN_KEY : `${RUN_KEY}_s${slot}`) };
}

/** Compare two save payloads field by field, counting every field compared. */
function diffFields(before, after) {
  const a = JSON.parse(before);
  const b = JSON.parse(after);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const diffs = [];
  for (const k of keys) {
    fieldsCompared++;
    const av = j(a[k]);
    const bv = j(b[k]);
    if (av !== bv) diffs.push({ key: k, before: a[k], after: b[k], lost: !(k in b), gained: !(k in a) });
  }
  return { a, b, keys, diffs };
}

// ---------------------------------------------------------------------------
// Group A — forward then back, on saves THIS build writes
// ---------------------------------------------------------------------------
// Each case builds run state through the game's own paths (createRunState,
// executeRunEffects, equipPiece/stampDeck, buildActMap) and never by typing a
// run object, so what is saved is a save the game could actually have written.
function runStates(registries) {
  const cases = [];
  for (const cls of registries.classes.all()) {
    cases.push({
      name: `fresh ${cls.id} (empty edge: floor 0, act 1, full pools, nothing spent)`,
      build: () => createRunState({ seed: 0x7000 + cls.id.length, classId: cls.id, registries }),
    });
  }
  cases.push({
    name: 'cursed and hurt (permanent max-HP loss + an absolute HP deficit)',
    build: () => {
      const run = createRunState({ seed: 0xc022, classId: 'reaver', registries });
      run.hp = run.maxHp - 26;
      run.cinders = 137;
      executeRunEffects({ run, registries, rng: createRng(0xc022) }, [{ op: 'loseMaxHpPct', pct: 10 }]);
      return run;
    },
  });
  cases.push({
    name: 'armoured (a loadout change reconciled through equipPiece + stampDeck)',
    build: () => {
      const run = createRunState({ seed: 0xea11, classId: 'herald', registries });
      run.hp = run.maxHp - 7;
      const edited = structuredClone(run.loadout);
      equipPiece(registries, edited, 'armor', 0, 'pilgrim', { has: () => true },
        { inCombat: false, attributes: run.attributes });
      run.loadout = edited;
      stampDeck(registries, run);
      return run;
    },
  });
  cases.push({
    name: 'mid-climb (a real act map, a position on it, a history)',
    build: () => {
      const run = createRunState({ seed: 0x3311, classId: 'starseer', registries });
      const rng = createRng(run.seed);
      run.mapGraph = buildActMap(registries, rng, 1, null);
      run.floor = 4;
      run.mapNodeId = Object.keys(run.mapGraph.nodes)[3] || null;
      run.history = [{ nodeId: 'n0_0', kind: 'combat' }, { nodeId: 'n1_0', kind: 'event' }];
      return run;
    },
  });
  cases.push({
    name: 'max/overflow edge (HP at 0, every flask charge spent, a large purse)',
    build: () => {
      const run = createRunState({ seed: 0x9999, classId: 'reaver', registries });
      run.hp = 0;
      run.cinders = 999999;
      run.flaskCharges.hpCurrent = 0;
      run.flaskCharges.manaCurrent = 0;
      return run;
    },
  });
  cases.push({
    name: 'max/overflow edge (every flask charge full, deck stamped, act 3)',
    build: () => {
      const run = createRunState({ seed: 0x9998, classId: 'herald', registries });
      run.flaskCharges.hpCurrent = run.flaskCharges.hp;
      run.flaskCharges.manaCurrent = run.flaskCharges.mana;
      run.actNumber = 3;
      run.floor = 12;
      return run;
    },
  });
  return cases;
}

function groupA(registries) {
  for (const c of runStates(registries)) {
    check(`round trip is the identity — ${c.name}`, () => {
      const storage = createMemoryStorage();
      const saves = createSaveManager(storage);
      const run = c.build();
      saves.saveRun(run, createRng(run.seed), 1);
      const A = storage.getItem(RUN_KEY);
      assert(typeof A === 'string' && A.length > 500,
        `nothing was written to '${RUN_KEY}' — this case has no referent (got ${A === null ? 'null' : `${A.length} bytes`})`);

      const first = cycle(saves, storage, registries);
      assert(first.run, `the save this build just wrote was REFUSED by its own load door and archived`);
      const B = first.bytes;

      const { keys, diffs } = diffFields(A, B);
      assert(keys.length >= 20,
        `only ${keys.length} fields in the payload — a save this thin is not the artifact under test`);
      if (diffs.length) {
        const named = diffs.map((d) => `${d.key}: ${short(d.before, 90)} -> ${short(d.after, 90)}${d.lost ? ' (FIELD LOST)' : ''}${d.gained ? ' (FIELD INVENTED)' : ''}`);
        throw new Error(`the door changed ${diffs.length} field(s) on a save it had just written — ${named.join(' · ')}`);
      }
      assert(A === B, `fields all match but the bytes differ (${A.length} -> ${B.length}) — key ORDER moved, which a diff of values cannot see`);

      // A second lap. A door that settles on its second write rather than its
      // first is still not a fixed point, and one lap cannot tell the
      // difference: A -> B proves nothing if B -> C moves again.
      const second = cycle(saves, storage, registries);
      assert(second.run, 'the re-written save was refused on its second read');
      assert(second.bytes === B, `the SECOND lap moved (${B.length} -> ${second.bytes.length} bytes) — the door settles late, it does not hold still`);
      return `${keys.length} fields, byte-identical over two laps, ${A.length} bytes`;
    });
  }
}

// ---------------------------------------------------------------------------
// Group B — forward from an older build's own bytes
// ---------------------------------------------------------------------------
// Every fixture is real output of an older saveRun. The claim is NOT "nothing
// changed" — a migration is supposed to change things. It is: every change is
// EXPLAINED, every player-owned value survives, and nothing vanishes.

// The closed set of changes a migration is authorised to make, each with the
// reason it is allowed. A change to any key not on this list is RED — not
// because the change is necessarily wrong, but because an unexplained change to
// a persisted save is exactly the event this tool exists to surface.
const EXPLAINED_CHANGES = {
  schemaVersion: 'migrateRunSchema stamps the current RUN_SCHEMA_VERSION',
  contentVersion: 'loadRun re-stamps contentVersion once every id still resolves',
  attributes: 'migrateRetiredAttributeNames renames the retired seat to its heir (values checked separately)',
  derivedStatRuleSnapshot: 'initializeRunDerivedStats re-resolves the host rules at the current rulesetVersion',
  equipmentProfileRuleSnapshot: 'restoreEquipmentProfileRuleSnapshot re-resolves the equipment profile rules',
  flaskCharges: 'initializeRunFlaskCharges attributes the pre-ledger capacity once (base/granted) — currents checked separately',
  maxHpAdjustment: 'the v3-and-older permanent max-HP residual is inferred once (checked separately)',
  damageBySchoolAdd: 'the host relic snapshot stamps the damage-school ledger absent before D22',
  streamCounters: 'saveRun re-stamps the RNG stream counters from the live rng',
  deck: 'stampDeck re-stamps carrier fields on a pre-carrier deck (ids checked separately)',
  loadout: 'a pre-equipment save is healed with the class starting loadout',
  hp: 'pools are re-derived under the current rules; the ABSOLUTE deficit is checked separately',
  maxHp: 'pools are re-derived under the current rules; the ABSOLUTE deficit is checked separately',
  mana: 'pools are re-derived under the current rules',
  maxMana: 'pools are re-derived under the current rules',
  stamina: 'pools are re-derived under the current rules',
  maxStamina: 'pools are re-derived under the current rules',
  energyMax: 'pools are re-derived under the current rules',
  drawPerTurn: 'pools are re-derived under the current rules',
};

// `entry` names a key inside the Vigour-window corpus; its absence selects the
// whole file. Either way what reaches the door below is a STRING of save bytes.
const WINDOW = 'tests/fixtures/run-save-vigour-window.json';
const FIXTURES = [
  {
    file: 'tests/fixtures/run-save-constitution-acb8ffe.json',
    label: 'constitution-era, schemaVersion 2 (dev = acb8ffe)',
    mustContain: ['"constitution"', '"schemaVersion":2'],
    retiredNamePresent: false,
  },
  {
    file: WINDOW, entry: 'constitutionEra',
    label: 'constitution-era, schemaVersion 2 (dev = 5f58bca — the last tree before the rename)',
    mustContain: ['"constitution"', '"schemaVersion":2'],
    retiredNamePresent: false,
  },
  {
    file: WINDOW, entry: 'vigourEraNative',
    label: "vigour-era, schemaVersion 3, run created at dev = d7d1920 (dev's own parent)",
    mustContain: ['"vigour"', '"schemaVersion":3'],
    retiredNamePresent: true,
  },
  {
    file: WINDOW, entry: 'vigourEraPlayed',
    label: 'vigour-era, schemaVersion 3, PLAYED herald: floor 4, curse, deficit, spent flask',
    mustContain: ['"vigour"', '"schemaVersion":3', '"cinders":137'],
    retiredNamePresent: true,
  },
];

/** Read a fixture's save BYTES — the string the door takes — from either shape. */
function fixtureBytes(fx) {
  const path = resolve(ROOT, fx.file);
  assert(existsSync(path), `fixture missing: ${fx.file} — an absent corpus is a check that silently stopped running`);
  const raw = readFileSync(path, 'utf8');
  if (!fx.entry) return raw;
  const corpus = JSON.parse(raw);
  assert(Object.hasOwn(corpus, fx.entry),
    `${fx.file} has no entry '${fx.entry}' — the corpus was renamed out from under this check, which is how one silently stops running`);
  return JSON.stringify(corpus[fx.entry]);
}

// The player-owned values a migration may never move. Each is read off the OLD
// bytes and demanded of the loaded run — no expected literals, so the check
// cannot drift away from the fixture it is reading.
function assertPlayerValuesSurvive(old, run, retired) {
  const problems = [];
  const same = (key, oldValue, newValue) => {
    fieldsCompared++;
    if (j(oldValue) !== j(newValue)) problems.push(`${key}: ${short(oldValue, 80)} -> ${short(newValue, 80)}`);
  };

  // Identity and position — nothing here is derived from anything.
  for (const k of ['seed', 'seedString', 'class', 'startingKitId', 'startingKitSnapshot',
    'attributeMode', 'floor', 'actNumber', 'mapNodeId', 'cinders', 'history', 'modifiers',
    'relics', 'flasks', 'combatEntered']) {
    if (Object.hasOwn(old, k)) same(k, old[k], run[k]);
  }

  // The allocation, mapped through the retired-name table. This is the CON
  // question in its general form: the POINTS are the player's, whatever the
  // seat is called this week.
  const oldAttrs = old.attributes || {};
  for (const [id, value] of Object.entries(oldAttrs)) {
    const heir = Object.hasOwn(retired, id) ? retired[id] : id;
    fieldsCompared++;
    if (!Object.hasOwn(run.attributes || {}, heir)) {
      problems.push(`attributes.${id}${heir === id ? '' : ` (heir '${heir}')`}: present in the old save, ABSENT after the load`);
    } else if (run.attributes[heir] !== value) {
      problems.push(`attributes.${id}${heir === id ? '' : ` -> ${heir}`}: ${value} -> ${run.attributes[heir]} — the points moved`);
    }
  }
  fieldsCompared++;
  if (Object.keys(oldAttrs).length !== Object.keys(run.attributes || {}).length) {
    problems.push(`the allocation changed size: ${Object.keys(oldAttrs).length} -> ${Object.keys(run.attributes || {}).length}`);
  }

  // The deck: identity of every card instance. Carrier fields may be re-stamped
  // (stampDeck); which cards the player owns may not change.
  const oldDeck = Array.isArray(old.deck) ? old.deck : [];
  const newDeck = Array.isArray(run.deck) ? run.deck : [];
  fieldsCompared++;
  if (oldDeck.length !== newDeck.length) problems.push(`deck length ${oldDeck.length} -> ${newDeck.length}`);
  else {
    for (let i = 0; i < oldDeck.length; i++) {
      fieldsCompared++;
      const o = oldDeck[i]; const n = newDeck[i];
      if (o.instanceId !== n.instanceId || o.cardId !== n.cardId || !!o.upgraded !== !!n.upgraded) {
        problems.push(`deck[${i}]: ${o.instanceId}/${o.cardId}/${!!o.upgraded} -> ${n.instanceId}/${n.cardId}/${!!n.upgraded}`);
      }
    }
  }

  // Flask charges the player has SPENT. The capacity ledger is allowed to be
  // attributed on the way in (base/granted); what is left in the vessel is not.
  if (old.flaskCharges) {
    for (const k of ['capacity', 'hp', 'mana', 'hpCurrent', 'manaCurrent']) {
      fieldsCompared++;
      if (old.flaskCharges[k] !== (run.flaskCharges || {})[k]) {
        problems.push(`flaskCharges.${k}: ${old.flaskCharges[k]} -> ${(run.flaskCharges || {})[k]}`);
      }
    }
  }

  // The wound. Pools are re-derived; the ABSOLUTE deficit is the player's, and
  // save.js says so in its own comment (preserveDeficits). A door that heals a
  // legacy run to full is the friendliest possible way to lose a climb.
  if (Number.isFinite(old.hp) && Number.isFinite(old.maxHp)) {
    fieldsCompared++;
    const before = old.maxHp - old.hp;
    const after = run.maxHp - run.hp;
    if (before !== after) problems.push(`the HP deficit changed: ${old.hp}/${old.maxHp} (down ${before}) -> ${run.hp}/${run.maxHp} (down ${after})`);
  }
  return problems;
}

function groupB(registries) {
  const retired = retiredAttributeNames || {};
  const deadNames = Object.keys(retired);

  for (const fx of FIXTURES) {
    check(`an older build's own save comes forward whole — ${fx.label}`, () => {
      const bytes = fixtureBytes(fx);
      // Prove the probe has a referent before trusting anything it says: a
      // fixture that no longer carries the old vocabulary would pass every
      // assertion below while testing nothing (SOP 2's ⚙ clause).
      for (const needle of fx.mustContain) {
        assert(bytes.includes(needle), `fixture ${fx.file} no longer contains ${needle} — it has stopped being the artifact this check reads`);
      }
      if (fx.retiredNamePresent) {
        assert(deadNames.some((d) => bytes.includes(`"${d}"`)),
          `fixture ${fx.file} carries no retired attribute name, so the rename path is not exercised by it`);
      }

      const old = JSON.parse(bytes);
      const storage = createMemoryStorage();
      const saves = createSaveManager(storage);
      storage.setItem(RUN_KEY, bytes);

      const run = saves.loadRun(registries, 1);
      assert(run, `the save was REFUSED and archived — an older build's run did not come forward at all`);

      // 1. Nothing vanishes.
      saves.saveRun(run, createRng(run.seed, run.streamCounters), 1);
      const A = storage.getItem(RUN_KEY);
      const forward = JSON.parse(A);
      const lost = Object.keys(old).filter((k) => !(k in forward));
      assert(lost.length === 0, `field(s) present in the old save and GONE after the migration: ${lost.join(', ')}`);

      // 2. Every change is explained.
      const unexplained = [];
      for (const k of Object.keys(old)) {
        fieldsCompared++;
        if (j(old[k]) === j(forward[k])) continue;
        if (!Object.hasOwn(EXPLAINED_CHANGES, k)) {
          unexplained.push(`${k}: ${short(old[k], 80)} -> ${short(forward[k], 80)}`);
        }
      }
      for (const k of Object.keys(forward)) {
        if (k in old) continue;
        fieldsCompared++;
        if (!Object.hasOwn(EXPLAINED_CHANGES, k)) unexplained.push(`${k}: (absent) -> ${short(forward[k], 80)} — a field INVENTED with no registered reason`);
      }
      assert(unexplained.length === 0,
        `the migration changed ${unexplained.length} field(s) with no registered explanation: ${unexplained.join(' · ')}`);

      // 3. Every player-owned value survives.
      const problems = assertPlayerValuesSurvive(old, run, retired);
      assert(problems.length === 0, `${problems.length} player-owned value(s) moved: ${problems.join(' · ')}`);

      // 4. Zero dead bytes forward. The heir must be spelled, the dead name
      //    must not survive anywhere in the re-serialized save.
      for (const dead of deadNames) {
        assert(!A.includes(`"${dead}"`), `the retired name '${dead}' survives in the re-saved bytes`);
      }

      // 5. And the migrated save is itself a fixed point.
      const second = cycle(saves, storage, registries);
      assert(second.run, 'the migrated save was refused on its own next read');
      assert(second.bytes === A,
        `a migrated save is not stable: the lap after the migration moved ${A.length} -> ${second.bytes.length} bytes`);

      const changed = Object.keys(old).filter((k) => j(old[k]) !== j(forward[k]));
      const gained = Object.keys(forward).filter((k) => !(k in old));
      return `v${old.schemaVersion} -> v${RUN_SCHEMA_VERSION}; ${changed.length} explained change(s) [${changed.join(',')}], ${gained.length} field(s) added [${gained.join(',') || '—'}], 0 lost, stable thereafter`;
    });
  }
}

// ---------------------------------------------------------------------------
// Boundary
// ---------------------------------------------------------------------------
function boundary(registries) {
  console.log(`
BOUNDARY — what this green does NOT cover.

  · IT MEASURES THE RUN SAVE ONLY. The durable PROFILE (sote_meta_v1), its
    backup mirror, and the archive drawer are a different artifact with a
    different schema (META_SCHEMA_VERSION) and a different set of failure
    modes; tools/profile-durability-probe.mjs is their instrument, not this one.
  · IT NEVER OPENS A BROWSER. Every save here lives in an in-memory storage
    stub with localStorage's shape. A quota refusal, a killed tab mid-write, or
    a browser that stringifies differently is untouched by this green.
  · ONE PLATFORM, ONE RUNTIME. Node ${process.version} on ${process.platform}.
    JSON key order is an implementation property; a runtime that ordered object
    keys differently would fail the byte comparison for a reason that is not a
    defect. It has been observed identical here and nowhere else.
  · THREE OLDER BUILDS, NOT ALL OF THEM. Fixtures exist for schemaVersion 2
    (constitution) and 3 (vigour). schemaVersion 1 is still ACCEPTED by
    migrateRunSchema and NO fixture in this tree was written by a v1 build —
    that path is 'unknown', not green, and aging will not fix it.
  · IT ASKS WHETHER A SAVE SURVIVES THE DOOR, NEVER WHETHER THE NUMBERS ARE
    RIGHT. If D22 derives the wrong HP, this tool is silent: it only reports
    that whatever went in came back. tools/conhp.mjs holds the formula.

FINDING CARRIED, NOT ASSERTED — and it is here because it is one design call
away from being this tool's business.

  Three fields are optional in RUN_SHAPE with NO schemaVersion gate, so the
  migration heals meant for old saves also fire on a CURRENT-schema (v${RUN_SCHEMA_VERSION}) save:

    attributes / attributeMode  ->  refilled from the class preset
                                    (src/model/attributes.js normalizeRunAttributes)
    loadout                     ->  refilled with the class starting loadout
                                    (src/engine/save.js loadRun)
    flaskCharges                ->  rebuilt, every spent charge reset
                                    (src/model/state.js initializeRunFlaskCharges)

  Repro — a v${RUN_SCHEMA_VERSION} save with its allocation deleted, loaded through the same door
  as everything above. It returns a run with the class preset and says nothing.
  Copy this whole block into a shell at the repo root:

    node --input-type=module -e "
    import { contentBundle } from './src/content/index.js';
    import { createRegistries } from './src/model/registries.js';
    import { createRunState } from './src/model/state.js';
    import { createMemoryStorage, createSaveManager, RUN_KEY } from './src/engine/save.js';
    const REG = createRegistries(contentBundle);
    const st = createMemoryStorage(), saves = createSaveManager(st);
    saves.saveRun(createRunState({ seed: 7, classId: 'reaver', registries: REG }), null, 1);
    const o = JSON.parse(st.getItem(RUN_KEY));
    delete o.attributes; delete o.attributeMode;
    st.setItem(RUN_KEY, JSON.stringify(o));
    console.log('loaded:', JSON.stringify(saves.loadRun(REG, 1).attributes));
    "

  Observed 2026-08-15 at dev = 7e67de8:
    loaded: {"strength":13,"dexterity":10,"constitution":12,"wisdom":10,"intelligence":10}
  — the reaver preset, handed back for an allocation that was not in the file.

  By the module's own contract that would be refused by name (save.js: bad
  saves are ARCHIVED, never silently replaced; Law 1 clause 5). THIS TOOL DOES
  NOT ASSERT IT, and the reason is not squeamishness: tests/engine.test.js 28
  and 50 currently assert the OPPOSITE — 28 deletes 'loadout' from a
  current-schema run and requires it to heal. Two shipped tests encode the
  present behaviour as intended, so whether a v${RUN_SCHEMA_VERSION} save missing a field should heal
  or refuse is a DESIGN CALL, and it is not an instrument's to make. Gating
  those three fields on schemaVersion 1 (the gate startingKitId already uses)
  turns tests 28 and 50 red — measured 2026-08-15 at dev = 7e67de8.

  WAKE CONDITION (an observable predicate, not a mood): the day tests 28 and 50
  stop requiring a current-schema save to heal, this paragraph is DELETED and
  the assertion moves into Group B — an excuse that outlives its defect is how
  a suite goes green over a bug (Law 5's enforcement note).
`);
}

// ---------------------------------------------------------------------------
// Selftest — six known-bads, each entering as file bytes in a copied tree.
// Five break the DOOR (src/); the sixth breaks the EVIDENCE (the corpus),
// which was the one input none of the others could see.
// ---------------------------------------------------------------------------
async function selftest() {
  const { doorSelftest } = await import('./doorplant.mjs');
  return doorSelftest({
    tool: 'saveroundtrip.mjs',
    // tests/ carries the three frozen legacy fixtures; without it the copied
    // tree has no Group B corpus and every plant would "pass" for the wrong
    // reason — a fixture that silently stops being read is the defect.
    extraCopy: ['tests'],
    timeoutMs: 180000,
    plants: [
      {
        // THE ONE THIS TOOL EXISTS FOR (Law 1 clause 5): the retired seat's
        // points land in the wrong seat. Deliberately a SWAP and not a constant:
        // a constant fails the fixedTotal allocation rule and is refused by name
        // three lines later, which is the tree defending itself, not this tool
        // catching anything — the plant would go red for a reason that is not
        // the reason claimed, and a red for the wrong reason is not a catch.
        // A swap keeps the total legal, keeps every name live, crashes nothing,
        // and produces a run that is perfectly consistent with itself. Only the
        // OLD BYTES know, which is the entire thesis of this file.
        name: "the retired seat's points land in another seat — total still legal, nothing crashes",
        file: 'src/model/attributes.js',
        find: '      run.attributes[heir] = run.attributes[dead];',
        replace: '      run.attributes[heir] = run.attributes.strength;\n      run.attributes.strength = run.attributes[dead];',
        expectRed: /the points moved/,
      },
      {
        // A field quietly dropped on the way through the door.
        name: "the load door drops the run's history",
        file: 'src/engine/save.js',
        find: '      delete run.migratedFromRunSchemaVersion;',
        replace: '      delete run.migratedFromRunSchemaVersion;\n      delete run.history;',
        expectRed: /history/,
      },
      {
        // A legacy wound healed on the way forward — the friendliest loss there is.
        name: 'a legacy HP deficit is healed to full at the load door',
        file: 'src/engine/save.js',
        find: 'initializeRunDerivedStats(run, registries, { preserveDeficits: true });',
        replace: 'initializeRunDerivedStats(run, registries, { preserveDeficits: false });',
        expectRed: /HP deficit changed|player-owned value\(s\) moved/,
      },
      {
        // The retired-name table emptied: the old build's save stops resolving.
        name: 'the retired-name map is emptied, so a vigour-era save no longer heals',
        file: 'src/content/retiredNames.js',
        find: "  vigour: 'constitution',",
        replace: '',
        expectRed: /REFUSED and archived|carries no retired attribute name|retired/,
      },
      {
        // Spent charges quietly refilled — a value the player would notice, in
        // a field no formula check reads.
        name: 'spent flask charges are quietly refilled on load',
        file: 'src/model/state.js',
        find: '  syncFlaskGrowth(registries, run);\n  return run.flaskCharges;',
        replace: '  syncFlaskGrowth(registries, run);\n  run.flaskCharges.hpCurrent = run.flaskCharges.hp;\n  return run.flaskCharges;',
        expectRed: /flaskCharges\.hpCurrent|the door changed/,
      },
      {
        // THE PLANT THAT IS NOT IN src/ — the CORPUS is the input here, and it
        // was the one input nobody armed. Every plant above breaks the door;
        // this one breaks the evidence.
        //
        // The predicted edit, and it is a helpful one: someone tidying the tree
        // sees a fixture full of a name this game retired, runs the obvious
        // find-and-replace, and every check that reads it stays green — while
        // measuring a save that spells the CURRENT name, which proves nothing
        // about the population this corpus exists for. The frozen bytes are
        // Vigour-era ON PURPOSE, and purpose that only lives in a commit
        // message is one refactor from gone.
        //
        // Marina ordered the warning written at the corpus rather than in a
        // log (2026-08-16). It is the first key of the fixture, where a person
        // editing those bytes reads it before anything else. This plant is what
        // makes it more than a note: the guard that enforces it is now watched.
        name: 'the frozen corpus is normalized to the live name',
        file: 'tests/fixtures/run-save-vigour-window.json',
        find: '"vigour"',
        replace: '"constitution"',
        all: true, // it appears in three entries; half a rename is a false green
        expectRed: /no longer contains "vigour"/,
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

console.log(`saveroundtrip — is a save a fixed point of the save door? (run schema v${RUN_SCHEMA_VERSION})\n`);
door();

const content = validateContent(contentBundle);
check('the real content boot is green, so every registry below is the shipped one', () => {
  assert(content.ok, `validateContent refused the shipped bundle: ${j(content.errors).slice(0, 300)}`);
  return `contentVersion ${contentBundle.version ?? '(unversioned)'}, ${RUN_SHAPE.length} declared save fields`;
});
if (!content.ok) {
  console.log('\nsaveroundtrip: content boot is red — no save question can be asked of a tree that will not boot.');
  process.exit(2);
}
const REGISTRIES = createRegistries(contentBundle);

console.log('\n-- A. forward then back, on saves this build writes --');
groupA(REGISTRIES);

console.log("\n-- B. forward from an older build's own bytes --");
groupB(REGISTRIES);

boundary(REGISTRIES);

// The floor on this tool's own denominator. A run that compared a handful of
// fields and printed PASS would be the eleven-instruments shape; the number is
// in the output so a reader can see it shrink.
const FIELD_FLOOR = 400;
console.log(`${checks - failures}/${checks} checks passed · ${fieldsCompared} save fields compared`);
if (fieldsCompared < FIELD_FLOOR) {
  console.log(`saveroundtrip: RED — only ${fieldsCompared} fields compared (floor ${FIELD_FLOOR}). A green over an empty comparison is not a green.`);
  process.exit(1);
}
if (failures) process.exit(1);
