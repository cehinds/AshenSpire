#!/usr/bin/env node
// tools/statusreach.mjs — CAN A PLAYER EVER MEET THIS STATUS?
//
// Every row in content/statuses.js is applied by something a player can
// actually encounter, or this goes red and names the row.
//
// Rune, 2026-08-08. Law 1 clause 1 says adding content never touches code —
// a status is a row. This is that clause's FALSIFIER, and its absence is why
// the following shipped and stayed shipped:
//
//   `frost`     threshold 10, burst 8% of max HP, leaves Weak + Frost-Exposed,
//               its own resist row, its own SFX row (procBurst_frost).
//   `insanity`  threshold 14, the biggest burst, +8 Poise, a GUARANTEED
//               Stagger, its own exposure row, its own SFX row.
//
//   Appliers, across all of src/content, at dev = cd3da94:  ZERO. Both.
//
// Everything downstream of them was built and tested — the engine procs them
// (tests 7b, 7c, 7e, 7g), the validator rules on every knob (7f), Vega wrote
// them each a burst sound (#66) — and the card named FROST NOVA applied `weak`
// and `vulnerable`. Bleed was applied 21 times. Nobody noticed, for the same
// reason nobody notices any of these: every instrument downstream was green,
// because every instrument downstream tested the row and not the WAY IN.
//
// ---------------------------------------------------------------------------
// THE TRAP THIS FILE IS BUILT AROUND, and it is not hypothetical: the audit
// that found the defect used `/applyStatus[^}]*status:'frost'/` over src/content
// and the first hit it reported was a `resists:` declaration — a row that
// REDUCES incoming frost, matched as if it produced some. A grep cannot tell a
// READER of a status from an APPLIER of one, and that difference is the entire
// question. So nothing here is a text scan. This walks the loaded content
// graph and counts one shape only:
//
//     { op: 'applyStatus', status: '<id>' }
//
// and NOT, deliberately, each of these — every one of which mentions a status
// id and none of which applies it:
//
//     resists: { status }                   bleedResist RESISTS bleed
//     taggedVulnerability: { tags }         a damage multiplier, not a source
//     { p: 'hasStatus', status }            a predicate READS it
//     { p: 'eventStatusIs', status }        a predicate READS it
//     { f: 'stacks', status }               a formula READS it
//     { op: 'removeStatus', status }        the opposite of an applier
//     an equipMods ROW                      the VOCABULARY, not a use of it
//
// The last one is why `bundle.equipment` is never walked generically: its rows
// literally carry `op: 'applyStatus'` in a COLUMN, so a blind walk would count
// the dictionary as a sentence and hand every mod-able status a free green.
// Equipment gets route R4 below instead, which needs BOTH halves.
//
// ---------------------------------------------------------------------------
// THE ROUTES, ENUMERATED FROM THE ENGINE, because a reach model that guesses is
// a reach model that reports a plausible number:
//
//   R1  content   an `applyStatus` op inside a non-status content entry:
//                 cards (base AND upgrade), relics, enemies, events, flasks,
//                 stances, classes, and `balance` (balance.poise.onFill is
//                 where `staggered` is applied — engine/combat.js consults it
//                 and never names the status).
//   R2  status    an `applyStatus` op inside a REACHED status's own hooks[].do
//                 or proc.effects. Transitive: frostExposed is reachable
//                 because frost is, and stops being reachable the day frost
//                 does. (engine/statuses.js checkProcFill)
//   R3  resist    proc.resistance.status of a REACHED proc status — enqueued
//                 by the engine, not by content (engine/statuses.js:142).
//   R4  equip     an equipMods row whose `apply` is `status`/`startStatus`,
//                 AND at least one armament or armour row whose `mods` names
//                 that field. BOTH halves, or it is vocabulary nobody speaks.
//                 (model/loadout.js applyCardMods / runMods)
//   R5  code      a CLOSED, DECLARED list of appliers that live in code rather
//                 than content. Today it has exactly one member and that is
//                 itself a finding, stated below.
//
// R5 IS THE WEAKEST EDGE IN THIS FILE AND IT IS A SUBSTRING MATCH — the same
// technique this file's own header calls a trap. It is admissible only because
// it is CLOSED (one entry), RATCHETED (a declared needle that has vanished is
// a FAILURE, never a silent drop back to red), and because the alternative is
// worse: `glassCannon` would sit red forever for a reason that is not the class
// this check exists to catch, and "the first person to see a check permanently
// red turns it off."
//
// THE FINDING R5 RECORDS, not fixed here because it is not content:
// src/main.js:1101 does `if (mods.glassCannon) playerStatuses.push({ status:
// 'glassCannon', stacks: 1 })`. The Custom Climb mod IDs are data
// (content/customMods.js); the mapping from id to status is code. A fourth
// chaos mod granting a status is an engine edit today. That is Law 1 clause 1's
// business, and it is one line to fix by moving the status onto the mod row —
// on the day someone owns that call.
//
// ---------------------------------------------------------------------------
// THE FLOORS — because an empty population is how a dead instrument prints a
// plausible number (`verify-shipped: OK — 0 checks passed`, and eleven more in
// one session). Each one exits non-zero; none of them is a softer bucket than
// red (SOP 2's silence guard):
//
//   F1  zero statuses in the bundle                -> the population is gone
//   F2  a NAMED source set is empty                -> the walk went blind
//   F3  zero appliers found anywhere               -> the matcher stopped matching
//   F4  a declared R5 needle is no longer in its file
//
// F3 is the one that matters most and it is cheap: one edit to the shape this
// file matches on turns "43 statuses, 43 reached" into "43 statuses, 43
// UNREACHED" — loud — but one edit to the SOURCE SETS turns it into a green
// over nothing. F2 is what stops that.
//
// ---------------------------------------------------------------------------
// KNOWN-BAD FIRST, AND THE PLANT ENTERS BY THE DOOR THE REAL INPUT ENTERS
// (development.md, The instrument rule). The house's base rate this session:
// eleven instruments ran dead and printed a plausible number, and every failed
// plant entered downstream of the defect it was meant to catch. So:
//
//   this check reads the STATUS TABLE          -> the plant is a table row
//   this check reads CONTENT FILES             -> the plant is a content file
//
// OBSERVED RED, on the real tree, by editing the real files (see --selftest for
// the in-memory equivalents; all four below were watched at
// dev = cd3da94 + tools/axisfit.mjs, 2026-08-08, node v22, one Linux box):
//
//   1. THE DEFECT, with no plant at all — `node tools/statusreach.mjs` on the
//      unmodified content of dev = cd3da94:
//        FAIL — 6 of 43 shipped statuses have no applier: frost, insanity,
//        frostResist, insanityResist, frostExposed, insanityExposed
//        exit 1
//      Six, not two: the two proc rows took their resist rows and their
//      exposure rows down with them, which is R2/R3 being transitive and is
//      the honest size of the hole.
//   2. A new row `plantedRimeAsh` appended to src/content/statuses.js — the
//      population's own door:
//        FAIL — 7 of 44 … plantedRimeAsh, exit 1.
//   3. `strike.burn=+2` deleted from `torch` (and `gorefireBrand`) in
//      content/source/weapons.csv, recompiled — R4's door:
//        FAIL — 7 of 43 … burn, exit 1. The mod field still exists; nothing
//        wields it; that is not reach.
//   4. All 25 `{op:'applyStatus', … status:'bleed'}` lines deleted from the
//      nine real content files, plus the katana's `strike.bleed=+2`:
//        FAIL — 8 of 43 … bleed, bleedResist, exit 1. bleedResist fell WITH
//        it: a resist row for a status nobody applies is just as unreachable.
//      (21 was the number in the audit; 25 is what the tree actually holds,
//      counted by the deletion. The audit's regex was per-line and missed the
//      status-hook and flask ones — which is the same blind spot again.)
//
// Usage
//   node tools/statusreach.mjs             the shipped bundle
//   node tools/statusreach.mjs --json      machine-readable
//   node tools/statusreach.mjs --selftest  plant all eight mechanisms
//
// Exit codes
//   0  every shipped status has a way in
//   1  a status no player can reach  (EXPECTED on dev at cd3da94)
//   2  a floor fired — the population or the walk went empty. NEVER a pass.
//
// REMOVAL CONDITION (SOP 1's corollary): delete this file the day the status
// table is generated FROM the appliers rather than authored beside them —
// then an unreachable row cannot be written and this has no subject. It is
// WRONG, and rewritten rather than deleted, the first time a status this file
// calls reached turns out to be unreachable in play: reachability of the
// APPLIER is what a player meets, and this checks that the applier exists, not
// that a run can ever draw it.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// R5 — the closed, declared list of code-side appliers. Adding to this list is
// how you ADMIT a Law 1 clause 1 breach rather than hide one, so keep it short
// and keep the reason in the row.
export const CODE_APPLIERS = [
  {
    status: 'glassCannon',
    file: 'src/main.js',
    needle: `playerStatuses.push({ status: 'glassCannon'`,
    why: 'Custom Climb chaos mod: the mod id is data, the status it grants is code',
  },
];

