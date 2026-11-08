// src/model/loadout/shape.js — the shape of a loadout and the equipment-profile rule snapshot.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { ratingIds } from '../ratingFormula.js';
import { DAMAGE_SCHOOLS } from '../schemas.js';
import { EQUIPMENT_ROLES } from './hands.js';

const EQUIPMENT_PROFILE_SNAPSHOT_VERSION = 2;
const EQUIPMENT_PROFILE_PATCH_FIELDS = Object.freeze(['baseValue', 'ratingId', 'cap']);
const EQUIPMENT_PROFILE_CARRIER_FIELDS = Object.freeze(['damageSchool', 'exposureBuildupPerHit', 'magicShare']);


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
    || (eq.armour || []).find((o) => o.classId === classId && o.unlock === '' && !o.sharedSet);
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

export function profileById(registries, id) {
  return ((registries.equipment || {}).basicCardProfiles || []).find((p) => p.id === id) || null;
}

function profileRule(profile) {
  return {
    ...Object.fromEntries(EQUIPMENT_PROFILE_PATCH_FIELDS.map((key) => [key, profile[key] === '' ? null : profile[key]])),
    ...Object.fromEntries(EQUIPMENT_PROFILE_CARRIER_FIELDS.map((key) => [key, profile[key] === '' ? null : profile[key]])),
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
  if (![1, EQUIPMENT_PROFILE_SNAPSHOT_VERSION].includes(snapshot.snapshotVersion)) throw new Error(`unknown equipment profile snapshotVersion ${snapshot.snapshotVersion}`);
  if (!snapshot.profiles || typeof snapshot.profiles !== 'object' || Array.isArray(snapshot.profiles)) throw new Error('equipment profile snapshot profiles must be an object map');
  snapshot = structuredClone(snapshot);
  if (snapshot.snapshotVersion === 1) {
    const profiles = Object.fromEntries((registries.equipment.basicCardProfiles || []).map((profile) => {
      const live = profileRule(profile);
      const saved = snapshot.profiles[profile.id] || {};
      const preserved = Object.fromEntries(
        [...EQUIPMENT_PROFILE_PATCH_FIELDS, ...EQUIPMENT_PROFILE_CARRIER_FIELDS, 'compatibility']
          .filter((key) => saved[key] !== undefined && key !== 'ratingId')
          .map((key) => [key, saved[key]]),
      );
      return [profile.id, { ...live, ...preserved }];
    }));
    snapshot = { snapshotVersion: EQUIPMENT_PROFILE_SNAPSHOT_VERSION, profiles, rarityBonuses: snapshot.rarityBonuses };
  }
  const liveIds = new Set((registries.equipment.basicCardProfiles || []).map((profile) => profile.id));
  for (const id of Object.keys(snapshot.profiles)) if (!liveIds.has(id)) throw new Error(`equipment profile snapshot has unknown '${id}'`);
  for (const profile of registries.equipment.basicCardProfiles || []) {
    const rule = snapshot.profiles[profile.id];
    if (!rule) throw new Error(`equipment profile snapshot missing '${profile.id}'`);
    if (!Number.isFinite(rule.baseValue)) throw new Error(`${profile.id}.baseValue must be finite`);
    if (!ratingIds.includes(rule.ratingId)) throw new Error(`${profile.id}.ratingId '${rule.ratingId}' is unknown`);
    if (rule.cap != null && (!Number.isFinite(rule.cap) || rule.cap < 0)) throw new Error(`${profile.id}.cap must be null or finite non-negative`);
    if (rule.compatibility !== `${profile.role}-v1`) throw new Error(`${profile.id}.compatibility '${rule.compatibility}' does not match ${profile.role}-v1`);
    // Version-1 snapshots predate combat carriers. They adopt the live row
    // exactly once during migration; every subsequent save owns the values.
    if (rule.damageSchool === undefined) rule.damageSchool = profile.damageSchool;
    if (rule.exposureBuildupPerHit === undefined) rule.exposureBuildupPerHit = profile.exposureBuildupPerHit;
    // A blank magic share is the card's damage type default (null). Older snapshots adopt the live row once.
    if (rule.magicShare === undefined) rule.magicShare = profile.magicShare === '' ? null : profile.magicShare;
    if (rule.magicShare !== null && !(Number.isFinite(rule.magicShare) && rule.magicShare >= 0 && rule.magicShare <= 1)) throw new Error(`${profile.id}.magicShare must be null or 0..1`);
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
