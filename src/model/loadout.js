import { tokenRe } from './validate.js';
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
//
// HANDS — one fact, one home (Law 0 clause 4). Which hand a piece is IN is the
// SLOT's fact: the player put it there. The piece's own `hand` column says only
// which hand it MAY be held in — eligibility, never location. Those are two
// different facts and they used to be read out of one field, which is how two
// weapons could go in and one come out (Bjorn, 2026-08-07). slotHand() is the
// only answer to "which hand is this", pieceHand() the only answer to "which
// hand may this go in", and fitsSlot() is the only gate between them.

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

// ---------------------------------------------------------------------------
// Hands
// ---------------------------------------------------------------------------

/** The closed set. A third hand is a new word — engine, one act (Law 1 c1). */
export const HANDS = Object.freeze(['left', 'right']);

/**
 * slotHand(slot) → 'left' | 'right' | null — WHERE A SLOT IS.
 *
 * The one home. `null` is not "unknown", it is "this slot is not a hand":
 * armour is worn and a talisman is carried, so neither is held in one and
 * neither is drawn in one. equipSlots.csv `hand` is the only input, on purpose
 * — the id used to be sniffed for the substring 'left', which meant renaming
 * the slot moved the sprite and said nothing.
 */
export function slotHand(slot) {
  const h = slot && slot.hand;
  return HANDS.includes(h) ? h : null;
}

/**
 * pieceHand(piece) → 'left' | 'right' | null — WHERE A PIECE MAY GO.
 *
 * Eligibility, and only eligibility. `either` and a piece with no `hand` at all
 * (every armour set) are unconstrained, and read as null.
 */
export function pieceHand(piece) {
  const h = piece && piece.hand;
  return HANDS.includes(h) ? h : null;
}

/**
 * fitsSlot(slot, piece) → boolean — may this piece go in this slot?
 *
 * Two gates, both of them data: the slot's `kinds` and the piece's `hand`. The
 * only predicate in the tree that answers this, so the picker cannot offer what
 * equipPiece() refuses — offering a piece and then silently not taking it is
 * the exact shape of a player saying "the slot won't accept it".
 */
export function fitsSlot(slot, piece) {
  if (!slot || !piece) return false;
  if (!(slot.kinds || []).includes(piece.kind)) return false;
  const may = pieceHand(piece);
  return may === null || may === slotHand(slot);
}