// The op that applies a status. One string, in one place, on purpose — this is
// the shape the whole check turns on.
const APPLY_OP = 'applyStatus';

/** Every { op:'applyStatus', status } in a value, and NOTHING that merely names one. */
function appliersIn(node, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) appliersIn(n, out);
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  if (node.op === APPLY_OP && typeof node.status === 'string') out.push(node.status);
  for (const v of Object.values(node)) appliersIn(v, out);
  return out;
}

/**
 * statusReach(bundle) → the whole verdict, as data.
 *
 * ONE function, called by main() AND by --selftest AND by the test suite, so a
 * plant cannot pass against a re-stated mechanism while the real run is red
 * (Vira's floorVerdict discipline on tools/axisfit.mjs — the two population
 * selftests there re-stated their mechanism instead of calling it, and could
 * have drifted green while main() was red).
 */
export function statusReach(bundle, opts = {}) {
  const readFile = opts.readFile || ((rel) => readFileSync(resolve(ROOT, rel), 'utf8'));
  const floors = [];
  const witness = new Map(); // statusId -> [ 'R1 card:frostNova', ... ]
  const note = (id, where) => {
    if (!witness.has(id)) witness.set(id, []);
    witness.get(id).push(where);
  };

  // ---- the POPULATION, and F1 ---------------------------------------------
  const statuses = Array.isArray(bundle.statuses) ? bundle.statuses : [];
  const ids = statuses.map((s) => s && s.id).filter((s) => typeof s === 'string');
  if (ids.length === 0) {
    floors.push('F1  the status table is EMPTY — there is no population to rule on, so this run judged nothing');
  }
  const byId = new Map(statuses.filter((s) => s && s.id).map((s) => [s.id, s]));

  // ---- R1: the named source sets, and F2 ----------------------------------
  // Named, not derived by walking the bundle: `bundle.equipment` must NOT be
  // walked (its rows carry op:'applyStatus' as data) and `bundle.statuses`
  // must not either (that is R2, and it is gated on reach). A named set is
  // also the only kind a floor can count.
  const SOURCE_SETS = [
    ['cards', bundle.cards],
    ['relics', bundle.relics],
    ['enemies', bundle.enemies],
    ['events', bundle.events],
    ['flasks', bundle.flasks],
    ['stances', bundle.stances],
    ['classes', bundle.classes],
    ['balance', bundle.balance ? [bundle.balance] : []],
  ];
  for (const [name, set] of SOURCE_SETS) {
    const rows = Array.isArray(set) ? set : [];
    if (rows.length === 0) {
      floors.push(`F2  source set '${name}' is EMPTY — the walk went blind on it, and a blind walk reports 'no appliers' exactly like a real absence`);
      continue;
    }
    for (const row of rows) {
      const where = `${name}:${(row && row.id) || '(row)'}`;
      for (const id of appliersIn(row)) note(id, `R1 ${where}`);
    }
  }

  // ---- R4: equipment needs BOTH halves ------------------------------------
  const eq = bundle.equipment || {};
  const modFields = eq.modFields || {};
  const pieces = [...(eq.armaments || []), ...(eq.armour || [])];
  const fieldsUsed = new Map(); // field -> [piece ids]
  for (const p of pieces) {
    for (const raw of p.mods || []) {
      const field = String(raw).split('=')[0].split('.').pop();
      if (!fieldsUsed.has(field)) fieldsUsed.set(field, []);
      fieldsUsed.get(field).push(p.id);
    }
  }
  for (const [field, spec] of Object.entries(modFields)) {
    if (!spec || (spec.apply !== 'status' && spec.apply !== 'startStatus')) continue;
    if (typeof spec.status !== 'string' || !spec.status) continue;
    const users = fieldsUsed.get(field) || [];
    if (users.length === 0) continue; // vocabulary nobody speaks — NOT reach
    note(spec.status, `R4 equipMods:${field} via ${users.slice(0, 3).join(', ')}`);
  }

  // ---- R5: code-side, closed and ratcheted (F4) ---------------------------
  for (const c of CODE_APPLIERS) {
    let src = null;
    try {
      src = readFile(c.file);
    } catch (e) {
      floors.push(`F4  declared code applier for '${c.status}': ${c.file} could not be read (${e.code || e.message})`);
      continue;
    }
    if (!src.includes(c.needle)) {
      floors.push(
        `F4  declared code applier for '${c.status}' is GONE from ${c.file} — the needle `
        + `\`${c.needle}\` no longer appears. Either the status moved to content (delete the `
        + `CODE_APPLIERS row and let R1 find it) or it lost its only applier. Both need a person.`,
      );
      continue;
    }
    note(c.status, `R5 code ${c.file} — ${c.why}`);
  }

  // ---- F3: the matcher itself -----------------------------------------------
  if (witness.size === 0 && ids.length > 0) {
    floors.push('F3  ZERO appliers found in the whole bundle — the matcher stopped matching. 43 statuses cannot all be unreachable; this is the instrument, not the content');
  }

  // ---- R2 + R3: transitive closure through REACHED statuses ----------------
  const reached = new Set([...witness.keys()].filter((id) => byId.has(id)));
  for (let grew = true; grew;) {
    grew = false;
    for (const id of [...reached]) {
      const def = byId.get(id);
      if (!def) continue;
      const downstream = [
        ...appliersIn(def.hooks).map((s) => [s, `R2 via ${id}.hooks`]),
        ...appliersIn(def.proc && def.proc.effects).map((s) => [s, `R2 via ${id}.proc.effects`]),
      ];
      if (def.proc && def.proc.resistance && typeof def.proc.resistance.status === 'string') {
        downstream.push([def.proc.resistance.status, `R3 via ${id}.proc.resistance`]);
      }
      for (const [s, where] of downstream) {
        note(s, where);
        if (byId.has(s) && !reached.has(s)) {
          reached.add(s);
          grew = true;
        }
      }
    }
  }

  // ---- the verdict ---------------------------------------------------------
  const unreached = ids.filter((id) => !reached.has(id));
  // An applier pointing at a status id that does not exist is a different
  // defect (the validator's), but silence about it here would be dishonest.
  const dangling = [...witness.keys()].filter((id) => !byId.has(id));

  return {
    total: ids.length,
    reached: [...reached].sort(),
    unreached,
    dangling,
    witness,
    floors,
    verdict: floors.length ? 'FLOOR' : unreached.length ? 'FAIL' : 'PASS',
    exitCode: floors.length ? 2 : unreached.length ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

// THE DOOR, printed in the check's own output — *The instrument rule*,
// commons/development.md, as amended 2026-08-08: "State the door, in the
// check's own output. Not 'observed red' but observed red FROM <entry point>,
// on an artifact of the real kind, through every stage the real run performs."
const DOOR = `
OBSERVED RED FROM \`node tools/statusreach.mjs\` — this entry point, no other —
on the real tree at dev = cd3da94, four times, each plant entering by the door
the real input enters and travelling every stage the real run travels
(content-build recompile -> src/content/index.js -> the same statusReach()):
  · no plant at all, the shipped content:  FAIL 6/43, exit 1
  · a row appended to src/content/statuses.js:  FAIL 7/44, names it, exit 1
  · strike.burn=+2 deleted from content/source/weapons.csv, recompiled:  FAIL 7/43, exit 1
  · all 25 bleed appliers deleted from the nine content files:  FAIL 8/43
    (bleed AND bleedResist), exit 1
\`--selftest\` plants the same mechanisms in memory, including the two that must
go GREEN — a check that can only go red proves as little as one that cannot.`;

const BOUNDARY = `
BOUNDARY — what a green from this tool does NOT mean:
  · REACHED IS NOT EFFECTIVE. This proves something APPLIES the status, never
    that applying it does anything. Measured, and it is a live finding today:
    frostExposed and insanityExposed raise damage whose EFFECT carries a
    matching tag, and ZERO shipped effects carry a \`tags\` field at all
    (grep "tags: \\[" over src/content/cards, relics, flasks → 0). Both exposure
    rows are reachable and inert. The fix is derivation from cardTagging.csv,
    which is a model change, not a content one — so it is named here and not
    done here.
  · REACHED IS NOT DRAWABLE. A card with an applier still has to be in a class
    pool, a rewardable rarity, and a run's RNG. This reads the definition, not
    the run. tools/runsim.mjs is the half that plays.
  · REACHED IS NOT BALANCED. Every number touched on the way here is marked
    PROVISIONAL in its own row and none of it has been through the sim.
  · R5 IS A SUBSTRING MATCH in one file, and the header says why that is
    admissible exactly once and never twice.
  · THE UPGRADE PATH IS WALKED, the equipment path is walked, the intent path
    is walked — but any FUTURE way to apply a status that is none of R1–R5
    reads as unreachable here, loudly, which is the right way round.`;

function report(r, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify({
      verdict: r.verdict, total: r.total, unreached: r.unreached,
      dangling: r.dangling, floors: r.floors,
    }, null, 2));
    return;
  }
  console.log('statusreach: every shipped status, and the way a player meets it.\n');
  for (const id of [...r.reached].sort()) {
    const w = r.witness.get(id) || [];
    console.log(`  ok    ${id.padEnd(20)} ${w.length} applier(s) — ${w.slice(0, 3).join(' · ')}${w.length > 3 ? ` · +${w.length - 3} more` : ''}`);
  }
  for (const id of r.unreached) {
    console.log(`  RED   ${id.padEnd(20)} NOTHING APPLIES IT — a shipped row no player can reach`);
  }
  for (const id of r.dangling) {
    console.log(`  RED   ${id.padEnd(20)} applied by ${(r.witness.get(id) || []).join(', ')} but there is NO SUCH STATUS ROW`);
  }
  for (const f of r.floors) console.log(`  FLOOR ${f}`);
  console.log();
  if (r.verdict === 'FLOOR') {
    console.log(`RESULT: FLOOR — this run judged nothing it can vouch for; ${r.floors.length} floor(s) fired.`);
  } else if (r.verdict === 'FAIL') {
    console.log(`RESULT: FAIL — ${r.unreached.length} of ${r.total} shipped statuses have no applier: ${r.unreached.join(', ')}.`);
  } else {
    console.log(`RESULT: ${r.total}/${r.total} shipped statuses have at least one applier, by routes R1-R5.`);
  }
  console.log(DOOR);
  console.log(BOUNDARY);
}

