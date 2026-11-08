// src/model/validate/equipment.js — equipment tables, eligibility, starting kits and character creation.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { cardManaPolicy } from '../../content/generated/cardManaPolicy.js';
import { SCHEMAS, DAMAGE_SCHOOLS } from '../schemas.js';
import { wornZoneOf, handZoneOf } from '../zones.js';
import { startingKitProblems } from '../startingKits.js';
import { armouryUiProblems } from '../equipmentUi.js';
import { characterCreationProblems } from '../characterCreation.js';
import {
  itemRefIdentity,
  itemUpgradeTagMatchesKind,
  parseItemUpgradeTag,
  UPGRADE_COST_TAG,
} from '../itemUpgrades.js';
import { walkSchema } from './schemaWalk.js';

export function equipmentProblems(b, err, ctx) {
  const { ids, vctx, equipment } = ctx;
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) {
    err('equipment', 'must be an object containing basicCardProfiles');
  } else if (!Array.isArray(equipment.basicCardProfiles)) {
    err('equipment.basicCardProfiles', 'Missing required basicCardProfiles array');
  } else {
    for (const problem of armouryUiProblems(equipment.armouryUi)) {
      err(problem.path, problem.message);
    }
    // Player Poise is authored on every equipment row even though it has no
    // combat consumer yet. Missing data must not silently normalize to zero:
    // the receipt is truthful only when every worn source says its number.
    for (const [table, rows] of [['armaments', equipment.armaments], ['armour', equipment.armour]]) {
      if (!Array.isArray(rows)) {
        err(`equipment.${table}`, 'must be an array');
        continue;
      }
      for (const row of rows) {
        const id = row && row.id || '?';
        const value = row && row.poiseThreshold;
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          err(`equipment.${table}.${id}.poiseThreshold`, `must be a finite non-negative integer, got ${JSON.stringify(value)}`);
        }
      }
    }

    // Intrinsic armament facts are an authored presentation contract, not a
    // second route into generated-card or combat arithmetic. Missing values
    // fail here rather than being displayed as plausible zeroes.
    // The armament slice of the tag junction, folded once for the rules below.
    const armamentTags = new Map();
    for (const row of Array.isArray(b.tagging) ? b.tagging : []) {
      if (!row || row.family !== 'armament') continue;
      const list = armamentTags.get(row.objectId);
      if (list) list.push(row.tagId);
      else armamentTags.set(row.objectId, [row.tagId]);
    }
    const armamentTagIds = (id) => armamentTags.get(id) || [];

    const intrinsicFields = ['attackRating', 'defenseRating', 'weight', 'weaponArtManaCost', 'uniqueSkillStaminaCost'];
    for (const row of Array.isArray(equipment.armaments) ? equipment.armaments : []) {
      const id = row && row.id || '?';
      for (const field of intrinsicFields) {
        const value = row && row[field];
        if (!Number.isInteger(value) || value < 0) {
          err(`equipment.armaments.${id}.${field}`, `must be an explicit non-negative integer, got ${JSON.stringify(value)}`);
        }
      }
      // Every armament has one physical damage type: its Block-facing part of a hit (magic share < 1).
      if (!['blunt', 'slashing', 'piercing'].includes(row?.physicalDamageType)) {
        err(`equipment.armaments.${id}.physicalDamageType`, `must be blunt, slashing or piercing, got ${JSON.stringify(row?.physicalDamageType)}`);
      }
      if (Number.isInteger(row?.weight) && row.weight !== row.poiseThreshold) {
        err(`equipment.armaments.${id}.weight`, `must equal authored poiseThreshold ${JSON.stringify(row.poiseThreshold)}`);
      }
      // Item-type tags are tagging.csv rows now, so the boot door reads them
      // from the junction: this pass sees the bundle, which is BEFORE
      // model/registries.js stamps `itemTypeTags` onto the piece.
      const isStaffTechnique = armamentTagIds(id).includes('item:magic-focus')
        && row?.techniqueProfile === 'staffTechnique';
      const hasWeaponArts = (row?.weaponCardPackage?.weaponArtDefaults || []).length > 0;
      const minimumManaCost = hasWeaponArts || isStaffTechnique ? cardManaPolicy.minimumMana : 0;
      if (row?.weaponArtManaCost < minimumManaCost) {
        err(`equipment.armaments.${id}.weaponArtManaCost`, `must be at least ${minimumManaCost} for its authored weapon arts`);
      }
      if (row?.uniqueSkillStaminaCost !== 0) {
        err(`equipment.armaments.${id}.uniqueSkillStaminaCost`, 'must remain 0 until an explicit unique-skill consumer exists');
      }
    }

    const seenProfiles = new Set();
    for (const profile of equipment.basicCardProfiles) {
      const id = profile && profile.id || '?';
      walkSchema(profile, SCHEMAS.basicCardProfile, `equipment.basicCardProfiles.${id}`, vctx);
      if (seenProfiles.has(id)) err(`equipment.basicCardProfiles.${id}`, `Duplicate profile id '${id}'`);
      seenProfiles.add(id);
      if (profile && Number.isFinite(profile.baseValue) && profile.baseValue < 0) err(`equipment.basicCardProfiles.${id}.baseValue`, 'must be non-negative');
      if (profile && Number.isFinite(profile.cap) && profile.cap < 0) err(`equipment.basicCardProfiles.${id}.cap`, 'must be non-negative');
      if (!Number.isInteger(profile && profile.exposureBuildupPerHit) || profile.exposureBuildupPerHit < 0) err(`equipment.basicCardProfiles.${id}.exposureBuildupPerHit`, 'must be a non-negative integer');
      if (profile && profile.cap !== '' && profile.cap != null && !Number.isFinite(profile.cap)) err(`equipment.basicCardProfiles.${id}.cap`, 'must be blank or finite');
      if (profile && profile.compatibility !== `${profile.role}-v1`) err(`equipment.basicCardProfiles.${id}.compatibility`, `must match role '${profile.role}-v1'`);
      // A profile's tags are tagging.csv rows now, checked with every other
      // carrier's by tagContentProblems above — one rule, one message, for all.
    }

    // Validate the raw authored carrier rows before their map is joined onto
    // cards. This keeps duplicate/missing rows visible at the production boot
    // door rather than allowing Map normalization to hide them.
    if (!Array.isArray(equipment.cardExposure)) {
      err('equipment.cardExposure', 'Missing required generated cardExposure array');
    } else {
      const seen = new Set();
      for (const row of equipment.cardExposure) {
        const cardId = row && row.cardId;
        const path = `equipment.cardExposure.${cardId || '?'}`;
        for (const key of Object.keys(row || {})) if (!['cardId', 'damageSchool', 'exposureBuildupPerHit'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        if (typeof cardId !== 'string' || !ids.cards.has(cardId)) err(`${path}.cardId`, `unknown card '${cardId}'`);
        if (!DAMAGE_SCHOOLS.includes(row && row.damageSchool)) err(`${path}.damageSchool`, `unknown damage school '${row && row.damageSchool}'`);
        if (!Number.isInteger(row && row.exposureBuildupPerHit) || row.exposureBuildupPerHit < 0) err(`${path}.exposureBuildupPerHit`, 'must be a non-negative integer');
        if (seen.has(cardId)) err(path, `Duplicate card exposure row '${cardId}'`);
        seen.add(cardId);
      }
      const damages = (Array.isArray(b.cards) ? b.cards : []).filter((card) => [...(card.effects || []), ...((card.upgrade && card.upgrade.effects) || [])].some((effect) => effect && effect.op === 'damage'));
      for (const card of damages) {
        const path = `cards.${card.id}`;
        const row = equipment.cardExposure.find((candidate) => candidate.cardId === card.id);
        // The CSV remains the pre-expansion carrier for existing saved cards.
        // Graded faces own their school/buildup explicitly in profile traits.
        const gradeCarrier = card.gradeProfiles?.find(profile => profile.rank === card.abilityRank)?.traits;
        const carrier = gradeCarrier?.damageSchool ? gradeCarrier : row;
        if (!row) err(`${path}.exposureBuildupPerHit`, 'Missing required explicit damage carrier row');
        if (typeof card.damageSchool !== 'string') err(`${path}.damageSchool`, 'Missing required explicit damage school');
        if (!Number.isInteger(card.exposureBuildupPerHit) || card.exposureBuildupPerHit < 0) err(`${path}.exposureBuildupPerHit`, 'Missing required non-negative per-hit buildup');
        if (carrier && (card.damageSchool !== carrier.damageSchool || card.exposureBuildupPerHit !== carrier.exposureBuildupPerHit)) err(path, 'Resolved card carrier disagrees with authored row or grade traits');
        // A Mana spell works toward a break faster than an action-only one
        // (plan phase 8): its row carries at least balance.exposure.buildupPerManaSpell.
        const floor = b.balance && b.balance.exposure && b.balance.exposure.buildupPerManaSpell;
        const schoolMult = ((b.balance || {}).arcaneExposure || {}).schoolBuildupMultipliers || {};
        // EITHER FACE COSTING MANA BINDS THE ROW. An upgrade that adds a Mana
        // line was slipping past the floor while its buildup stayed at the
        // base's (Codex, #1203); the row is one per card, so one face is enough.
        const upgradedMana = card.upgrade && Number.isInteger(card.upgrade.manaCost) ? card.upgrade.manaCost : card.manaCost;
        const costsMana = (Number.isInteger(card.manaCost) && card.manaCost > 0) || (Number.isInteger(upgradedMana) && upgradedMana > 0);
        if (carrier && Number.isInteger(floor) && costsMana && (schoolMult[carrier.damageSchool] || 0) > 0 && carrier.exposureBuildupPerHit < floor) {
          err(`equipment.cardExposure.${card.id}.exposureBuildupPerHit`, `'${card.name || card.id}' costs Mana and builds Arcane Exposure, so it builds at least ${floor} per hit (balance.exposure.buildupPerManaSpell); it builds ${carrier.exposureBuildupPerHit}`);
        }
        for (const profile of card.gradeProfiles || []) {
          const traits = profile.traits;
          const profilePath = `${path}.gradeProfiles.${profile.rank}.traits`;
          if (!traits || !DAMAGE_SCHOOLS.includes(traits.damageSchool) || !Number.isInteger(traits.exposureBuildupPerHit) || traits.exposureBuildupPerHit < 0) err(profilePath, 'Damage grade requires an explicit valid school and non-negative per-hit buildup');
          else if (profile.manaCost > 0 && (schoolMult[traits.damageSchool] || 0) > 0 && Number.isInteger(floor) && traits.exposureBuildupPerHit < floor) err(profilePath, `Mana-costing damage grade must build at least ${floor} Exposure per hit`);
        }
      }
    }
  }

  // Equipment eligibility tables are boot-critical raw authoring. Validate
  // them before the equipment normalizer can join rows into pieces and thereby
  // hide a duplicate item/stat pair. This is the same validateContent door the
  // production boot uses, not a tool-only validator.
  if (equipment && typeof equipment === 'object' && !Array.isArray(equipment)) {
    const pieces = [...(Array.isArray(equipment.armaments) ? equipment.armaments : []), ...(Array.isArray(equipment.armour) ? equipment.armour : [])];
    const pieceIds = new Set(pieces.map((row) => row && row.id).filter(Boolean));
    const armamentIds = new Set((Array.isArray(equipment.armaments) ? equipment.armaments : []).map((row) => row && row.id).filter(Boolean));
    if (!Array.isArray(equipment.equipmentRequirements)) {
      err('equipment.equipmentRequirements', 'Missing required generated equipmentRequirements array');
    } else {
      const seen = new Set();
      for (const row of equipment.equipmentRequirements) {
        const itemId = row && row.itemId;
        const attributeId = row && row.attributeId;
        const path = `equipment.equipmentRequirements.${itemId || '?'}:${attributeId || '?'}`;
        for (const key of Object.keys(row || {})) if (!['itemId', 'attributeId', 'minimum'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        if (typeof itemId !== 'string' || !itemId) err(`${path}.itemId`, 'must be a non-empty item id');
        else if (!pieceIds.has(itemId)) err(`${path}.itemId`, `unknown item '${itemId}'`);
        if (typeof attributeId !== 'string' || !attributeId) err(`${path}.attributeId`, 'must be a non-empty attribute id');
        else if (!ids.attributes.has(attributeId)) err(`${path}.attributeId`, `unknown attribute '${attributeId}'`);
        if (!row || !Object.prototype.hasOwnProperty.call(row, 'minimum') || !Number.isFinite(row.minimum) || !Number.isInteger(row.minimum) || row.minimum < 0) {
          err(`${path}.minimum`, 'must be a finite non-negative integer');
        }
        const key = `${itemId}:${attributeId}`;
        if (seen.has(key)) err(path, `Duplicate item/stat requirement '${key}'`);
        seen.add(key);
      }
    }
    if (!Array.isArray(equipment.itemUpgradeChanges)) {
      err('equipment.itemUpgradeChanges', 'Missing required generated itemUpgradeChanges array');
    } else {
      const itemDefinitions = new Map([
        ...(Array.isArray(equipment.armaments) ? equipment.armaments : []).filter(Boolean).map((row) => [`armament/${row.id}`, row]),
        ...(Array.isArray(equipment.armour) ? equipment.armour : []).filter(Boolean).map((row) => [`armor/${row.classId}/${row.id}`, row]),
        ...(Array.isArray(b.relics) ? b.relics : []).filter(Boolean).map((row) => [`relic/${row.id}`, row]),
      ]);
      const knownItemRefs = new Set(itemDefinitions.keys());
      const seen = new Set();
      const packages = new Map();
      for (const row of equipment.itemUpgradeChanges) {
        const itemRef = row && row.itemRef;
        const nextTier = row && row.nextTier;
        const tag = row && row.tag;
        const path = `equipment.itemUpgradeChanges.${itemRef || '?'}:tier${nextTier || '?'}:${tag || '?'}`;
        for (const key of Object.keys(row || {})) if (!['itemRef', 'nextTier', 'tag', 'value'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        const identity = itemRefIdentity(itemRef);
        if (!identity || !knownItemRefs.has(itemRef)) err(`${path}.itemRef`, `unknown namespaced item '${itemRef}'`);
        if (!Number.isInteger(nextTier) || nextTier < 1) err(`${path}.nextTier`, 'must be a positive integer');
        const descriptor = parseItemUpgradeTag(tag, [...ids.attributes]);
        if (!descriptor) err(`${path}.tag`, `unknown upgrade tag '${tag}'`);
        else if (!identity || !itemUpgradeTagMatchesKind(descriptor, identity.itemKind)) {
          err(`${path}.tag`, `upgrade tag '${tag}' is invalid for item kind '${identity?.itemKind || 'unknown'}'`);
        } else if (descriptor.kind === 'equipmentPoise') {
          const before = itemDefinitions.get(itemRef)?.poiseThreshold;
          if (!Number.isInteger(before) || before + row.value < 0) {
            err(`${path}.value`, `must keep authored poiseThreshold non-negative (base ${JSON.stringify(before)})`);
          }
        } else if (descriptor.kind === 'relicPassive') {
          const before = itemDefinitions.get(itemRef)?.passives?.[descriptor.passiveKey];
          if (!Number.isInteger(before) || before + row.value < 0) {
            err(`${path}.value`, `must target an existing non-negative integer passive '${descriptor.passiveKey}' (base ${JSON.stringify(before)})`);
          }
        }
        if (!Number.isInteger(row && row.value) || row.value === 0) err(`${path}.value`, 'must be a non-zero integer');
        if (tag === UPGRADE_COST_TAG && (!Number.isInteger(row.value) || row.value < 1)) err(`${path}.value`, 'Smithing Stone cost must be a positive integer');
        const exact = `${itemRef}|${nextTier}|${tag}`;
        if (seen.has(exact)) err(path, `Duplicate item/tier/tag row '${exact}'`);
        seen.add(exact);
        const packageKey = `${itemRef}|${nextTier}`;
        if (!packages.has(packageKey)) packages.set(packageKey, []);
        packages.get(packageKey).push(row);
      }
      const tiersByItem = new Map();
      for (const [packageKey, rows] of packages) {
        const split = packageKey.lastIndexOf('|');
        const itemRef = packageKey.slice(0, split);
        const nextTier = Number(packageKey.slice(split + 1));
        const costs = rows.filter((row) => row.tag === UPGRADE_COST_TAG);
        if (costs.length !== 1) err(`equipment.itemUpgradeChanges.${itemRef}:tier${nextTier}`, `must have exactly one ${UPGRADE_COST_TAG} row`);
        if (rows.length === costs.length) err(`equipment.itemUpgradeChanges.${itemRef}:tier${nextTier}`, 'must have at least one gameplay change row');
        const effective = rows.filter((row) => {
          const descriptor = parseItemUpgradeTag(row.tag, [...ids.attributes]);
          return descriptor && descriptor.kind !== 'upgradeCost' && itemUpgradeTagMatchesKind(descriptor, itemRefIdentity(itemRef)?.itemKind);
        });
        if (!effective.length) err(`equipment.itemUpgradeChanges.${itemRef}:tier${nextTier}`, 'must have at least one kind-compatible non-cost change');
        if (!tiersByItem.has(itemRef)) tiersByItem.set(itemRef, []);
        tiersByItem.get(itemRef).push(nextTier);
      }
      for (const [itemRef, tiers] of tiersByItem) {
        const ordered = [...new Set(tiers)].sort((a, b) => a - b);
        ordered.forEach((tier, index) => {
          if (tier !== index + 1) err(`equipment.itemUpgradeChanges.${itemRef}`, `tiers must be contiguous from 1; found ${ordered.join(', ')}`);
        });
      }
    }
    if (!Array.isArray(equipment.cardEquipmentExceptions)) {
      err('equipment.cardEquipmentExceptions', 'Missing required generated cardEquipmentExceptions array');
    } else {
      const seen = new Set();
      for (const row of equipment.cardEquipmentExceptions) {
        const cardId = row && row.cardId;
        const weaponId = row && row.weaponId;
        const path = `equipment.cardEquipmentExceptions.${cardId || '?'}:${weaponId || '?'}`;
        for (const key of Object.keys(row || {})) if (!['cardId', 'weaponId'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        if (typeof cardId !== 'string' || !ids.cards.has(cardId)) err(`${path}.cardId`, `unknown card '${cardId}'`);
        if (typeof weaponId !== 'string' || !armamentIds.has(weaponId)) err(`${path}.weaponId`, `unknown weapon '${weaponId}'`);
        const key = `${cardId}:${weaponId}`;
        if (seen.has(key)) err(path, `Duplicate exact card/weapon pair '${key}'`);
        seen.add(key);
      }
    }
    // EVERY SLOT ROW IS A ZONE THE RUN CAN CARRY (plan phase 3b). zones.js is
    // the one home of "which slot fills which zone"; a row here that it does
    // not name would take a piece the player equipped and give it nowhere to
    // ride in the save's `zones`, so it is refused by name at boot rather than
    // discovered as a null in a projection.
    for (const slot of Array.isArray(equipment.slots) ? equipment.slots : []) {
      if (!slot || typeof slot.id !== 'string') continue;
      const held = typeof slot.hand === 'string' && slot.hand !== '';
      if (held && !handZoneOf(slot.id)) err(`equipment.slots.${slot.id}`, `is a hand slot that no hands zone names (model/zones.js HAND_SLOT_IDS) — the run could not carry what is put in it`);
      if (!held && !wornZoneOf(slot.id)) err(`equipment.slots.${slot.id}`, `is a worn slot that no worn zone names (model/zones.js WORN_SLOT_IDS) — the run could not carry what is put in it`);
    }
    if (!Array.isArray(equipment.cardTagging)) err('equipment.cardTagging', 'Missing required registered cardTagging array');
  }

  // Starting kits are a nested generated table whose validity spans classes,
  // hand slots, armament discovery weights, and the no-spoiler policy.
  try {
    const kitRegistries = {
      classes: { ids: () => [...ids.classes], has: (id) => ids.classes.has(id), get: (id) => (b.classes || []).find((row) => row.id === id) },
      equipment: b.equipment || {},
      balance: b.balance || {},
    };
    for (const problem of startingKitProblems(kitRegistries)) err('equipment.startingKits', problem);
  } catch (error) {
    err('equipment.startingKits', error && error.message ? error.message : 'starting-kit validation failed');
  }

  const dependencySafeBundle = {
    ...b,
    equipment: {
      ...(equipment && typeof equipment === 'object' && !Array.isArray(equipment) ? equipment : {}),
      armaments: Array.isArray(equipment && equipment.armaments) ? equipment.armaments : [],
      armour: Array.isArray(equipment && equipment.armour) ? equipment.armour : [],
    },
  };
  for (const problem of characterCreationProblems(dependencySafeBundle)) {
    const split = problem.indexOf(':');
    err(split >= 0 ? problem.slice(0, split) : 'characterCreation', split >= 0 ? problem.slice(split + 1).trim() : problem);
  }
  ctx.dependencySafeBundle = dependencySafeBundle;
}