/**
 * validateEquipment(registries) → [] when sound, else human-readable problems.
 * Catches the mistakes CSV authoring actually makes: a misspelled field, a mod
 * aimed at a prefix no class maps to a card, a slot whose `kinds` gate matches
 * nothing, a hand named on one side and not the other, a piece no slot can
 * hold, and armour that leaves a class with no starting set (or two).
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

  for (const slot of eq.slots || []) {
    if (slot.kinds.length === 0) problems.push(`slot '${slot.id}' gates on no kinds`);
  }

  // ---- hands: the slot owns the location, the piece owns the eligibility ---
  // Both vocabularies are closed, and a value outside one names its own row.
  for (const slot of eq.slots || []) {
    const h = slot.hand;
    if (h != null && h !== '' && !HANDS.includes(h)) {
      problems.push(`slot '${slot.id}': hand '${h}' is not one of ${HANDS.join('|')} (or empty for a slot that is not a hand)`);
    }
  }
  for (const piece of pieces) {
    const h = piece.hand;
    if (h != null && h !== '' && h !== 'either' && !HANDS.includes(h)) {
      problems.push(`${piece.id}: hand '${h}' is not one of ${HANDS.join('|')}|either`);
    }
  }
  // A slot holding pieces that name a hand must name one itself. Without this,
  // a slot authored with an empty `hand` takes a weapon and draws it nowhere —
  // wrong, reasonable-looking, and silent (Law 0 clause 5).
  for (const slot of eq.slots || []) {
    if (slotHand(slot)) continue;
    const handed = pieces.filter((p) => (slot.kinds || []).includes(p.kind) && pieceHand(p));
    if (handed.length) {
      problems.push(
        `slot '${slot.id}' accepts ${handed.length} piece(s) that name a hand (e.g. '${handed[0].id}') ` +
        `but names no hand itself — set hand=${HANDS.join('|')} on that row in equipSlots.csv`
      );
    }
  }
  // Every piece has somewhere to go — kind AND hand. This replaces the old
  // kind-only check, which passed a left-handed staff no slot could ever hold.
  for (const piece of pieces) {
    if (!(eq.slots || []).some((s) => fitsSlot(s, piece))) {
      problems.push(`no slot can hold '${piece.id}' (kind '${piece.kind}', hand '${piece.hand || '—'}')`);
    }
  }
  // …and the other edge: a slot whose kinds match pieces, every one of which
  // names the other hand, is a square the player can open onto an empty list.
  // A slot matching NO piece by kind is a slot authored ahead of its content
  // (talismans today) and is not this defect.
  for (const slot of eq.slots || []) {
    const byKind = pieces.filter((p) => (slot.kinds || []).includes(p.kind));
    if (byKind.length && !byKind.some((p) => fitsSlot(slot, p))) {
      problems.push(
        `slot '${slot.id}' can hold nothing: ${byKind.length} piece(s) match kinds ` +
        `'${(slot.kinds || []).join('|')}' and every one of them names the other hand`
      );
    }
  }

  for (const classId of registries.classes.ids()) {
    const sets = (eq.armour || []).filter((o) => o.classId === classId);
    const starting = sets.filter((o) => o.unlock === '');
    if (starting.length !== 1) {
      problems.push(`class '${classId}' has ${starting.length} starting armour sets (need exactly 1)`);
    }
  }
  // The ladder's one join, and it dangles the way every join dangles: a rung
  // naming a slot that is not there. Law 1 clause 5 — fail loud, name the
  // entry, and print what the author could have meant. `registries.unlocks` is
  // absent in the partial-registry call sites (tests), and an absent table is
  // "no rungs", not a defect.
  for (const u of registries.unlocks || []) {
    if (u.kind !== SLOT_RUNG_KIND) continue;
    if (!(eq.slots || []).some((s) => s.id === u.ref)) {
      problems.push(
        `unlocks.csv row '${u.id}' is a ${SLOT_RUNG_KIND} rung whose ref '${u.ref}' is not a slot — `
        + `equipSlots.csv has ${(eq.slots || []).map((s) => `'${s.id}'`).join(', ') || '(none)'}`
      );
    }
  }
  // THE LADDER'S JOIN, CHECKED IN BOTH DIRECTIONS — and the second direction is
  // Vira's finding at gate. The first draft only asked whether there were too
  // MANY rungs; too FEW is the silent one, and it is exactly Law 0 clause 5:
  // `talisman` declares 3 sets, authors 0 rungs, derives 1 forever, and every
  // instrument stays green while two thirds of a declared slot are unreachable.
  // Nothing wrong is printed because nothing wrong happens — the screen simply
  // never draws them. That is a generated result that is wrong but reasonable.
  //
  // THE CARVE-OUT IS THE FILE'S OWN, NOT A NEW ONE: a slot matching no piece by
  // kind is authored ahead of its content (talismans today) and is not this
  // defect — the same sentence the empty-slot check above already makes. So this
  // fires the day a talisman row exists, which is the day the gap becomes real.
  for (const slot of eq.slots || []) {
    const rungs = slotRungs(registries, slot.id);
    const cap = Math.max(1, Number(slot.sets) || 1);
    if (1 + rungs.length > cap) {
      problems.push(
        `slot '${slot.id}' carries ${cap} set(s) but unlocks.csv authors ${rungs.length} rung(s) for it `
        + `(${rungs.map((r) => `'${r.id}'`).join(', ')}) — a rung past the last set can never be climbed to; `
        + `raise \`sets\` on that row in equipSlots.csv or drop a rung`
      );
    }
    // AND IT ONLY FIRES WHEN THE TABLE IS THERE TO BE READ. `slotRungs` treats a
    // missing `registries.unlocks` as "no rungs", which is safe for the
    // too-MANY direction (zero can never exceed a cap) and is a lie in this one:
    // a partial registry would be told every multi-set slot is unreachable, when
    // the truth is that this check has nothing to check against. **Absent is not
    // zero.** A run that cannot know says nothing rather than something false.
    const knowable = Array.isArray((registries || {}).unlocks);
    if (knowable && 1 + rungs.length < cap && pieces.some((p) => (slot.kinds || []).includes(p.kind))) {
      problems.push(
        `slot '${slot.id}' declares ${cap} sets but only ${1 + rungs.length} can ever open `
        + `(1 free + ${rungs.length} rung(s) in unlocks.csv) — the other `
        + `${cap - 1 - rungs.length} would never be reachable; add a rung with `
        + `kind='${SLOT_RUNG_KIND}' ref='${slot.id}' or lower \`sets\` in equipSlots.csv`
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// WHAT IS YOURS — one predicate, one home (EldenSpire#90)
// ---------------------------------------------------------------------------
//
// Constantine: *"as for weapons, I should only see an inventory of the weapons
// I've collected for that character's profile. so, if I only have my starting
// weapon and a scimitar, I should only see those options."*
//
// The armoury was a CATALOGUE PRETENDING TO BE AN INVENTORY: the right-hand
// picker opened 17 chips with 16 of them locked, and the only act available on
// turn one was "Bare". The fix is not a better lock icon. It is that a thing you
// do not have is not an option.
//
// THE COLLAPSE, which is why this lives here and not in the screen. "May I have
// this?" was answered THREE TIMES, all three inside one function in a UI file,
// with three different renderings:
//
//   unlock + meta.unlocked           → a locked chip with the unlock's hint
//   unlock + reveal:'hidden'         → dropped from the list
//   drops.requireFound + meta.found  → a locked chip with a sentence hardcoded
//                                      in the screen
//
// One fact — is this piece mine — written three ways, none of them where the
// MUTATION lives. So the picker was the only thing enforcing it, and it enforced
// it by not attaching a click handler. Measured at 77a02b9, before this change:
//
//     equipPiece(R, createLoadout(R,'reaver'), 'rightHand', 0, 'greatsword')
//     → true, on a profile that has never found a greatsword.
//
// A gate only a view holds is not a gate — the same sentence already written
// above equipPiece, about the same function, for a different check. Filtering
// the chip out WITHOUT this would have made ownership LESS enforced while
// looking stricter, because absence would be the only guard left. That is the
// direction my seat is meant to fail in and it is named rather than discovered.
//
// TWO ROUTES, AND THEY ARE NOT A TEST ON `kind`. A piece is yours because you
// EARNED it (a condition — `unlock`) or because you FOUND it (a pickup —
// `drops.requireFound`). Which route applies is a fact about where the piece
// comes from: only pieces the drop table can produce can be found, and the drop
// table draws from armaments. The screen used to ask `piece.kind !== 'armor'`
// directly, which is an `if` on a content value below the content layer (Law 1
// clause 3) that happens to be correct today because every one of the 16
// armaments has `unlock: ''` and every armour row has one. A coincidence of the
// data, not a rule — so it is written here as the pool question it actually is.

/** Can this piece turn up as a drop? Only the drop pool answers to requireFound. */
export function fromDropPool(piece) {
  return !!piece && piece.kind !== 'armor';
}

