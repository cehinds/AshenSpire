// src/model/loadout.js — what you carry, and what it does to your cards.
//
// The design rule (SPEC §3.1(2)) is that equipment may not add behaviour the
// engine doesn't already have. So a piece never ships an effect: it ships
// NUMBERS aimed at the cards you already start with. A dagger doesn't give you
// a dagger card — it turns Strike into 3 damage twice. A greatsword turns the
// same Strike into one heavy, expensive swing. The deck size never changes,
// and the engine never learns the word "dagger".
//
// Three tables do all the deciding, none of them in this file:
//   equipSlots.csv    what slots exist, how many sets each carries, swap rules
//   equipMods.csv     which fields a mod may name and how each one applies
//   equipTargets.csv  which card each mod prefix rewrites, per class
//
// Everything here is headless and pure: no document, no timers, no randomness.

// ---------------------------------------------------------------------------
// Mod strings
// ---------------------------------------------------------------------------

/**
 * parseMod('strike.damage=+4') → { prefix, field, mode: 'add'|'set', value }
 * Returns null on anything malformed; validateEquipment() reports those.
 */
export function parseMod(str) {
  const m = /^([A-Za-z]\w*)\.([A-Za-z]\w*)=([+-]?)(\d+(?:\.\d+)?)$/.exec(String(str).trim());
  if (!m) return null;
  const [, prefix, field, sign, num] = m;
  return {
    prefix,
    field,
    mode: sign ? 'add' : 'set',
    value: sign === '-' ? -Number(num) : Number(num),
  };
}

/**
 * validateEquipment(registries) → [] when sound, else human-readable problems.
 * Catches the mistakes CSV authoring actually makes: a misspelled field, a mod
 * aimed at a prefix no class maps to a card, a slot whose `kinds` gate matches
 * nothing, and armour that leaves a class with no starting set (or two).
 */
