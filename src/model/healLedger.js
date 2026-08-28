// src/model/healLedger.js — THE RUN DOOR SAYS WHAT IT DID.
//
// THE DEFECT THIS EXISTS FOR, and it was found from two ends by two seats who
// each could only see half of it (Marina's ruling, 2026-08-15):
//
//   · Vira, from the save side: three fields are optional in RUN_SHAPE with no
//     schemaVersion gate, so a heal written for old saves also fires on a
//     CURRENT-schema save. Delete an allocation from a v4 save and it loads
//     with the class preset, silently.
//   · Sten, from the run-creation side: a planted double-count in the max-HP
//     chain was SWALLOWED — `reconcileRunLoadoutHp` is the last writer at run
//     creation, so it overwrote the plant and his instrument went green on a
//     real defect.
//
// One defect: **a last-writer-wins reconcile that keeps no record of what it
// overwrote.** Nobody owned run creation.
//
// WHAT THIS IS AND IS NOT. It is VISIBILITY, explicitly not the collapse. The
// max-HP formula still lives in three homes (src/model/state.js twice,
// src/model/loadout.js once) and this file does not merge them — *you cannot
// safely collapse what you cannot watch drift*, and Sten's swallowed plant is
// the proof. Each home now WRITES DOWN what it computed and what it replaced,
// so a disagreement between them is observable instead of being decided by
// call order. No behaviour changes. Not one number moves.
//
// AND IT IS NOT A REFUSAL. Refuse-vs-heal is a false dichotomy (Constantine's
// own word, C6). The defect is the SILENCE, not the heal. A heal that names
// itself satisfies save.js's honesty contract — "a failed load is a NAMED,
// VISIBLE state, never a fresh profile wearing the same filename", which the
// PROFILE has had since #67 and the RUN never did — and leaves
// tests/engine.test.js 28 and 50 green, because they are right that a player's
// climb should survive a missing field.
//
// SHAPE. The ledger is a NON-ENUMERABLE property of the run object, so
// `JSON.stringify(run)` (serializeRun), `{...run}`, `Object.keys` and
// `structuredClone` all skip it: **no save byte changes**, which is what lets
// tools/saveroundtrip.mjs keep asserting that a save is a fixed point of its
// own door. It is a witness, not persisted state.
//
// SCOPE — open only at a DOOR. `openLedger` is called at exactly two places,
// and `note()` is a no-op anywhere else:
//   · createRunState        (src/model/state.js)   — a run being born
//   · createSaveManager.loadRun (src/engine/save.js) — a run coming back
// stampDeck → reconcileRunLoadoutHp runs after every loadout mutation all
// climb long; recording those would grow without bound and answer a question
// nobody asked. Between doors the ledger is closed and costs nothing.
//
// WHO READS IT. `saves.runStatus()` — the run-side twin of `profileStatus()`,
// same idea, one home each. tools/runcreation.mjs drives BOTH doors and fails
// if the three max-HP homes disagree (Sten's A7).
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day run creation and the
// load door have ONE writer for each field they set — no last writer, nothing
// to overwrite, nothing to witness. Collapsing the three homes is what would
// earn that, and this file is the instrument that makes the collapse safe to
// attempt; it is not a permanent fixture.

/** The property name on the run. String, not a Symbol, so it greps. */
export const LEDGER_KEY = 'runHealLedger';

// A bound so a pathological caller cannot grow it without limit even inside a
// door. Dropped entries are COUNTED, never silently discarded: a truncated
// witness that does not say it was truncated is the silence again.
const MAX_ENTRIES = 500;

function ledger(run) {
  return run && typeof run === 'object' ? run[LEDGER_KEY] : null;
}

/**
 * openLedger(run, door, savedSchemaVersion) — start recording. Resets any
 * previous record: each trip through a door is its own account, and a ledger
 * that accumulated across two loads could not tell you which one healed.
 */
export function openLedger(run, door, savedSchemaVersion) {
  if (!run || typeof run !== 'object') return null;
  const record = {
    door,
    savedSchemaVersion: savedSchemaVersion === undefined ? null : savedSchemaVersion,
    open: true,
    entries: [],
    dropped: 0,
  };
  if (Object.hasOwn(run, LEDGER_KEY)) {
    run[LEDGER_KEY] = record;
  } else {
    Object.defineProperty(run, LEDGER_KEY, {
      value: record,
      writable: true,
      enumerable: false, // ← the whole reason no save byte moves
      configurable: true,
    });
  }
  return record;
}

/** closeLedger(run) → the finished record (or null). Notes after this are no-ops. */
export function closeLedger(run) {
  const rec = ledger(run);
  if (!rec) return null;
  rec.open = false;
  return rec;
}

/**
 * note(run, entry) — record one act of the door. No-op unless a door is open.
 *
 * entry = {
 *   kind:  'write'     — a field set for the first time at this door
 *          'overwrite' — a later writer replaced a value an earlier one set
 *          'heal'      — a field ABSENT from the input was filled in
 *          'rename'    — a value carried from a retired name to its heir
 *          'compute'   — a home stated the value it computed (may equal the
 *                        one already there; this is how the three max-HP homes
 *                        are compared without collapsing them)
 *   site   — the code that did it, file:function, one string
 *   field  — the run field it touched
 *   was / now — the values, as they were and are
 *   why    — one sentence a person can act on
 * }
 */