/**
 * ownership(registries, { meta, loadout }) → { has(piece) }
 *
 * The one predicate. A PIECE, not an id: armour ids repeat across classes
 * ("`id` is unique per class, not globally"), so an id set would say the Reaver
 * owns the Starseer's habit.
 */
export function ownership(registries, { meta = {}, loadout = null } = {}) {
  const cfg = ((registries || {}).balance || {}).equipment || {};
  const drops = cfg.drops || {};
  const unlocked = new Set(meta.unlocked || []);
  // `persistence` decides what counts as found: what this run picked up, what
  // the profile has ever held, or both (the default — a climb that ends badly
  // still widens the wardrobe).
  const found = new Set([
    ...(cfg.persistence !== 'perRun' ? meta.found || [] : []),
    ...(cfg.persistence !== 'unlocked' ? carriedIds(loadout) : []),
  ]);
  return {
    has(piece) {
      if (!piece) return false;
      if (piece.unlock !== '' && piece.unlock != null) return unlocked.has(piece.unlock);
      if (fromDropPool(piece) && drops.requireFound) return found.has(piece.id);
      return true;
    },
  };
}

// ---------------------------------------------------------------------------
// THE SLOT LADDER — three states, and NOT a three-valued field (EldenSpire#90)
// ---------------------------------------------------------------------------
//
// Constantine: *"starts with slots locked (but only shows the next locked
// thing). so for weapon slots, it may start with just 1 with the second one
// shows a locked icon, but the third one doesn't show until the second is
// unlocked."*
//
// THE OBVIOUS FORM IS A THREE-VALUED FIELD PER CELL AND IT IS #78 AGAIN. A
// closed set of `open|next|hidden` written on each cell is a closed set PER
// CELL, so the vocabulary is the PRODUCT over cells — and that product is full
// of things nobody built: a ladder with two locked steps, a hidden cell BEFORE
// an open one, a slot with no open cell at all. Marina's property, house-wide:
// A CLOSED SET MUST STAY CLOSED UNDER WHATEVER FACTORISATION REPLACES IT.
//
// SO THE STATES ARE A DERIVATION, NOT A VOCABULARY. There is exactly one number
// — how many sets of this slot are open — and the three states are arithmetic
// on it against the cell's index. Out-of-order and two-locked are not invalid,
// they are UNREPRESENTABLE, which is the stronger thing and the same move as
// #91's `subject` pointer. Nothing here is authored per cell, so there is
// nothing for an author to write and therefore nothing to fall out of the set.
//
// AND THE NUMBER IS NOT A NEW SAVE KEY EITHER. A rung is something you EARN, and
// this game already has one home for earned things: `meta.unlocked`, filled by
// evaluateUnlocks from unlocks.csv. A rung is a ROW there — `kind` is already a
// column, and **the EARNING path never reads it**: `evaluateUnlocks` tests
// `condition` against progress and returns ids, so a new `kind` value is earned
// with no engine change at all (Law 0 clause 2). What is new is the CONSUMER,
// and that is this file: one word, one act, schema-free.
//
// *(Corrected by Vira at gate: the first draft of this comment said "nothing in
// the tree branches on its value", and `slotRungs` two screens down branches on
// it in the same commit that shipped the sentence. It was true of the earning
// path and false of the tree, and the difference is the whole claim — so it now
// says which path it is talking about.)*
//
//     id,kind,ref,name,condition,param,reveal,hint
//     rack2,slot,rightHand,Second Rack Slot,reachAct,2,listed,Reach the Stitched Court.
//
// A "TURN ONE" LADDER THAT NOTHING CAN CLIMB WOULD BE A REFUSAL WITH NO REASON.
// The next cell is shown only when a rung exists that would open it — so a slot
// with no rungs authored shows its open cells and stops, and refuses(){} is
// never asked to mark a control whose reason is the empty string. The reason a
// locked cell gives IS that rung's own `hint`, which is content. No sentence
// about locks is written in this file or in the screen.

