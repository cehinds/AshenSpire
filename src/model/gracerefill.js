// src/model/gracerefill.js — what a grace hands back, and what it refuses.
//
// Constantine, 2026-08-08: "flasks should refill automatically at graces", and
// the longer form the same evening: "at every grace all characters should
// restore 3 hp flasks, and 3 mana flasks (this should be configurable in teh
// debug settings and be data driven, and each character should start with
// those)."
//
// THE GRACE IS THE SHRINE OF EMBERLIGHT. There is no node type called `grace`
// in this tree and none is invented here: `shrine` is the rest node (SPEC §7.1,
// NODE_TYPES in model/floorplan.js), it is the only place a run stops to
// recover, and it is what his sentence is about. Naming a second word for it
// would be the second copy this house exists to catch.
//
// TWO NOUNS THAT ARE NOT THE SAME NOUN, and this file exists on the seam.
// His flask is Elden Ring's: one vessel, N charges, refilled at a grace.
// THIS GAME'S flask is Slay the Spire's potion: `run.flasks` is up to
// `balance.flaskSlots` SLOTS, each holding a distinct content entry with its
// own effects (content/flasks.js). "Restore 3 hp flasks" therefore has to mean
// something in the second model, and the only honest reading is: TOP THE SLOTS
// UP TO THREE OF THAT KIND. Said out loud because the reading is ours, not his.
//
// LAYERING: model/, imports nothing from engine/. Pure. `graceRefillPlan` never
// mutates — the mutation is one line in engine/encounters.js, so the same plan
// can be shown on a screen, printed by a settings row, and measured by a sim
// without any of the three having to apply it to find out what it says.

import { FLASK_KINDS } from './schemas.js';

/**
 * flaskKindOf(def) → one of FLASK_KINDS.
 *
 * LAW 0 CLAUSE 1 — an entry DESCRIBES, the machinery DERIVES. No flask in
 * content/flasks.js was edited to gain a kind: Crimson Flask heals, so it is
 * `hp`, and it says so by carrying a `heal` op and nothing else. An author who
 * writes a new healing flask writes no new field.
 *
 * LAW 0 CLAUSE 3 — the derivation is overridable, and the override is data. An
 * explicit `kind:` on the row wins over everything below, so a flask that heals
 * as a side effect but is not the healing flask can say so without code.
 *
 * Mana is now real run/combat state. Azure Flask carries the real `restoreMana`
 * opcode, so that authored effect derives `mana` without confusing Mana with
 * per-turn Energy. An explicit kind still wins for unusual hybrid flasks.
 */
export function flaskKindOf(def) {
  if (!def || typeof def !== 'object') return 'utility';
  if (typeof def.kind === 'string') return def.kind; // override wins, validated at boot
  const effects = Array.isArray(def.effects) ? def.effects : [];
  if (effects.some((e) => e && e.op === 'restoreMana')) return 'mana';
  if (effects.some((e) => e && e.op === 'heal')) return 'hp';
  return 'utility';
}

/**
 * firstFlaskOfKind(defs, kind) → the def a kind resolves to, or null.
 *
 * THE ONE HOME for "which flask does 'hp' mean". It takes a plain array of
 * defs rather than registries so that all three callers can share it: the plan
 * (registries.flasks.all()), boot validation (the raw bundle, before any
 * registry exists), and the settings row (the content array, in a module that
 * is never handed registries). One rule, three doors, no second copy.
 *
 * FIRST AUTHORED, NEVER RANDOM. A grace that hands over a different flask on a
 * re-run is a grace nothing can measure.
 */
export function firstFlaskOfKind(defs, kind) {
  for (const d of defs || []) if (flaskKindOf(d) === kind) return d;
  return null;
}

/** Every flask id of a kind, in registry (authored) order. */
export function flasksOfKind(registries, kind) {
  return registries.flasks.all().filter((d) => flaskKindOf(d) === kind).map((d) => d.id);
}

/** The refill table, as authored. Absent = no refill, which is a legal state. */
export function graceRefillTable(balance) {
  const t = balance && balance.graceRefill;
  return Array.isArray(t) ? t : [];
}

/** The carry cap. One home: `balance.flaskSlots`, same default the UI uses. */
export function flaskSlotCap(balance) {
  const n = balance && balance.flaskSlots;
  return typeof n === 'number' && Number.isFinite(n) ? n : 3;
}

/**
 * graceRefillLadder(balance) → ['0','1',...,String(cap)]
 *
 * The debug control's choices, DERIVED from the carry cap rather than typed.
 * Raising `flaskSlots` lengthens every one of those chip rows with no edit to
 * the settings screen. The strings are strings because `type: 'choice'` rows
 * store strings (settings.js `rowHtml`), and a number stored where a string is
 * compared is how a setting silently stops sticking.
 */
export function graceRefillLadder(balance) {
  const cap = flaskSlotCap(balance);
  const n = Number.isInteger(cap) && cap >= 0 ? cap : 3;
  return Array.from({ length: n + 1 }, (_, i) => String(i));
}

