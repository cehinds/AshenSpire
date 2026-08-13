// src/model/flaskgrowth.js — how the flask maximum grows, and where C1 waits.
//
// Constantine, 2026-08-08 (D17 message 6): "...those two are locked in with 3
// charges, with upgrade options via relics or quest events or talismans or
// flask seeds to increase the amount of charges".
//
// ONE CHAIN, DATA ROWS, ONE TRUTH FUNCTION (the coordinator's ruling, and it
// is the swap-cost chain's schema shape wearing flasks). A growth row
// DESCRIBES — { source, id, kind, amount } — and the machinery DERIVES the
// maximum (Law 0 clauses 1–3). A new relic that grows a charge is a ROW in
// `balance.flaskGrowth`; a fifth SOURCE is a word (FLASK_GROWTH_SOURCES,
// model/schemas.js — engine act, set + refusals together).
//
// ═════════════════════════════════════════════════════════════════════════
// THE C1 SEAM — the one named place the open capacity question lands.
//
// Two records disagree about what "3 charges" means, and the question is open
// with Constantine (the family record calls it C1):
//
//   POOL   — dev as shipped: `balance.flaskCapacity` is 3 TOTAL, one pool,
//            reallocatable between Crimson (hp) and Azure (mana) at a grace.
//   VESSEL — D17 message 6 as recorded: "those two are locked in with 3
//            charges" — 3 EACH on two dedicated vessels, no reallocation.
//
// THIS CHAIN IS NEUTRAL BY CONSTRUCTION. Every row targets a KIND
// ('hp' | 'mana'), and both readings need exactly that: the pool reading
// allocates the growth to the kind (precisely what the shipped
// `addFlaskCapacity` opcode already does), the vessel reading raises that
// vessel's own maximum. The BINDING of a kind-delta into stored charge state
// lives in exactly one function below — `syncFlaskGrowth` — and it currently
// implements the POOL reading because that is what ships. C1's answer
// rewrites THAT FUNCTION (and, under VESSEL, the charge container it feeds);
// it rewrites ZERO rows, and no other function in this file changes meaning.
//
// TWO DOORS INTO A BIGGER MAXIMUM, deliberately, one per shape of cause:
//   the MOMENT door     — the `addFlaskCapacity` run opcode: a one-shot grant
//                         from something that HAPPENS (a keepsake at run
//                         start, a quest event's chosen effect). Stored.
//   the POSSESSION door — this chain: growth that tracks something you HAVE
//                         (a relic carried, a talisman worn, one day a seed).
//                         Derived, so losing the source loses the growth.
// One grant may use one door only; the questEvent refusal below enforces the
// one collision the two doors could have.
// ═════════════════════════════════════════════════════════════════════════

import { FLASK_GROWTH_SOURCES } from './schemas.js';
import { CHARGE_FLASK_KINDS, flaskCapacity } from './gracerefill.js';

// DELIBERATELY NOT `import { equippedIn } from './loadout.js'`. The canonical
// worn-piece resolver is loadout.js `equippedIn`, but importing it here closes
// a cycle — validate.js → this file → loadout.js → validate.js — and loadout
// calls `tokenRe()` at module top, which then throws before initialization
// (measured: ReferenceError at loadout.js:1073 the moment the import existed).
// The chain only needs the ACTIVE ID in the talisman slot, so it reads the
// loadout's own stored shape below; if `equippedIn`'s set/active resolution
// ever changes shape, `wornTalismanId` is the one line to re-level.
function wornTalismanId(loadout) {
  const ids = (loadout && loadout.sets && loadout.sets.talisman) || [];
  return ids[(loadout && loadout.active && loadout.active.talisman) || 0] || null;
}

/** The chain's rows, as authored. Absent = no growth, which is a legal state. */
export function flaskGrowthTable(balance) {
  const t = balance && balance.flaskGrowth;
  return Array.isArray(t) ? t : [];
}

/** The optional hard cap. Absent = uncapped; the boot refusal only arms when
 *  it is authored, so no invented ceiling ships while C1 is open. */
export function flaskGrowthMax(balance) {
  const v = balance && balance.flaskGrowthMax;
  return Number.isInteger(v) && v > 0 ? v : null;
}

/**
 * flaskGrowthPlan(registries, run) → { rows, perKind }
 *
 * THE TRUTH FUNCTION, and it is pure. For every authored row it answers: is
 * the source held by THIS run, and if not, why not — so the same reckoning can
 * be shown on a screen, printed by a tool, and applied by the seam without any
 * of the three disagreeing. `perKind` sums only the held rows.
 *
 * `binding: false` rows carry a `why` by name (the mana-row pattern): a row
 * that grows nothing SAYS it grows nothing, wherever it is read.
 */