/** The unlocks.csv `kind` that opens a set slot. One string, one home. */
export const SLOT_RUNG_KIND = 'slot';

/** The rungs of one slot's ladder, in authored order. Rung N opens set N+1. */
export function slotRungs(registries, slotId) {
  return ((registries || {}).unlocks || [])
    .filter((u) => u && u.kind === SLOT_RUNG_KIND && u.ref === slotId);
}

/**
 * openedSets(registries, slot, { meta, loadout }) → how many sets are USABLE.
 *
 * One open always: a slot you cannot use at all is not a slot, it is an absence,
 * and `sets` already says the slot exists.
 *
 * THE LEGACY FLOOR IS THE EDGE THAT WILL ACTUALLY BITE, and it is the state my
 * change INVENTS. Every loadout written before today has `sets` full-width and
 * all of it reachable, so a save can hold a weapon in set 3 with zero rungs
 * earned. Without this line that weapon is in a cell the player cannot see,
 * still counted by carriedIds, still stamping their deck — a piece stranded
 * behind a lock that did not exist when they put it there. So the loadout's own
 * contents raise the floor: what you are already holding is by definition open.
 */
export function openedSets(registries, slot, { meta = {}, loadout = null } = {}) {
  const cap = Math.max(1, Number(slot && slot.sets) || 1);
  const earned = new Set((meta && meta.unlocked) || []);
  let opened = 1;
  for (const u of slotRungs(registries, slot.id)) if (earned.has(u.id)) opened += 1;
  const ids = ((loadout && loadout.sets) || {})[slot.id] || [];
  for (let i = 0; i < ids.length; i += 1) if (ids[i]) opened = Math.max(opened, i + 1);
  return Math.min(cap, opened);
}

