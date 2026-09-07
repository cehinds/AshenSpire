import { tokenRe } from './validate.js';
import {
  applyMountOverrides, extraMountInstances, mountKey, ownerItemRef,
} from './cardMounts.js';
import { deriveAttributeTierReceipt, deriveStat } from './derivedStats.js';
import { startingKitProblems, armourIsStartingEligible } from './startingKits.js';
import { resolveCreationHands, classCreationConfig } from './characterCreation.js';
import { tagService } from './tagService.js';
import { DAMAGE_SCHOOLS } from './schemas.js';
// Recording only — `note` is a no-op unless a run door is open, so the
// stampDeck calls that fire all climb long cost nothing.
import { note } from './healLedger.js';
import { cumulativeRequirementDelta, resolveUpgradedEquipment } from './itemUpgrades.js';
import { splitAuthoredWeaponArts } from '../framework/deck.js';

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

/**
 * modEffectLines(registries, piece) → the piece's mods, written the way a
 * player reads them: `strike.damage=+4` → `Strike Damage +4`.
 *
 * THIS EXISTS BECAUSE THE ANSWER WAS ALREADY IN TWO PLACES AND THE THIRD SITE
 * PRINTED THE RAW ROW. Measured 2026-09-03 on ?shot=reward: the Victory screen
 * showed a player `Greatsword — strike.damage=+4, strike.cost=+1,
 * strike.poise=+3` — engine keys, on the screen where a reward is chosen. The
 * two existing renderers were `pieceEffects` (model/creationBrief.js, via
 * parseMod) and `modSummary` (ui/screens/compendium.js, via its own regex),
 * and they disagreed in two ways worth naming because this function had to
 * pick one of each:
 *
 *   THE PREFIX. creationBrief dropped it ("Damage +4"); compendium kept it
 *   ("Strike Damage +4"). KEPT — the prefix names WHICH CARD the mod rewrites,
 *   and a weapon that changes two cards reads as two identical lines without
 *   it.
 *
 *   AN UNKNOWN FIELD. creationBrief printed the raw row; compendium DROPPED the
 *   line. RAW — and the reasoning is creationBrief's, quoted because it is
 *   right: "A visible oddity is a bug report; a dropped line is a screen that
 *   quietly under-describes a weapon." An unregistered field is already a hard
 *   content failure (content/source/equipMods.csv), so reaching that branch
 *   means the tables disagree and a player should see something.
 *
 * `set` mode reads `= 3` rather than a bare `3`, so "Cost = 0" cannot be
 * misread as "Cost 0 added".
 */
export function modEffectLines(registries, piece) {
  const fields = (registries?.equipment || {}).modFields || {};
  return (piece?.mods || []).map((raw) => modEffectLine(fields, raw));
}

/** One mod string, rendered. Split out so a caller holding only the vocabulary
 *  (compendium walks a table, not a registry) reaches the same sentence. */
export function modEffectLine(fields, raw) {
  const mod = parseMod(raw);
  const spec = mod && (fields || {})[mod.field];
  if (!spec) return String(raw);
  const where = !mod.prefix || mod.prefix === 'self'
    ? ''
    : `${mod.prefix[0].toUpperCase()}${mod.prefix.slice(1)} `;
  const amount = mod.mode === 'add'
    ? `${mod.value >= 0 ? '+' : ''}${mod.value}`
    : `= ${mod.value}`;
  return `${where}${spec.label} ${amount}`;
}

// ---------------------------------------------------------------------------
// Hands
// ---------------------------------------------------------------------------

/** The closed set. A third hand is a new word — engine, one act (Law 1 c1). */
export const HANDS = Object.freeze(['left', 'right']);
export const EQUIPMENT_ROLES = Object.freeze(['attack', 'guard', 'technique']);
export const ARMAMENT_INTRINSIC_STAT_FIELDS = Object.freeze([
  'attackRating',
  'defenseRating',
  'weight',
  'weaponArtManaCost',
  'uniqueSkillStaminaCost',
]);

/**
 * Validate presentation-only armament facts without folding them into card or
 * combat math. Every field is explicit: absence is never interpreted as zero.
 */
