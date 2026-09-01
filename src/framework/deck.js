// src/framework/deck.js — deterministic, idempotent combat-deck composition
// (framework contract: Deck composition, Unarmed fallback).
//
// THE CONTRACT MODEL — THE SPECIFICATION, NOT THE COMPOSER. By owner ruling
// (2026-09-01, docs/framework-cutover-report.md) the framework ADOPTED the
// shipped composition as its implementation: src/framework/deckComposition.js
// is the door, re-exporting WeaponDeckCompositionService (attack slots —
// ceil/floor hand split, two-handed conflicts, unarmed attack fallback,
// deterministic fingerprints, shield/priority-ref rules) and the role plan
// (equipmentKitPlan → startingDeckRefs at creation, re-resolved by stampDeck
// on swap/load) for guard/technique replacement. The contract-NEW outputs
// this module specifies — granted cards, installed weapon arts, the unarmed
// Evasive Guard / Dodge Roll fallback package — exist in no legacy path yet
// and are the open build work on top of that adoption.
//
// Recomposition runs on equip, unequip, hand swap, character creation, load,
// continue, and save restoration — always from the run deck plus the loadout,
// never from a previous composition, which is what makes it idempotent.

import { mechanics } from './data/mechanics.js';

export class DeckError extends Error {
  constructor(message) { super(`deck: ${message}`); this.name = 'DeckError'; }
}

/**
 * A weapon card plan: which strike/guard cards replace remaining basic slots
 * and which weapon arts install. Weapon package shape (EquipmentCardPackage):
 * { strikeCardId?, guardCardId?, grantedCards: [{cardId, count}], weaponArtDefaults: [cardId] }.
 */
export function buildEquippedWeaponCardPlan(loadout, { packageFor }) {
  const weapons = validEquippedWeapons(loadout);
  if (weapons.length === 0) {
    return {
      strikes: [mechanics.unarmedPackage.strikeCardId],
      guards: [mechanics.unarmedPackage.guardCardId],
      granted: [],
      weaponArts: [mechanics.unarmedPackage.emptySlotWeaponArtId],
      source: 'unarmed',
    };
  }
  if (weapons.length === 1) {
    // A left-hand-only weapon receives the complete package exactly as it
    // would in the right hand.
    const pkg = requirePackage(packageFor, weapons[0].equipmentId);
    return planFromPackages([{ hand: weapons[0].hand, pkg }], null);
  }
  const right = weapons.find((w) => w.hand === 'right');
  const left = weapons.find((w) => w.hand === 'left');
  if (!right || !left) throw new DeckError('two weapons must occupy distinct hands');
  return planFromPackages(
    [{ hand: 'right', pkg: requirePackage(packageFor, right.equipmentId) }],
    { hand: 'left', pkg: requirePackage(packageFor, left.equipmentId) },
  );
}

function requirePackage(packageFor, equipmentId) {
  const pkg = packageFor(equipmentId);
  if (!pkg) throw new DeckError(`equipment ${equipmentId} has no card package`);
  return pkg;
}

function planFromPackages(primaryList, secondary) {
  const primary = primaryList[0].pkg;
  if (!secondary) {
    return {
      strikes: primary.strikeCardId ? [primary.strikeCardId] : [mechanics.unarmedPackage.strikeCardId],
      guards: primary.guardCardId ? [primary.guardCardId] : [mechanics.unarmedPackage.guardCardId],
      granted: [...(primary.grantedCards || [])],
      weaponArts: [...(primary.weaponArtDefaults || [])],
      source: 'single',
    };
  }
  // Two weapons: authored slots split ceil/floor with unique preference
  // RIGHT_THEN_LEFT (framework contract: splitAuthoredSlots).
  const rightPkg = primary;
  const leftPkg = secondary.pkg;
  const strikes = [rightPkg.strikeCardId, leftPkg.strikeCardId].filter(Boolean);
  const guards = [rightPkg.guardCardId, leftPkg.guardCardId].filter(Boolean);
  const arts = splitAuthoredWeaponArts(rightPkg.weaponArtDefaults || [], leftPkg.weaponArtDefaults || []);
  return {
    strikes: strikes.length ? strikes : [mechanics.unarmedPackage.strikeCardId],
    guards: guards.length ? guards : [mechanics.unarmedPackage.guardCardId],
    granted: [...(rightPkg.grantedCards || []), ...(leftPkg.grantedCards || [])],
    weaponArts: arts.map((art) => art.id),
    source: 'dual',
  };
}

/**
 * The dual-wield weapon-art split, kept in one home: ceil/floor slot quotas
 * with unique preference RIGHT_THEN_LEFT — right picks first, so a duplicate
 * art deterministically survives on the right. Returns [{id, hand}] in
 * installed order (right's picks, then left's), so callers that attribute an
 * instance to the armament that owns it get the winning hand.
 */
export function splitAuthoredWeaponArts(rightArtIds, leftArtIds) {
  const pool = [
    ...rightArtIds.map((id) => ({ id, hand: 'right' })),
    ...leftArtIds.map((id) => ({ id, hand: 'left' })),
  ];
  const totalSlots = pool.length;
  const rightQuota = Math.ceil(totalSlots / 2);
  const leftQuota = Math.floor(totalSlots / 2);
  const seen = new Set();
  const take = (hand, quota) => {
    const taken = [];
    for (const art of pool) {
      if (taken.length >= quota) break;
      if (art.hand !== hand || seen.has(art.id)) continue;
      seen.add(art.id);
      taken.push({ id: art.id, hand });
    }
    return taken;
  };
  return [...take('right', rightQuota), ...take('left', leftQuota)];
}

export function validEquippedWeapons(loadout) {
  const out = [];
  if (loadout.rightHand) out.push({ hand: 'right', equipmentId: loadout.rightHand });
  if (loadout.leftHand) out.push({ hand: 'left', equipmentId: loadout.leftHand });
  return out;
}

/**
 * composeCombatDeck(runDeck, loadout, {packageFor, isBasicStrike, isBasicGuard})
 * runDeck: [{instanceId, cardId, upgraded?}] — earned cards and permanent
 * upgrades ride through untouched; only remaining BASIC strike/guard slots are
 * replaced, cycling through the plan's replacements in slot order.
 */
export function composeCombatDeck(runDeck, loadout, helpers) {
  const { isBasicStrike, isBasicGuard } = helpers;
  const plan = buildEquippedWeaponCardPlan(loadout, helpers);
  let strikeIndex = 0;
  let guardIndex = 0;
  const cards = runDeck.map((slot) => {
    if (isBasicStrike(slot.cardId)) {
      const cardId = plan.strikes[strikeIndex % plan.strikes.length];
      strikeIndex += 1;
      return { ...slot, cardId, replacedFrom: slot.cardId };
    }
    if (isBasicGuard(slot.cardId)) {
      const cardId = plan.guards[guardIndex % plan.guards.length];
      guardIndex += 1;
      return { ...slot, cardId, replacedFrom: slot.cardId };
    }
    return { ...slot }; // unrelated earned cards and permanent upgrades preserved
  });
  for (const grant of plan.granted) {
    for (let i = 0; i < (grant.count || 1); i += 1) {
      cards.push({ instanceId: `${grant.cardId}#granted${i}`, cardId: grant.cardId, granted: true });
    }
  }
  return Object.freeze({
    cards: Object.freeze(cards),
    installedWeaponArts: Object.freeze([...plan.weaponArts]),
    plan,
  });
}
