// src/model/loadout/weaponPlan.js — the equipped weapon card plan and the weapon deck composition service.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { gameModule } from '../gameProfile.js';
import { retiredAttackSlots } from '../cardRemoval.js';
import {
  attackProfileFor, handSource, quotaRefs, applyEquippedWeaponCardPlan,
} from './weaponPackages.js';
import { startingDeckConfig } from './grantSources.js';
import { startingDeckPlan } from './deckPlan.js';

/** Pure deterministic projection from active hand equipment to authored slots. */
export function buildEquippedWeaponCardPlan(registries, loadout, classId, { attackSlotCount = undefined, removedAttackSlotIds = [] } = {}) {
  if (registries.gameProfile?.foundation?.mode === 'configured' && gameModule(registries, 'cards')?.mode !== 'legacy') {
    return Object.freeze({ attackSlotCount: 0, fingerprint: 'configured-deck', slots: Object.freeze([]) });
  }
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
  const retired = retiredAttackSlots(count, removedAttackSlotIds);
  const slots = refs.map((ref, index) => ({ equipmentAttackSlotId: `attack:${index}`, ...ref }))
    .filter(slot => !retired.has(slot.equipmentAttackSlotId));
  const fingerprint = slots.map((slot) => [slot.equipmentAttackSlotId, slot.sourceHand || '-', slot.weaponId || '-', slot.cardId, slot.profileId].join(':')).join('|');
  return Object.freeze({ attackSlotCount: slots.length, fingerprint, slots: Object.freeze(slots.map(Object.freeze)) });
}

export const WeaponDeckCompositionService = Object.freeze({
  buildEquippedWeaponCardPlan,
  applyEquippedWeaponCardPlan,
});