export function armamentIntrinsicStatProblems(piece) {
  const id = piece && piece.id || '?';
  const problems = [];
  for (const field of ARMAMENT_INTRINSIC_STAT_FIELDS) {
    const value = piece && piece[field];
    if (!Number.isInteger(value) || value < 0) {
      problems.push(`${id}: ${field} must be an explicit non-negative integer`);
    }
  }
  if (Number.isInteger(piece?.weight) && piece.weight !== piece.poiseThreshold) {
    problems.push(`${id}: weight ${piece.weight} must equal authored poiseThreshold ${piece.poiseThreshold}`);
  }
  const isStaffTechnique = (piece?.itemTypeTags || []).includes('item:magic-focus')
    && piece?.techniqueProfile === 'staffTechnique';
  const expectedManaCost = isStaffTechnique ? 1 : 0;
  if (piece?.weaponArtManaCost !== expectedManaCost) {
    problems.push(`${id}: weaponArtManaCost must be ${expectedManaCost} for its authored item type and technique profile`);
  }
  if (piece?.uniqueSkillStaminaCost !== 0) {
    problems.push(`${id}: uniqueSkillStaminaCost must remain 0 until an explicit unique-skill consumer exists`);
  }
  return problems;
}
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
export function equipmentRequirementReceipt(registries, piece, attributes = {}, { itemUpgradeLevels = {}, armamentLevels = {} } = {}) {
  if (!piece || typeof piece !== 'object') throw new Error('equipment requirement receipt needs a piece');
  const authored = (piece.requirements && piece.requirements.attributes) || {};
  const requirements = [];
  const failures = [];
  const namespaced = itemUpgradeLevels?.[`armament/${piece.id}`];
  const level = Number.isInteger(namespaced) ? namespaced
    : Number.isInteger(armamentLevels?.[piece.id]) ? armamentLevels[piece.id] : 0;
  for (const [attributeId, required] of Object.entries(authored)) {
    if (!registries.attributes.has(attributeId)) throw new Error(`${piece.id}: unknown requirement attribute '${attributeId}'`);
    if (!Number.isInteger(required) || required < 0) throw new Error(`${piece.id}.${attributeId}: requirement minimum must be a non-negative integer`);
    const delta = cumulativeRequirementDelta(registries, `armament/${piece.id}`, attributeId, level);
    const effectiveRequired = Math.max(0, required + delta);
    const actual = attributes && attributes[attributeId];
    const row = { attributeId, baseRequired: required, reduction: -delta, required: effectiveRequired, actual: Number.isFinite(actual) ? actual : null };
    requirements.push(row);
    if (!Number.isFinite(actual) || actual < effectiveRequired) failures.push(row);
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
/**
 * The same floor as validateContent: a door that answers questions about
 * content is structurally unable to throw on content. Named rules first; this
 * catches what no rule names yet, so a malformed field is a reported problem
 * rather than an exception before the banner can render.
 */
export function validateEquipment(registries) {
  // THE FLOOR ADDS, IT NEVER REPLACES. The accumulator is created HERE and
  // handed in, so a throw partway through keeps every field-addressed problem
  // found before it. Returning a fresh array from the catch — which is what
  // this did — turned a good diagnosis into a generic one: content that
  // correctly reported `grantedCards[0] must name cardId` came back saying only
  // "cannot read properties of null". A backstop that erases the answers it is
  // standing behind is worse than no backstop.
  const problems = [];
  try {
    return collectEquipmentProblems(registries, problems);
  } catch (error) {
    problems.push(`equipment validation could not finish reading this content: ${error && error.message} — a field is malformed in a way no rule names yet; any problems listed above were found before it, and the stack points at the field that threw`);
    return problems;
  }
}

function collectEquipmentProblems(registries, problems = []) {
  const eq = registries.equipment || {};
  const fields = eq.modFields || {};
  const pieces = [...(eq.armaments || []), ...(eq.armour || [])];
  const profilesPresent = Array.isArray(eq.basicCardProfiles);
  const profiles = eq.basicCardProfiles || [];
  const profileIds = new Set();
  const tags = tagService(registries);
  const attributeIds = new Set(registries.attributes && registries.attributes.ids ? registries.attributes.ids() : []);
  if (Array.isArray(eq.startingKits)) problems.push(...startingKitProblems(registries));

  for (const piece of eq.armaments || []) problems.push(...armamentIntrinsicStatProblems(piece));

  if (profilesPresent) {
    if (!Array.isArray(eq.equipmentRequirements)) problems.push('equipmentRequirements.csv: missing generated table');
    if (!Array.isArray(eq.cardEquipmentExceptions)) problems.push('cardEquipmentExceptions.csv: missing generated table');
    if (!Array.isArray(eq.cardTagging)) problems.push('cardTagging: missing the registered card-tag table (content/source/tagging.csv)');
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
    // The service owns what a family may carry, so this reads the same rule
    // the boot door reads rather than a second copy of it.
    for (const tag of profile.tags || []) {
      try { tags.assertLegal('basicCardProfile', tag); }
      catch (e) { problems.push(`${profile.id}: ${e.message}`); }
    }
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
    // roleCopies is the LEGACY distribution, and the hand-kept sum is exactly
    // the coupling the composed deck exists to remove: with the composed path
    // live, raising startingDeckSize to 12 produces a valid twelve-card plan
    // and these dormant counts would still reject it for summing to ten.
    // They are rules only while they are the ones being read.
    if (!startingDeckConfig(registries)) {
      const total = [...EQUIPMENT_ROLES, 'signature'].reduce((sum, role) => sum + (Number(roleCopies[role]) || 0), 0);
      if (total !== registries.balance.startingDeckSize) {
        problems.push(`balance.equipment.roleCopies sum ${total}; startingDeckSize is ${registries.balance.startingDeckSize}`);
      }
      if (roleCopies.signature !== 1) problems.push('balance.equipment.roleCopies.signature must be exactly 1');
    }
    problems.push(...startingDeckProblems(registries));
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
  if (typeof eqBal.allowChangesInCombat !== 'boolean') {
    problems.push(`balance.equipment.allowChangesInCombat must be true or false — got ${JSON.stringify(eqBal.allowChangesInCombat)}`);
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
 * isEquipmentComposedInstance(inst) -> boolean
 *
 * Whether a deck instance is MINTED BY EQUIPMENT rather than owned by the deck,
 * and so is not a candidate for permanent removal. Both removal doors — the
 * merchant's burn and the `removeCardFromDeck` opcode — already excluded package
 * outputs (`grantedBy`) for the stated reason that "the next authoritative
 * reconcile would recreate the same deterministic id, so a removal here could
 * never persist". A generated attack slot has exactly that property and was
 * never excluded: burning one re-minted it on the next restamp, so the merchant
 * charged cinders for nothing and the event opcode did nothing. Persisting the
 * birth quota turned that silent no-op into a loud throw, which is how it was
 * finally noticed — the removal was already broken, it just failed quietly.
 *
 * One predicate, both doors, so the two cannot disagree about what a removal is.
 */
export function isEquipmentComposedInstance(inst) {
  return Boolean(inst && (inst.grantedBy || inst.equipmentAttackSlotId));
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
    // Contract-new output (framework contract: Equipment contract,
    // grantedCards; adoption ruling 2026-09-01): extra real cards a package
    // adds to the starting deck. No shipped armament authors any yet — the
    // mechanism validates and composes, and stays dormant until data exists.
    const grantedCardsRaw = source.grantedCards == null ? [] : source.grantedCards;
    if (!Array.isArray(grantedCardsRaw)) throw new Error(`${piece.id}: grantedCards must be an array`);
    // A CARD THE RECONCILE CANNOT FIND AGAIN IS NOT GRANTABLE. Reconciliation is
    // a SCAN of the four piles: an instance the scan does not see is treated as
    // a missing grant and re-pushed under the same deterministic id. That is
    // correct for every destination but one — a Power is REMOVED FROM PLAY when
    // played, so it sits in no pile, and the next swap or snapshot migration
    // would hand it straight back to be played and stacked again.
    //
    // The alternative is a ledger of grants that left play — new run state, a
    // new save field, and a new thing to keep in sync — for a seam no shipped
    // armament uses. The rule is cheaper and honest: if the reconcile cannot
    // track a card's lifecycle, the package may not grant it, said at the door.
    const trackable = (cardId, what) => {
      const def = registries.cards.get(cardId);
      const destination = registries.framework && typeof registries.framework.afterPlayDestination === 'function'
        ? registries.framework.afterPlayDestination(def)
        : 'DISCARD_PILE';
      if (destination === 'REMOVED_FROM_PLAY') {
        throw new Error(`${piece.id}: ${what} '${cardId}' is removed from play when played (a ${def && def.type}), and grant reconciliation finds its instances by scanning the piles — it would be handed back and replayable after every equipment swap; a package may only grant cards that stay in a pile`);
      }
    };
    const grantedSeen = new Set();
    const grantedCards = grantedCardsRaw.map((raw, index) => {
      const ref = typeof raw === 'string' ? { cardId: raw } : raw;
      if (!ref || typeof ref !== 'object' || Array.isArray(ref) || !ref.cardId) {
        throw new Error(`${piece.id}: grantedCards[${index}] must name cardId`);
      }
      if (!registries.cards.has(ref.cardId)) throw new Error(`${piece.id}: granted card '${ref.cardId}' is unknown`);
      const count = ref.count == null ? 1 : ref.count;
      if (!Number.isInteger(count) || count < 1) throw new Error(`${piece.id}: grantedCards[${index}].count must be a positive integer`);
      if (grantedSeen.has(ref.cardId)) throw new Error(`${piece.id}: duplicate granted card '${ref.cardId}'`);
      trackable(ref.cardId, 'granted card');
      grantedSeen.add(ref.cardId);
      return { cardId: ref.cardId, count };
    });
    // Default weapon arts: real cards the armament installs (contract-new,
    // dormant — no shipped armament authors any). Validated like grants.
    const weaponArtsRaw = source.weaponArtDefaults == null ? [] : source.weaponArtDefaults;
    if (!Array.isArray(weaponArtsRaw)) throw new Error(`${piece.id}: weaponArtDefaults must be an array`);
    const artSeen = new Set();
    const weaponArtDefaults = weaponArtsRaw.map((artId, index) => {
      if (typeof artId !== 'string' || !artId) throw new Error(`${piece.id}: weaponArtDefaults[${index}] must name a card id`);
      if (!registries.cards.has(artId)) throw new Error(`${piece.id}: weapon art '${artId}' is unknown`);
      if (artSeen.has(artId)) throw new Error(`${piece.id}: duplicate weapon art '${artId}'`);
      trackable(artId, 'weapon art');
      artSeen.add(artId);
      return artId;
    });
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
      grantedCards: Object.freeze(grantedCards),
      weaponArtDefaults: Object.freeze(weaponArtDefaults),
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
  // WHERE THE DEFAULT COMES FROM. Under the composed starting deck the attack
  // quota is whatever the plan worked out — grants first, then filler split by
  // the class's strikeBias — and roleCopies.attack is the LEGACY answer, right
  // only while the composed path is off. Reading the legacy number here while
  // state.js composed the deck from the other one is how a bias of anything but
  // 0.5 died: six instances created, then restamped against an authored four
  // ("attack instance count 6 does not match authored 4"). The default is the
  // composed count whenever the composed path is live, so every caller —
  // creation, restamp, the Armoury preview — agrees without threading it.
  // Only when a class is actually named: the equip/swap probes call this with
  // classId null to ask what a loadout projects in the abstract, and there is
  // no class deck to plan for then — the legacy quota is the right answer, and
  // asking for a plan without one is how this threw reading a missing class.
  const composed = classId && startingDeckConfig(registries)
    ? startingDeckPlan(registries, loadout, classId)
    : null;
  const configured = composed
    ? composed.attackCount
    : Number(((registries.balance || {}).equipment || {}).roleCopies?.attack);
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
    // A shield owns a low fallback strike when it is the only armed hand, but
    // never steals half the active attack package from a paired weapon. Two
    // true weapons still split the authored attack slots deterministically.
    const nonShield = eligible.filter((source) => source.piece?.kind !== 'shield');
    if (nonShield.length === 1) refs = quotaRefs(registries, nonShield[0], count);
    else refs = [
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

// ---------------------------------------------------------------------------
// Composed starting deck
// ---------------------------------------------------------------------------

/**
 * The composed-deck half of validateEquipment.
 *
 * The cap rule is evaluated whatever `growToFit` says, so flipping the toggle
 * can never turn sound content unsound behind your back. When growToFit is on
 * the overrun is reported through `startingDeckWarnings` instead of here — one
 * validation truth, two severities.
 */
export function startingDeckProblems(registries) {
  return startingDeckFindings(registries).problems;
}

/** Overruns a growing deck absorbed. Sound content, worth seeing. */
export function startingDeckWarnings(registries) {
  return startingDeckFindings(registries).warnings;
}

/**
 * grantSourceIds(registries) -> [tagId]
 *
 * The vocabulary of "where a starting card came from", READ FROM THE TAG
 * TABLES rather than typed here. It used to be a frozen array in this file,
 * which is the shape the owner ruled against: adding a sixth source meant
 * editing code. It is now a domain (`grantSource`) with a row per source, so a
 * new one is a spreadsheet line like every other word in the game.
 *
 * Authoring order is the vocabulary's order, and that is the order bound cards
 * are dealt in — `sourceOrder` in balance may re-rank them, but the legal set
 * is whatever the registry holds.
 */
function grantSourceIds(registries) {
  return ((registries || {}).tags || [])
    .filter((tag) => tag && tag.domain === 'grantSource')
    .map((tag) => tag.id);
}

/**
 * The seams in THIS FILE that mint a bound card. These are engine structure,
 * not content vocabulary: there is a weapon seam and an armour seam whatever an
 * author names their sources. Each is bound to a grantSource tag by
 * `startingDeck.sources`, and every one of them must be bound — an unbound seam
 * would stamp `undefined` and sort its cards last in silence.
 *
 * A source with no seam (today: `from:relic`) is legal and needs no entry; it
 * is declared vocabulary waiting for a minter.
 */
const MINTED_GRANT_ROLES = ['global', 'armor', 'weapon', 'class'];

/**
 * grantSourceFor(cfg, role) -> tagId
 *
 * The grantSource tag a minting seam stamps, READ FROM THE AUTHORED MAP rather
 * than typed at the seam. Round twenty's finding: with the ids typed inline,
 * renaming a grantSource tag and its `sourceOrder` entry validated clean and
 * then dealt that source's cards last, because `sortBySourceOrder` no longer
 * recognised what the seam stamped. Validation guarantees every role in
 * MINTED_GRANT_ROLES is bound, so the fallback here is for hand-built configs
 * that never went through that door, not for shipped content.
 */
function grantSourceFor(cfg, role) {
  const bound = ((cfg || {}).sources || {})[role];
  return typeof bound === 'string' && bound ? bound : null;
}

function startingDeckFindings(registries) {
  const problems = [];
  const warnings = [];
  const cfg = ((registries.balance || {}).equipment || {}).startingDeck;
  if (!cfg) return { problems, warnings };
  if (typeof cfg.enabled !== 'boolean') problems.push('startingDeck.enabled must be boolean');
  if (cfg.oddFillerGoesTo !== undefined && !['attack', 'guard'].includes(cfg.oddFillerGoesTo)) {
    problems.push(`startingDeck.oddFillerGoesTo must be 'attack' or 'guard' (got ${JSON.stringify(cfg.oddFillerGoesTo)}) — it names which role wins the remainder when the cap leaves an odd number of base cards`);
  }
  // The DECK SIZE, held here because the composed path is now the only reader of
  // it. The legacy roleCopies sum used to imply this — a fractional size could
  // never equal a sum of integer copies — and gating that check on the composed
  // path being off (round four) removed the implication without replacing it.
  // `10.5` then validated clean and planned `guardCount: 4.5`, which the copy
  // loop turned into five guards and an eleven-card deck.
  // sourceOrder is read by grantRefsFor to order the bound cards it deals, and a
  // malformed one used to surface as a TypeError rather than a content problem.
  // The vocabulary is the grantSource tag domain, so this validates against the
  // registry rather than a list typed in this file.
  if (cfg.sourceOrder !== undefined) {
    const legal = grantSourceIds(registries);
    if (!Array.isArray(cfg.sourceOrder)) {
      problems.push(`startingDeck.sourceOrder must be an array of grant-source tags (got ${JSON.stringify(cfg.sourceOrder)}) — it names the order bound cards are dealt in`);
    } else {
      for (const source of cfg.sourceOrder) {
        if (!legal.includes(source)) {
          problems.push(`startingDeck.sourceOrder names unknown grant source '${source}' (legal: ${legal.join(', ') || 'none registered — add rows to tags.csv in the grantSource domain'})`);
        }
      }
    }
  }

  // `sources` binds each minting seam to one of those tags. Without it the ids
  // were typed at the seams, so renaming a grantSource tag AND its sourceOrder
  // entry passed everything above and then dealt that source's cards last —
  // clean validation, wrong deck. Checked here so the rename fails at the door
  // instead of at the table: every seam bound, to a registered source.
  {
    const legal = grantSourceIds(registries);
    const map = cfg.sources;
    if (map === undefined || map === null || typeof map !== 'object' || Array.isArray(map)) {
      problems.push(`startingDeck.sources must be an object binding each minting seam (${MINTED_GRANT_ROLES.join(', ')}) to a grant-source tag (got ${JSON.stringify(map)}) — it is what each seam stamps on the cards it mints`);
    } else {
      for (const role of MINTED_GRANT_ROLES) {
        const bound = map[role];
        if (typeof bound !== 'string' || !bound) {
          problems.push(`startingDeck.sources.${role} must name a grant-source tag (got ${JSON.stringify(bound)}) — the '${role}' seam mints cards and would stamp nothing, sorting them last in silence`);
        } else if (!legal.includes(bound)) {
          problems.push(`startingDeck.sources.${role} names unknown grant source '${bound}' (legal: ${legal.join(', ') || 'none registered — add rows to tags.csv in the grantSource domain'})`);
        } else if (Array.isArray(cfg.sourceOrder) && !cfg.sourceOrder.includes(bound)) {
          // Legal — an unranked source is dealt last by contract — but almost
          // never what an author meant, so it is SEEN rather than refused.
          warnings.push(`startingDeck.sources.${role} names '${bound}', which sourceOrder does not rank — the '${role}' seam's cards are dealt after every ranked source`);
        }
      }
      for (const role of Object.keys(map)) {
        if (!MINTED_GRANT_ROLES.includes(role)) {
          problems.push(`startingDeck.sources names unknown seam '${role}' (the engine mints: ${MINTED_GRANT_ROLES.join(', ')}) — nothing reads this binding, so the tag it names would never be stamped`);
        }
      }
    }
  }
  const authoredSize = (registries.balance || {}).startingDeckSize;
  if (!Number.isInteger(authoredSize) || authoredSize < 0) {
    problems.push(`startingDeckSize must be a non-negative integer (got ${JSON.stringify(authoredSize)}) — the composed plan divides it into role counts, and a fraction becomes a card that half exists`);
  }
  // The DEFAULT bias, held to the same rule as an override. A class with no
  // override falls back to it, so a malformed default is not a cosmetic typo:
  // it reaches startingDeckPlan as NaN and run creation dies restamping against
  // an authored NaN quota, with nothing said at the door.
  const inBias = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
  if (cfg.defaultStrikeBias !== undefined && !inBias(cfg.defaultStrikeBias)) {
    problems.push(`startingDeck.defaultStrikeBias must be between 0 and 1 (got ${JSON.stringify(cfg.defaultStrikeBias)})`);
  }
  for (const [classId, row] of Object.entries(cfg.classes || {})) {
    if (!registries.classes.has(classId)) problems.push(`startingDeck.classes names unknown class '${classId}'`);
    const bias = row && row.strikeBias;
    if (!inBias(bias)) {
      problems.push(`startingDeck.classes.${classId}.strikeBias must be between 0 and 1 (got ${bias})`);
    }
  }
  const globalGrants = (cfg.global || {}).grants;
  if (globalGrants !== undefined && !Array.isArray(globalGrants)) {
    problems.push(`startingDeck.global.grants must be an array of card ids (got ${JSON.stringify(globalGrants)})`);
  } else {
    for (const cardId of globalGrants || []) {
      if (!registries.cards.has(cardId)) problems.push(`startingDeck.global.grants names unknown card '${cardId}'`);
    }
  }
  problems.push(...boundGrantProblems(registries));

  if (cfg.enabled !== true || problems.length) return { problems, warnings };

  // NO BUDGET REFUSAL, AND NO WEAPON-ART WARNING. Both existed to police a cap
  // that no longer works that way: the cap governs how many BASE cards are
  // minted, not how many cards a run may begin with. Equipment that fills or
  // exceeds it simply leaves no room for strikes and defends, which is a
  // balance question for whoever authors the weapons rather than something
  // validation can answer. The starseer and herald decks that read 11 against
  // an authored 10 were never wrong — they are 10 base cards' worth of cap with
  // one weapon art on top.
  //
  // What remains worth saying is what the composed deck WILL be, per class, so
  // an author can see the shape their content produces without starting a run.
  // Reported over EVERY loadout a player can begin in, not just the baseline —
  // the enumeration that four review rounds went into building for the budget
  // check. The budget is gone; the enumeration is not, because the question it
  // answers ("what can a player actually start in") is the same one, and a kit
  // that deals no base cards is worth seeing whichever kit it is.
  const seenShape = new Set();
  for (const classId of registries.classes.ids()) {
    let candidates = [];
    // A validation pass never throws on bad content — a bundle whose slots or
    // profiles are broken is named by the rules that own them.
    try { candidates = selectableStartingLoadouts(registries, classId); } catch { continue; }
    for (const { label, loadout } of candidates) {
      let plan = null;
      try { plan = startingDeckPlan(registries, loadout, classId); } catch (e) {
        problems.push(`startingDeck: cannot plan '${classId}' ${label}: ${e.message}`);
        continue;
      }
      if (!plan || plan.filler > 0) continue;
      const detail = `startingDeck: class '${classId}' ${label} begins with ${plan.size} card(s), all equipment-bound — its gear meets the ${plan.cap}-card cap on its own, so no base strikes or defends are dealt`;
      if (seenShape.has(detail)) continue;
      seenShape.add(detail);
      warnings.push(detail);
    }
  }

  return { problems, warnings };
}

/**
 * selectableStartingLoadouts(registries, classId) -> [{ label, loadout }]
 *
 * Every loadout a player can actually BEGIN in. This asks character creation
 * what it accepts rather than guessing the axes: three rounds of review found
 * three of them in turn (the baseline kit, then the armour, then the hands,
 * each chosen independently of the others), because the enumeration was built
 * from the kit table while `resolveCreationHands`/`resolveStartingArmour` were
 * the things actually deciding. So the candidates come from
 * characterCreation's own `handIds` and `armourIds`, paired through creation's
 * own resolver — an incompatible pair throws there and is skipped here, with no
 * second copy of the compatibility rule to drift.
 *
 * The authored kits ride along as a floor, so a class whose kit names a piece
 * outside handIds is still checked.
 */
function selectableStartingLoadouts(registries, classId) {
  const armours = (registries.equipment || {}).armour || [];
  const kits = ((registries.equipment || {}).startingKits || []).filter((kit) => kit.classId === classId);
  let creation = null;
  try { creation = classCreationConfig(registries, classId); } catch { creation = null; }
  const handIds = [null, ...((creation && creation.handIds) || [])];
  // ASK THE PREDICATE, DO NOT RE-LIST THE AXES. `armourIds` is one of THREE ways
  // an outfit becomes startable — free (`unlock === ''`) and earned-by-unlock are
  // the others — and enumerating the one I remembered is what three earlier
  // rounds each caught one axis later. startingKits.js owns the real answer, and
  // run creation asks it, so this asks the same function with the most permissive
  // meta there is: every unlock the bundle can ever grant. Nothing a player can
  // start in is outside this set, and nothing outside the bundle is inside it.
  const everyUnlock = { unlocked: ((registries.unlocks || []).map((row) => row && row.id)).filter(Boolean) };
  const armourRows = armours.filter((row) => row.classId === classId
    && armourIsStartingEligible(row, everyUnlock, registries, classId));

  const out = [];
  const seen = new Set();
  const add = (label, loadout, key) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, loadout });
  };

  for (const armour of armourRows.length ? armourRows : [null]) {
    const armourWhere = armour ? ` + armour '${armour.id}'` : '';
    // The authored kits, whole.
    for (const kit of kits) {
      add(`kit '${kit.id}'${armourWhere}`, createLoadout(registries, classId, kit, armour),
        `kit:${kit.id}:${armour ? armour.id : ''}`);
    }
    // And every hand pair creation would accept, which is where the kits stop
    // being the whole story: two grant-bearing pieces that share no kit can
    // still be picked together.
    for (const rightHand of handIds) {
      for (const leftHand of handIds) {
        if (rightHand === null && leftHand === null) continue;
        let hands;
        try {
          hands = resolveCreationHands(registries, classId, { rightHand, leftHand }, {});
        } catch {
          continue; // creation refuses this pair, so a player cannot reach it
        }
        const kit = { classId, rightHand: hands.rightHand || '', leftHand: hands.leftHand || '' };
        const where = `hands ${hands.rightHand || '-'}/${hands.leftHand || '-'}${armourWhere}`;
        add(where, createLoadout(registries, classId, kit, armour),
          `hands:${hands.rightHand || ''}:${hands.leftHand || ''}:${armour ? armour.id : ''}`);
      }
    }
  }
  if (!out.length) out.push({ label: 'default loadout', loadout: createLoadout(registries, classId) });
  return out;
}

/** The composed-deck config, or null when the legacy roleCopies path is live. */
function startingDeckConfig(registries) {
  const cfg = startingDeckSettings(registries);
  if (!cfg || cfg.enabled !== true) return null;
  return cfg;
}

/**
 * The same block, WITHOUT the enabled gate. Provenance is not a planner
 * feature: a granted card carries the id of the source that minted it whether
 * or not the composed plan is switched on, so the stamp reads this and the
 * planner reads startingDeckConfig.
 */
function startingDeckSettings(registries) {
  return ((registries.balance || {}).equipment || {}).startingDeck;
}

/** The tag that says "this object carries its own cards"; payload in equipmentGrants.csv. */
export const BOUND_GRANT_TAG = 'bound';

/**
 * The two halves of a bound grant, held together.
 *
 * Tagged with no row is a broken promise the player can see and the deck never
 * honours; a row with no tag is a grant that lands with nothing declaring it.
 * Both are authoring mistakes, and neither is visible from its own side — so
 * they are checked from here, where both halves are in scope.
 */
export function boundGrantProblems(registries) {
  const problems = [];
  const eq = registries.equipment || {};
  const rows = eq.equipmentGrants;
  if (!Array.isArray(rows)) return ['equipmentGrants.csv: missing generated table'];
  // Pieces carry their family with them here, because the KEY is (family,
  // scope, sourceId) — an outfit id is unique only within its class, so
  // `default` alone names four different outfits and the bare id could neither
  // tell them apart nor let two of them grant different cards.
  const pieces = [
    ...(eq.armaments || []).map((piece) => ({ piece, family: 'armament' })),
    ...(eq.armour || []).map((piece) => ({ piece, family: 'armour' })),
  ];
  const keyFor = (family, scope, sourceId) => `${family}\u001f${scope || ''}\u001f${sourceId}`;
  const named = (row) => (row.scope ? `${row.family}/${row.scope}/${row.sourceId}` : `${row.family || '?'}/${row.sourceId}`);
  const seen = new Set();

  for (const row of rows) {
    if (!row || typeof row.sourceId !== 'string' || !row.sourceId) { problems.push('equipmentGrants.csv: row missing sourceId'); continue; }
    if (row.family !== 'armament' && row.family !== 'armour') {
      problems.push(`equipmentGrants.csv: '${row.sourceId}' names family '${row.family}' — must be 'armament' or 'armour'`);
      continue;
    }
    const key = keyFor(row.family, row.scope, row.sourceId);
    if (seen.has(key)) problems.push(`equipmentGrants.csv: duplicate row for ${named(row)}`);
    seen.add(key);
    const owners = pieces.filter((entry) => entry.family === row.family
      && entry.piece.id === row.sourceId
      && (entry.piece.classId || '') === (row.scope || ''));
    if (!owners.length) { problems.push(`equipmentGrants.csv: ${named(row)} names no known piece`); continue; }
    if (!owners.some((entry) => (entry.piece.tags || []).includes(BOUND_GRANT_TAG))) {
      problems.push(`equipmentGrants.csv: ${named(row)} grants cards but is not tagged '${BOUND_GRANT_TAG}' — the grant would be silent`);
    }
    if (!(row.cards || []).length) problems.push(`equipmentGrants.csv: ${named(row)} names no cards`);
    for (const cardId of row.cards || []) {
      if (!registries.cards.has(cardId)) problems.push(`equipmentGrants.csv: ${named(row)} grants unknown card '${cardId}'`);
    }
  }

  for (const { piece, family } of pieces) {
    if (!(piece.tags || []).includes(BOUND_GRANT_TAG)) continue;
    if (!seen.has(keyFor(family, piece.classId || '', piece.id))) {
      problems.push(`${piece.id}: tagged '${BOUND_GRANT_TAG}' but equipmentGrants.csv names no cards for it — the promise is empty`);
    }
  }
  return problems;
}

/**
 * Cards an object carries, or [] — the tag GATES the table, so a row nobody
 * tagged is inert rather than a silent grant. Works on anything with `tags`
 * and an `id`; nothing here is equipment-specific.
 */
export function boundGrantCardIds(registries, object, family = null) {
  if (!object || !(object.tags || []).includes(BOUND_GRANT_TAG)) return [];
  // The WHOLE piece identity, not the bare id: outfit ids repeat per class, so
  // `default` alone names four different outfits. `family` narrows it when the
  // caller knows which table the piece came from; the scope half is read off
  // the object, so a scoped family matches only its own row.
  const rows = (registries.equipment || {}).equipmentGrants || [];
  const row = rows.find((entry) => entry.sourceId === object.id
    && (!family || !entry.family || entry.family === family)
    && (entry.scope || '') === scopeOfPiece(registries, entry.family || family, object));
  return (row && row.cards) || [];
}

/** The scope half of a piece's key, from its family's scopeField. */
function scopeOfPiece(registries, family, object) {
  const spec = (registries.tagFamilies || []).find((row) => row.family === family);
  if (!spec || !spec.scopeField) return '';
  return (object && object[spec.scopeField]) || '';
}

/** Cards a source hands over outright, one copy each, before any filler. */
function grantRefsFor(registries, loadout, classId, cfg, techniqueRow) {
  const cls = registries.classes.get(classId);
  const grants = [];

  // Weapon — the technique the equipped armament teaches. Weapon ATTACK grants
  // (priorityAttackRefs) are not counted here: they are dealt inside the attack
  // quota by quotaRefs, so counting them again would charge them twice.
  if (techniqueRow && techniqueRow.profile) {
    grants.push({
      source: grantSourceFor(cfg, 'weapon'),
      cardId: techniqueRow.profile.baseCardId,
      equipmentRole: 'technique',
      profileId: techniqueRow.profile.id,
    });
  }

  // NOT HERE: the cards a `bound` piece carries (equipmentGrants.csv). They
  // used to be pushed as plain run-owned refs, which is why they stayed in the
  // deck after the piece was unequipped and why a bound piece equipped mid-run
  // brought nothing — round nineteen's finding, and the owner's ruling
  // (2026-09-03): if the item is not equipped, its cards are gone. So they are
  // ITEM-OWNED instances, minted by desiredGrantInstances alongside package
  // grants and weapon arts, and swept by the same reconcile. startingDeckPlan
  // counts them against the cap through that door, never through this list.

  // The validator names a non-array `global.grants`, so a bad bundle does not
  // boot — but this is the PLANNER, reached by tools and fixtures with
  // hand-built configs that never went through that door. It reads the shape it
  // needs rather than trusting that someone else checked.
  const globalGrants = (cfg.global || {}).grants;
  if (Array.isArray(globalGrants)) {
    for (const cardId of globalGrants) grants.push({ source: grantSourceFor(cfg, 'global'), cardId });
  }
  if (cls.startingSignatureCard) grants.push({ source: grantSourceFor(cfg, 'class'), cardId: cls.startingSignatureCard });

  // DEALT IN THE AUTHORED ORDER. `sourceOrder` is a list of grantSource tag ids;
  // a source it does not name is dealt last, in the order it was pushed. Stable,
  // so two grants from the same source keep their authored sequence.
  return sortBySourceOrder(cfg, grants, (grant) => grant.source);
}

/**
 * sortBySourceOrder(cfg, rows, sourceOf) -> rows
 *
 * Stable sort by `startingDeck.sourceOrder`, a list of grantSource tag ids. A
 * row whose source the list does not name sorts last, keeping its incoming
 * position. Shared so the plan's grants and the assembled deck cannot disagree
 * about what "in source order" means.
 */
export function sortBySourceOrder(cfg, rows, sourceOf) {
  const order = Array.isArray(cfg && cfg.sourceOrder) ? cfg.sourceOrder : [];
  const rank = (row) => {
    const at = order.indexOf(sourceOf(row));
    return at === -1 ? order.length : at;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (rank(a.row) - rank(b.row)) || (a.index - b.index))
    .map((entry) => entry.row);
}

/**
 * startingDeckPlan(registries, loadout, classId) → the arithmetic, no cards.
 *
 * Grants are dealt first and are never dropped; filler is what the budget has
 * left, split between attack and guard by the class bias. `minFiller` is the
 * invariant in both branches of `growToFit` — the toggle only decides whether
 * the deck size gives way (true) or the content author does (false).
 */
export function startingDeckPlan(registries, loadout, classId) {
  const cfg = startingDeckConfig(registries);
  if (!cfg) return null;
  const cap = Number(registries.balance.startingDeckSize);
  const rows = equipmentKitPlan(registries, loadout, classId);
  const grants = grantRefsFor(registries, loadout, classId, cfg, rows.find((row) => row.role === 'technique'));

  // Cards the package layer mints (reconcileGrantedCards installs them itself at
  // run creation, so they are COUNTED here and never pushed into `grants` —
  // pushing would deal each card twice). Weapon ARTS are counted the same way:
  // they are equally real cards in the opening hand, and under the cap rule
  // below there is nothing to refuse, so there is no longer any reason to treat
  // them differently from grants. That asymmetry existed only to avoid failing
  // the shipped bundle, and the rule that made it fail is gone.
  const packageCards = desiredGrantInstances(registries, { loadout, class: classId }).length;

  // THE CAP APPLIES TO THE BASE CARDS, AND ONLY AT CREATION (owner ruling,
  // 2026-09-03). Bound cards are dealt first and are never capped, dropped or
  // refused; the cap decides how many base strikes and defends are minted on
  // top of them, and nothing else. If equipment alone meets or exceeds the cap,
  // no base cards are minted and the run begins with only its unique cards —
  // that is a balance question for whoever authors the weapons, not an error.
  //
  // Which is why `growToFit` and `minFiller` are gone. Both existed to decide
  // who yields when grants got greedy: the deck size, or the content author.
  // Nobody yields now. A floor of basic cards is not a rule either — it is
  // simply what the cap leaves over, and the unarmed profiles are what those
  // cards LOOK like when a hand is bare.
  const bound = grants.length + packageCards;
  const filler = Math.max(0, cap - bound);

  const bias = Number(
    ((cfg.classes || {})[classId] || {}).strikeBias ?? cfg.defaultStrikeBias ?? 0.5
  );
  // An odd filler count cannot split evenly, so one role wins the remainder.
  // Authored, not assumed: `oddFillerGoesTo` names it and defaults to attack.
  const oddGoesToAttack = (cfg.oddFillerGoesTo ?? 'attack') !== 'guard';
  const exact = filler * bias;
  const attackCount = Math.min(filler, Math.max(0, oddGoesToAttack
    ? Math.round(exact)
    : Math.ceil(exact - 0.5)));
  return Object.freeze({
    size: bound + filler,
    grants: Object.freeze(grants.map(Object.freeze)),
    filler,
    attackCount,
    guardCount: filler - attackCount,
    bias,
    oddGoesToAttack,
    cap,
    // Counted against the cap, dealt by reconcileGrantedCards rather than by
    // this plan, so `grants` stays the deal-out list it is used as.
    packageCards,
  });
}

/** The starting deck as instance-ready refs. */
export function startingDeckRefs(registries, loadout, classId) {
  const cls = registries.classes.get(classId);
  const plan = startingDeckPlan(registries, loadout, classId);
  const copies = ((registries.balance || {}).equipment || {}).roleCopies || {};
  const refs = [];

  // Composed path: attack and guard counts come from the plan, everything else
  // is a grant. Legacy path: the authored roleCopies distribution, verbatim.
  const attackSlotCount = plan ? plan.attackCount : undefined;
  const guardCopies = plan ? plan.guardCount : (copies.guard || 0);

  for (const row of equipmentKitPlan(registries, loadout, classId)) {
    if (row.role === 'attack') {
      const attackPlan = buildEquippedWeaponCardPlan(registries, loadout, classId, { attackSlotCount });
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
    if (row.role === 'guard') {
      for (let i = 0; i < guardCopies; i++) {
        refs.push({ cardId: row.profile.baseCardId, equipmentRole: 'guard', profileId: row.profile.id });
      }
      continue;
    }
    if (plan) continue; // technique is a grant under the composed path
    for (let i = 0; i < (copies[row.role] || 0); i++) {
      refs.push({ cardId: row.profile.baseCardId, equipmentRole: row.role, profileId: row.profile.id });
    }
  }

  if (!plan) {
    for (let i = 0; i < (copies.signature || 0); i++) refs.push({ cardId: cls.startingSignatureCard });
    return refs;
  }
  for (const grant of plan.grants) {
    const { source, ...ref } = grant;
    // The provenance rides ALONG. It used to be discarded here, which left the
    // assembled deck with no way to answer "where did this card come from" —
    // so `sourceOrder` could order the plan but never the deck it produced.
    refs.push({ ...ref, grantSource: source });
  }
  return refs;
}

/**
 * Granted cards and default weapon arts reconcile against the EQUIPPED
 * packages on every authoritative restamp (contract-new outputs on the
 * adopted composer; dormant while no shipped armament authors either).
 * Deterministic instance ids make the reconcile idempotent and save-stable;
 * an instance whose armament left the hands leaves the deck with it.
 */
/**
 * orderStartingDeck(registries, run) -> run.deck
 *
 * SPEC says bound cards are dealt first, in `sourceOrder`. Until this ran, they
 * were dealt LAST: startingDeckRefs emits the base attack and guard refs before
 * it consumes the grants, and reconcileGrantedCards appends package grants and
 * weapon arts after that again — so the shipped starseer opened with four
 * strikes and three defends, then its technique, signature and art. The spec I
 * wrote and the code I wrote disagreed, and the spec is the one the owner ruled.
 *
 * Ordered ONCE, at creation, because "dealt" is a creation word: instances that
 * arrive later from a mid-run swap land where reconcile puts them.
 *
 * Base cards keep their relative order. That is not tidiness — the legacy
 * attack-slot migration binds `attack:0..N-1` by deck order, so reshuffling the
 * base cards among themselves would rebind them.
 */
export function orderStartingDeck(registries, run) {
  const cfg = startingDeckConfig(registries);
  if (!cfg || !Array.isArray(run.deck)) return run.deck;
  // A card either CARRIES its provenance or is a base card. No shape-guessing:
  // `grantSource` is written where the card is minted, in the same vocabulary
  // `sourceOrder` names, so this reads one field instead of inferring from
  // `grantedBy`/`sourceId`/role and drifting the day a fourth shape appears.
  const sourceOf = (card) => (card && card.grantSource) || null;
  const bound = [];
  const base = [];
  for (const card of run.deck) (sourceOf(card) === null ? base : bound).push(card);
  run.deck = [...sortBySourceOrder(cfg, bound, sourceOf), ...base];
  return run.deck;
}

// ---------------------------------------------------------------------------
// Card ownership
// ---------------------------------------------------------------------------
//
// EVERY CARD IN THE DECK HAS AN OWNER: the run, or one item. Run-owned cards
// are the run's for good — base strikes and defends (an item only re-skins
// them), the class signature, global grants, rewards, and anything extracted
// at a smith. Item-owned cards RIDE WITH THE ITEM: equip it and they arrive,
// unequip it and they leave, equip it again and they are back, identical.
//
// One rule, three authoring sources feeding it — a package's `grantedCards`,
// its `weaponArtDefaults`, and the `bound` table (equipmentGrants.csv). Until
// the owner's ruling (2026-09-03) the third was the odd one out: its cards
// were minted as plain run-owned refs at creation and never looked at again,
// so they outlived the piece that promised them. Now all three are minted by
// desiredGrantInstances and swept by the reconciles below, keyed on the one
// predicate here rather than on a role list copied into each sweep.

/** The roles an item-owned instance may carry. */
export const ITEM_OWNED_ROLES = Object.freeze(['granted', 'weaponArt']);

/** True when the instance rides with an item rather than belonging to the run. */
export function isItemOwned(inst) {
  return Boolean(inst) && ITEM_OWNED_ROLES.includes(inst.equipmentRole);
}

/**
 * The namespaced ref of the piece — `armament/<id>` or `armor/<class>/<id>`,
 * the same spelling itemUpgrades and smithing already key on, so an owner
 * written on a card instance can be resolved by every model that speaks it.
 */
export function pieceItemRef(piece) {
  if (!piece || !piece.id) return null;
  return piece.kind === 'armor' ? `armor/${piece.classId}/${piece.id}` : `armament/${piece.id}`;
}

/** The inverse read: the item an instance rides with. Lives in cardMounts.js; re-exported so readers of this module find both halves together. */
export { ownerItemRef };

/** The tagFamilies.csv family a piece belongs to, from its kind. */
function pieceFamily(piece) {
  return piece && piece.kind === 'armor' ? 'armour' : 'armament';
}

/**
 * The instance a pile should hold for a wanted mount: the one it has, unless
 * the mount's CARD changed under the same key — a smith emptied it down to
 * its fallback, or seated another card — in which case the fresh instance
 * replaces it in place. Fresh, not patched: a stamped instance carries the
 * old card's carrier fields (`damageSchool`, `mods`), and stampDeck treats a
 * stamped non-equipment card as immutable, so patching `cardId` alone would
 * leave a Dodge Roll wearing Crimson Cleave's stamp.
 */
function adoptWanted(inst, wanted) {
  return inst.cardId === wanted.cardId && (inst.upgraded === true) === (wanted.upgraded === true) ? inst : wanted;
}

export function reconcileGrantedCards(registries, run) {
  if (!run.deck) run.deck = [];
  const desired = desiredGrantInstances(registries, run);
  const wanted = new Map(desired.map((d) => [d.instanceId, d]));
  const present = new Set();
  // In place, not a reassignment: stampDeck captures its stamping list before
  // reconciling, so an appended instance must land in the SAME array to flow
  // through the carrier/mod stamping that follows.
  const kept = [];
  for (const inst of run.deck) {
    if (!isItemOwned(inst)) { kept.push(inst); continue; }
    const want = wanted.get(inst.instanceId);
    if (!want) continue;
    present.add(inst.instanceId);
    kept.push(adoptWanted(inst, want));
  }
  run.deck.length = 0;
  run.deck.push(...kept);
  for (const d of desired) if (!present.has(d.instanceId)) run.deck.push(d);
  return run.deck;
}

/**
 * EVERY item-owned instance the CURRENTLY worn equipment lends — the one list
 * both reconciles and the creation plan read, so "what does my gear give me"
 * has one answer. Bound-table cards first, for every worn piece; then package
 * grants, right hand then left (the contract model authors no dedup for them);
 * then weapon arts, which with both hands armed go through the framework's
 * splitAuthoredWeaponArts — quota split, unique preference RIGHT_THEN_LEFT —
 * so an art both weapons author installs once, attributed to the winning hand.
 */
function desiredGrantInstances(registries, run) {
  // Stamped from the authored binding, not typed here — see grantSourceFor.
  const settings = startingDeckSettings(registries);
  const weaponSource = grantSourceFor(settings, 'weapon');
  let desired = [];

  // THE BOUND TABLE. Every worn piece carrying the `bound` tag lends the cards
  // equipmentGrants.csv names for it — armour as much as armaments, because
  // the tag is the gate and it does not care what kind of thing wears it.
  for (const piece of equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) {
    desired.push(...boundMountInstances(registries, settings, piece));
  }

  const sources = { right: null, left: null };
  for (const hand of ['right', 'left']) {
    const source = handSource(registries, run.loadout, run.class, hand);
    if (source.package) sources[hand] = source;
  }
  for (const hand of ['right', 'left']) {
    const source = sources[hand];
    if (!source) continue;
    desired.push(...packageGrantInstances(source.package, weaponSource));
  }
  const arts = sources.right && sources.left
    ? splitAuthoredWeaponArts(sources.right.package.weaponArtDefaults, sources.left.package.weaponArtDefaults)
    : ['right', 'left'].flatMap((hand) => (sources[hand]
      ? sources[hand].package.weaponArtDefaults.map((id) => ({ id, hand }))
      : []));
  for (const art of arts) {
    desired.push(weaponArtInstance(sources[art.hand].package.weaponId, art.id, weaponSource));
  }

  // WHAT A SMITH HAS DONE TO THOSE MOUNTS, applied before the empty-hand rule
  // below so an art mount emptied down to its Dodge Roll fallback counts as a
  // Dodge Roll already installed — one, not one per hand.
  desired = applyMountOverrides(registries, run, desired);

  // THE EMPTY HAND'S ART: the Dodge Roll rides as long as one hand is empty
  // (the owner's rule, 2026-09-02) — not only when both are. With one hand
  // armed, the technique slot is that armament's (its installed art, A-6)
  // and the EMPTY hand contributes the unarmed technique as a weapon-art
  // instance of its own, minted and dropped here as the hands change, so
  // filling the hand takes the dodge away and emptying it brings it back.
  // Both hands empty is the unarmed package (every technique slot is the
  // Dodge Roll already); a two-handed armament fills both hands.
  const armed = ['right', 'left'].filter((hand) => handSource(registries, run.loadout, run.class, hand).piece);
  const twoHanded = sources.right?.package?.handsRequired === 2 || sources.left?.package?.handsRequired === 2;
  if (armed.length === 1 && !twoHanded) {
    const empty = armed[0] === 'right' ? 'left' : 'right';
    const profile = profileById(registries, ((registries.balance || {}).equipment || {}).unarmedProfiles?.technique);
    const alreadyInstalled = profile && desired.some((d) => d.equipmentRole === 'weaponArt' && d.cardId === profile.baseCardId);
    if (profile && profile.baseCardId && !alreadyInstalled) {
      desired.push({
        instanceId: `weaponArt:unarmed:${empty}:${profile.baseCardId}`,
        cardId: profile.baseCardId, upgraded: false, equipmentRole: 'weaponArt', grantedBy: `unarmed:${empty}`,
        grantSource: weaponSource,
      });
    }
  }

  // EXTRA MOUNTS a smith has filled on worn pieces (the rune seam).
  for (const piece of equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: run.itemUpgradeLevels || {} })) {
    desired.push(...extraMountInstances(registries, run, pieceItemRef(piece), {
      grantSource: grantSourceFor(settings, pieceFamily(piece) === 'armour' ? 'armor' : 'weapon'),
    }));
  }
  return desired;
}

// ---- the three minters, one spelling each --------------------------------

/** The `bound` table's cards for one piece, as item-owned instances. Copies of the same card are numbered. */
function boundMountInstances(registries, settings, piece) {
  const family = pieceFamily(piece);
  const owner = pieceItemRef(piece);
  const copies = new Map();
  const out = [];
  for (const cardId of boundGrantCardIds(registries, piece, family)) {
    const i = copies.get(cardId) || 0;
    copies.set(cardId, i + 1);
    out.push({
      instanceId: mountKey.bound(owner, cardId, i),
      cardId, upgraded: false, equipmentRole: 'granted', grantedBy: owner,
      grantSource: grantSourceFor(settings, family === 'armour' ? 'armor' : 'weapon'),
    });
  }
  return out;
}

/** A package's grantedCards, as item-owned instances. */
function packageGrantInstances(pkg, weaponSource) {
  const out = [];
  for (const grant of pkg.grantedCards) {
    for (let i = 0; i < grant.count; i++) {
      out.push({
        instanceId: mountKey.granted(pkg.weaponId, grant.cardId, i),
        cardId: grant.cardId, upgraded: false, equipmentRole: 'granted', grantedBy: pkg.weaponId,
        grantSource: weaponSource,
      });
    }
  }
  return out;
}

/** One authored weapon art, as an item-owned instance. */
function weaponArtInstance(weaponId, artId, weaponSource) {
  return {
    instanceId: mountKey.weaponArt(weaponId, artId),
    cardId: artId, upgraded: false, equipmentRole: 'weaponArt', grantedBy: weaponId,
    grantSource: weaponSource,
  };
}

/**
 * itemMountInstances(registries, run, piece, { authored }) -> [instance]
 *
 * Everything ONE piece lends, whether or not it is equipped — the bound table,
 * the package's grants, ALL of its arts (the two-hand split that keeps a
 * shared art to one copy is a question about a pair, not about this piece)
 * and, unless `authored` is asked for, what a smith has done to those mounts
 * plus any extra mounts filled. The smith services enumerate an item's mounts
 * through this one door so a carried, unequipped sword can be worked on.
 */
export function itemMountInstances(registries, run, piece, { authored = false } = {}) {
  if (!piece) return [];
  const settings = startingDeckSettings(registries);
  const weaponSource = grantSourceFor(settings, 'weapon');
  const list = boundMountInstances(registries, settings, piece);
  const pkg = piece.kind === 'armor' ? null : WeaponCardPackageModel.fromPiece(registries, piece);
  if (pkg) {
    list.push(...packageGrantInstances(pkg, weaponSource));
    for (const artId of pkg.weaponArtDefaults) list.push(weaponArtInstance(pkg.weaponId, artId, weaponSource));
  }
  if (authored) return list;
  const itemRef = pieceItemRef(piece);
  return [
    ...applyMountOverrides(registries, run, list),
    ...extraMountInstances(registries, run, itemRef, {
      grantSource: grantSourceFor(settings, pieceFamily(piece) === 'armour' ? 'armor' : 'weapon'),
    }),
  ];
}

/**
 * The same reconcile at the ONE mid-fight door equipment moves through: the
 * combat piles are the deck while a fight is on, so a swap sweeps stale
 * granted/weaponArt instances out of every pile (hand included — an instance
 * whose armament left the hands leaves with it) and lands missing ones in the
 * discard pile, where the engine's addCard effect puts mid-combat additions.
 * Deterministic instance ids keep the sweep idempotent and combat-save-stable.
 */
export function reconcileGrantedCardsInCombat(registries, run, piles) {
  const desired = desiredGrantInstances(registries, run);
  const wanted = new Map(desired.map((d) => [d.instanceId, d]));
  const present = new Set();
  for (const pile of [piles.hand, piles.draw, piles.discard, piles.exhaust]) {
    const kept = [];
    for (const inst of pile) {
      if (!isItemOwned(inst)) { kept.push(inst); continue; }
      const want = wanted.get(inst.instanceId);
      if (!want) continue;
      present.add(inst.instanceId);
      kept.push(adoptWanted(inst, want));
    }
    pile.length = 0;
    pile.push(...kept);
  }
  for (const d of desired) if (!present.has(d.instanceId)) piles.discard.push(d);
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
export function equippedPieces(registries, loadout, classId, { itemUpgradeLevels = {} } = {}) {
  if (!loadout) return [];
  const out = [];
  for (const slot of (registries.equipment || {}).slots || []) {
    const piece = equippedIn(registries, loadout, classId, slot.id);
    if (piece && piece.kind === 'armor') {
      const itemRef = `armor/${piece.classId}/${piece.id}`;
      out.push(resolveUpgradedEquipment(registries, itemRef, itemUpgradeLevels[itemRef] || 0));
    } else if (piece) out.push(piece);
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
  // THE QUOTA IS THE RUN'S, NOT THE LOADOUT'S. A composed deck's attack count
  // is decided once, at birth, from the grants the run started with — after
  // that the deck HAS the instances it has, and swapping equipment re-skins
  // them rather than changing how many there are. Recomputing from the current
  // loadout made a swap between pieces with different grant counts throw
  // ("attack instance count 3 does not match authored 4"). The authoritative
  // full-deck restamp therefore reads the count off the deck itself; a subset
  // restamp keeps the old behaviour, since a pile is not the whole truth.
  // `run.deck` — NOT `list`. A subset restamp is handed one pile, and combat
  // calls this once per pile, so reading the count off the subset threw the
  // quota away exactly when it was most needed: the pile holding attack:3
  // failed with "unknown equipmentAttackSlotId 'attack:3'" mid-swap. The whole
  // deck is on the run in both cases and is the record of what the run was born
  // with, so both paths read the same number from the same place.
  // THE QUOTA IS READ, NOT DERIVED. Four rounds went into deriving it — from the
  // plan, then from the loadout, then from `list`, then from `run.deck` — and
  // every one of them was inert on the path that actually mattered: combat's
  // swap builds a SYNTHETIC run with `deck: []` and calls this once per pile, so
  // there was never a deck to count. state.js writes the number down at birth
  // instead (`equipmentAttackSlotCount`), combat carries it onto the synthetic
  // run like it carries the profile snapshot, and this reads it. `== null`, not
  // falsy: zero is a quota, and a run born with no attacks says so.
  //
  // The count-the-deck path survives for one caller only — a run saved before
  // the field existed, whose own deck is still the record of what it was born
  // with. A synthetic run with neither has nothing to say, and replans.
  let bornWith = Number.isFinite(run.equipmentAttackSlotCount) ? run.equipmentAttackSlotCount : undefined;
  if (bornWith === undefined && Array.isArray(run.deck) && run.deck.length) {
    bornWith = run.deck.filter((card) => card && card.equipmentRole === 'attack').length;
  }
  const attackPlan = buildEquippedWeaponCardPlan(registries, run.loadout, run.class, { attackSlotCount: bornWith });
  for (const inst of list.filter((card) => card.equipmentRole === 'attack')) {
    const prior = inst.profileId && run.equipmentProfileRuleSnapshot.profiles[inst.profileId];
    const desired = attackPlan.slots.find((slot) => slot.equipmentAttackSlotId === inst.equipmentAttackSlotId);
    const next = desired && run.equipmentProfileRuleSnapshot.profiles[desired.profileId];
    if (prior && next && prior.compatibility !== next.compatibility) {
      throw new Error(`Incompatible attack profile swap: ${inst.profileId} (${prior.compatibility}) -> ${desired.profileId} (${next.compatibility})`);
    }
  }
  applyEquippedWeaponCardPlan(attackPlan, list, { allowSubset: cards != null });
  // Only the authoritative full-deck restamp reconciles granted/weapon-art
  // instances — a pile subset must never mint or drop them. Reconciling
  // BEFORE the stamping loop (in place — list IS run.deck here) means a
  // newly composed instance is stamped like any other card below.
  if (cards == null) reconcileGrantedCards(registries, run);
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
        inst.smithingLevel = run.itemUpgradeLevels?.[`armament/${sourceArmamentId}`]
          ?? run.armamentLevels?.[sourceArmamentId]
          ?? 0;
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
 * MAY WHAT IS IN THIS SET CHANGE RIGHT NOW — the sibling question to canSwap.
 * `canSwap` asks whether the ACTIVE set may change; this asks whether a set's
 * CONTENTS may. The combat answer is data-owned by allowChangesInCombat so the
 * Armoury, mutation, and engine all read one rule.
 *
 * This is intentionally one combat-wide balance switch rather than another
 * per-slot column. Which prepared set may become active remains a property of
 * the slot (`canSwap`); whether carried gear may replace, move, or leave a
 * position is one fight rule for every position (`allowChangesInCombat`).
 *
 * The context is required and must contain a boolean. Silence never means
 * permission: malformed callers fail closed even when the shipped rule is on.
 */
/** One shared refusal sentence for model, engine, and Armoury. */
export const COMBAT_EQUIPMENT_CHANGE_DISABLED = 'Equipment changes are disabled during combat.';

export function canEquip(registries, slotId, ctx) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: `No slot '${slotId}'` };
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `canEquip('${slotId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. This line is the defect, not the refusal.`
    );
    return { ok: false, reason: COMBAT_EQUIPMENT_CHANGE_DISABLED };
  }
  const cfg = (((registries || {}).balance || {}).equipment || {});
  if (ctx.inCombat && cfg.allowChangesInCombat !== true) {
    return { ok: false, reason: COMBAT_EQUIPMENT_CHANGE_DISABLED };
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
 * WHAT THIS DOES NOT OWN: the PRICE. `balance.equipment.swapCost` is charged in
 * the combat intent, outside this function. Direct model calls remain useful for
 * previews and fixtures; player actions must route through the engine.
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
 * holding. During combat, moving an item from storage into a position must route
 * through the priced `changeEquipment` engine intent.
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
 * Clearing a slot needs no ownership, but it still asks the combat-change rule.
 * The permission is checked before the `!itemId` return so disabling combat
 * equipment changes also disables combat unequip.
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
  const permission = canEquip(registries, slotId, { inCombat: ctx.inCombat });
  if (!permission.ok) return false;
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
  if (!equipmentRequirementReceipt(registries, piece, ctx.attributes, { itemUpgradeLevels: ctx.itemUpgradeLevels, armamentLevels: ctx.armamentLevels }).ok) return false;
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