/**
 * graceRefillPlan(registries, run, { counts }) → what a grace would hand over.
 *
 * PURE. Returns the whole reckoning — including everything it could NOT do and
 * why — so that no caller has to apply it to find out. `counts` is the debug
 * override, `{ [kind]: number }`; anything absent falls back to the authored
 * row, which is the one home for the number.
 *
 *   {
 *     cap, held, free,                       // slots
 *     rows: [{ kind, count, flaskId, have, want, granted, short, binding, why }],
 *     grants: [flaskId, ...],                // in the order they would be added
 *     total,                                 // grants.length
 *     shortfalls: [{ kind, short, why }],    // what it refused to pretend it did
 *   }
 *
 * `binding: false` is the inert row and it is the point of the `why` string:
 * a knob whose value is plausibly ignored is worse than no knob, so the row
 * that restores nothing SAYS it restores nothing, by name, wherever it is
 * drawn.
 */
export function graceRefillPlan(registries, run, { counts = {} } = {}) {
  const balance = registries.balance || {};
  const cap = flaskSlotCap(balance);
  const held = Array.isArray(run && run.flasks) ? run.flasks : [];
  const kindOfHeld = held.map((f) => {
    if (!f || !registries.flasks.has(f.flaskId)) return null;
    return flaskKindOf(registries.flasks.get(f.flaskId));
  });

  let free = Math.max(0, cap - held.length);
  const rows = [];
  const grants = [];
  const shortfalls = [];

  for (const raw of graceRefillTable(balance)) {
    const kind = raw && raw.kind;
    // THE OVERRIDE, AND IT IS READ HERE OR THE WHOLE DEBUG CONTROL IS THEATRE.
    // This line was missing for one commit: the parameter was declared, the
    // settings row was drawn, the shrine passed `counts` in, and the plan
    // silently used the authored number anyway — a knob whose value is ignored,
    // the exact failure Law 0 clause 5 names, shipped inside the feature that
    // exists to avoid it. It was found by `tools/gracerefill.mjs --selftest`
    // (behaviour plant `counts { hp: 0 }`) and by nothing else, which is why
    // that plant enters at the shrine and not at this function.
    const authored = raw && typeof raw.count === 'number' ? raw.count : 0;
    const override = counts && Object.hasOwn(counts, kind) ? counts[kind] : undefined;
    const count = typeof override === 'number' && Number.isFinite(override) && override >= 0
      ? Math.floor(override)
      : authored;
    const members = flasksOfKind(registries, kind);
    // An explicit `flaskId` on the row wins; otherwise the kind's first
    // authored member. Registry order, never rng — a grace that hands over a
    // different flask on a re-run is a grace nothing can measure.
    const flaskId = (raw && raw.flaskId) || members[0] || null;
    const have = kindOfHeld.filter((k) => k === kind).length;
    const want = Math.max(0, count - have);

    if (!flaskId) {
      rows.push({
        kind, count, flaskId: null, have, want: 0, granted: 0, short: 0, binding: false,
        why: `NOT BINDING — no flask entry declares kind '${kind}', so this restores nothing. `
          + `The row is declared on purpose: the day an entry carries kind: '${kind}', this refill starts working with no code change.`,
      });
      continue;
    }

    const granted = Math.min(want, free);
    for (let i = 0; i < granted; i++) grants.push(flaskId);
    free -= granted;
    const short = want - granted;
    if (short > 0) {
      shortfalls.push({
        kind, short,
        why: `${short} ${kind} flask${short === 1 ? '' : 's'} not given — all ${cap} flask slot${cap === 1 ? '' : 's'} are full.`,
      });
    }
    rows.push({
      kind, count, flaskId, have, want, granted, short, binding: true,
      why: short > 0 ? shortfalls[shortfalls.length - 1].why : '',
    });
  }

  return { cap, held: held.length, free, rows, grants, total: grants.length, shortfalls };
}

/**
 * graceRefillRefusals(bundle) → [{ key, msg }]
 *
 * LAW 1 CLAUSE 5, at boot, naming the entry. Shaped exactly like
 * `geometryRefusals` in model/mapview.js and consumed the same way from
 * model/validate.js, because one refusal shape in one place is cheaper than two
 * that agree today.
 *
 * IT TAKES THE BUNDLE, NOT THE BALANCE, and that is load-bearing: three of the
 * eight refusals below can only be asked with the flask entries in hand — does
 * this kind have a member, is this override a real id, is that override of the
 * kind the row claims. A refusal that could only see `balance` would be the
 * half of the question that was never in doubt.
 *
 * WHAT IS DELIBERATELY *NOT* A REFUSAL: a row whose kind has no members. That
 * is the inert row, it is legal, and it reports itself as NOT BINDING wherever
 * it is drawn. Refusing it at boot would make `mana` unspeakable until a mana
 * flask exists, which is the opposite of declaring it early.
 */