/**
 * visibleSets(...) → how many cells the slot DRAWS: the open ones, plus the one
 * step ahead when there is a rung left to earn. Exactly one lookahead, because
 * it is `+1` and not a range.
 */
export function visibleSets(registries, slot, ctx = {}) {
  const cap = Math.max(1, Number(slot && slot.sets) || 1);
  const opened = openedSets(registries, slot, ctx);
  const ceiling = Math.min(cap, 1 + slotRungs(registries, slot.id).length);
  return opened < ceiling ? opened + 1 : opened;
}

/** The rung that would open cell `index`, or null if nothing can. */
export function rungFor(registries, slot, index) {
  return slotRungs(registries, slot.id)[index - 1] || null;
}

/**
 * setCellState(index, opened, visible) → 'open' | 'next' | 'hidden'.
 * Total, ordered, and derived — the whole closed set, in three comparisons.
 */
export function setCellState(index, opened, visible) {
  if (index < opened) return 'open';
  if (index < visible) return 'next';
  return 'hidden';
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
 * their own `kinds`, so this finds the armour slot by what it accepts instead
 * of hard-coding 'armor', and the hands by slotHand() — a renamed slot keeps
 * working, and a fourth hand would too.
 *
 * A piece is drawn in THE SLOT IT IS IN. It used to be drawn in the hand its
 * own row named, so a right-handed weapon put in the left hand was drawn in the
 * right — and two of them at once collapsed onto one layer, last writer
 * winning: two weapons equipped, one weapon on the figure, no error anywhere
 * (Bjorn photographed it on `dev`, 2026-08-07). Nothing here reads piece.hand;
 * that field gates equipping (fitsSlot), which is a different question.
 */
export function figureSpec(registries, loadout, classId) {
  const slots = (registries.equipment || {}).slots || [];
  const spec = { armourId: 'default', rightId: null, leftId: null };
  if (!loadout) return spec;
  for (const slot of slots) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (!piece) continue;
    if (slot.kinds.includes('armor')) {
      spec.armourId = piece.id;
      continue;
    }
    const hand = slotHand(slot);
    if (hand === 'right') spec.rightId = piece.id;
    else if (hand === 'left') spec.leftId = piece.id;
    // No hand: this slot is not held (a talisman), so there is nothing to draw
    // in a hand for it. It used to land in the right hand as a weapon layer.
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

// One home: src/model/validate.js (EldenSpire#41). A fresh instance per use,
// which is also why the defensive lastIndex resets below are now redundant.
const TOKEN_RE = tokenRe();

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

/**
 * canEquip(registries, slotId, { inCombat }) → { ok, reason }.
 *
 * MAY WHAT IS IN THIS SET CHANGE RIGHT NOW — the sibling question to canSwap,
 * and the one nothing in the model answered. `canSwap` asks whether the ACTIVE
 * set may change; this asks whether a set's CONTENTS may. In a fight the answer
 * is no for every slot, and it is derived rather than authored (below).
 *
 * IT REPLACES `canUseStorage`, WHICH HAD ZERO CALLERS IN THE WHOLE TREE. That is
 * the second copy this seat exists to refuse, in its quietest form: the fact
 * "you cannot re-arm mid-fight" was written twice — once in the model, where
 * nothing read it, and once as `} else if (!inCombat) {` in the armoury's click
 * handler, where it was the only thing actually enforcing anything. The dead
 * copy is deleted and the live one moves onto the mutation (equipPiece below).
 * Same defect as #90's ownership hole, one function over, found by asking who
 * reads each of these two.
 *
 * WHY IT IS DERIVED AND NOT A COLUMN. The obvious form is an `equip` column in
 * equipSlots.csv beside `swap`. It is #78 again: a second two-valued field per
 * slot makes the vocabulary the PRODUCT of the two, and that product holds cells
 * nobody built — a slot you may re-arm but not cycle, an armour slot a row could
 * declare re-armable mid-fight while storage stays sealed under it. Changing
 * what a set HOLDS is strictly more than changing which set is ACTIVE, so the
 * answer follows from the fight, not from a row. An author writes nothing new
 * and nothing can fall out of the set (Law 0 clause 1).
 *
 * The reason is composed from the slot's own label, exactly as canSwap does it,
 * so the two sentences on this screen come from one place and read as siblings.
 */
export function canEquip(registries, slotId, { inCombat = false } = {}) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: `No slot '${slotId}'` };
  if (inCombat) {
    return {
      ok: false,
      reason: `${slot.label} is sealed in combat — you cycle between the sets you brought.`,
    };
  }
  return { ok: true, reason: '' };
}

