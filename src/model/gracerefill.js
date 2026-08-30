// src/model/gracerefill.js — what a grace hands back, and what it refuses.
//
// Crimson and Azure are fixed-capacity charge pools. Class data authors the
// starting split; Grace refills that split and may reallocate it atomically.
//
// THE GRACE IS THE SHRINE OF EMBERLIGHT. There is no node type called `grace`
// in this tree and none is invented here: `shrine` is the rest node (SPEC §7.1,
// NODE_TYPES in model/floorplan.js), it is the only place a run stops to
// recover, and it is what his sentence is about. Naming a second word for it
// would be the second copy this house exists to catch.
//
// Utility consumables remain separate inventory entries in `run.flasks`.
// Crimson/Azure definitions supply effects and presentation only; reward and
// shop pools exclude their ids through `utilityFlaskIds`.
//
// LAYERING: model/, imports nothing from engine/. Pure. `graceRefillPlan` never
// mutates — the mutation is one line in engine/encounters.js, so the same plan
// can be shown on a screen, printed by a settings row, and measured by a sim
// without any of the three having to apply it to find out what it says.

import { FLASK_KINDS } from './schemas.js';

export const CHARGE_FLASK_KINDS = Object.freeze(['hp', 'mana']);
// Save-schema compatibility only. Runtime identity is derived from the current
// authored definitions below; these ids recognize pre-authority saves.
const LEGACY_CHARGE_FLASK_KIND_BY_ID = Object.freeze({ crimsonFlask: 'hp', azureFlask: 'mana' });

export function flaskCapacity(balance) {
  const value = balance && balance.flaskCapacity;
  if (!Number.isInteger(value) || value <= 0) throw new Error('balance.flaskCapacity must be a positive integer');
  return value;
}

export function createFlaskCharges(balance, allocation) {
  const capacity = flaskCapacity(balance);
  const hp = allocation && allocation.hp;
  const mana = allocation && allocation.mana;
  if (!Number.isInteger(hp) || hp < 0 || !Number.isInteger(mana) || mana < 0 || hp + mana !== capacity) {
    throw new Error(`Flask allocation must satisfy hp + mana = capacity ${capacity}`);
  }
  // THE CAPACITY LEDGER, born complete. `capacity` is one stored number fed by
  // two doors (model/flaskgrowth.js, THE DOORS), and each door writes its own
  // ledger line: `grown` (the possession door, per kind, reversible) and
  // `granted` (the moment door, a total, permanent). `base` is what the vessel
  // was born holding — this run's snapshot of the authored balance.flaskCapacity,
  // like startingKitSnapshot: a later retune re-bases new runs, never old saves.
  // The invariant the save shape enforces (validateRunShape):
  //     capacity === base + grown.hp + grown.mana + granted
  // A capacity that cannot be accounted for by its three parts is a corrupt
  // save, refused BY NAME at the load door — so a future "cleanup" that
  // derives capacity from the chain alone and silently deletes every
  // moment-door charge goes red on the first save it touches.
  return { capacity, base: capacity, hp, mana, hpCurrent: hp, manaCurrent: mana, grown: { hp: 0, mana: 0 }, granted: 0 };
}

export function reallocateFlaskCharges(charges, { hp, mana }) {
  if (!charges || !Number.isInteger(charges.capacity) || charges.capacity <= 0) throw new Error('Missing flask charge capacity');
  if (!Number.isInteger(hp) || hp < 0 || !Number.isInteger(mana) || mana < 0 || hp + mana !== charges.capacity) {
    throw new Error(`Flask allocation must satisfy hp + mana = capacity ${charges.capacity}`);
  }
  charges.hp = hp;
  charges.mana = mana;
  charges.hpCurrent = hp;
  charges.manaCurrent = mana;
  return charges;
}

/**
 * E10 — "just increment button for each that automatically adjusts the other
 * flask to keep to the total available." (Constantine, 2026-08-15.)
 *
 * THE SCREEN ASKS THIS WHAT IT MAY OFFER AND PRICES NOTHING ITSELF. One row per
 * charge kind, DERIVED from CHARGE_FLASK_KINDS and the authored definitions —
 * Law 0 clause 1. A third charge kind gets a row, a name, art and both buttons
 * with no edit to any screen.
 *
 * WHAT "THE OTHER FLASK" MEANS WHEN THERE IS MORE THAN ONE OTHER. His sentence
 * is written for exactly two, and the vocabulary is a closed SET, not a pair
 * (Law 1 clause 3: new combinations of existing vocabulary must just work). The
 * rule is derived from the counts and stated HERE rather than guessed at a call
 * site:
 *   · `+` on kind K takes one from the kind holding the MOST, ties broken by
 *     declared order. Taking from the richest is the only choice that cannot
 *     empty a pool the player is still spending while another sits full.
 *   · `-` on kind K gives one to the kind holding the FEWEST, same tiebreak.
 *     It IS `+` on that kind said from the other end — which is why both
 *     buttons sit on every row and neither is decoration: at two kinds they are
 *     the same two moves twice, and EACH ROW STILL READS ON ITS OWN.
 * At exactly two kinds this collapses to his sentence with nothing left over.
 *
 * BOTH EDGES ARE STATES, NOT GUARDS. A kind at 0 cannot give; a kind holding
 * every charge cannot take. `capacity` never moves — the total is the invariant
 * he asked for, and `assigned` is reported so a screen can SHOW it holding
 * rather than promise that it does.
 */