export function note(run, entry) {
  const rec = ledger(run);
  if (!rec || !rec.open) return null;
  if (rec.entries.length >= MAX_ENTRIES) {
    rec.dropped += 1;
    return null;
  }
  const row = {
    kind: entry.kind,
    site: entry.site,
    field: entry.field,
    was: entry.was,
    now: entry.now,
    why: entry.why || '',
    changed: entry.kind === 'compute' ? undefined : jsonEq(entry.was, entry.now) === false,
    savedSchemaVersion: rec.savedSchemaVersion,
    door: rec.door,
  };
  rec.entries.push(row);
  return row;
}

function jsonEq(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return a === b;
  }
}

/**
 * readLedger(run, { currentSchemaVersion }) → a plain summary, or null when the
 * run has never been through an instrumented door.
 *
 * `heals` counts only the entries that FILLED AN ABSENCE — the thing the
 * narrowed refuse question is about. `overwrites` counts a later writer
 * replacing an earlier one — Sten's swallow. They are separate numbers because
 * they are separate defects wearing one shape.
 */
export function readLedger(run, { currentSchemaVersion = null } = {}) {
  const rec = ledger(run);
  if (!rec) return null;
  const heals = rec.entries.filter((e) => e.kind === 'heal' || e.kind === 'rename');
  const overwrites = rec.entries.filter((e) => e.kind === 'overwrite' && e.changed);
  const onCurrentSchema = currentSchemaVersion !== null
    && rec.savedSchemaVersion === currentSchemaVersion;
  return {
    door: rec.door,
    savedSchemaVersion: rec.savedSchemaVersion,
    open: rec.open,
    dropped: rec.dropped,
    entries: rec.entries.map((e) => ({ ...e })),
    healed: heals.length,
    overwrote: overwrites.length,
    // THE PREDICATE THE WAKE CONDITION IS WRITTEN ON (see tools/runcreation.mjs
    // and the boundary of tools/saveroundtrip.mjs). A heal on a CURRENT-schema
    // save is the event that turns "should a v4 save missing a field heal or
    // refuse?" from a parked design call into a live one.
    healedOnCurrentSchema: onCurrentSchema ? heals.length : 0,
    fields: [...new Set(rec.entries.map((e) => e.field))],
  };
}

/**
 * THE THREE LIVE HOMES OF THE MAX-HP FORMULA, named once, here, so a tool that
 * censuses them cannot drift from the code that reports them (Sten found them;
 * the line numbers he gave were state.js:210, state.js:256, loadout.js:1086 at
 * dev = 7e67de8, which is why this is keyed on site strings and not on lines).
 *
 * THEY ARE NOT COLLAPSED AND THIS OBJECT IS NOT A PLAN TO COLLAPSE THEM. It is
 * the census list: a home missing from a run's ledger has not agreed with the
 * others — it has said nothing, and those look identical from the outside.
 */
export const MAX_HP_HOMES = Object.freeze({
  'state.js:initializeRunDerivedStats(validate)': 'home 1 — checks a persisted maxHp against the snapshot + equipment + adjustment',
  'state.js:initializeRunDerivedStats(derive)': 'home 2 — derives maxHp from the host rules; SECOND writer at run creation',
  'loadout.js:reconcileRunLoadoutHp': 'home 3 — reconciles maxHp after a loadout mutation; LAST writer at run creation',
});

/**
 * maxHpHomeValues(summary) → [{ site, value, was, door }] — what each home said
 * about maxHp on this trip. Empty is a meaningful answer and callers must treat
 * it as one: a home that did not run proves nothing about agreement.
 */
export function maxHpHomeValues(summary) {
  if (!summary) return [];
  return summary.entries
    .filter((e) => e.field === 'maxHp' && Object.hasOwn(MAX_HP_HOMES, e.site))
    .map((e) => ({ site: e.site, value: e.now, was: e.was, door: e.door }));
}

/**
 * describeLedger(summary) → the lines a human reads. One line per act, each
 * naming the site, the field, and both values — because "the door healed
 * something" is the same silence in a friendlier voice.
 */
export function describeLedger(summary) {
  if (!summary) return ['(no run door has been opened on this run)'];
  const short = (v) => {
    if (v === undefined) return '(absent)';
    let s;
    try {
      s = JSON.stringify(v);
    } catch (e) {
      s = String(v);
    }
    if (s === undefined) s = String(v);
    return s.length > 90 ? `${s.slice(0, 90)}…` : s;
  };
  const head = `${summary.door}: saved schemaVersion ${summary.savedSchemaVersion} · `
    + `${summary.healed} heal(s), ${summary.overwrote} overwrite(s)`
    + (summary.dropped ? ` · ${summary.dropped} entr(ies) DROPPED past the cap` : '');
  return [head, ...summary.entries.map((e) => `  ${e.kind.toUpperCase().padEnd(9)} ${e.site} — ${e.field}: ${short(e.was)} -> ${short(e.now)}${e.why ? `  (${e.why})` : ''}`)];
}