export function flaskGrowthPlan(registries, run) {
  const rows = [];
  const perKind = { hp: 0, mana: 0 };

  for (const raw of flaskGrowthTable(registries.balance)) {
    const source = raw && raw.source;
    const id = raw && raw.id;
    const kind = raw && raw.kind;
    const amount = raw && Number.isInteger(raw.amount) ? raw.amount : 0;
    let held = false;
    let why = '';

    if (source === 'relic') {
      held = Array.isArray(run && run.relics) && run.relics.includes(id);
      if (!held) why = `not held — the run does not carry relic '${id}'.`;
    } else if (source === 'talisman') {
      held = wornTalismanId(run && run.loadout) === id;
      if (!held) why = `not worn — '${id}' is not in the talisman slot.`;
    } else if (source === 'questEvent') {
      // NOT BINDING TODAY, by name: the run records no quest-event history
      // (run.history is declared and never written), so a possession-shaped
      // row cannot resolve. A quest event that grows charges TODAY does it
      // through the moment door — an `addFlaskCapacity` effect on its own
      // choice row, zero code. The day event history exists, this row binds
      // and that event's imperative grant must move into it: one door per
      // grant, and the boot refusal below already guards the collision.
      why = 'NOT BINDING — the run records no quest-event history yet; '
        + 'today a quest event grants growth through its own choice effect (op addFlaskCapacity).';
    } else if (source === 'flaskSeed') {
      // Declared and inert: the source is one of his four words, no seed item
      // vocabulary exists in content, and rows of this source are refused at
      // boot until one does. The word ships so the day is a data day.
      why = 'NOT BINDING — no flask-seed item exists in content; the source is reserved for the day one does.';
    } else {
      why = `unknown source '${source}' — validation refuses this row at boot.`;
    }

    if (held && CHARGE_FLASK_KINDS.includes(kind)) perKind[kind] += amount;
    rows.push({ source, id, kind, amount, held, binding: held, why });
  }

  return { rows, perKind };
}

/**
 * syncFlaskGrowth(registries, run) → { changed, applied, plan } | null
 *
 * ══ THE C1 SEAM, applied — the ONLY place a kind-delta becomes stored
 * capacity, and the function C1's answer rewrites. ══
 *
 * POOL BINDING (shipped): a held row's amount raises `flaskCharges.capacity`
 * and allocates itself to the row's kind — the same arithmetic as the
 * `addFlaskCapacity` opcode, so the two doors cannot disagree about what a
 * charge is. Under the VESSEL reading this function would instead raise the
 * kind's own maximum, and `createFlaskCharges`/`reallocateFlaskCharges`
 * (model/gracerefill.js) would change shape with it; the rows would not.
 *
 * DERIVED, SO REVERSIBLE: `flaskCharges.grown` stores what the chain has
 * currently applied per kind. Sync diffs the plan against it and applies the
 * difference, so gaining a relic grows the maximum and (one day) unequipping
 * a talisman shrinks it back — idempotent, safe to call at every checkpoint.
 *
 * THE POOL AMBIGUITY, named rather than smoothed: under the pool reading the
 * player may have reallocated a grown charge to the other kind before the
 * source is lost. Removal takes from the row's kind first and overflows to
 * the other — a rule NOBODY ordered, forced into existence by the pool
 * topology alone. The vessel reading has no such case. That asymmetry is
 * part of C1's price and is recorded in the family packet, not decided here.
 */
export function syncFlaskGrowth(registries, run) {
  const f = run && run.flaskCharges;
  if (!f) return null;
  const plan = flaskGrowthPlan(registries, run);
  const grown = f.grown && Number.isInteger(f.grown.hp) && Number.isInteger(f.grown.mana)
    ? f.grown
    : { hp: 0, mana: 0 };
  const applied = { hp: 0, mana: 0 };

  for (const kind of CHARGE_FLASK_KINDS) {
    const d = plan.perKind[kind] - grown[kind];
    if (d === 0) continue;
    applied[kind] = d;
    if (d > 0) {
      // A new charge arrives full — the same generosity as addFlaskCapacity.
      f.capacity += d;
      f[kind] += d;
      f[`${kind}Current`] += d;
    } else {
      const take = -d;
      const other = kind === 'hp' ? 'mana' : 'hp';
      f.capacity -= take;
      const fromKind = Math.min(take, f[kind]);
      f[kind] -= fromKind;
      f[other] -= take - fromKind; // safe: grown charges are inside capacity
      f.hpCurrent = Math.min(f.hpCurrent, f.hp);
      f.manaCurrent = Math.min(f.manaCurrent, f.mana);
    }
  }

  f.grown = { hp: plan.perKind.hp, mana: plan.perKind.mana };
  return { changed: applied.hp !== 0 || applied.mana !== 0, applied, plan };
}