export function validateEquipment(registries) {
  const eq = registries.equipment || {};
  const fields = eq.modFields || {};
  const problems = [];
  const pieces = [...(eq.armaments || []), ...(eq.armour || [])];

  for (const piece of pieces) {
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      if (!mod) {
        problems.push(`${piece.id}: unparseable mod '${raw}'`);
        continue;
      }
      const spec = fields[mod.field];
      if (!spec) {
        problems.push(`${piece.id}: unknown mod field '${mod.field}' (register it in equipMods.csv)`);
        continue;
      }
      if (spec.scope === 'run' && mod.prefix !== 'self') {
        problems.push(`${piece.id}: '${mod.field}' is a run mod and must be written as 'self.${mod.field}'`);
      }
      if (spec.scope === 'card' && !(eq.cardTargets || []).includes(mod.prefix)) {
        problems.push(`${piece.id}: '${mod.prefix}' is not a card target (add it to equipTargets.csv)`);
      }
      if (spec.status && !registries.statuses.has(spec.status)) {
        problems.push(`equipMods.csv: field '${mod.field}' names unknown status '${spec.status}'`);
      }
    }
  }

  const kinds = new Set(pieces.map((p) => p.kind));
  for (const slot of eq.slots || []) {
    if (slot.kinds.length === 0) problems.push(`slot '${slot.id}' gates on no kinds`);
  }
  for (const kind of kinds) {
    const fits = (eq.slots || []).some((s) => s.kinds.includes(kind));
    if (!fits) problems.push(`no slot accepts pieces of kind '${kind}'`);
  }

  for (const classId of registries.classes.ids()) {
    const sets = (eq.armour || []).filter((o) => o.classId === classId);
    const starting = sets.filter((o) => o.unlock === '');
    if (starting.length !== 1) {
      problems.push(`class '${classId}' has ${starting.length} starting armour sets (need exactly 1)`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Loadout shape
// ---------------------------------------------------------------------------

/**
 * createLoadout(registries, classId) → a fresh loadout.
 *
 *   { sets: { slotId: [itemId|null × slot.sets] },
 *     active: { slotId: index },
 *     storage: [itemId] }
 *
 * Slots come from the table, so adding a row to equipSlots.csv adds a slot to
 * every new run with no change here. You start bare-handed in your class's one
 * unlocked armour set — the run is meant to arm you.
 */
export function createLoadout(registries, classId) {
  const eq = registries.equipment || {};
  const sets = {};
  const active = {};
  for (const slot of eq.slots || []) {
    sets[slot.id] = new Array(Math.max(1, slot.sets)).fill(null);
    active[slot.id] = 0;
  }
  const starting = (eq.armour || []).find((o) => o.classId === classId && o.unlock === '');
  if (starting && sets.armor) sets.armor[0] = starting.id;
  return { sets, active, storage: [] };
}

/** The piece in a slot's active set, or null. Armour resolves per class. */
export function equippedIn(registries, loadout, classId, slotId) {
  const ids = (loadout.sets || {})[slotId] || [];
  const id = ids[(loadout.active || {})[slotId] || 0];
  if (!id) return null;
  const eq = registries.equipment || {};
  const slot = (eq.slots || []).find((s) => s.id === slotId);
  if (slot && slot.kinds.includes('armor')) {
    return (eq.armour || []).find((o) => o.classId === classId && o.id === id) || null;
  }
  return (eq.armaments || []).find((a) => a.id === id) || null;
}

/** Every currently-worn piece, in slot order — the order mods apply in. */
export function equippedPieces(registries, loadout, classId) {
  if (!loadout) return [];
  const out = [];
  for (const slot of (registries.equipment || {}).slots || []) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (piece) out.push(piece);
  }
  return out;
}

/**
 * figureSpec(registries, loadout, classId) → { armourId, rightId, leftId }
 *
 * What the sprite layers should be, derived rather than stored. Slots declare
 * their own `kinds`, so this finds the armour slot and the two hands by what
 * they accept instead of hard-coding 'rightHand'/'leftHand' — a renamed slot
 * keeps working, and a fourth hand would too.
 */
export function figureSpec(registries, loadout, classId) {
  const slots = (registries.equipment || {}).slots || [];
  const spec = { armourId: 'default', rightId: null, leftId: null };
  if (!loadout) return spec;
  for (const slot of slots) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (slot.kinds.includes('armor')) {
      if (piece) spec.armourId = piece.id;
    } else if (piece) {
      // 'right'/'left' is the piece's own property (weapons.csv `hand`), with
      // the slot as the tiebreaker for anything usable in either.
      const hand = piece.hand === 'either' ? (slot.id.toLowerCase().includes('left') ? 'left' : 'right') : piece.hand;
      if (hand === 'left') spec.leftId = piece.id;
      else spec.rightId = piece.id;
    }
  }
  return spec;
}

/** Tags granted by what you're wearing (deduplicated, slot order). */
export function loadoutTags(registries, loadout, classId) {
  const seen = [];
  for (const p of equippedPieces(registries, loadout, classId)) {
    for (const t of p.tags || []) if (!seen.includes(t)) seen.push(t);
  }
  return seen;
}

/** A short string that changes whenever the worn set does — for cache keys. */
export function loadoutSignature(loadout) {
  if (!loadout) return '';
  return Object.keys(loadout.sets || {})
    .sort()
    .map((k) => `${k}:${(loadout.sets[k] || [])[(loadout.active || {})[k] || 0] || '-'}`)
    .join('|');
}

// ---------------------------------------------------------------------------
// Collecting mods
// ---------------------------------------------------------------------------

/**
 * cardMods(registries, loadout, classId) → Map(cardId → ['damage=+4', ...]).
 * The prefix is dropped because it has already done its job (choosing the
 * card); order is slot order, and the applier honours it.
 */
export function cardMods(registries, loadout, classId) {
  const eq = registries.equipment || {};
  const fields = eq.modFields || {};
  const out = new Map();
  for (const piece of equippedPieces(registries, loadout, classId)) {
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      const spec = mod && fields[mod.field];
      if (!spec || spec.scope !== 'card') continue;
      const cardId = cardForTarget(eq, mod.prefix, classId);
      if (!cardId) continue;
      const list = out.get(cardId) || [];
      list.push(`${mod.field}=${mod.mode === 'add' ? (mod.value >= 0 ? '+' : '') : ''}${mod.value}`);
      out.set(cardId, list);
    }
  }
  return out;
}