export function graceRefillRefusals(bundle) {
  const out = [];
  const b = bundle || {};
  const balance = b.balance;
  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) return out;
  if (balance.graceRefill == null) return out; // no table = no refill; legal.

  if (!Array.isArray(balance.graceRefill)) {
    out.push({
      key: 'balance.graceRefill',
      msg: `must be an array of { kind, count } rows — got ${JSON.stringify(balance.graceRefill)}. `
        + `It is a table so that a new flask kind is a ROW and not an edit to the shrine.`,
    });
    return out;
  }

  const cap = flaskSlotCap(balance);
  const defs = Array.isArray(b.flasks) ? b.flasks : [];
  const byId = new Map(defs.filter((d) => d && typeof d.id === 'string').map((d) => [d.id, d]));
  const membersOf = (kind) => defs.filter((d) => flaskKindOf(d) === kind).length;

  const seen = new Map();
  let satisfiable = 0;
  const satisfiableRows = [];

  balance.graceRefill.forEach((row, i) => {
    const at = `balance.graceRefill[${i}]`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      out.push({ key: at, msg: `must be an object { kind, count } — got ${JSON.stringify(row)}.` });
      return;
    }
    const { kind, count } = row;

    // 1. A kind nothing carries — the closed set, named, with the legal values.
    if (typeof kind !== 'string' || !FLASK_KINDS.includes(kind)) {
      out.push({
        key: `${at}.kind`,
        msg: `${JSON.stringify(kind)} is not a flask kind — one of ${FLASK_KINDS.join(', ')}. `
          + `A kind is a WORD (Law 0 clause 2): adding one is an edit to FLASK_KINDS in model/schemas.js, `
          + `not a row here, and this refusal is what stops a typo from becoming a silent no-op.`,
      });
      return;
    }

    // 2. One home per number. Two rows for one kind is two answers to one question.
    if (seen.has(kind)) {
      out.push({
        key: `${at}.kind`,
        msg: `'${kind}' is already refilled by balance.graceRefill[${seen.get(kind)}] — two rows for one kind are two homes `
          + `for one number, and only the first would ever be read. Keep one row.`,
      });
      return;
    }
    seen.set(kind, i);

    // 3-5. The count. Each refusal says what the bad value would have DONE.
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      out.push({ key: `${at}.count`, msg: `must be a number of flasks — got ${JSON.stringify(count)}.` });
      return;
    }
    if (count < 0) {
      out.push({
        key: `${at}.count`,
        msg: `${count} is negative — a grace restores flasks, it never takes them. `
          + `A negative count reaches Math.max(0, count - have) and resolves to "give nothing", which is a knob that looks set and does nothing.`,
      });
      return;
    }
    if (!Number.isInteger(count)) {
      out.push({
        key: `${at}.count`,
        msg: `${count} is fractional — a slot holds a whole flask. `
          + `A fractional count would floor into a different number than the one written here, on a screen that prints the one written here.`,
      });
      return;
    }

    // 6. A row that can never be satisfied even alone.
    if (count > cap) {
      out.push({
        key: `${at}.count`,
        msg: `${count} '${kind}' flasks cannot be carried — balance.flaskSlots is ${cap}. `
          + `Raise balance.flaskSlots or lower this count; a refill above the carry cap is a promise the inventory cannot keep.`,
      });
      return;
    }

    // 7. An explicit flaskId override must resolve, and must be of this kind.
    if (row.flaskId != null) {
      if (!byId.has(row.flaskId)) {
        out.push({ key: `${at}.flaskId`, msg: `${JSON.stringify(row.flaskId)} is not a flask id.` });
        return;
      }
      const actual = flaskKindOf(byId.get(row.flaskId));
      if (actual !== kind) {
        out.push({
          key: `${at}.flaskId`,
          msg: `'${row.flaskId}' is a '${actual}' flask but this row refills '${kind}'. `
            + `The override picks WHICH flask of the kind is handed over, never what the kind means.`,
        });
        return;
      }
    }

    if (membersOf(kind) > 0 || row.flaskId != null) {
      satisfiable += count;
      satisfiableRows.push(`${kind}×${count}`);
    }
  });

  // 8. The aggregate. It is asked of the SATISFIABLE rows only, so a declared
  //    inert kind costs nothing today — and turns this red the day someone
  //    authors a member for it without raising the cap. That is the balance
  //    question arriving loudly instead of silently, and it is the intended
  //    behaviour, not a side effect: whoever adds the first mana flask is
  //    exactly the person who has to answer "how many can you carry now".
  if (satisfiable > cap) {
    out.push({
      key: 'balance.graceRefill',
      msg: `a grace would hand over ${satisfiable} flasks (${satisfiableRows.join(' + ')}) into ${cap} slot${cap === 1 ? '' : 's'}. `
        + `Raise balance.flaskSlots to ${satisfiable} or lower the counts. Left alone, the last rows in the table would silently `
        + `restore nothing while the debug control still showed their number — a knob whose value is ignored.`,
    });
  }

  return out;
}