/**
 * flaskGrowthRefusals(bundle) → [{ key, msg }]
 *
 * LAW 1 CLAUSE 5 at boot, naming the entry — consumed by model/validate.js
 * exactly like graceRefillRefusals, because one refusal shape in one place is
 * cheaper than two that agree today.
 *
 * IT TAKES THE BUNDLE, NOT THE BALANCE: four of the refusals below can only
 * be asked with the relics, events and equipment tables in hand — does this
 * source id exist, is that event already granting through the moment door.
 */
export function flaskGrowthRefusals(bundle) {
  const out = [];
  const b = bundle || {};
  const balance = b.balance;
  if (!balance || typeof balance !== 'object' || Array.isArray(balance)) return out;

  // The cap's SHAPE is checked before the table's existence — a malformed
  // flaskGrowthMax beside an absent table was silent in this function's first
  // draft, and its own selftest caught it (MISS, 2026-08-13) before commit.
  const max = flaskGrowthMax(balance);
  if (balance.flaskGrowthMax !== undefined && max == null) {
    out.push({
      key: 'balance.flaskGrowthMax',
      msg: `must be a positive integer — got ${JSON.stringify(balance.flaskGrowthMax)}.`,
    });
  }

  if (balance.flaskGrowth == null) return out; // no chain = no growth; legal.

  if (!Array.isArray(balance.flaskGrowth)) {
    out.push({
      key: 'balance.flaskGrowth',
      msg: `must be an array of { source, id, kind, amount } rows — got ${JSON.stringify(balance.flaskGrowth)}. `
        + 'It is a table so that a bigger maximum is a ROW, never an engine edit.',
    });
    return out;
  }

  const relicIds = new Set((b.relics || []).map((r) => r && r.id).filter(Boolean));
  const events = Array.isArray(b.events) ? b.events : [];
  const eventIds = new Set(events.map((e) => e && e.id).filter(Boolean));
  const eq = b.equipment || {};
  // A talisman row must name a piece the talisman slot could actually hold —
  // resolved against the slot's own `kinds` (generated/equipSlots.js), never
  // against all pieces: a row naming a weapon id would validate forever and
  // bind never, the silent-plausible failure Law 0 clause 5 names.
  const talismanSlot = (eq.slots || []).find((s) => s && s.id === 'talisman');
  const talismanKinds = talismanSlot
    ? (Array.isArray(talismanSlot.kinds) ? talismanSlot.kinds : [talismanSlot.kinds])
    : [];
  const talismanIds = new Set(
    [...(eq.armaments || []), ...(eq.armour || [])]
      .filter((p) => p && talismanKinds.includes(p.kind))
      .map((p) => p.id)
  );

  const seen = new Map();
  let growthSum = 0;

  balance.flaskGrowth.forEach((row, i) => {
    const at = `balance.flaskGrowth[${i}]`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      out.push({ key: at, msg: `must be an object { source, id, kind, amount } — got ${JSON.stringify(row)}.` });
      return;
    }
    const { source, id, kind, amount } = row;

    // 1. The source is a WORD from the closed set — his four, no fifth by typo.
    if (typeof source !== 'string' || !FLASK_GROWTH_SOURCES.includes(source)) {
      out.push({
        key: `${at}.source`,
        msg: `${JSON.stringify(source)} is not a growth source — one of ${FLASK_GROWTH_SOURCES.join(', ')} `
          + '(D17 message 6, his four words). A fifth source is an engine act (FLASK_GROWTH_SOURCES, model/schemas.js), never a row.',
      });
      return;
    }

    // 2. The kind is a charge vessel. 'utility' flasks are inventory, not charges.
    if (typeof kind !== 'string' || !CHARGE_FLASK_KINDS.includes(kind)) {
      out.push({
        key: `${at}.kind`,
        msg: `${JSON.stringify(kind)} is not a charge kind — one of ${CHARGE_FLASK_KINDS.join(', ')}. `
          + 'Only the dedicated vessels have a maximum to grow; utility flasks are carried, not charged.',
      });
      return;
    }

    // 3–5. The amount. Growth grows; each refusal says what the bad value would have done.
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      out.push({ key: `${at}.amount`, msg: `must be a number of charges — got ${JSON.stringify(amount)}.` });
      return;
    }
    if (amount <= 0) {
      out.push({
        key: `${at}.amount`,
        msg: `${amount} is not positive — this chain GROWS the maximum ("to increase the amount of charges", his words). `
          + 'A negative or zero row is a curse wearing an upgrade\'s name; a shrinking mechanic would be its own word, decided out loud.',
      });
      return;
    }
    if (!Number.isInteger(amount)) {
      out.push({
        key: `${at}.amount`,
        msg: `${amount} is fractional — a vessel holds whole charges. A fractional amount would floor into a `
          + 'different number than the one written here, on a screen that prints the one written here.',
      });
      return;
    }

    // 6. One home per grant: the same source may not grow the same kind twice.
    const dupKey = `${source}:${id}:${kind}`;
    if (seen.has(dupKey)) {
      out.push({
        key: `${at}`,
        msg: `duplicate of balance.flaskGrowth[${seen.get(dupKey)}] — '${source}' '${id}' already grows '${kind}'. `
          + 'Two rows for one grant are two homes for one number; raise the first row\'s amount instead.',
      });
      return;
    }
    seen.set(dupKey, i);

    // 7. The source ref must resolve — a dangling id is a promise to nothing.
    if (typeof id !== 'string' || !id) {
      out.push({ key: `${at}.id`, msg: `must name a ${source} id — got ${JSON.stringify(id)}.` });
      return;
    }
    if (source === 'relic' && !relicIds.has(id)) {
      out.push({ key: `${at}.id`, msg: `'${id}' is not a relic id — this row would wait forever for a relic nobody can hold.` });
      return;
    }
    if (source === 'questEvent') {
      if (!eventIds.has(id)) {
        out.push({ key: `${at}.id`, msg: `'${id}' is not an event id — this row would wait forever for an event nobody can meet.` });
        return;
      }
      // THE TWO-DOOR COLLISION: an event may grow charges through its own
      // choice effect (the moment door) OR through this chain — never both,
      // or the grant lands twice under two names.
      const ev = events.find((e) => e && e.id === id);
      const alsoImperative = (ev.choices || []).some((c) => (c && c.effects || []).some((e) => e && e.op === 'addFlaskCapacity'));
      if (alsoImperative) {
        out.push({
          key: `${at}`,
          msg: `event '${id}' already grants flask capacity through its own choice effect (op addFlaskCapacity) — `
            + 'two doors for one grant would land it twice. Keep the effect row (the working door today) or this chain row, not both.',
        });
        return;
      }
    }
    if (source === 'talisman' && !talismanIds.has(id)) {
      out.push({
        key: `${at}.id`,
        msg: `'${id}' is not a piece the talisman slot can hold (slot kinds: ${talismanKinds.join(', ') || 'none'}) — `
          + 'talismans are unauthored today (the slot ships empty, generated/equipSlots.js), so every talisman row '
          + 'refuses here until the first talisman piece is authored. That day this refusal stops firing and the row '
          + 'binds with no code change.',
      });
      return;
    }
    if (source === 'flaskSeed') {
      out.push({
        key: `${at}`,
        msg: `no flask-seed item vocabulary exists in content — the source is declared (D17 message 6) and reserved. `
          + 'A seed row becomes authorable the day seed items exist as entries; until then a row here names nothing a run could hold.',
      });
      return;
    }

    growthSum += amount;
  });

  // 8. The aggregate hard cap — armed only when authored, so no invented
  //    ceiling ships while C1 is open. Evaluated under the SHIPPED pool
  //    binding (the seam's): base capacity + all growth, worst case all held.
  //    Under the vessel reading the bound becomes per-kind — that edit lives
  //    at the seam with the rest of C1's answer.
  if (max != null) {
    let base = 0;
    try { base = flaskCapacity(balance); } catch { /* its own refusal reports it */ }
    if (base + growthSum > max) {
      out.push({
        key: 'balance.flaskGrowth',
        msg: `fully grown, the maximum would reach ${base + growthSum} charges against flaskGrowthMax ${max}. `
          + 'Raise balance.flaskGrowthMax or lower the rows; a chain that can quietly pass its own ceiling is a cap that is decoration.',
      });
    }
  }

  return out;
}