function cardForTarget(eq, target, classId) {
  const rows = eq.targets || [];
  const exact = rows.find((t) => t.target === target && t.classId === classId);
  if (exact) return exact.cardId;
  const any = rows.find((t) => t.target === target && t.classId === '*');
  return any ? any.cardId : null;
}

/**
 * runMods(registries, loadout, classId) → { maxHp, startStatuses: [{status, stacks}] }
 * The `self.*` half of the vocabulary: things a piece does to you rather than
 * to a card. startStatuses are handed straight to createCombat's existing
 * playerStatuses hook, so the engine needs no equipment code to honour them.
 */
export function runMods(registries, loadout, classId) {
  const fields = (registries.equipment || {}).modFields || {};
  const stacks = new Map();
  let maxHp = 0;
  for (const piece of equippedPieces(registries, loadout, classId)) {
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      const spec = mod && fields[mod.field];
      if (!spec || spec.scope !== 'run') continue;
      if (spec.apply === 'maxHp') {
        maxHp = mod.mode === 'add' ? maxHp + mod.value : mod.value;
      } else if (spec.apply === 'startStatus') {
        const prev = stacks.get(spec.status) || 0;
        stacks.set(spec.status, mod.mode === 'add' ? prev + mod.value : mod.value);
      }
    }
  }
  return {
    maxHp,
    startStatuses: [...stacks].filter(([, n]) => n > 0).map(([status, n]) => ({ status, stacks: n })),
  };
}

// ---------------------------------------------------------------------------
// Applying mods to a card
// ---------------------------------------------------------------------------

const TOKEN_RE = /\{([A-Za-z][\w.]*)\}/g;

function firstIndexOfOp(effects, op) {
  return effects.findIndex((e) => e && e.op === op);
}

function adjust(current, mod, floor) {
  const next = mod.mode === 'add' ? (typeof current === 'number' ? current : 0) + mod.value : mod.value;
  return floor == null ? next : Math.max(floor, next);
}

/**
 * applyCardMods(def, mods, opts) → a new card def, or `def` unchanged.
 *
 *   mods = ['damage=+4', 'hits=2', 'cost=+1']   (prefix already stripped)
 *   opts = { modFields, limits }
 *
 * Mods apply in order, so a later `=N` genuinely replaces an earlier `+N` —
 * that's what lets a Tower Shield's flat block override a smaller bonus rather
 * than stacking with it. Formula-valued amounts are left alone: a piece may
 * change a number, never the shape of an effect.
 */