export function flaskChargePlan(registries, charges) {
  if (!charges || !Number.isInteger(charges.capacity) || charges.capacity <= 0) {
    throw new Error('flaskChargePlan needs a run flask-charge pool with a positive capacity');
  }
  const kinds = CHARGE_FLASK_KINDS;
  const count = (kind) => {
    const value = charges[kind];
    if (!Number.isInteger(value) || value < 0) throw new Error(`flaskChargePlan: charges.${kind} is not a count`);
    return value;
  };
  // Ranked once, not per row: the donor is the richest OTHER kind, the receiver
  // the poorest OTHER kind, and both come off this one ordering.
  const pick = (self, better) => {
    let best = null;
    for (const kind of kinds) {
      if (kind === self) continue;
      if (best === null || better(count(kind), count(best))) best = kind;
    }
    return best;
  };
  const assigned = kinds.reduce((sum, kind) => sum + count(kind), 0);
  const rows = kinds.map((kind) => {
    const def = chargeFlaskDefinition(registries, kind);
    const name = (def && def.name) || kind;
    const donor = pick(kind, (a, b) => a > b);
    const receiver = pick(kind, (a, b) => a < b);
    const held = count(kind);
    const canAdd = donor !== null && count(donor) > 0;
    const canSub = receiver !== null && held > 0;
    return {
      kind,
      def,
      count: held,
      donor,
      receiver,
      canAdd,
      canSub,
      // The reasons belong to the model because the CONDITIONS do. A screen
      // writing its own sentence here would be the second copy of a rule.
      addReason: canAdd ? null : `Every charge is already ${name}`,
      subReason: canSub ? null : `No ${name} charge to move`,
    };
  });
  return { capacity: charges.capacity, assigned, kinds: kinds.slice(), rows };
}

/**
 * THE ONE MOVE, and the ONLY way the increment control changes anything.
 * It does not write the pool itself: it composes the WHOLE allocation and hands
 * it to reallocateFlaskCharges, so `sum === capacity` keeps ONE home and a `+`
 * can never become the door that breaks it.
 *
 * BOUNDARY, STATED RATHER THAN DESIGNED AROUND: reallocateFlaskCharges takes
 * `{ hp, mana }` and validateRunShape enforces `hp + mana === capacity`, so the
 * SAVE SCHEMA is two-kind today even though the plan above is not. A third
 * charge kind fails LOUD and by name here (Law 1 clause 5) rather than dropping
 * charges into a field nothing reads. Widening it is a save-shape act — the
 * seam Vira named at e05be89, where save.js ARCHIVES a run that fails to
 * validate — and it is not this one.
 */
export function moveFlaskCharge(registries, charges, { from, to }) {
  const plan = flaskChargePlan(registries, charges);
  if (from === to) throw new Error('moveFlaskCharge: from and to are the same kind');
  for (const kind of [from, to]) {
    if (!plan.kinds.includes(kind)) throw new Error(`moveFlaskCharge: '${kind}' is not a charge flask kind`);
  }
  if (charges[from] <= 0) throw new Error(`moveFlaskCharge: no '${from}' charge to move`);
  const next = {};
  for (const kind of plan.kinds) next[kind] = charges[kind];
  next[from] -= 1;
  next[to] += 1;
  return reallocateFlaskCharges(charges, next);
}

export function refillFlaskCharges(charges) {
  if (!charges) return null;
  charges.hpCurrent = charges.hp;
  charges.manaCurrent = charges.mana;
  return charges;
}

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

/** The current authored definition backing a charge-pool kind. */
export function chargeFlaskDefinition(registries, kind) {
  if (!CHARGE_FLASK_KINDS.includes(kind)) return null;
  const def = firstFlaskOfKind(registries && registries.flasks && registries.flasks.all(), kind);
  if (!def) throw new Error(`Missing authored '${kind}' charge flask definition`);
  return def;
}

/** Current content id for a charge kind; never a UI/engine literal. */
export function chargeFlaskId(registries, kind) {
  return chargeFlaskDefinition(registries, kind)?.id || null;
}

/** Reverse current content identity, with one explicit legacy-save seam. */
export function chargeKindForFlask(registries, id) {
  if (typeof id !== 'string' || !id) return null;
  for (const kind of CHARGE_FLASK_KINDS) {
    if (chargeFlaskId(registries, kind) === id) return kind;
  }
  return LEGACY_CHARGE_FLASK_KIND_BY_ID[id] || null;
}

export function isFlaskChargeId(registries, id) { return chargeKindForFlask(registries, id) != null; }
export function utilityFlaskIds(registries) {
  return registries.flasks.ids().filter((id) => !isFlaskChargeId(registries, id));
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

/** The carry cap. One strict home: `balance.flaskSlots`. */
export function flaskSlotCap(balance) {
  const n = balance && balance.flaskSlots;
  if (!Number.isInteger(n) || n <= 0) throw new Error('balance.flaskSlots must be a positive integer');
  return n;
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
  return Array.from({ length: cap + 1 }, (_, i) => String(i));
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
