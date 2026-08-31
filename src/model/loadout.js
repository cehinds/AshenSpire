import { tokenRe } from './validate.js';
import { deriveAttributeTierReceipt, deriveStat } from './derivedStats.js';
import { startingKitProblems } from './startingKits.js';
import { DAMAGE_SCHOOLS } from './schemas.js';
// Recording only — `note` is a no-op unless a run door is open, so the
// stampDeck calls that fire all climb long cost nothing.
import { note } from './healLedger.js';

const EQUIPMENT_PROFILE_SNAPSHOT_VERSION = 1;
const EQUIPMENT_PROFILE_PATCH_FIELDS = Object.freeze(['baseValue', 'scalingStat', 'pointsPerTier', 'rounding', 'gainPerTier', 'cap']);
const EQUIPMENT_PROFILE_CARRIER_FIELDS = Object.freeze(['damageSchool', 'exposureBuildupPerHit']);
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
export const EQUIPMENT_ROLES = Object.freeze(['attack', 'guard', 'technique']);
// ---------------------------------------------------------------------------
// The two `apply` vocabularies — one per mod scope (Viki, A8)
// ---------------------------------------------------------------------------
//
// equipMods.csv's header has always called `apply` a closed set and NOTHING HAS
// EVER CHECKED IT. `validateEquipment` checks the field name, the scope and the
// status; a row reading `apply=swapcost` or `apply=maxhp` passes every one of
// those, is collected by neither `cardMods` nor `runMods`, and does nothing —
// silently, forever. That is a legal-looking entry with a wrong-but-reasonable
// result, which is the failure Law 0 clause 5 names as the dangerous one.
//
// So the vocabulary lives beside its consumers, and each list is the set of
// values the function two hundred lines below actually branches on. A new
// `apply` is a WORD, not a row: it means teaching a consumer something, and the
// validator goes red until one has been taught (Law 0 clause 2).
export const CARD_MOD_APPLIES = Object.freeze(['amount', 'hits', 'cost', 'scale', 'status']);
export const EQUIPMENT_POOL_FIELDS = Object.freeze(['maxHp', 'maxMana', 'maxStamina']);
export const RUN_MOD_APPLIES = Object.freeze([...EQUIPMENT_POOL_FIELDS, 'startStatus', 'swapCost']);
const EQUIPMENT_POOL_CURRENT = Object.freeze({ maxHp: 'hp', maxMana: 'mana', maxStamina: 'stamina' });

/** Move one maximum while retaining deficit that may exceed the smaller vessel. */
export function moveEquipmentPool(holder, maxField, nextMax, carriedDeficit = undefined) {
  const currentField = EQUIPMENT_POOL_CURRENT[maxField];
  if (!currentField || !Number.isFinite(holder[maxField]) || !Number.isFinite(holder[currentField])) {
    throw new Error(`moveEquipmentPool requires finite ${maxField}/${currentField}`);
  }
  const oldMax = holder[maxField];
  const observedDeficit = Math.max(0, oldMax - holder[currentField]);
  const priorDeficit = Number.isInteger(carriedDeficit) && carriedDeficit >= 0 ? carriedDeficit : observedDeficit;
  // A hidden deficit can be larger than a temporarily shrunken vessel. Account
  // for spending/healing since the prior equipment move before resizing again.
  const representedDeficit = Math.min(priorDeficit, oldMax);
  const deficit = Math.max(0, priorDeficit + observedDeficit - representedDeficit);
  holder[maxField] = nextMax;
  holder[currentField] = Math.max(0, nextMax - deficit);
  return deficit;
}

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

/** Resolve explicit item attribute minima. Missing attributes fail closed. */
export function equipmentRequirementReceipt(registries, piece, attributes = {}) {
  if (!piece || typeof piece !== 'object') throw new Error('equipment requirement receipt needs a piece');
  const authored = (piece.requirements && piece.requirements.attributes) || {};
  const requirements = [];
  const failures = [];
  for (const [attributeId, required] of Object.entries(authored)) {
    if (!registries.attributes.has(attributeId)) throw new Error(`${piece.id}: unknown requirement attribute '${attributeId}'`);
    if (!Number.isInteger(required) || required < 0) throw new Error(`${piece.id}.${attributeId}: requirement minimum must be a non-negative integer`);
    const actual = attributes && attributes[attributeId];
    const row = { attributeId, required, actual: Number.isFinite(actual) ? actual : null };
    requirements.push(row);
    if (!Number.isFinite(actual) || actual < required) failures.push(row);
  }
  return { itemId: piece.id, requirements, failures, ok: failures.length === 0 };
}

/** First selected-hand requirement failure, shared by every creation mode. */
export function startingHandsRequirementFailure(registries, hands = {}, attributes = {}) {
  for (const pieceId of Object.values(hands).filter(Boolean)) {
    const piece = (registries.equipment.armaments || []).find((row) => row.id === pieceId);
    if (!piece) throw new Error(`unknown starting armament '${pieceId}'`);
    const receipt = equipmentRequirementReceipt(registries, piece, attributes);
    if (!receipt.ok) return { piece, failure: receipt.failures[0] };
  }
  return null;
}

/**
 * A total hand snapshot for character-creation stat previews. The player's
 * actual choices stay untouched so the refusal can name an incompatible item;
 * only pieces the preview run cannot legally equip are omitted from the
 * temporary loadout used to derive its displayed stats.
 */
export function previewCompatibleHands(registries, hands = {}, attributes = {}) {
  const next = {
    leftHand: hands.leftHand || null,
    rightHand: hands.rightHand || null,
  };
  for (const hand of ['leftHand', 'rightHand']) {
    const id = next[hand];
    if (!id) continue;
    const piece = (registries.equipment.armaments || []).find((row) => row.id === id);
    if (piece && !equipmentRequirementReceipt(registries, piece, attributes).ok) next[hand] = null;
  }
  return next;
}

