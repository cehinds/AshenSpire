// src/model/loadout/requirements.js — attribute requirements and card/equipment compatibility.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { cumulativeRequirementDelta } from '../itemUpgrades.js';

/** Resolve explicit item attribute minima. Missing attributes fail closed. */
export function equipmentRequirementReceipt(registries, piece, attributes = {}, { itemUpgradeLevels = {}, armamentLevels = {} } = {}) {
  if (!piece || typeof piece !== 'object') throw new Error('equipment requirement receipt needs a piece');
  const authored = (piece.requirements && piece.requirements.attributes) || {};
  const requirements = [];
  const failures = [];
  // EACH HALF OF THE WARDROBE UNDER ITS OWN REF. Upgrade levels are keyed
  // `armament/<id>` for weapons and `armor/<classId>/<id>` for outfits
  // (itemUpgradeChanges.csv, loadout's own equippedPieces), and this read
  // used the weapon form for both, so an outfit sharing an id with a weapon
  // read THAT weapon's smithing level. No armour tier can lower a minimum
  // today — itemUpgradeTagMatchesKind admits only equipmentPoise deltas for
  // armour — so the armour ref finds no requirement rows; it is the right
  // key for the day that vocabulary is widened, not a live reduction
  // (review, #1217 and #1255).
  const itemRef = piece.kind === 'armor' ? `armor/${piece.classId}/${piece.id}` : `armament/${piece.id}`;
  const namespaced = itemUpgradeLevels?.[itemRef];
  const level = Number.isInteger(namespaced) ? namespaced
    : piece.kind !== 'armor' && Number.isInteger(armamentLevels?.[piece.id]) ? armamentLevels[piece.id] : 0;
  for (const [attributeId, required] of Object.entries(authored)) {
    if (!registries.attributes.has(attributeId)) throw new Error(`${piece.id}: unknown requirement attribute '${attributeId}'`);
    if (!Number.isInteger(required) || required < 0) throw new Error(`${piece.id}.${attributeId}: requirement minimum must be a non-negative integer`);
    const delta = cumulativeRequirementDelta(registries, itemRef, attributeId, level);
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
  // Source/damage categories describe execution, not permission to inherit a
  // different class's card. Preserve the existing card-school compatibility.
  const schoolTags = new Set((registries.tags || []).filter((tag) => tag.domain === 'card').map((tag) => tag.id));
  const sharedTags = cardTags.filter((tag) => schoolTags.has(tag) && (piece.tags || []).includes(tag));
  if (sharedTags.length) return { ok: true, reason: 'tag', sharedTags, cardId, pieceId };
  return { ok: false, reason: 'noMatch', sharedTags: [], cardId, pieceId };
}