/**
 * cycleSet(registries, loadout, slotId, index, { meta }) → mutates the active
 * set index. Returns false when the slot, the index, or the LADDER says no.
 *
 * VIRA'S GATE OF #90, AND SHE IS RIGHT THAT IT IS THE SAME DEFECT. `equipPiece`
 * above carried a comment claiming the gate was on the mutation; #90 proved that
 * sentence was about `fitsSlot` and had never been true of ownership, and moved
 * the gate. **This function was three functions below it, in the same file, in
 * the same commit, still bounding on `ids.length` — the raw array — while
 * `openedSets()` shipped directly above it already knowing the answer.** So the
 * ladder's gate was in the screen: the exact arrangement the commit spent itself
 * disproving. A truth function written in the same act is not a follow-up.
 *
 * Measured at `c43c908`, her falsifier, before this change: fresh profile,
 * `openedSets 1 · cycleSet accepts 3` on every multi-set slot — **6 of 13
 * (slot, index) pairs.**
 *
 * THE BOUND IS `openedSets()` AND NEVER `1 + rungs earned`, which is her edge 2
 * and the reason this is not "just add a comparison". A save from before today
 * has `sets` full-width with pieces already in the last cell and no rungs
 * earned; `openedSets` raises its floor to what the loadout is already holding,
 * on purpose. A bound that recomputed the ladder from the rungs alone would
 * strand a legacy player's weapon behind a lock that did not exist when they put
 * it there — worse than the defect. **One truth function, two consumers**: the
 * screen draws what `openedSets` opens and this refuses what it does not, so the
 * two cannot disagree about a cell.
 *
 * `registries` moves to the front like everything else in this module, which is
 * also what makes a call site left on the old signature fail CLOSED: the old
 * first argument was a loadout, `registries.equipment.slots` is then undefined,
 * the slot does not resolve, and it cycles nothing and says so.
 */
export function cycleSet(registries, loadout, slotId, index, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || index < 0 || index >= ids.length) return false;
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) {
    console.error(
      `cycleSet('${slotId}', ${index}): no such slot in registries.equipment — refusing.`
      + ' Call it as cycleSet(registries, loadout, slotId, index, { meta }).'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!ctx || typeof ctx !== 'object') {
    console.error(
      `cycleSet('${slotId}', ${index}): called with no ladder context — refusing.`
      + ' Pass { meta } so the bound is openedSets() and not the raw array.'
    );
    return false;
  }
  if (index >= openedSets(registries, slot, { meta: ctx.meta || {}, loadout })) return false;
  loadout.active[slotId] = index;
  return true;
}

/**
 * addToStorage(loadout, itemId, cap) → true when it went in.
 *
 * Where a found armament lands. Storage is what you are carrying but not
 * holding; hand slots are sealed against it once a fight starts (canEquip).
 * A duplicate is refused rather than stacking — you either have a Katana or
 * you don't.
 */
