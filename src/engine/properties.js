// src/engine/properties.js — the one mount path for property rules
// (docs/proposal-progression-and-property-system.md §3, plan phase 1b)
//
// A property tag confers behaviour only while a CARRIER holds it: the equipped
// weapon, the worn armour — later a relic, the class card, a location. This
// file is the single door. mountProperties installs a carrier's rules into
// ctx.propertyMounts[ownerKey][sourceKey]; unmountProperties removes them; and
// the fourth scan in triggers.js plus the passive readers in model/registries.js
// are the only things that read the map.
//
// A carrier is { kind, id, instanceId, ownerKey, tagIds }:
//   kind        one of PROPERTY_CARRIER_FAMILIES (armament, armour, relic, class)
//   id          the content id (boneSceptre)
//   instanceId  what identifies THIS copy — for equipment, the namespaced item
//               ref (armament/boneSceptre), which an item keeps wherever it sits
//   ownerKey    the trigger-owner key (triggers.js triggerOwnerKey): 'player' solo
//   tagIds      the property tags the carrier holds (a piece's `propertyTags`)
//
// SOURCE KEYS ARE UNIQUE. Mounting a source that is already mounted THROWS, by
// name: a re-equip that mounted twice would fire every trigger twice, and the
// only safe answer to "mount again" is "unmount first". syncLoadoutProperties is
// the diff every equipment door uses, so it never asks twice.
//
// NOTHING HERE IS PERSISTED. Mounts are derived from the loadout at combat
// start, after every equipment change, and when a saved combat is restored —
// definitions are never saved (SPEC §3.3), so a patched rule applies to a
// loaded fight, and a snapshot written before properties existed restores with
// them mounted.
//
// Headless: no document/window/localStorage/timers.

import { PROPERTY_CARRIER_FAMILIES } from '../model/schemas.js';
import { equippedPieces, pieceItemRef } from '../model/loadout.js';
import { triggerOwnerKey } from './triggers.js';

// The carrier kinds the loadout owns. syncLoadoutProperties manages these and
// never touches another kind's mounts (a relic or class carrier, later phases).
const LOADOUT_KINDS = new Set(['armament', 'armour']);

/** The key a carrier's mount lives under, per owner. */
export function propertySourceKey(carrier) {
  return `${carrier.kind}:${carrier.instanceId || carrier.id}`;
}

function assertCarrier(carrier) {
  const c = carrier || {};
  const problems = [];
  if (!PROPERTY_CARRIER_FAMILIES.includes(c.kind)) {
    problems.push(`kind '${c.kind}' is not a property carrier (carriers: ${PROPERTY_CARRIER_FAMILIES.join(', ')})`);
  }
  if (typeof c.id !== 'string' || !c.id) problems.push('id must be a non-empty string');
  if (c.instanceId != null && (typeof c.instanceId !== 'string' || !c.instanceId)) problems.push('instanceId, when present, must be a non-empty string');
  if (typeof c.ownerKey !== 'string' || !c.ownerKey) problems.push('ownerKey must be a non-empty string');
  if (!Array.isArray(c.tagIds)) problems.push('tagIds must be an array');
  if (problems.length) throw new Error(`Property carrier refused: ${problems.join('; ')} (got ${JSON.stringify(carrier)})`);
}

/**
 * The rules a tag set confers, in tag order: each tag's one rule, kept only if
 * every tag it `requires` is on the same carrier and none it `excludes` is.
 * An unknown tag throws — validate.js has already refused it at boot.
 */
export function carrierRules(registries, tagIds) {
  const held = new Set(tagIds);
  const rules = [];
  for (const tag of tagIds) {
    const rule = registries.propertyRules.get(tag);
    if ((rule.requires || []).some((t) => !held.has(t))) continue;
    if ((rule.excludes || []).some((t) => held.has(t))) continue;
    rules.push(rule);
  }
  return rules;
}

/**
 * mountProperties(ctx, carrier) → the mount record, or null when the carrier
 * confers nothing. Throws, by name, if this source is already mounted for
 * this owner.
 */
export function mountProperties(ctx, carrier) {
  assertCarrier(carrier);
  const rules = carrierRules(ctx.registries, carrier.tagIds);
  if (!rules.length) return null;
  const sourceKey = propertySourceKey(carrier);
  const mounts = ctx.propertyMounts || (ctx.propertyMounts = {});
  const owned = mounts[carrier.ownerKey] || (mounts[carrier.ownerKey] = {});
  if (owned[sourceKey]) {
    throw new Error(`Property source '${sourceKey}' is already mounted for '${carrier.ownerKey}' — a carrier mounts once; unmount it before mounting it again`);
  }
  owned[sourceKey] = { kind: carrier.kind, id: carrier.id, instanceId: carrier.instanceId || carrier.id, rules };
  return owned[sourceKey];
}

/** unmountProperties(ctx, carrier) → true if a mount was removed. */
export function unmountProperties(ctx, carrier) {
  const owned = ctx.propertyMounts && ctx.propertyMounts[carrier.ownerKey];
  const sourceKey = propertySourceKey(carrier);
  if (!owned || !owned[sourceKey]) return false;
  delete owned[sourceKey];
  if (!Object.keys(owned).length) delete ctx.propertyMounts[carrier.ownerKey];
  return true;
}

/** One owner's mount map, for the passive readers — null when nothing is mounted. */
export function propertyMountsOf(ctx, entity) {
  if (!entity || !ctx || !ctx.propertyMounts) return null;
  return ctx.propertyMounts[triggerOwnerKey(ctx, entity)] || null;
}

/** The carriers a loadout presents: every worn piece that holds a property tag. */
export function loadoutCarriers(registries, loadout, classId, ownerKey, itemUpgradeLevels = {}) {
  return equippedPieces(registries, loadout, classId, { itemUpgradeLevels })
    .filter((piece) => Array.isArray(piece.propertyTags) && piece.propertyTags.length)
    .map((piece) => ({
      kind: piece.kind === 'armor' ? 'armour' : 'armament',
      id: piece.id,
      instanceId: pieceItemRef(piece),
      ownerKey,
      tagIds: [...piece.propertyTags],
    }));
}

/**
 * syncLoadoutProperties(combat) — make the player's equipment mounts equal the
 * loadout: unmount what is no longer worn, mount what newly is, leave the rest
 * (and its once/limitPerTurn gates, which triggerState keys by source) alone.
 * Called at createCombat, after both equipment doors (swapArmament and
 * changeEquipment) and when a combat snapshot is restored.
 */
export function syncLoadoutProperties(combat) {
  if (!combat || !combat.player) return;
  const ownerKey = triggerOwnerKey(combat, combat.player);
  const wanted = combat.loadout
    ? loadoutCarriers(combat.registries, combat.loadout, combat.player.classId, ownerKey, combat.itemUpgradeLevels || {})
    : [];
  const wantedKeys = new Set(wanted.map(propertySourceKey));
  const current = (combat.propertyMounts && combat.propertyMounts[ownerKey]) || {};
  for (const [sourceKey, mount] of Object.entries(current)) {
    if (LOADOUT_KINDS.has(mount.kind) && !wantedKeys.has(sourceKey)) {
      unmountProperties(combat, { ...mount, ownerKey, tagIds: [] });
    }
  }
  for (const carrier of wanted) {
    const owned = combat.propertyMounts && combat.propertyMounts[ownerKey];
    if (!owned || !owned[propertySourceKey(carrier)]) mountProperties(combat, carrier);
  }
}