export function applyCardMods(def, mods, opts = {}) {
  if (!mods || !mods.length) return def;
  const fields = opts.modFields || {};
  const limits = opts.limits || {};
  const effects = (def.effects || []).map((e) => ({ ...e }));
  let cost = def.cost;
  const touched = [];

  for (const raw of mods) {
    const mod = parseMod(`x.${raw}`);
    const spec = mod && fields[mod.field];
    if (!spec) continue;
    touched.push(spec);

    if (spec.apply === 'cost') {
      cost = adjust(cost, mod, limits.minCost != null ? limits.minCost : 0);
      continue;
    }
    if (spec.apply === 'scale') {
      for (const e of effects) {
        if (typeof e.amount === 'number') e.amount = Math.max(0, e.amount + mod.value);
        if (typeof e.stacks === 'number') e.stacks = Math.max(0, e.stacks + mod.value);
      }
      continue;
    }
    if (spec.apply === 'amount') {
      const i = firstIndexOfOp(effects, spec.op);
      const floor = spec.op === 'damage' ? limits.minDamage : spec.op === 'block' ? limits.minBlock : 0;
      if (i === -1) {
        if (mod.value > 0) effects.push({ op: spec.op, target: spec.effTarget, amount: mod.value });
      } else if (typeof effects[i].amount === 'number') {
        effects[i].amount = adjust(effects[i].amount, mod, floor != null ? floor : 0);
      }
      continue;
    }
    if (spec.apply === 'hits') {
      const i = firstIndexOfOp(effects, spec.op);
      if (i === -1) continue;
      const max = limits.maxHits != null ? limits.maxHits : 99;
      const n = adjust(effects[i].hits != null ? effects[i].hits : 1, mod, 1);
      effects[i].hits = Math.min(max, n);
      continue;
    }
    if (spec.apply === 'status') {
      const i = effects.findIndex((e) => e && e.op === 'applyStatus' && e.status === spec.status);
      if (i === -1) {
        if (mod.value > 0) {
          effects.push({ op: 'applyStatus', target: spec.effTarget, status: spec.status, stacks: mod.value });
        }
      } else if (typeof effects[i].stacks === 'number') {
        effects[i].stacks = adjust(effects[i].stacks, mod, 0);
      }
    }
  }

  // Rules text: numbers already in the template re-bind on their own (the UI
  // reads tokens off the effects). A mod that introduced something the text
  // never mentioned gets its clause appended, so a burning Strike says so.
  let textTemplate = def.textTemplate;
  const present = new Set();
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(textTemplate || '')) !== null) present.add(m[1]);
  for (const spec of touched) {
    if (!spec.clause) continue;
    TOKEN_RE.lastIndex = 0;
    const tok = TOKEN_RE.exec(spec.clause);
    if (!tok || present.has(tok[1])) continue;
    present.add(tok[1]);
    textTemplate = `${textTemplate} ${spec.clause}`.trim();
  }

  return { ...def, cost, effects, textTemplate, equipMods: mods };
}

// ---------------------------------------------------------------------------
// Stamping the deck
// ---------------------------------------------------------------------------

/**
 * stampDeck(registries, run, cards) → number of instances re-stamped.
 *
 * Card instances carry their equipment numbers as `inst.mods`, which is what
 * makes the whole system fall out of the existing architecture: resolveCard
 * already turns an instance into a def, saves already serialize instances, and
 * co-op already ships instances between seats. Nothing else had to learn about
 * equipment.
 *
 * Re-stamping is idempotent, so calling it after every swap is safe. Pass
 * `cards` to stamp a hand mid-combat; it defaults to the run deck.
 */
export function stampDeck(registries, run, cards) {
  const list = cards || run.deck || [];
  const mods = cardMods(registries, run.loadout, run.class);
  let n = 0;
  for (const inst of list) {
    const next = mods.get(inst.cardId) || [];
    const prev = inst.mods || [];
    if (next.length === prev.length && next.every((v, i) => v === prev[i])) continue;
    if (next.length) inst.mods = next;
    else delete inst.mods;
    n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Swapping
// ---------------------------------------------------------------------------

/**
 * canSwap(registries, slotId, { inCombat }) → { ok, reason }.
 * The rule lives in equipSlots.csv (`swap`): hands may be changed mid-fight at
 * a price, armour and talismans may not. Storage is sealed in combat too — you
 * cycle between the sets you brought, you don't rummage.
 */
export function canSwap(registries, slotId, { inCombat = false } = {}) {
  const slot = ((registries.equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: `No slot '${slotId}'` };
  if (inCombat && slot.swap !== 'combat') {
    return { ok: false, reason: `${slot.label} can only be changed outside combat.` };
  }
  return { ok: true, reason: '' };
}

/** canDrawFromStorage — storage is sealed once a fight starts. */
export function canUseStorage({ inCombat = false } = {}) {
  return !inCombat;
}

/**
 * cycleSet(loadout, slotId, index) → mutates the active set index.
 * Returns false when the slot or index doesn't exist.
 */
export function cycleSet(loadout, slotId, index) {
  const ids = (loadout.sets || {})[slotId];
  if (!ids || index < 0 || index >= ids.length) return false;
  loadout.active[slotId] = index;
  return true;
}

/** equipPiece — put a piece id into a specific set of a slot (null clears). */
export function equipPiece(loadout, slotId, setIndex, itemId) {
  const ids = (loadout.sets || {})[slotId];
  if (!ids || setIndex < 0 || setIndex >= ids.length) return false;
  ids[setIndex] = itemId || null;
  return true;
}
