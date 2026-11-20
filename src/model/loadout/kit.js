// src/model/loadout/kit.js — the equipment kit plan and receipt.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { effectiveEquipmentRating } from '../ratingFormula.js';
import { ratingsConfigFor, ratingStatRows } from '../statRows.js';
import { EQUIPMENT_ROLES } from './hands.js';
import { profileById, restoreEquipmentProfileRuleSnapshot } from './shape.js';
import { equippedIn } from './equipped.js';

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

export function roleAmountReceipt(registries, row, attributes, equipmentProfileRuleSnapshot, run = null) {
  const profile = row.profile;
  const rule = equipmentProfileRuleSnapshot && equipmentProfileRuleSnapshot.profiles && equipmentProfileRuleSnapshot.profiles[profile.id];
  if (!rule) throw new Error(`equipment profile snapshot missing '${profile.id}'`);
  const rarity = row.piece && row.piece.rarity;
  const rarityBonus = (((equipmentProfileRuleSnapshot.rarityBonuses || {})[rarity] || {})[row.role]) || 0;
  // THE RUN'S OWN RATING ROWS (ruleset 7, model/statRows.js): a card's rating
  // is priced by the rows the run was born with, or the live table for a
  // preview with no run behind it.
  const ratingConfig = ratingsConfigFor(registries, run) || { ratings: ratingStatRows(registries, run) };
  const rating = effectiveEquipmentRating(ratingConfig, attributes, row.piece, rule, rule.ratingId, run?.level?.level);
  rating.sourceLabel = row.piece ? (row.piece.kind === 'shield' ? 'shield' : 'weapon') : 'attribute';
  const uncappedEffectBase = rule.baseValue + rarityBonus;
  const effectBase = Number.isFinite(rule.cap) ? Math.min(rule.cap, uncappedEffectBase) : uncappedEffectBase;
  const raw = uncappedEffectBase + rating.value;
  const value = Number.isFinite(rule.cap) ? Math.min(rule.cap, raw) : raw;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${profile.id}: resolved equipment profile value must be finite and non-negative (got ${value})`);
  return {
    role: row.role,
    profileId: profile.id,
    pieceId: row.piece && row.piece.id,
    base: rule.baseValue,
    rarity,
    rarityBonus,
    rating,
    effectBase,
    raw,
    cap: rule.cap,
    value,
  };
}

/** Calculation receipts for card base + source-equipment rating + rarity. */
export function equipmentKitReceipt(registries, loadout, classId, attributes, equipmentProfileRuleSnapshot, run = null) {
  const snapshot = restoreEquipmentProfileRuleSnapshot(equipmentProfileRuleSnapshot, registries);
  return equipmentKitPlan(registries, loadout, classId).map((row) => ({ ...row, receipt: roleAmountReceipt(registries, row, attributes, snapshot, run) }));
}