// ---------------------------------------------------------------------------
// --selftest — eight plants, through the SAME statusReach() main() calls.
// ---------------------------------------------------------------------------

function clone(node) {
  // NOT structuredClone and NOT JSON round-tripping: the bundle carries the
  // scripts table, whose values are FUNCTIONS — structuredClone throws on them
  // and JSON silently drops them, and a plant run against a bundle quietly
  // missing a table is a plant that entered downstream of the thing it tests.
  // Functions are shared by reference; nothing here mutates one.
  if (Array.isArray(node)) return node.map(clone);
  if (node === null || typeof node !== 'object') return node;
  if (node instanceof Map) return new Map([...node].map(([k, v]) => [k, clone(v)]));
  if (node instanceof Set) return new Set([...node].map(clone));
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = clone(v);
  return out;
}

async function selftest(real) {
  let bad = 0;
  const expect = (name, got, want) => {
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(62)} got ${got}, want ${want}`);
  };
  const codeOk = () => ({ readFile: () => CODE_APPLIERS.map((c) => c.needle).join('\n') });

  console.log('statusreach --selftest — every mechanism planted, including the two that must go GREEN.');
  console.log('THE DOOR, said plainly: these plants enter IN MEMORY, on the loaded bundle —');
  console.log('downstream of the CSV compile and the module load, so they exercise the reach');
  console.log('model and NOT the loading. The four plants that entered by the real door (real');
  console.log('files, real recompile, real CLI) are recorded in this file\'s header and printed');
  console.log('by a plain run. Neither half is sufficient alone; that is why both exist.\n');

  // 1 — THE CHECK MUST BE ABLE TO GO GREEN. A check that can only go red is as
  //     useless as one that can only go green, and only the second is usually
  //     looked for.
  //
  //     NOT "the shipped bundle is green" — that was the first draft and it was
  //     wrong, caught by running this file at the tree it was written against:
  //     the corpus line went red because the TREE was red, and a corpus test
  //     that fails for the tree's reason cannot tell you whose fault a red is.
  //     (run-node.mjs already says this about 36/37: one line for the check's
  //     own integrity, one for the state of the code.) So the green is PLANTED:
  //     whatever the tree holds, give every unreached row an applier through
  //     the ordinary card door and the verdict must turn.
  {
    const b = clone(real);
    const before = statusReach(b, codeOk());
    for (const id of before.unreached) {
      b.cards.push({
        id: `plantedApplierFor_${id}`, name: 'Planted', class: 'colorless', rarity: 'common',
        cost: 1, type: 'skill', effects: [{ op: APPLY_OP, target: 'enemy', status: id, stacks: 1 }],
      });
    }
    expect('G1  every unreached row given an applier (must go GREEN)', statusReach(b, codeOk()).verdict, 'PASS');
  }

  // 2 — a status row with no applier, planted IN THE TABLE (the real door).
  let b = clone(real);
  b.statuses.push({ id: 'plantedNobodyApplies', name: 'Planted', icon: '?', stackMode: 'add', decay: 'none' });
  let r = statusReach(b, codeOk());
  expect('P1  a table row with no applier', r.verdict, 'FAIL');
  expect('P1  ...and it is named', r.unreached.includes('plantedNobodyApplies'), true);

  // 3 — THE READER TRAP, and this is the one that matters. Give the planted
  //     row every kind of MENTION except an application, exactly as `frost`
  //     had one: a resists row, a predicate, a formula, a removeStatus, and an
  //     equipMods row nobody equips. A grep goes green on all five.
  b = clone(real);
  b.statuses.push({ id: 'plantedOnlyRead', name: 'Planted', icon: '?', stackMode: 'add', decay: 'none' });
  b.statuses[0].resists = { status: 'plantedOnlyRead', percent: 50 };
  b.cards[0].effects = [
    { op: 'damage', target: 'enemy', amount: 1, if: { p: 'hasStatus', of: 'target', status: 'plantedOnlyRead' } },
    { op: 'damage', target: 'enemy', amount: { f: 'stacks', status: 'plantedOnlyRead', of: 'target' } },
    { op: 'removeStatus', target: 'enemy', status: 'plantedOnlyRead' },
  ];
  b.equipment.modFields.plantedField = { field: 'plantedField', apply: 'status', op: 'applyStatus', status: 'plantedOnlyRead' };
  r = statusReach(b, codeOk());
  expect('P2  read five ways, applied none (the frost defect)', r.unreached.includes('plantedOnlyRead'), true);

  // 4 — the applier door: strip a status of its only applier and it must go red,
  //     together with everything that was only reachable THROUGH it.
  b = clone(real);
  const strip = (id) => {
    const kill = (n) => {
      if (Array.isArray(n)) { for (let i = n.length - 1; i >= 0; i--) { if (n[i] && n[i].op === APPLY_OP && n[i].status === id) n.splice(i, 1); else kill(n[i]); } return; }
      if (n === null || typeof n !== 'object') return;
      for (const v of Object.values(n)) kill(v);
    };
    kill(b.cards); kill(b.relics); kill(b.enemies); kill(b.events);
    kill(b.flasks); kill(b.stances); kill(b.classes); kill(b.balance);
    // AND the status table's own hooks — found by this plant failing the first
    // time it ran. Removing bleed from every card, relic, enemy and stance
    // still left it REACHED, correctly: the `bloodUnction` STATUS applies bleed
    // from a hook, and bloodUnction is itself reached from a flask. A plant
    // that stopped at the content files would have called the tool broken when
    // the tool was right. R2 is transitive in both directions.
    kill(b.statuses);
    // AND the equipment route — found the same way, on the second run. The
    // katana carries `strike.bleed=+2`, so R4 kept bleed reachable with every
    // op in the tree gone. Two of this file's five routes were invisible to
    // the first draft of this plant, and both times the tool was right and the
    // plant was the thing entering downstream of the defect.
    for (const p of [...b.equipment.armaments, ...b.equipment.armour]) {
      p.mods = (p.mods || []).filter((m) => !String(m).includes(`.${id}=`));
    }
  };
  strip('bleed');
  r = statusReach(b, codeOk());
  expect('P3  bleed with every applier removed', r.unreached.includes('bleed'), true);
  expect('P3  ...and bleedResist falls with it (R3 is transitive)', r.unreached.includes('bleedResist'), true);

  // 5 — R4 needs BOTH halves: the vocabulary row without a wielder is not reach.
  b = clone(real);
  for (const p of [...b.equipment.armaments, ...b.equipment.armour]) {
    p.mods = (p.mods || []).filter((m) => !String(m).includes('.burn='));
  }
  r = statusReach(b, codeOk());
  expect('P4  the burn mod field with nothing equipping it', r.unreached.includes('burn'), true);

  // 6 — F1: no population at all is not a pass.
  b = clone(real); b.statuses = [];
  expect('P5  empty status table (F1)', statusReach(b, codeOk()).exitCode, 2);

  // 7 — F2: the walk goes blind on one named set.
  b = clone(real); b.cards = [];
  r = statusReach(b, codeOk());
  expect('P6  an empty source set (F2)', r.exitCode, 2);
  expect('P6  ...and it names which one', r.floors.some((f) => f.includes("'cards'")), true);

  // 8 — F4: the code-side ratchet. A declared needle that vanished must FAIL,
  //     never quietly fall back to "unreached".
  r = statusReach(real, { readFile: () => '// the needle is gone' });
  expect('P7  a declared code applier that vanished (F4)', r.exitCode, 2);

  // 9 — the OTHER green: dangling appliers are reported, not swallowed.
  b = clone(real);
  b.cards[0].effects = [{ op: APPLY_OP, target: 'enemy', status: 'noSuchStatusAnywhere', stacks: 1 }];
  r = statusReach(b, codeOk());
  expect('G2  an applier pointing at no row is REPORTED', r.dangling.includes('noSuchStatusAnywhere'), true);

  // The harness quotes this line verbatim (tests/run-node.mjs) rather than
  // recomposing numbers out of it — a recomposed verdict is a second home for
  // the verdict, and it drifts. So it ends in a full stop, on purpose.
  console.log(`\nRESULT: ${bad === 0 ? 'corpus held' : `CORPUS BROKE — ${bad} plant(s) did not behave`}`
    + ` — 12 assertions over 9 planted mechanisms, 2 of them required to go GREEN.`);
  return bad === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const { contentBundle } = await import('../src/content/index.js');
  if (args.includes('--selftest')) return selftest(contentBundle);
  const r = statusReach(contentBundle);
  report(r, { json: args.includes('--json') });
  return r.exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(2); });
}
