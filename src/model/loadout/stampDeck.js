// src/model/loadout/stampDeck.js — stamping the deck.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { gameModule } from '../gameProfile.js';
import { effectiveAshenBlightAttributes } from '../ashenBlight.js';
import { stampSkillBonuses } from '../skills.js';
import { applyAbilityGrade } from '../abilityGrades.js';
import { profileById } from './shape.js';
import { roleAmountReceipt, equipmentKitReceipt } from './kit.js';
import { buildEquippedWeaponCardPlan } from './weaponPlan.js';
import { applyEquippedWeaponCardPlan } from './weaponPackages.js';
import { reconcileGrantedCards } from './grants.js';
import { cardMods, reconcileRunLoadoutHp } from './cardMods.js';

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
  // Configured cards own their explicit deck and shared rating receipt. They
  // have no legacy weapon-card slots to stamp or grants to reconcile; projecting
  // those slots would also reject the explicitly authored two-dagger Rogue kit.
  if (run.gameProfile?.foundation?.mode === 'configured' && gameModule(run, 'cards')?.mode !== 'legacy') {
    // Only the full-deck call reconciles Core's gear-granted cards (a pile subset must never mint or drop them).
    if (cards == null) reconcileGrantedCards(registries, run);
    return 0;
  }
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
  const attackPlan = buildEquippedWeaponCardPlan(registries, run.loadout, run.class, { attackSlotCount: bornWith, removedAttackSlotIds: run.removedAttackSlotIds });
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
  const effectiveAttributes = effectiveAshenBlightAttributes(run);
  const rolePlan = new Map(equipmentKitReceipt(registries, run.loadout, run.class, effectiveAttributes, run.equipmentProfileRuleSnapshot, run).map((row) => [row.role, row]));
  let n = 0;
  for (const inst of list) {
    let row = inst.equipmentRole ? rolePlan.get(inst.equipmentRole) : null;
    if (inst.equipmentRole === 'attack' || inst.kitRole) {
      const profile = profileById(registries, inst.profileId);
      const owner = inst.kitRole ? inst.grantedBy : inst.weaponId;
      const piece = owner
        ? (registries.equipment.armaments || []).find((candidate) => candidate.id === owner) || null
        : null;
      row = { role: inst.kitRole || 'attack', profile, piece };
      row.receipt = roleAmountReceipt(registries, row, effectiveAttributes, run.equipmentProfileRuleSnapshot, run);
    }
    if (row && row.profile) {
      const prior = inst.profileId && run.equipmentProfileRuleSnapshot.profiles[inst.profileId];
      const nextCompatibility = run.equipmentProfileRuleSnapshot.profiles[row.profile.id].compatibility;
      if (prior && prior.compatibility !== nextCompatibility) throw new Error(`Incompatible ${inst.equipmentRole} profile swap: ${inst.profileId} (${prior.compatibility}) -> ${row.profile.id} (${nextCompatibility})`);
      if (inst.equipmentRole !== 'attack') inst.cardId = row.profile.baseCardId;
      inst.profileId = row.profile.id;
      inst.ratingId = row.receipt.rating.id;
      inst.ratingValue = row.receipt.rating.value;
      if (Number.isFinite(row.receipt.cap)) inst.ratingCap = row.receipt.cap;
      else delete inst.ratingCap;
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
        delete inst.upgradeSteps;
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
      // The first stamp reads the resolved instance face, including a chosen
      // ability grade. Later stamps preserve the carrier already on the host
      // instance instead of adopting live content changes.
      const authored = registries.cards.get(inst.cardId);
      carrier = schoolAbsent ? applyAbilityGrade(authored, inst.abilityRank) : inst;
      // A non-attack card may name a school for its status or presentation
      // without dealing per-hit exposure. Persist its school with an explicit
      // zero carrier so new instances satisfy the same saved-pair contract.
      if (schoolAbsent && authored.type !== 'attack' && typeof carrier.damageSchool === 'string'
        && carrier.exposureBuildupPerHit === undefined) carrier = {...carrier,exposureBuildupPerHit:0};
    }
    const priorSchool = inst.damageSchool;
    const priorBuildup = inst.exposureBuildupPerHit;
    if (typeof carrier.damageSchool === 'string') inst.damageSchool = carrier.damageSchool;
    else delete inst.damageSchool;
    if (Number.isInteger(carrier.exposureBuildupPerHit)) inst.exposureBuildupPerHit = carrier.exposureBuildupPerHit;
    else delete inst.exposureBuildupPerHit;
    // The magic share is the profile's; the physical damage type is the lending weapon's (armaments.csv physicalDamageType).
    const priorShare = inst.magicShare;
    const priorPhysical = inst.physicalDamageType;
    if (Number.isFinite(carrier.magicShare)) inst.magicShare = carrier.magicShare;
    else delete inst.magicShare;
    if (row && row.piece && row.piece.physicalDamageType) inst.physicalDamageType = row.piece.physicalDamageType;
    else delete inst.physicalDamageType;
    const mods = cardMods(registries, run.loadout, run.class, {
      attackSourceWeaponId: inst.kitRole === 'attack' ? inst.grantedBy : inst.equipmentRole === 'attack' ? (inst.weaponId || null) : undefined,
    });
    const amountMod = row && row.role === 'attack' ? `damage=${row.receipt.effectBase}`
      : row && row.role === 'guard' ? `block=${row.receipt.effectBase}` : null;
    const next = [...(amountMod ? [amountMod] : []), ...((row && row.profile.mods) || []), ...(mods.get(inst.cardId) || [])];
    const prev = inst.mods || [];
    const carrierChanged = priorSchool !== inst.damageSchool || priorBuildup !== inst.exposureBuildupPerHit
      || priorShare !== inst.magicShare || priorPhysical !== inst.physicalDamageType;
    if (!carrierChanged && next.length === prev.length && next.every((v, i) => v === prev[i])) continue;
    if (next.length) inst.mods = next;
    else delete inst.mods;
    n += 1;
  }
  // A full restamp also refreshes the derived skill bonus (SPEC §13.4o): a
  // swapped hand changes which schools a track's levels reach. A fight's own
  // pile restamps (cards != null) keep the bonus its cards started with.
  if (cards == null) stampSkillBonuses(registries, run);
  return n;
}
