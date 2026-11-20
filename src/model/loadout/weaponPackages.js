// src/model/loadout/weaponPackages.js — weapon card packages.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { slotHand } from './hands.js';
import { profileById } from './shape.js';
import { equippedIn } from './equipped.js';

const WEAPON_CARD_PACKAGE_COMPATIBILITY = 'attack-v1';

export function attackProfileFor(registries, profileId, owner) {
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

/** Equipment-derived identity; permanent removal eligibility lives in cardRemoval.js. */
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
    // Learnable arts (owner 2026-11-05): cards the weapon's family can teach. Never granted by wearing the
    // weapon; rewards, shops and the Blacksmith offer them while the weapon is carried. Distinct from the defaults.
    const learnableRaw = source.learnableArts == null ? [] : source.learnableArts;
    if (!Array.isArray(learnableRaw)) throw new Error(`${piece.id}: learnableArts must be an array`);
    const learnableSeen = new Set();
    const learnableArts = learnableRaw.map((artId, index) => {
      if (typeof artId !== 'string' || !artId) throw new Error(`${piece.id}: learnableArts[${index}] must name a card id`);
      if (!registries.cards.has(artId)) throw new Error(`${piece.id}: learnable art '${artId}' is unknown`);
      if (learnableSeen.has(artId)) throw new Error(`${piece.id}: duplicate learnable art '${artId}'`);
      if (artSeen.has(artId)) throw new Error(`${piece.id}: learnable art '${artId}' is already a default art`);
      learnableSeen.add(artId);
      return artId;
    });
    let combatKit = null;
    if (source.combatKit != null) {
      const kit = source.combatKit;
      if (!kit || typeof kit !== 'object' || Array.isArray(kit)) throw new Error(`${piece.id}: combatKit must be an object`);
      for (const role of ['attack', 'guard']) {
        const profile = profileById(registries, kit[`${role}ProfileId`]);
        if (!profile || profile.role !== role) throw new Error(`${piece.id}: combatKit.${role}ProfileId must name a ${role} profile`);
      }
      if (!weaponArtDefaults.includes(kit.artCardId)) throw new Error(`${piece.id}: combatKit.artCardId must be an authored weapon art`);
      combatKit = Object.freeze({ attackProfileId: kit.attackProfileId, guardProfileId: kit.guardProfileId, artCardId: kit.artCardId });
    }
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
      learnableArts: Object.freeze(learnableArts),
      combatKit,
      fillerAttackProfileId: filler.id,
      compatibility: WEAPON_CARD_PACKAGE_COMPATIBILITY,
    });
  },
});

export function handSource(registries, loadout, classId, hand) {
  const slot = ((registries.equipment || {}).slots || []).find((row) => slotHand(row) === hand);
  if (!slot) throw new Error(`No equipment slot declares hand '${hand}'`);
  const piece = equippedIn(registries, loadout, classId, slot.id);
  return { hand, slotId: slot.id, piece, package: WeaponCardPackageModel.fromPiece(registries, piece) };
}

export function quotaRefs(registries, source, count) {
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