/** Resolve whether a card fits an equipped weapon without class-id branches. */
export function cardEquipmentCompatibility(registries, { cardId, classId, pieceId } = {}) {
  const card = registries.cards.get(cardId);
  const equipment = registries.equipment || {};
  const piece = (equipment.armaments || []).find((row) => row.id === pieceId);
  if (!piece) throw new Error(`Unknown armament '${pieceId}' for card compatibility`);
  const exactRows = (equipment.cardEquipmentExceptions || []).filter((row) => row.cardId === cardId);
  if (exactRows.length) return { ok: exactRows.some((row) => row.weaponId === pieceId), reason: 'exactWeapon', cardId, pieceId };
  if (card.class === classId) return { ok: true, reason: 'class', cardId, pieceId };
  const tagging = (equipment.cardTagging || []).find((row) => row.cardId === cardId);
  const cardTags = (tagging && tagging.tags) || [];
  const sharedTags = cardTags.filter((tag) => (piece.tags || []).includes(tag));
  if (sharedTags.length) return { ok: true, reason: 'tag', sharedTags, cardId, pieceId };
  return { ok: false, reason: 'noMatch', sharedTags: [], cardId, pieceId };
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
  const profilesPresent = Array.isArray(eq.basicCardProfiles);
  const profiles = eq.basicCardProfiles || [];
  const profileIds = new Set();
  const tagIds = new Set((registries.tags || []).map((t) => t.id));
  const attributeIds = new Set(registries.attributes && registries.attributes.ids ? registries.attributes.ids() : []);
  if (Array.isArray(eq.startingKits)) problems.push(...startingKitProblems(registries));

  if (profilesPresent) {
    if (!Array.isArray(eq.equipmentRequirements)) problems.push('equipmentRequirements.csv: missing generated table');
    if (!Array.isArray(eq.cardEquipmentExceptions)) problems.push('cardEquipmentExceptions.csv: missing generated table');
    if (!Array.isArray(eq.cardTagging)) problems.push('cardTagging.csv: missing registered table');
  }
  const requirementKeys = new Set();
  for (const row of eq.equipmentRequirements || []) {
    const key = `${row.itemId}:${row.attributeId}`;
    if (requirementKeys.has(key)) problems.push(`equipmentRequirements.csv: duplicate '${key}'`);
    requirementKeys.add(key);
    if (!pieces.some((piece) => piece.id === row.itemId)) problems.push(`equipmentRequirements.csv: unknown item '${row.itemId}'`);
    if (!attributeIds.has(row.attributeId)) problems.push(`equipmentRequirements.csv: unknown attribute '${row.attributeId}'`);
    if (!Number.isInteger(row.minimum) || row.minimum < 0) problems.push(`${key}: minimum must be a non-negative integer`);
  }
  const exceptionKeys = new Set();
  for (const row of eq.cardEquipmentExceptions || []) {
    const key = `${row.cardId}:${row.weaponId}`;
    if (exceptionKeys.has(key)) problems.push(`cardEquipmentExceptions.csv: duplicate '${key}'`);
    exceptionKeys.add(key);
    if (!registries.cards.has(row.cardId)) problems.push(`cardEquipmentExceptions.csv: unknown card '${row.cardId}'`);
    if (!(eq.armaments || []).some((piece) => piece.id === row.weaponId)) problems.push(`cardEquipmentExceptions.csv: unknown weapon '${row.weaponId}'`);
  }
  for (const piece of pieces) {
    try { equipmentRequirementReceipt(registries, piece, {}); }
    catch (error) { problems.push(error.message); }
  }

  // A row may deliberately reuse an existing generic render instead of adding
  // binary art in the same feature. The reference is explicit and truthful:
  // every renderer-owned field must match the row whose asset is reused.
  const armamentById = new Map((eq.armaments || []).map((piece) => [piece.id, piece]));
  for (const piece of eq.armaments || []) {
    const artKey = piece.artKey || piece.id;
    const source = armamentById.get(artKey);
    if (!source) {
      problems.push(`${piece.id}: artKey '${artKey}' is not a registered armament render`);
      continue;
    }
    if (artKey === piece.id) continue;
    for (const field of ['geom', 'scale', 'metal', 'accent']) {
      if (String(piece[field]) !== String(source[field])) {
        problems.push(`${piece.id}: ${field} '${piece[field]}' disagrees with artKey '${artKey}' field '${source[field]}'`);
      }
    }
  }

  for (const profile of profiles) {
    if (profileIds.has(profile.id)) problems.push(`basicCardProfiles.csv: duplicate profile id '${profile.id}'`);
    profileIds.add(profile.id);
    if (!EQUIPMENT_ROLES.includes(profile.role)) problems.push(`${profile.id}: unknown equipment role '${profile.role}'`);
    if (!registries.cards.has(profile.baseCardId)) problems.push(`${profile.id}: unknown base card '${profile.baseCardId}'`);
    if (!DAMAGE_SCHOOLS.includes(profile.damageSchool)) problems.push(`${profile.id}: unknown damage school '${profile.damageSchool}'`);
    if (!Number.isFinite(profile.baseValue) || profile.baseValue < 0) problems.push(`${profile.id}: baseValue must be finite and non-negative`);
    if (!attributeIds.has(profile.scalingStat)) problems.push(`${profile.id}: unknown scalingStat '${profile.scalingStat}'`);
    if (!Number.isFinite(profile.pointsPerTier) || profile.pointsPerTier <= 0) problems.push(`${profile.id}: pointsPerTier must be finite and > 0`);
    if (!['floor', 'ceil', 'round'].includes(profile.rounding)) problems.push(`${profile.id}: unknown rounding '${profile.rounding}'`);
    if (!Number.isFinite(profile.gainPerTier)) problems.push(`${profile.id}: gainPerTier must be finite`);
    if (profile.cap !== '' && profile.cap != null && (!Number.isFinite(profile.cap) || profile.cap < 0)) problems.push(`${profile.id}: cap must be blank or a finite non-negative number`);
    if (profile.compatibility !== `${profile.role}-v1`) problems.push(`${profile.id}: compatibility '${profile.compatibility}' must match role vocabulary '${profile.role}-v1'`);
    for (const tag of profile.tags || []) if (!tagIds.has(tag)) problems.push(`${profile.id}: unknown profile tag '${tag}'`);
    for (const raw of profile.mods || []) if (!parseMod(`${profile.role}.${raw}`)) problems.push(`${profile.id}: unparseable profile mod '${raw}'`);
  }

  for (const piece of profilesPresent ? (eq.armaments || []) : []) {
    for (const role of EQUIPMENT_ROLES) {
      const profileId = piece[`${role}Profile`];
      if (!profileId) continue;
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) problems.push(`${piece.id}: unknown ${role} profile '${profileId}'`);
      else if (profile.role !== role) problems.push(`${piece.id}: ${role}Profile '${profileId}' has wrong role '${profile.role}'`);
    }
    try { WeaponCardPackageModel.fromPiece(registries, piece); }
    catch (error) { problems.push(error.message); }
  }

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

  // ---- the `apply` vocabulary, which nothing checked until A8 --------------
  // equipMods.csv's header calls `apply` a closed set; `cardMods`, `runMods`
  // and `applyCardMods` are the three functions that branch on it, and until
  // now a row naming a fourth value passed every check and did NOTHING. Legal
  // input, no output, no complaint — Law 0 clause 5's dangerous half. The lists
  // live beside those consumers (CARD_MOD_APPLIES / RUN_MOD_APPLIES).
  for (const [field, spec] of Object.entries(fields)) {
    const legal = spec.scope === 'run' ? RUN_MOD_APPLIES : spec.scope === 'card' ? CARD_MOD_APPLIES : null;
    if (!legal) {
      problems.push(`equipMods.csv: field '${field}' has scope '${spec.scope}' — expected 'card' or 'run'`);
      continue;
    }
    if (!legal.includes(spec.apply)) {
      problems.push(
        `equipMods.csv: field '${field}' applies '${spec.apply}', which no ${spec.scope} consumer handles `
        + `— it would collect nothing and change nothing. Legal for scope '${spec.scope}': ${legal.join(', ')}`
      );
    }
  }

  // ABSENT IS NOT ZERO — this file's own rule, applied to itself. The partial
  // registries the tests build carry no `balance`, and telling one of them its
  // swap cost is malformed would be the checker inventing a defect out of not
  // being able to look. No balance block, nothing to say.
  const eqBal = ((registries.balance || {}).equipment) || null;
  if (eqBal) validateEquipmentBalance(pieces, eqBal, problems);

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
  // A carried hand slot must name its location even when every shipped piece
  // is side-neutral. Without this, a slot authored with an empty `hand` takes
  // an armament and draws it nowhere — wrong, reasonable-looking, and silent.
  for (const slot of eq.slots || []) {
    if (slotHand(slot)) continue;
    const held = pieces.filter((p) => (slot.kinds || []).includes(p.kind));
    const handed = held.filter((p) => pieceHand(p));
    if ((slot.storage && held.length) || handed.length) {
      problems.push(
        `slot '${slot.id}' accepts ${held.length} held piece(s) (e.g. '${held[0].id}') ` +
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

  if (eqBal) {
    const roleCopies = eqBal.roleCopies || {};
    const total = [...EQUIPMENT_ROLES, 'signature'].reduce((sum, role) => sum + (Number(roleCopies[role]) || 0), 0);
    if (total !== registries.balance.startingDeckSize) {
      problems.push(`balance.equipment.roleCopies sum ${total}; startingDeckSize is ${registries.balance.startingDeckSize}`);
    }
    if (roleCopies.signature !== 1) problems.push('balance.equipment.roleCopies.signature must be exactly 1');
    for (const role of EQUIPMENT_ROLES) {
      const sources = (eqBal.roleSources || {})[role];
      if (!Array.isArray(sources) || !sources.length) { problems.push(`roleSources.${role} must be non-empty`); continue; }
      const seenSlots = new Set();
      for (const source of sources) {
        if (!(eq.slots || []).some((s) => s.id === source.slot)) problems.push(`roleSources.${role} names unknown slot '${source.slot}'`);
        if (seenSlots.has(source.slot)) problems.push(`roleSources.${role} duplicates slot '${source.slot}' at equal precedence`);
        seenSlots.add(source.slot);
      }
      const fallback = (eqBal.unarmedProfiles || {})[role];
      const profile = profiles.find((p) => p.id === fallback);
      if (!profile || profile.role !== role) problems.push(`unarmedProfiles.${role} '${fallback}' does not resolve to a ${role} profile`);
    }
  }
  return problems;
}


/**
 * The `balance.equipment` half of the equipment check (Viki, A8/A7).
 *
 * Separate only because its input is separate: everything above validates what
 * an AUTHOR wrote in a spreadsheet, and this validates what a TUNER wrote in
 * balance.js. Both are data and both fail loud by name; a partial registry has
 * the first and not the second, and the caller says so rather than guessing.
 */
function validateEquipmentBalance(pieces, eqBal, problems) {
  // ---- A FEW BASIC WEAPONS FOR ALL (A7) ------------------------------------
  // `basicTag` is the one word behind *"maybe a few basic weapons become
  // available for all"*, and each refusal below exists because the failure it
  // catches is SILENT: the shelf looks exactly the way it looked before, and
  // nobody can tell a setting that is off from one that is broken.
  const basicTag = eqBal.basicTag;
  if (basicTag != null && basicTag !== '') {
    if (typeof basicTag !== 'string') {
      problems.push(`balance.equipment.basicTag must be a tag id string or '' — got ${JSON.stringify(basicTag)}`);
    } else {
      const carriers = pieces.filter((p) => (p.tags || []).includes(basicTag));
      if (!carriers.length) {
        problems.push(
          `balance.equipment.basicTag is '${basicTag}' and no armament carries that tag — `
          + `the universal shelf would be empty and say nothing. Tag a row in weapons.csv or set basicTag to ''`
        );
      }
      for (const p of carriers) {
        // `basic` answers the FOUND gate; an unlock is the EARNED gate. A row
        // wearing both is an author saying two opposite things, and the one
        // that would win is an implementation detail of `ownership()`.
        if (p.unlock !== '' && p.unlock != null) {
          problems.push(
            `'${p.id}' is tagged '${basicTag}' (everybody's) AND has unlock '${p.unlock}' (earned) — `
            + `pick one: drop the tag, or clear the unlock`
          );
        }
        // Armour never enters the drop pool, so `basic` has no gate to answer
        // on it and would sit there looking meaningful.
        if (!fromDropPool(p)) {
          problems.push(
            `'${p.id}' is tagged '${basicTag}' but its kind '${p.kind}' never drops, so the tag can never do `
            + `anything — '${basicTag}' answers the found gate only`
          );
        }
      }
    }
  }

  // ---- THE SWAP-COST CHAIN (A8) --------------------------------------------
  // Three rules he can try, so three ways to author one that quietly charges
  // the default forever. Each of these names the row.
  const rules = eqBal.swapCostRules;
  if (rules != null) {
    if (!Array.isArray(rules) || !rules.length) {
      problems.push('balance.equipment.swapCostRules must be a non-empty array of rule rows');
    } else {
      const seen = new Set();
      for (const r of rules) {
        const at = `swapCostRules row '${(r && r.id) || '(no id)'}'`;
        if (!r || typeof r.id !== 'string' || !r.id) { problems.push(`${at}: every rule row needs an id`); continue; }
        if (seen.has(r.id)) problems.push(`${at}: duplicate rule id — the later row is unreachable`);
        seen.add(r.id);
        if (!SWAP_COST_BASES.includes(r.base)) {
          problems.push(`${at}: base '${r.base}' is not one of ${SWAP_COST_BASES.join('|')}`);
        }
        if (typeof r.gear !== 'boolean') {
          problems.push(`${at}: gear must be true or false — got ${JSON.stringify(r.gear)}`);
        }
      }
      if (!seen.has(eqBal.swapCostRule)) {
        problems.push(
          `balance.equipment.swapCostRule is '${eqBal.swapCostRule}', which is not a rule id — `
          + `authored rules: ${[...seen].map((s) => `'${s}'`).join(', ')}`
        );
      }
    }
  }
  if (!Number.isInteger(eqBal.swapCost) || eqBal.swapCost < 0) {
    problems.push(`balance.equipment.swapCost must be a whole number ≥ 0 — got ${JSON.stringify(eqBal.swapCost)}`);
  }
  for (const r of eqBal.swapCostByCategory || []) {
    const at = `swapCostByCategory row '${(r && r.tag) || '(no tag)'}'`;
    if (!r || typeof r.tag !== 'string' || !r.tag) { problems.push(`${at}: every category row needs a tag`); continue; }
    // A category nothing carries is the silent one: the rule is live, the row
    // is legal, and no weapon in the game will ever match it.
    if (!pieces.some((p) => (p.tags || []).includes(r.tag))) {
      problems.push(`${at}: no armament carries tag '${r.tag}', so this cost can never be charged`);
    }
    if (!Number.isInteger(r.cost) || r.cost < 0) {
      problems.push(`${at}: cost must be a whole number ≥ 0 — got ${JSON.stringify(r.cost)}`);
    }
  }
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

// TWO QUESTIONS, ONE LADDER OF IFS — added when the Compendium arrived (#90
// sibling). `has()` answers *is this piece yours*; a screen that draws what is
// NOT yours needs a second thing — *which of the two routes withheld it* — so
// it can say why without guessing. Freja's `pieceReveal` derived that route a
// second time, off `piece.kind` and a caller-built `available` set, and the
// second derivation agreed with this one only by coincidence of today's data.
//
// So the route is returned FROM HERE, by the same `if` ladder that decides the
// boolean. `has` is `why(piece) === null` and cannot disagree with it — not
// "checked to agree", unable to differ. A third route tomorrow is one branch in
// one function, and OWNERSHIP_GATES below is what makes the screens notice it.
//
// The set is CLOSED and DECLARED, and the test asserts every member of it has a
// sentence in LOCK_COPY — the same declared-and-handled join #88 uses. A route
// with no words is the "graceful" empty tooltip my card warns about.

/** Why a piece is not yours. Closed; every member needs a sentence in LOCK_COPY. */
export const OWNERSHIP_GATES = Object.freeze(['unearned', 'unfound']);

/**
 * ownership(registries, { meta, loadout }) → { has(piece), why(piece) }
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
  const creationArmourGrant = loadout && loadout.creationArmourGrant;
  // A missing piece resolves to 'unearned' rather than to a fourth value: there
  // is no row to read a hint from, and 'unearned' is the route whose sentence is
  // generic. 'unfound' would promise the player it turns up in treasure, which
  // is a lie about a piece that does not exist. `has(null)` stays false either
  // way, which is the behaviour every caller already had.
  // A FEW BASIC WEAPONS FOR ALL (A7). Constantine: *"everything else is profile
  // specific but maybe a few basic weapons become available for all."*
  //
  // IT ANSWERS THE FOUND GATE AND ONLY THAT, which is why it is inside the
  // `requireFound` branch rather than a fourth `if` at the top. A piece is not
  // yours for two independent reasons — earned (`unlock`) and found (the drop
  // pool) — and a tag that short-circuited BOTH would make one word able to
  // unlock content, which is not what "basic" means and not what he asked for.
  // The two gates compose; a row wearing both is refused by name at validation,
  // so this order is not a tiebreak, it is the absence of a tie.
  const basicTag = cfg.basicTag;
  const isBasic = (piece) => !!basicTag && (piece.tags || []).includes(basicTag);
  const why = (piece) => {
    if (!piece) return 'unearned';
    if (creationArmourGrant
      && creationArmourGrant.classId === piece.classId
      && creationArmourGrant.id === piece.id) return null;
    if (piece.unlock !== '' && piece.unlock != null) {
      return unlocked.has(piece.unlock) ? null : 'unearned';
    }
    if (fromDropPool(piece) && drops.requireFound) {
      return isBasic(piece) || found.has(piece.id) ? null : 'unfound';
    }
    return null;
  };
  return {
    why,
    has(piece) { return !!piece && why(piece) === null; },
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
export function createLoadout(registries, classId, startingKit = null, startingArmour = null) {
  const eq = registries.equipment || {};
  const sets = {};
  const active = {};
  for (const slot of eq.slots || []) {
    sets[slot.id] = new Array(Math.max(1, slot.sets)).fill(null);
    active[slot.id] = 0;
  }
  // `startingArmour` is a RESOLVED row (model/startingKits.js
  // resolveStartingArmour — class-checked, eligibility-checked), never a bare
  // id: an id validated here would be a second decider for one question.
  // Absent, the class's free set — byte-for-byte the old behaviour.
  const starting = startingArmour
    || (eq.armour || []).find((o) => o.classId === classId && o.unlock === '');
  if (starting && sets.armor) sets.armor[0] = starting.id;
  const kit = startingKit || (eq.startingKits || []).find((row) => row.classId === classId && row.baseline === true);
  for (const [slotId, pieceId] of Object.entries({ rightHand: kit && kit.rightHand, leftHand: kit && kit.leftHand })) {
    if (!pieceId) continue;
    if (sets[slotId]) sets[slotId][0] = pieceId;
  }
  return {
    sets,
    active,
    storage: [],
    creationArmourGrant: starting ? { classId, id: starting.id } : null,
  };
}

function profileById(registries, id) {
  return ((registries.equipment || {}).basicCardProfiles || []).find((p) => p.id === id) || null;
}

function profileRule(profile) {
  return {
    ...Object.fromEntries(EQUIPMENT_PROFILE_PATCH_FIELDS.map((key) => [key, profile[key] === '' ? null : profile[key]])),
    ...Object.fromEntries(EQUIPMENT_PROFILE_CARRIER_FIELDS.map((key) => [key, profile[key]])),
    compatibility: profile.compatibility,
  };
}

function profileLayers(options = {}) {
  return [options.modeModifiers, ...(Array.isArray(options.runModifiers) ? options.runModifiers : options.runModifiers ? [options.runModifiers] : []), options.explicitOverride];
}

/** Host-owned equipment scaling rows, resolved once and persisted with the run. */
export function createEquipmentProfileRuleSnapshot(registries, options = {}) {
  const profiles = Object.fromEntries((registries.equipment.basicCardProfiles || []).map((profile) => [profile.id, profileRule(profile)]));
  for (const layer of profileLayers(options)) {
    if (!layer || layer.equipmentProfiles == null) continue;
    if (!layer.equipmentProfiles || typeof layer.equipmentProfiles !== 'object' || Array.isArray(layer.equipmentProfiles)) throw new Error('equipmentProfiles override must be an object map');
    for (const [id, patch] of Object.entries(layer.equipmentProfiles)) {
      if (!profiles[id]) throw new Error(`equipmentProfiles.${id}: unknown profile`);
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error(`equipmentProfiles.${id}: patch must be an object`);
      for (const key of Object.keys(patch)) if (!EQUIPMENT_PROFILE_PATCH_FIELDS.includes(key)) throw new Error(`equipmentProfiles.${id}.${key}: unknown field`);
      Object.assign(profiles[id], patch);
    }
  }
  const rarityBonuses = structuredClone(((registries.balance || {}).equipment || {}).rarityBonuses || {});
  return restoreEquipmentProfileRuleSnapshot({ snapshotVersion: EQUIPMENT_PROFILE_SNAPSHOT_VERSION, profiles, rarityBonuses }, registries);
}

/** Validate and clone a saved equipment scaling snapshot without live-data repair. */
export function restoreEquipmentProfileRuleSnapshot(snapshot, registries) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('equipment profile snapshot must be an object');
  if (snapshot.snapshotVersion !== EQUIPMENT_PROFILE_SNAPSHOT_VERSION) throw new Error(`unknown equipment profile snapshotVersion ${snapshot.snapshotVersion}`);
  if (!snapshot.profiles || typeof snapshot.profiles !== 'object' || Array.isArray(snapshot.profiles)) throw new Error('equipment profile snapshot profiles must be an object map');
  snapshot = structuredClone(snapshot);
  const liveIds = new Set((registries.equipment.basicCardProfiles || []).map((profile) => profile.id));
  for (const id of Object.keys(snapshot.profiles)) if (!liveIds.has(id)) throw new Error(`equipment profile snapshot has unknown '${id}'`);
  for (const profile of registries.equipment.basicCardProfiles || []) {
    const rule = snapshot.profiles[profile.id];
    if (!rule) throw new Error(`equipment profile snapshot missing '${profile.id}'`);
    if (!Number.isFinite(rule.baseValue)) throw new Error(`${profile.id}.baseValue must be finite`);
    if (!registries.attributes.has(rule.scalingStat)) throw new Error(`${profile.id}.scalingStat '${rule.scalingStat}' is unknown`);
    if (!Number.isFinite(rule.pointsPerTier) || rule.pointsPerTier <= 0) throw new Error(`${profile.id}.pointsPerTier must be > 0`);
    if (!['floor', 'ceil', 'round'].includes(rule.rounding)) throw new Error(`${profile.id}.rounding '${rule.rounding}' is unknown`);
    if (!Number.isFinite(rule.gainPerTier)) throw new Error(`${profile.id}.gainPerTier must be finite`);
    if (rule.cap != null && (!Number.isFinite(rule.cap) || rule.cap < 0)) throw new Error(`${profile.id}.cap must be null or finite non-negative`);
    if (rule.compatibility !== `${profile.role}-v1`) throw new Error(`${profile.id}.compatibility '${rule.compatibility}' does not match ${profile.role}-v1`);
    // Version-1 snapshots predate combat carriers. They adopt the live row
    // exactly once during migration; every subsequent save owns the values.
    if (rule.damageSchool === undefined) rule.damageSchool = profile.damageSchool;
    if (rule.exposureBuildupPerHit === undefined) rule.exposureBuildupPerHit = profile.exposureBuildupPerHit;
    if (!DAMAGE_SCHOOLS.includes(rule.damageSchool)) throw new Error(`${profile.id}.damageSchool '${rule.damageSchool}' is unknown`);
    if (!Number.isInteger(rule.exposureBuildupPerHit) || rule.exposureBuildupPerHit < 0) throw new Error(`${profile.id}.exposureBuildupPerHit must be a non-negative integer`);
    const legal = [...EQUIPMENT_PROFILE_PATCH_FIELDS, ...EQUIPMENT_PROFILE_CARRIER_FIELDS, 'compatibility'];
    for (const key of Object.keys(rule)) if (!legal.includes(key)) throw new Error(`${profile.id}.${key}: unknown equipment profile snapshot field`);
  }
  if (!snapshot.rarityBonuses || typeof snapshot.rarityBonuses !== 'object' || Array.isArray(snapshot.rarityBonuses)) throw new Error('equipment profile snapshot rarityBonuses must be an object');
  for (const [rarity, bonuses] of Object.entries(snapshot.rarityBonuses)) {
    if (!bonuses || typeof bonuses !== 'object' || Array.isArray(bonuses)) throw new Error(`rarityBonuses.${rarity} must be an object`);
    for (const [role, value] of Object.entries(bonuses)) {
      if (!EQUIPMENT_ROLES.includes(role)) throw new Error(`rarityBonuses.${rarity}.${role}: unknown role`);
      if (!Number.isFinite(value)) throw new Error(`rarityBonuses.${rarity}.${role}: must be finite`);
    }
  }
  return snapshot;
}

/** Resolve one equipment role from the data-owned ordered source table. */
export function equipmentRoleSource(registries, loadout, classId, role) {
  const eqBal = (registries.balance || {}).equipment || {};
  const sources = (eqBal.roleSources || {})[role] || [];
  for (const source of sources) {
    const piece = equippedIn(registries, loadout, classId, source.slot);
    if (!piece) continue;
    if (source.kinds && !source.kinds.includes(piece.kind)) continue;
    const profileId = piece[`${role}Profile`];
    if (profileId) return { role, slotId: source.slot, piece, profile: profileById(registries, profileId) };
  }
  const profileId = (eqBal.unarmedProfiles || {})[role];
  return { role, slotId: null, piece: null, profile: profileById(registries, profileId) };
}

/** One projection consumed by run creation, cards, Armoury, and creation UI. */
export function equipmentKitPlan(registries, loadout, classId) {
  return EQUIPMENT_ROLES.map((role) => equipmentRoleSource(registries, loadout, classId, role));
}

function roleAmountReceipt(registries, row, attributes, equipmentProfileRuleSnapshot) {
  const profile = row.profile;
  const rule = equipmentProfileRuleSnapshot && equipmentProfileRuleSnapshot.profiles && equipmentProfileRuleSnapshot.profiles[profile.id];
  if (!rule) throw new Error(`equipment profile snapshot missing '${profile.id}'`);
  const tier = deriveAttributeTierReceipt(rule, { attributes, sourceStat: rule.scalingStat });
  const rarity = row.piece && row.piece.rarity;
  const rarityBonus = (((equipmentProfileRuleSnapshot.rarityBonuses || {})[rarity] || {})[row.role]) || 0;
  const raw = rule.baseValue + tier.value + rarityBonus;
  const value = Number.isFinite(rule.cap) ? Math.min(rule.cap, raw) : raw;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${profile.id}: resolved equipment profile value must be finite and non-negative (got ${value})`);
  return { role: row.role, profileId: profile.id, pieceId: row.piece && row.piece.id, base: rule.baseValue, rarity, rarityBonus, ...tier, raw, cap: rule.cap, value };
}

/** Calculation receipts; the tier arithmetic is owned by derivedStats.js. */
export function equipmentKitReceipt(registries, loadout, classId, attributes, equipmentProfileRuleSnapshot) {
  const snapshot = restoreEquipmentProfileRuleSnapshot(equipmentProfileRuleSnapshot, registries);
  return equipmentKitPlan(registries, loadout, classId).map((row) => ({ ...row, receipt: roleAmountReceipt(registries, row, attributes, snapshot) }));
}

// ---------------------------------------------------------------------------
// Weapon card packages
// ---------------------------------------------------------------------------

const WEAPON_CARD_PACKAGE_COMPATIBILITY = 'attack-v1';

function attackProfileFor(registries, profileId, owner) {
  const profile = profileById(registries, profileId);
  if (!profile) throw new Error(`${owner}: missing attack profile '${profileId}'`);
  if (profile.role !== 'attack' || profile.compatibility !== WEAPON_CARD_PACKAGE_COMPATIBILITY) {
    throw new Error(`${owner}: attack profile '${profileId}' is not ${WEAPON_CARD_PACKAGE_COMPATIBILITY}`);
  }
  if (!profile.baseCardId || !registries.cards.has(profile.baseCardId)) {
    throw new Error(`${owner}: attack profile '${profileId}' has no valid filler card`);
  }
  return profile;
}

/**
 * The authored weapon-package seam. Existing `attackProfile` rows adapt to an
 * empty priority list plus that profile as filler; explicit packages may add
 * ordered one-off card refs without changing the number of attack instances.
 */
export const WeaponCardPackageModel = Object.freeze({
  fromPiece(registries, piece) {
    if (!piece) return null;
    const explicit = piece.weaponCardPackage;
    if (explicit == null && !piece.attackProfile) return null;
    if (explicit != null && (!explicit || typeof explicit !== 'object' || Array.isArray(explicit))) {
      throw new Error(`${piece.id}: weaponCardPackage must be an object`);
    }
    const source = explicit || {};
    if (explicit && source.compatibility !== WEAPON_CARD_PACKAGE_COMPATIBILITY) {
      throw new Error(`${piece.id}: weapon package compatibility must be ${WEAPON_CARD_PACKAGE_COMPATIBILITY}`);
    }
    const handsRequired = source.handsRequired ?? piece.handsRequired ?? 1;
    if (![1, 2].includes(handsRequired)) throw new Error(`${piece.id}: handsRequired must be 1 or 2`);
    const fillerAttackProfileId = explicit ? source.fillerAttackProfileId : piece.attackProfile;
    if (!fillerAttackProfileId) throw new Error(`${piece.id}: weapon package is missing fillerAttackProfileId`);
    const filler = attackProfileFor(registries, fillerAttackProfileId, piece.id);
    const priorityAttackRefs = source.priorityAttackRefs == null ? [] : source.priorityAttackRefs;
    if (!Array.isArray(priorityAttackRefs)) throw new Error(`${piece.id}: priorityAttackRefs must be an array`);
    const seen = new Set();
    const priorities = priorityAttackRefs.map((raw, index) => {
      const ref = typeof raw === 'string' ? { cardId: raw } : raw;
      if (!ref || typeof ref !== 'object' || Array.isArray(ref) || !ref.cardId) {
        throw new Error(`${piece.id}: priorityAttackRefs[${index}] must name cardId`);
      }
      if (!registries.cards.has(ref.cardId)) throw new Error(`${piece.id}: priority attack card '${ref.cardId}' is unknown`);
      const profileId = ref.profileId || filler.id;
      attackProfileFor(registries, profileId, piece.id);
      const key = `${ref.cardId}|${profileId}`;
      if (seen.has(key)) throw new Error(`${piece.id}: duplicate priority attack ref '${key}'`);
      seen.add(key);
      return { cardId: ref.cardId, profileId };
    });
    return Object.freeze({
      weaponId: piece.id,
      handsRequired,
      priorityAttackRefs: Object.freeze(priorities),
      fillerAttackProfileId: filler.id,
      compatibility: WEAPON_CARD_PACKAGE_COMPATIBILITY,
    });
  },
});

function handSource(registries, loadout, classId, hand) {
  const slot = ((registries.equipment || {}).slots || []).find((row) => slotHand(row) === hand);
  if (!slot) throw new Error(`No equipment slot declares hand '${hand}'`);
  const piece = equippedIn(registries, loadout, classId, slot.id);
  return { hand, slotId: slot.id, piece, package: WeaponCardPackageModel.fromPiece(registries, piece) };
}

function quotaRefs(registries, source, count) {
  const filler = attackProfileFor(registries, source.package.fillerAttackProfileId, source.package.weaponId);
  const refs = source.package.priorityAttackRefs.slice(0, count);
  while (refs.length < count) refs.push({ cardId: filler.baseCardId, profileId: filler.id });
  return refs.map((ref) => ({
    sourceHand: source.hand,
    weaponId: source.package.weaponId,
    cardId: ref.cardId,
    profileId: ref.profileId,
  }));
}

/** Pure deterministic projection from active hand equipment to authored slots. */
export function buildEquippedWeaponCardPlan(registries, loadout, classId, { attackSlotCount = undefined } = {}) {
  const configured = Number(((registries.balance || {}).equipment || {}).roleCopies?.attack);
  const count = attackSlotCount === undefined ? configured : Number(attackSlotCount);
  if (!Number.isInteger(count) || count < 0) throw new Error(`attackSlotCount must be a non-negative integer (got ${attackSlotCount})`);
  const right = handSource(registries, loadout, classId, 'right');
  const left = handSource(registries, loadout, classId, 'left');
  if (right.piece && left.piece && right.piece.id === left.piece.id) {
    throw new Error(`duplicate equipped armament '${right.piece.id}' has no distinct equipment-instance identity`);
  }
  const eligible = [right, left].filter((source) => source.package);
  const twoHanded = eligible.find((source) => source.package.handsRequired === 2);
  if (twoHanded && ((twoHanded.hand === 'right' ? left.piece : right.piece) || eligible.length > 1)) {
    throw new Error(`${twoHanded.package.weaponId}: two-handed weapon conflicts with occupied offhand`);
  }

  let refs;
  if (twoHanded) refs = quotaRefs(registries, twoHanded, count);
  else if (eligible.length === 2) {
    refs = [
      ...quotaRefs(registries, right, Math.ceil(count / 2)),
      ...quotaRefs(registries, left, Math.floor(count / 2)),
    ];
  } else if (eligible.length === 1) refs = quotaRefs(registries, eligible[0], count);
  else {
    const profileId = ((registries.balance || {}).equipment || {}).unarmedProfiles?.attack;
    const profile = attackProfileFor(registries, profileId, 'zero-weapon plan');
    refs = Array.from({ length: count }, () => ({ sourceHand: null, weaponId: null, cardId: profile.baseCardId, profileId: profile.id }));
  }
  const slots = refs.map((ref, index) => ({ equipmentAttackSlotId: `attack:${index}`, ...ref }));
  const fingerprint = slots.map((slot) => [slot.equipmentAttackSlotId, slot.sourceHand || '-', slot.weaponId || '-', slot.cardId, slot.profileId].join(':')).join('|');
  return Object.freeze({ attackSlotCount: count, fingerprint, slots: Object.freeze(slots.map(Object.freeze)) });
}

/** Rebind stable attack instances without replacing instances or touching metadata. */
export function applyEquippedWeaponCardPlan(plan, cards, { allowSubset = false } = {}) {
  if (!plan || !Array.isArray(plan.slots)) throw new Error('applyEquippedWeaponCardPlan requires an EquippedWeaponCardPlan');
  const attacks = (cards || []).filter((card) => card.equipmentRole === 'attack');
  if (!allowSubset && attacks.length !== plan.attackSlotCount) {
    throw new Error(`attack instance count ${attacks.length} does not match authored ${plan.attackSlotCount}`);
  }
  const missingIds = attacks.filter((card) => !card.equipmentAttackSlotId);
  if (missingIds.length) {
    if (allowSubset || attacks.length !== plan.attackSlotCount) throw new Error('legacy attack slots can migrate only from the authoritative full deck');
    attacks.forEach((card, index) => { card.equipmentAttackSlotId = `attack:${index}`; });
  }
  const byId = new Map(plan.slots.map((slot) => [slot.equipmentAttackSlotId, slot]));
  const seen = new Set();
  for (const card of attacks) {
    if (seen.has(card.equipmentAttackSlotId)) throw new Error(`duplicate equipmentAttackSlotId '${card.equipmentAttackSlotId}'`);
    seen.add(card.equipmentAttackSlotId);
    const slot = byId.get(card.equipmentAttackSlotId);
    if (!slot) throw new Error(`unknown equipmentAttackSlotId '${card.equipmentAttackSlotId}'`);
    card.cardId = slot.cardId;
    card.profileId = slot.profileId;
    card.equipmentPlanFingerprint = plan.fingerprint;
    if (slot.sourceHand) card.sourceHand = slot.sourceHand;
    else delete card.sourceHand;
    if (slot.weaponId) card.weaponId = slot.weaponId;
    else delete card.weaponId;
    if (slot.sourceEquipmentInstanceId) card.sourceEquipmentInstanceId = slot.sourceEquipmentInstanceId;
    else delete card.sourceEquipmentInstanceId;
  }
  return attacks.length;
}

export const WeaponDeckCompositionService = Object.freeze({
  buildEquippedWeaponCardPlan,
  applyEquippedWeaponCardPlan,
});

/** The ten-card role distribution, as instance-ready refs. */
export function startingDeckRefs(registries, loadout, classId) {
  const cls = registries.classes.get(classId);
  const copies = ((registries.balance || {}).equipment || {}).roleCopies || {};
  const refs = [];
  for (const row of equipmentKitPlan(registries, loadout, classId)) {
    if (row.role === 'attack') {
      const attackPlan = buildEquippedWeaponCardPlan(registries, loadout, classId);
      refs.push(...attackPlan.slots.map((slot) => ({
        cardId: slot.cardId,
        equipmentRole: 'attack',
        profileId: slot.profileId,
        equipmentAttackSlotId: slot.equipmentAttackSlotId,
        equipmentPlanFingerprint: attackPlan.fingerprint,
        ...(slot.sourceHand ? { sourceHand: slot.sourceHand } : {}),
        ...(slot.weaponId ? { weaponId: slot.weaponId } : {}),
      })));
      continue;
    }
    for (let i = 0; i < (copies[row.role] || 0); i++) {
      refs.push({ cardId: row.profile.baseCardId, equipmentRole: row.role, profileId: row.profile.id });
    }
  }
  for (let i = 0; i < (copies.signature || 0); i++) refs.push({ cardId: cls.startingSignatureCard });
  return refs;
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
 * figureSpec(registries, loadout, classId) →
 *   { armourId, rightId, leftId, rightMirror, leftMirror }
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
 *
 * The current full-frame art is authored at the sword socket for every
 * non-shield and at the off-hand socket for shields. The figure itself is
 * mirrored for the viewer, so a slot swap needs a per-layer mirror flag too:
 * `rightMirror` / `leftMirror` move the art onto the socket the slot names.
 * Those flags disappear when the producer is re-rendered from slot-neutral art.
 */
export function figureSpec(registries, loadout, classId) {
  const slots = (registries.equipment || {}).slots || [];
  const spec = {
    armourId: 'default', rightId: null, leftId: null,
    rightMirror: false, leftMirror: false,
  };
  if (!loadout) return spec;
  for (const slot of slots) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (!piece) continue;
    if (slot.kinds.includes('armor')) {
      spec.armourId = piece.id;
      continue;
    }
    const hand = slotHand(slot);
    if (hand === 'right') {
      spec.rightId = piece.artKey || piece.id;
      spec.rightMirror = piece.kind === 'shield';
    } else if (hand === 'left') {
      spec.leftId = piece.artKey || piece.id;
      spec.leftMirror = piece.kind !== 'shield';
    }
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

function equipmentChangedPayload(reason, before, after) {
  const changedPositions = [];
  const slotIds = new Set([...Object.keys((before || {}).sets || {}), ...Object.keys((after || {}).sets || {})]);
  for (const slotId of [...slotIds].sort()) {
    const beforeIds = ((before || {}).sets || {})[slotId] || [];
    const afterIds = ((after || {}).sets || {})[slotId] || [];
    const count = Math.max(beforeIds.length, afterIds.length);
    for (let setIndex = 0; setIndex < count; setIndex++) {
      const beforeItemId = beforeIds[setIndex] || null;
      const afterItemId = afterIds[setIndex] || null;
      const beforeActive = (((before || {}).active || {})[slotId] || 0) === setIndex;
      const afterActive = (((after || {}).active || {})[slotId] || 0) === setIndex;
      if (beforeItemId !== afterItemId || beforeActive !== afterActive) {
        changedPositions.push({ slotId, setIndex, beforeItemId, afterItemId, beforeActive, afterActive });
      }
    }
  }
  return {
    reason,
    beforeLoadoutSignature: loadoutSignature(before),
    afterLoadoutSignature: loadoutSignature(after),
    changedPositions,
  };
}

function emitEquipmentChanged(ctx, reason, before, after) {
  if (ctx && typeof ctx.onEquipmentChanged === 'function') {
    ctx.onEquipmentChanged(equipmentChangedPayload(reason, before, after));
  }
}

// ---------------------------------------------------------------------------
// Collecting mods
// ---------------------------------------------------------------------------

/**
 * cardMods(registries, loadout, classId) → Map(cardId → ['damage=+4', ...]).
 * The prefix is dropped because it has already done its job (choosing the
 * card); order is slot order, and the applier honours it.
 */
export function cardMods(registries, loadout, classId, { attackSourceWeaponId = undefined } = {}) {
  const eq = registries.equipment || {};
  const fields = eq.modFields || {};
  const out = new Map();
  for (const piece of equippedPieces(registries, loadout, classId)) {
    const packageModel = WeaponCardPackageModel.fromPiece(registries, piece);
    if (attackSourceWeaponId !== undefined && packageModel && piece.id !== attackSourceWeaponId) continue;
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
 * runMods(registries, loadout, classId)
 *   → { maxHp, maxMana, maxStamina, swapCostDelta, startStatuses }
 * The `self.*` half of the vocabulary: things a piece does to you rather than
 * to a card. startStatuses are handed straight to createCombat's existing
 * playerStatuses hook, so the engine needs no equipment code to honour them.
 *
 * `swapCostDelta` is the TALISMAN half of A8 — *"perhaps this action costs more
 * or less depending on Talisman"* — and it arrives as one `apply` value rather
 * than a new field on a piece, because a talisman already says what it does in
 * the same `mods` column every other piece uses (`self.swapCost=+1`). It is
 * SIGNED and it is a DELTA, never a price: the price is derived in
 * `swapCostFor` below, which is the only place that knows the base.
 *
 * NOTHING IS AUTHORED FOR IT YET AND THAT IS A CONTENT FACT, NOT A GAP. The
 * talisman slot has zero rows (equipSlots.csv ships it ahead of its content),
 * so today this returns 0 for every real loadout — and the day a talisman row
 * exists it works with no code, which test 28b measures with a piece it
 * authors itself rather than waiting for one.
 */
export function runMods(registries, loadout, classId) {
  const fields = (registries.equipment || {}).modFields || {};
  const stacks = new Map();
  const pools = Object.fromEntries(EQUIPMENT_POOL_FIELDS.map((field) => [field, 0]));
  let swapCostDelta = 0;
  for (const piece of equippedPieces(registries, loadout, classId)) {
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      const spec = mod && fields[mod.field];
      if (!spec || spec.scope !== 'run') continue;
      if (EQUIPMENT_POOL_FIELDS.includes(spec.apply)) {
        pools[spec.apply] = mod.mode === 'add' ? pools[spec.apply] + mod.value : mod.value;
      } else if (spec.apply === 'swapCost') {
        swapCostDelta = mod.mode === 'add' ? swapCostDelta + mod.value : mod.value;
      } else if (spec.apply === 'startStatus') {
        const prev = stacks.get(spec.status) || 0;
        stacks.set(spec.status, mod.mode === 'add' ? prev + mod.value : mod.value);
      }
    }
  }
  return {
    ...pools,
    swapCostDelta,
    startStatuses: [...stacks].filter(([, n]) => n > 0).map(([status, n]) => ({ status, stacks: n })),
  };
}

/**
 * Reconcile all run pools after an out-of-combat loadout mutation. The derived
 * snapshot, persisted equipment contribution, and HP adjustment remain the
 * authorities; each current pool keeps its absolute deficit as its vessel
 * grows or shrinks. Partial combat stamping records are deliberately ignored.
 */
export function reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses = false } = {}) {
  if (!run || !run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules
    || !EQUIPMENT_POOL_FIELDS.every((maxField) => {
      const currentField = maxField === 'maxHp' ? 'hp' : maxField.slice(3).toLowerCase();
      return Number.isFinite(run[maxField]) && Number.isFinite(run[currentField]);
    })) return null;
  if (!Number.isInteger(run.maxHpAdjustment)) {
    throw new Error('reconcileRunLoadoutHp requires integer maxHpAdjustment');
  }
  const classDef = registries.classes.get(run.class);
  const liveMods = runMods(registries, run.loadout, run.class);
  const priorBonuses = run.equipmentPoolBonuses || Object.fromEntries(
    EQUIPMENT_POOL_FIELDS.map((field) => [field, liveMods[field]]),
  );
  const bonuses = adoptEquipmentBonuses
    ? Object.fromEntries(EQUIPMENT_POOL_FIELDS.map((field) => [field, liveMods[field]]))
    : priorBonuses;
  const results = {};
  const applyPool = (maxField, currentField, derivedValue, equipmentBonus, nextMax, adjustment = 0) => {
    const was = run[maxField];
    const deficit = moveEquipmentPool(run, maxField, nextMax, run.equipmentPoolDeficits && run.equipmentPoolDeficits[currentField]);
    results[maxField] = { derived: derivedValue, equipmentBonus, adjustment, max: nextMax, deficit, was };
  };

  // Keep this named composition explicit: three independent instruments pin
  // the exact HP addends at creation and load. Mana/Stamina use the same
  // persisted-equipment rule below without weakening that historical witness.
  const derived = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', {
    attributes: run.attributes,
    classDef,
  });
  const equipmentBonus = bonuses.maxHp;
  const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment);
  applyPool('maxHp', 'hp', derived.value, equipmentBonus, nextMax, run.maxHpAdjustment);
  for (const [maxField, statId] of [['maxMana', 'mana'], ['maxStamina', 'stamina']]) {
    const poolDerived = deriveStat(run.derivedStatRuleSnapshot.rules, statId, {
      attributes: run.attributes,
      classDef,
    });
    const poolMax = Math.max(0, poolDerived.value + bonuses[maxField]);
    applyPool(maxField, statId, poolDerived.value, bonuses[maxField], poolMax);
  }
  run.equipmentPoolBonuses = { ...bonuses };
  run.equipmentPoolDeficits = Object.fromEntries(
    EQUIPMENT_POOL_FIELDS.map((field) => [EQUIPMENT_POOL_CURRENT[field], results[field].deficit]),
  );
  // MAX-HP HOME 3 of 3, and THE LAST WRITER AT RUN CREATION — createRunState
  // ends with stampDeck(), which begins with this call. That is why Sten's
  // planted double-count went green: whatever the earlier writers put in the
  // field, this one replaced it, and nothing recorded the replacement. It still
  // replaces it. It no longer does so silently.
  note(run, {
    kind: 'overwrite',
    field: 'maxHp',
    site: 'loadout.js:reconcileRunLoadoutHp',
    was: results.maxHp.was,
    now: results.maxHp.max,
    why: `max-HP home 3 of 3 and the last writer at the door — derived ${results.maxHp.derived} + equipment ${results.maxHp.equipmentBonus} + adjustment ${run.maxHpAdjustment}; deficit ${results.maxHp.deficit} carried`,
  });
  return {
    derived: results.maxHp.derived,
    equipmentBonus: results.maxHp.equipmentBonus,
    adjustment: run.maxHpAdjustment,
    maxHp: results.maxHp.max,
    deficit: results.maxHp.deficit,
    pools: results,
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
export function stampDeck(registries, run, cards, {
  adoptEquipmentBonuses = true,
  reconcileEquipmentPools = true,
} = {}) {
  if (reconcileEquipmentPools) reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses });
  const list = cards || run.deck || [];
  if (!run.attributes) throw new Error('stampDeck requires authoritative run attributes for equipment role projection');
  const attackPlan = buildEquippedWeaponCardPlan(registries, run.loadout, run.class);
  for (const inst of list.filter((card) => card.equipmentRole === 'attack')) {
    const prior = inst.profileId && run.equipmentProfileRuleSnapshot.profiles[inst.profileId];
    const desired = attackPlan.slots.find((slot) => slot.equipmentAttackSlotId === inst.equipmentAttackSlotId);
    const next = desired && run.equipmentProfileRuleSnapshot.profiles[desired.profileId];
    if (prior && next && prior.compatibility !== next.compatibility) {
      throw new Error(`Incompatible attack profile swap: ${inst.profileId} (${prior.compatibility}) -> ${desired.profileId} (${next.compatibility})`);
    }
  }
  applyEquippedWeaponCardPlan(attackPlan, list, { allowSubset: cards != null });
  const rolePlan = new Map(equipmentKitReceipt(registries, run.loadout, run.class, run.attributes, run.equipmentProfileRuleSnapshot).map((row) => [row.role, row]));
  let n = 0;
  for (const inst of list) {
    let row = inst.equipmentRole ? rolePlan.get(inst.equipmentRole) : null;
    if (inst.equipmentRole === 'attack') {
      const profile = profileById(registries, inst.profileId);
      const piece = inst.weaponId
        ? (registries.equipment.armaments || []).find((candidate) => candidate.id === inst.weaponId) || null
        : null;
      row = { role: 'attack', profile, piece };
      row.receipt = roleAmountReceipt(registries, row, run.attributes, run.equipmentProfileRuleSnapshot);
    }
    if (row && row.profile) {
      const prior = inst.profileId && run.equipmentProfileRuleSnapshot.profiles[inst.profileId];
      const nextCompatibility = run.equipmentProfileRuleSnapshot.profiles[row.profile.id].compatibility;
      if (prior && prior.compatibility !== nextCompatibility) throw new Error(`Incompatible ${inst.equipmentRole} profile swap: ${inst.profileId} (${prior.compatibility}) -> ${row.profile.id} (${nextCompatibility})`);
      if (inst.equipmentRole !== 'attack') inst.cardId = row.profile.baseCardId;
      inst.profileId = row.profile.id;
      inst.profileReceipt = { ...row.receipt };
      const sourceArmamentId = row.piece && row.piece.id;
      if (sourceArmamentId) {
        inst.sourceArmamentId = sourceArmamentId;
        inst.smithingLevel = (run.armamentLevels && run.armamentLevels[sourceArmamentId]) || 0;
        // Equipment-bound basics derive their upgrade from the source piece.
        // Per-copy flags remain authoritative only for ordinary cards.
        inst.upgraded = false;
      } else {
        delete inst.sourceArmamentId;
        delete inst.smithingLevel;
      }
    }
    let carrier;
    if (row && row.profile) {
      // Equipment roles deliberately re-resolve from the persisted host rule
      // snapshot when the active set changes.
      carrier = run.equipmentProfileRuleSnapshot.profiles[row.profile.id];
    } else {
      const schoolAbsent = inst.damageSchool === undefined;
      const buildupAbsent = inst.exposureBuildupPerHit === undefined;
      if (schoolAbsent !== buildupAbsent) throw new Error(`${inst.instanceId}: damageSchool and exposureBuildupPerHit must both be present or both be absent`);
      // Non-equipment cards are immutable host-stamped instances. Consult live
      // content only at the explicit new/legacy adoption door, never during a
      // later equipment swap re-stamp.
      carrier = schoolAbsent ? registries.cards.get(inst.cardId) : inst;
    }
    const priorSchool = inst.damageSchool;
    const priorBuildup = inst.exposureBuildupPerHit;
    if (typeof carrier.damageSchool === 'string') inst.damageSchool = carrier.damageSchool;
    else delete inst.damageSchool;
    if (Number.isInteger(carrier.exposureBuildupPerHit)) inst.exposureBuildupPerHit = carrier.exposureBuildupPerHit;
    else delete inst.exposureBuildupPerHit;
    const mods = cardMods(registries, run.loadout, run.class, {
      attackSourceWeaponId: inst.equipmentRole === 'attack' ? (inst.weaponId || null) : undefined,
    });
    const amountMod = row && row.role === 'attack' ? `damage=${row.receipt.value}`
      : row && row.role === 'guard' ? `block=${row.receipt.value}` : null;
    const next = [...(amountMod ? [amountMod] : []), ...((row && row.profile.mods) || []), ...(mods.get(inst.cardId) || [])];
    const prev = inst.mods || [];
    const carrierChanged = priorSchool !== inst.damageSchool || priorBuildup !== inst.exposureBuildupPerHit;
    if (!carrierChanged && next.length === prev.length && next.every((v, i) => v === prev[i])) continue;
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
 * canSwap(registries, slotId, { inCombat }) → { ok, word, reason }.
 * The rule lives in equipSlots.csv (`swap`): hands may be changed mid-fight at
 * a price, armour and talismans may not.
 *
 * `word` IS THE BADGE, AND IT LIVES HERE BECAUSE THE COLLISION DID (#98, Bjorn).
 * The screen used to type the literal 'sealed' into the slot header while this
 * function supplied only the tooltip — so the one word a player actually reads
 * had no home, and nothing could compare it to anything. It collided: the
 * ARMOUR header said "sealed" (this function, about the ACTIVE SET) while two
 * rows below the picker said "Right Hand is sealed in combat" (canEquip, about
 * a set's CONTENTS), on a Right Hand carrying no badge at all. Both sentences
 * were true. **One word carrying two facts, with the copies visibly
 * disagreeing** — his framing, and it is worse than a second copy, because a
 * second copy at least says the same thing twice.
 *
 * So the badge word sits beside the reason it belongs to, and test 31d asserts
 * canEquip's sentence contains neither this word nor any slot label. A future
 * edit that reintroduces the collision goes red, which is the point: the
 * brittleness IS the check. The wording is Sunna's whenever she wants it —
 * both strings are one line each and neither is derived from the other.
 */
export function canSwap(registries, slotId, { inCombat = false } = {}) {
  const slot = ((registries.equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, word: 'unknown', reason: `No slot '${slotId}'` };
  // THE WORDING IS MINE (Sunna, #98). Two changes, and the second is the reason
  // for the first.
  //
  // `sealed` → `fastened`. Not a synonym swap. "Sealed" is an ABSOLUTE word over
  // a PARTIAL rule — it says *shut*, while the fact it carries is only that THIS
  // slot cannot change its active set, and two slots beside it can. A total word
  // over a partial fact is how it collided with the screen-wide seal in the first
  // place, and re-keying the string without changing its register would leave the
  // reader in the same place Bjorn found them. "Fastened" is a STATE, not a
  // verdict: it says the armour is done up, which is why it cannot come off, and
  // it cannot be read as the re-arm rule below.
  //
  // AND IT HAS TO STAND ALONE, which is the part I could not fix here. This badge
  // carries its reason in a `title=`, and Law 3 clause 4 is explicit that a native
  // title alone does not satisfy — a touch or pad player never sees it. Measured
  // at 390x844: the badge renders 23.6-33.1 px wide with NO reachable explanation
  // at any text size. So the word is the whole message on the shape Constantine
  // just made the priority, and I picked one that survives being alone. The
  // reason wants to be on the glass; that is markup, not a string, and it is
  // filed rather than smuggled in here.
  if (inCombat && slot.swap !== 'combat') {
    return { ok: false, word: 'fastened', reason: `${slot.label} stays fastened until the fight ends.` };
  }
  return { ok: true, word: '', reason: '' };
}

// ---------------------------------------------------------------------------
// WHAT A SWAP COSTS — one chain, three rules, all of it data (Viki, A8)
// ---------------------------------------------------------------------------
//
// `canSwap` above says WHETHER. This says HOW MUCH, and the comment on
// `cycleSet` below already named it as the next act: *"the PRICE.
// balance.equipment.swapCost is charged in doSwapArmament, outside this
// function"* — so the price had no truth function at all, only a subtraction in
// the engine. It has one now, and it lives here because this module is the one
// home for what a loadout means.
//
// Constantine named three prices and said *"that way I can try each"*, so the
// three are rows in `balance.equipment.swapCostRules` and the live one is a
// word. This function is the chain they select rungs of; it contains no `if`
// on a rule id, which is the difference between data he can switch between and
// three branches wearing a config key.

/** Where a rule's base price comes from. Closed; a row saying anything else is refused by name. */
export const SWAP_COST_BASES = Object.freeze(['default', 'category']);

/** The authored rules table. Empty is a real answer: no table, no rule, price falls to the default. */
export function swapCostRules(registries) {
  return (((registries || {}).balance || {}).equipment || {}).swapCostRules || [];
}

/**
 * resolveSwapCostRule(registries, meta) → the live rule row, or null.
 *
 * Unset, or a value this build cannot read, is the SHIPPING DEFAULT — the same
 * rule `resolveMapMode` and `savedZoom` use, and for the same reason: a
 * hand-edited save or an older build's value must behave exactly as an absent
 * one. The Settings row reads this table too, so the control and the resolver
 * cannot disagree about which rules exist.
 */
export function resolveSwapCostRule(registries, meta) {
  const cfg = (((registries || {}).balance || {}).equipment || {});
  const rows = swapCostRules(registries);
  const want = ((meta && meta.settings) || {}).swapCostRule;
  return rows.find((r) => r && r.id === want) || rows.find((r) => r && r.id === cfg.swapCostRule) || null;
}

/**
 * swapCostFor(registries, { rule, loadout, classId, slotId, setIndex, relicDelta })
 *   → { cost, ruleId, base, baseCost, categoryTag, gearOn, gearDelta, gearIgnored, floored }
 *
 * THE WHOLE DERIVATION, RETURNED RATHER THAN JUST THE NUMBER. A price a screen
 * or a test can only observe as `2` cannot be checked for WHY it is 2, and the
 * thing being measured tonight is whether three settings actually produce
 * different numbers — so every rung is in the return value and test 28b prints
 * the table. `gearIgnored` is the deliberately loud one: it is the delta a
 * gear-off rule DECLINED, so a talisman doing nothing says so instead of
 * looking broken.
 *
 * WHICH PIECE'S CATEGORY. The one being DRAWN — `loadout.sets[slotId][setIndex]`,
 * the set you are switching TO — not the one going away and not a max() of the
 * two. You pay for what you pick up, which is the reading a player can predict
 * from the thing they just chose. It is one line and named here rather than
 * discovered: if it plays wrong, this sentence is what changes.
 *
 * THE RELIC HALF ARRIVES AS A NUMBER, and that is a module boundary, not a
 * shortcut. `passiveSum` lives in model/registries.js, which imports THIS file
 * — so importing it back would make a cycle, and a cycle that survives Node
 * survives it in a hand-rolled single-file bundler only by luck. Combat already
 * owns the relic-passive-to-price pattern (`effectiveCost`, same file, same
 * shape), so it sums `swapCostDelta` and hands the total in. A caller that
 * forgets is NAMED, not defaulted: silence must not mean "no relics".
 *
 * THE FLOOR IS 0 AND IT IS ARITHMETIC, NOT DATA. An authored negative — a
 * category row at −1, a `swapCost` below zero — is refused by name in
 * `validateEquipment`. A negative TOTAL is a legal talisman meeting a cheap
 * weapon, and it clamps the way `powerCostReduction` already does, with
 * `floored` set so the clamp is observable rather than quiet.
 */
export function swapCostFor(registries, {
  rule = null, loadout = null, classId = null, slotId = null, setIndex = 0, relicDelta,
} = {}) {
  const cfg = (((registries || {}).balance || {}).equipment || {});
  const fallback = Number.isFinite(cfg.swapCost) ? cfg.swapCost : 0;
  const row = rule || null;
  const base = row && SWAP_COST_BASES.includes(row.base) ? row.base : 'default';

  let categoryTag = null;
  let baseCost = fallback;
  if (base === 'category') {
    const ids = ((loadout || {}).sets || {})[slotId] || [];
    const id = ids[setIndex];
    const eq = (registries || {}).equipment || {};
    const piece = id ? (eq.armaments || []).find((a) => a.id === id) || null : null;
    const tags = (piece && piece.tags) || [];
    // ORDERED, FIRST MATCH WINS — the priority between two tags a piece carries
    // is the order of the rows, so it is authorable and visible. No match at all
    // (a bare hand, an untagged piece) falls through to the default, which is
    // the same number the 'flat' rule charges — by design, not by accident.
    const hit = (cfg.swapCostByCategory || []).find((r) => r && tags.includes(r.tag));
    if (hit) {
      categoryTag = hit.tag;
      baseCost = Number.isFinite(hit.cost) ? hit.cost : fallback;
    }
  }

  if (!Number.isFinite(relicDelta)) {
    console.error(
      `swapCostFor('${slotId}'): no finite \`relicDelta\` — refusing to guess.`
      + ` Got ${JSON.stringify(relicDelta)}. Pass passiveSum(registries, relicIds, 'swapCostDelta').`
      + ' Charging the gear stage as 0. This line is the defect, not the price.'
    );
  }
  const relic = Number.isFinite(relicDelta) ? relicDelta : 0;
  const worn = loadout ? runMods(registries, loadout, classId).swapCostDelta : 0;
  const delta = relic + worn;
  const gearOn = !!(row && row.gear);
  const raw = baseCost + (gearOn ? delta : 0);

  return {
    cost: Math.max(0, raw),
    ruleId: row ? row.id : null,
    base,
    baseCost,
    categoryTag,
    gearOn,
    gearDelta: gearOn ? delta : 0,
    gearIgnored: gearOn ? 0 : delta,
    floored: raw < 0,
  };
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
 * THE SENTENCE DOES NOT NAME THE SLOT, and that is the repair of my own defect
 * (#98, Bjorn). I composed it from the slot's label because canSwap does — but
 * canSwap's fact IS per slot (hands cycle, armour does not) and this one is not:
 * in a fight NO slot may be re-armed. Naming the slot made a screen-wide truth
 * wear a per-slot voice, so "Right Hand is sealed in combat" read as a claim
 * about the Right Hand, sitting under a Right Hand header with no badge on it
 * while ARMOUR had one. The label was doing the opposite of its job. It says
 * what is actually true instead, once, about the act rather than the slot — and
 * it borrows no word from canSwap, so the two refusals cannot be read as the
 * same rule. The picker's own `<h4>` says which slot you are looking at; this
 * line never needed to.
 *
 * NO CONTEXT MEANS SEALED, not "not in combat" (#98, Vira). The old signature
 * defaulted `inCombat` to false, so a caller that said nothing was told it may
 * re-arm — silence meaning permission, which is the whole defect this function
 * was extracted to remove. A truth function that cannot be told whether a fight
 * is on refuses, and names the caller that failed to say.
 */
/**
 * The one sentence, so the two refusing paths below cannot drift apart.
 *
 * REWORDED BY SUNNA (#98), AND THE OLD ONE HAD THE SAME DEFECT IT WAS REPAIRED
 * FOR, one clause further along. It read:
 *
 *     "You cannot re-arm mid-fight — cycle between the sets you brought."
 *
 * The front was fixed: it stopped naming the slot, because no slot may be
 * re-armed. **The back was not.** "Cycle between the sets you brought" is a
 * PER-SLOT promise — hands cycle, armour does not — and this sentence is printed
 * under armour too, where it is simply false. A screen-wide truth stopped
 * wearing a per-slot label and kept offering a per-slot consolation. Same defect,
 * quieter half, and the check could not see it because it only asserts the
 * sentence names no slot.
 *
 * So it says one thing that is true everywhere and offers nothing it cannot
 * keep. It is also 53 characters against 64, which matters: measured at 390x844
 * this line wraps to two lines from Text M upward, and a refusal a player reads
 * mid-fight should not be a paragraph.
 *
 * WHAT IT DELIBERATELY NO LONGER DOES: point at the way out. That is right for a
 * screen-wide string and wrong for the screen — a refusal that names no
 * alternative is a dead end, and the alternative here is per-slot, so it belongs
 * beside the slot that has one. Filed, not silently dropped.
 */
export const SEALED_MID_FIGHT = 'Nothing goes in or out of a set once the fight starts.';

export function canEquip(registries, slotId, ctx) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: `No slot '${slotId}'` };
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `canEquip('${slotId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. This line is the defect, not the refusal.`
    );
    return { ok: false, reason: SEALED_MID_FIGHT };
  }
  if (ctx.inCombat) return { ok: false, reason: SEALED_MID_FIGHT };
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
 * THE SWAP RULE IS ASKED HERE NOW, AND THAT IS THE WHOLE CHANGE (#104, Vira,
 * found while gating #98 and carded as its own act). This signature used to have
 * no `inCombat` at all, so the question was never whether it CHECKED the swap
 * rule but whether it COULD: `canSwap` was enforced by both callers and by
 * neither of them structurally. **A second copy fails by divergence; an
 * unenforced gate fails by bypass** — different defects, and only the second one
 * was here. It had a live cell: `talisman` (`swap=outOfCombat`, `sets=3`) MOVED
 * mid-fight, against its own data, and every test of this function used
 * `rightHand`, where the missing gate is vacuous — which is why nothing was red.
 * Dormant only because talismans are unauthored: one CSV row under Law 1 clause 1
 * wakes it, so this is a content fact away from live, not a hypothetical.
 *
 * IT ASKS `canSwap`; IT DOES NOT RESTATE IT. The rule keeps its one home — no
 * `slot.swap` comparison is written in this function, and the sentence a player
 * reads is not typed here. `doSwapArmament` still calls `canSwap` itself because
 * it needs the REASON to throw before it charges the price; that is the same
 * function answering two questions (may I / what do I tell them), not two copies
 * of the rule. Both callers and the mutation now agree by construction.
 *
 * `inCombat` IS REQUIRED AND FAILS CLOSED, exactly as `equipPiece`'s is and for
 * the reason written there: a context defaulting to "not in combat" makes
 * SILENCE MEAN PERMISSION, which is how every hole in this module got in. The
 * check is on the VALUE, not the key — `{ inCombat: undefined }` is what a caller
 * produces by forwarding a variable that was never set, and it refuses too.
 *
 * WHAT THIS DOES NOT CLOSE, said plainly because the next act needs it: the
 * PRICE. `balance.equipment.swapCost` is charged in `doSwapArmament`, outside
 * this function, so a caller reaching here directly still moves a `swap=combat`
 * slot mid-fight for 0 Energy instead of 2. The gate above stops the sealed slots
 * only. The cost is the next act and it hangs on this argument.
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
      + ' Call it as cycleSet(registries, loadout, slotId, index, { meta, inCombat }).'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `cycleSet('${slotId}', ${index}): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. Pass { meta, inCombat } so the bound is`
      + ' openedSets() and the seal is canSwap(). This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!canSwap(registries, slotId, { inCombat: ctx.inCombat }).ok) return false;
  if (index >= openedSets(registries, slot, { meta: ctx.meta || {}, loadout })) return false;
  const before = structuredClone(loadout);
  loadout.active[slotId] = index;
  try {
    buildEquippedWeaponCardPlan(registries, loadout, ctx.classId || null);
  } catch (error) {
    loadout.active[slotId] = before.active[slotId];
    console.error(`cycleSet('${slotId}', ${index}): ${error.message} — refusing.`);
    return false;
  }
  emitEquipmentChanged(ctx, 'swapSet', before, loadout);
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
 * Normalize saves written while one owned armament could occupy several hand
 * sets. Keep an active occurrence when one exists (slot order breaks ties),
 * clear the others, and remove an equipped survivor from shared Inventory.
 * Returns a receipt for the load-door ledger; an empty array means no change.
 */
export function normalizeArmamentLocations(registries, loadout) {
  if (!loadout || !loadout.sets) return [];
  const eq = (registries || {}).equipment || {};
  const handSlots = (eq.slots || []).filter((slot) => slotHand(slot));
  const armamentIds = new Set((eq.armaments || []).map((piece) => piece.id));
  const occurrences = new Map();
  for (const slot of handSlots) {
    const ids = loadout.sets[slot.id] || [];
    for (let setIndex = 0; setIndex < ids.length; setIndex++) {
      const id = ids[setIndex];
      if (!id || !armamentIds.has(id)) continue;
      const rows = occurrences.get(id) || [];
      rows.push({ slotId: slot.id, setIndex, active: setIndex === ((loadout.active || {})[slot.id] || 0) });
      occurrences.set(id, rows);
    }
  }

  const changes = [];
  const storage = [...new Set(loadout.storage || [])];
  for (const [id, rows] of occurrences) {
    const kept = rows.find((row) => row.active) || rows[0];
    const cleared = rows.filter((row) => row !== kept);
    for (const row of cleared) loadout.sets[row.slotId][row.setIndex] = null;
    const removedFromStorage = storage.includes(id);
    if (removedFromStorage) storage.splice(storage.indexOf(id), 1);
    if (cleared.length || removedFromStorage) changes.push({ id, kept, cleared, removedFromStorage });
  }
  if (storage.length !== (loadout.storage || []).length || changes.length) loadout.storage = storage;
  return changes;
}

/**
 * Apply the storage/location half of an equipment mutation. Both the real
 * mutation and comparison preview call this function, so a preview cannot
 * invent a duplicate object the committed action would move away.
 */
function equipTransitionPlan(registries, loadout, slotId, setIndex, itemId) {
  const ids = ((loadout || {}).sets || {})[slotId];
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((candidate) => candidate.id === slotId);
  if (!slot || !ids || setIndex < 0 || setIndex >= ids.length) {
    return { ok: false, reason: 'That equipment location is no longer available.' };
  }

  const previousId = ids[setIndex] || null;
  if (!slotHand(slot)) {
    return { ok: true, slot, ids, previousId, nextStorage: loadout.storage || [], storesPrevious: false };
  }

  const cap = Number.isInteger(((registries.balance || {}).equipment || {}).storageSlots)
    ? registries.balance.equipment.storageSlots
    : 8;
  const nextStorage = [...new Set(loadout.storage || [])].filter((id) => id !== itemId);
  const storesPrevious = previousId && previousId !== itemId && !nextStorage.includes(previousId);
  if (storesPrevious && nextStorage.length >= cap) {
    return {
      ok: false,
      reason: `Inventory is full (${nextStorage.length}/${cap}). Make room before ${itemId ? 'moving this item' : 'unequipping this item'}.`,
    };
  }
  return { ok: true, slot, ids, previousId, nextStorage, storesPrevious };
}

/** A mutation-free capacity verdict for the Armoury's action feedback. */
export function equipTransitionReceipt(registries, loadout, slotId, setIndex, itemId) {
  const plan = equipTransitionPlan(registries, loadout, slotId, setIndex, itemId);
  return { ok: plan.ok, reason: plan.reason || '' };
}

export function applyEquipTransition(registries, loadout, slotId, setIndex, itemId) {
  const plan = equipTransitionPlan(registries, loadout, slotId, setIndex, itemId);
  if (!plan.ok) return false;
  const { slot, ids, nextStorage, previousId, storesPrevious } = plan;
  if (!slotHand(slot)) {
    ids[setIndex] = itemId || null;
    return true;
  }

  const eq = (registries || {}).equipment || {};
  const handSlotIds = new Set((eq.slots || []).filter((candidate) => slotHand(candidate)).map((candidate) => candidate.id));
  if (itemId) {
    for (const [otherSlotId, otherIds] of Object.entries(loadout.sets || {})) {
      if (!handSlotIds.has(otherSlotId)) continue;
      for (let i = 0; i < otherIds.length; i++) {
        if (otherIds[i] === itemId && (otherSlotId !== slotId || i !== setIndex)) otherIds[i] = null;
      }
    }
  }
  if (storesPrevious) nextStorage.push(previousId);
  loadout.storage = nextStorage;
  ids[setIndex] = itemId || null;
  return true;
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
 * `ctx` — `{ inCombat }` — is REQUIRED, for the reason the two arguments above
 * it are (#95). A context that defaults to "not in combat" fails OPEN: every
 * call site written after today would equip mid-fight by saying nothing, which
 * is how the ownership hole survived #90 in the first place. `cycleSet` above
 * already takes a required trailing context for the ladder, so this is that
 * pattern, not a new one.
 *
 * THE CHECK IS ON THE VALUE, NOT THE KEY (#98, Vira). It read `'inCombat' in
 * ctx`, which answers whether the key was TYPED — so `{ inCombat: undefined }`
 * and `{ inCombat: null }` were taken, and both are what a caller produces by
 * forwarding a variable that was never set. That is the same defect one notch
 * quieter than the one this argument exists to close: absent read as permission.
 * A boolean, or it refuses and prints what it was actually handed.
 */
export function equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || setIndex < 0 || setIndex >= ids.length) return false;
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. Pass { inCombat } as the seventh argument.`
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  // THE GATE IS HERE, ON THE MUTATION, and the screen no longer holds a copy of
  // it. Before #95 the only thing stopping a mid-fight re-arm was the armoury
  // declining to open its picker — a screen, not a gate, so a save file, a drop,
  // a drag, a gamepad path or a second surface walked straight past it. Measured
  // at 98fedde: equipPiece on a live combat loadout returned true.
  // Passed through, NOT coerced. `!!ctx.inCombat` would turn a value this
  // function had just refused into a legal one, so if the check above is ever
  // loosened canEquip's own check is a real second gate rather than an echo.
  const seal = canEquip(registries, slotId, { inCombat: ctx.inCombat });
  if (!seal.ok) return false;
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((s) => s.id === slotId);
  if (!slot) return false;
  const before = structuredClone(loadout);
  const appearedElsewhere = itemId && Object.entries(loadout.sets || {}).some(([otherSlotId, values]) => (
    values.some((value, index) => value === itemId && (otherSlotId !== slotId || index !== setIndex))
  ));
  const reason = !itemId ? 'unequip' : appearedElsewhere ? 'move' : 'equip';
  if (!itemId) {
    const changed = applyEquipTransition(registries, loadout, slotId, setIndex, null);
    if (changed) emitEquipmentChanged(ctx, reason, before, loadout);
    return changed;
  }
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
  if (!equipmentRequirementReceipt(registries, piece, ctx.attributes).ok) return false;
  const next = structuredClone(loadout);
  if (!applyEquipTransition(registries, next, slotId, setIndex, itemId)) return false;
  try {
    buildEquippedWeaponCardPlan(registries, next, ctx.classId || null);
  } catch (error) {
    console.error(`equipPiece('${slotId}', '${itemId}'): ${error.message} — refusing.`);
    return false;
  }
  loadout.sets = next.sets;
  loadout.active = next.active;
  loadout.storage = next.storage;
  emitEquipmentChanged(ctx, reason, before, loadout);
  return true;
}