export function addToStorage(loadout, itemId, cap = 8) {
  if (!loadout || !itemId) return false;
  loadout.storage = loadout.storage || [];
  if (loadout.storage.includes(itemId)) return false;
  if (loadout.storage.length >= cap) return false;
  loadout.storage.push(itemId);
  return true;
}

/** Every armament this run has access to: carried, plus whatever is slotted. */
export function carriedIds(loadout) {
  if (!loadout) return [];
  const out = [...(loadout.storage || [])];
  for (const ids of Object.values(loadout.sets || {})) {
    for (const id of ids) if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) → boolean.
 * Put a piece id into a specific set of a slot; `null` clears it.
 *
 * The gate is HERE, on the mutation, and not in the screen that calls it. The
 * picker used to be the only thing deciding what may go where, so every other
 * way into a slot — a save file, a drop, a future drag, a gamepad path nobody
 * has written yet — walked straight past it. A caller that must remember to
 * check is not a gate (`bundle.mjs`, same week, same lesson). `registries` is
 * the first argument like everything else in this module, which is also what
 * makes a call site left on the old signature fail CLOSED — it equips nothing
 * and the suite says so — rather than quietly skip the new check.
 *
 * `owned` is that same sentence, one check later, and the reason it is REQUIRED
 * rather than optional (#90). Whether the piece FITS was gated here; whether it
 * is YOURS was gated only by the picker declining to attach a click handler to
 * a locked chip. #90 removes those chips, so an optional argument would have
 * left ownership enforced by nothing at all while the screen looked stricter.
 * Missing `owned` refuses and says so — the same fail-closed shape as the
 * `registries` argument above, for the same reason.
 *
 * Clearing a slot needs no ownership: putting a thing down is always allowed.
 * IT DOES NOT NEED THE COMBAT GATE ANY LESS, and the order of the two checks
 * below is where that is said. Putting a weapon down mid-fight is re-arming with
 * nothing; the ownership check has no opinion about it and the seal does. So the
 * seal is asked FIRST, above the `!itemId` return, and ownership second.
 *
 * `ctx` — `{ inCombat }` — is REQUIRED and presence-checked, for the reason the
 * two arguments above it are (#95). A context that defaults to "not in combat"
 * fails OPEN: every call site written after today would equip mid-fight by
 * saying nothing, which is how the ownership hole survived #90 in the first
 * place. A bag missing the key is refused rather than read as false, because a
 * missing key and `false` are indistinguishable and mean the opposite things.
 * `cycleSet` above already takes a required trailing context for the ladder, so
 * this is that pattern, not a new one.
 */
export function equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || setIndex < 0 || setIndex >= ids.length) return false;
  if (!ctx || typeof ctx !== 'object' || !('inCombat' in ctx)) {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): called with no combat context — refusing.`
      + ' Pass { inCombat } as the seventh argument.'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  // THE GATE IS HERE, ON THE MUTATION, and the screen no longer holds a copy of
  // it. Before #95 the only thing stopping a mid-fight re-arm was the armoury
  // declining to open its picker — a screen, not a gate, so a save file, a drop,
  // a drag, a gamepad path or a second surface walked straight past it. Measured
  // at 98fedde: equipPiece on a live combat loadout returned true.
  const seal = canEquip(registries, slotId, { inCombat: !!ctx.inCombat });
  if (!seal.ok) return false;
  if (!itemId) {
    ids[setIndex] = null;
    return true;
  }
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((s) => s.id === slotId);
  if (!slot) return false;
  // Armour ids repeat across classes; the class gate is armourById's, and this
  // one only asks whether the piece may live in this slot at all.
  const piece = slot.kinds.includes('armor')
    ? (eq.armour || []).find((o) => o.id === itemId)
    : (eq.armaments || []).find((a) => a.id === itemId);
  if (!piece || !fitsSlot(slot, piece)) return false;
  if (!owned || typeof owned.has !== 'function') {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): called with no ownership — refusing.`
      + ' Pass ownership(registries, { meta, loadout }) as the sixth argument.'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!owned.has(piece)) return false;
  ids[setIndex] = itemId;
  return true;
}
