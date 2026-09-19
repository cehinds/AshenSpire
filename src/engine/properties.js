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
//   kind        one of MOUNTABLE_KINDS below — the holders this path has a hold
//               window for. An engine vocabulary, not a content gate: every
//               family may carry property tags (schemas.js says why the gate
//               went), and this names which holders the MOUNT knows how to hold.
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

import { carrierRules } from '../model/registries.js';
import { equippedPieces, pieceItemRef } from '../model/loadout.js';
import { triggerOwnerKey } from './triggers.js';

// The carrier kinds the loadout owns. syncLoadoutProperties manages these and
// never touches another kind's mounts (a relic or class carrier, later phases).
const LOADOUT_KINDS = new Set(['armament', 'armour']);

// The holders this path can mount, and why the list is short: a mount needs a
// WINDOW — the span over which the holder is held — and these four are the
// holders whose window the engine knows (worn, worn, owned, chosen). A kind
// gains a mount by gaining a window here, never by a content row.
const MOUNTABLE_KINDS = Object.freeze(['armament', 'armour', 'relic', 'class']);

/** The key a carrier's mount lives under, per owner. */
export function propertySourceKey(carrier) {
  return `${carrier.kind}:${carrier.instanceId || carrier.id}`;
}

function assertCarrier(carrier) {
  const c = carrier || {};
  const problems = [];
  if (!MOUNTABLE_KINDS.includes(c.kind)) {
    problems.push(`kind '${c.kind}' has no mount window (mountable: ${MOUNTABLE_KINDS.join(', ')})`);
  }
  if (typeof c.id !== 'string' || !c.id) problems.push('id must be a non-empty string');
  if (c.instanceId != null && (typeof c.instanceId !== 'string' || !c.instanceId)) problems.push('instanceId, when present, must be a non-empty string');
  if (typeof c.ownerKey !== 'string' || !c.ownerKey) problems.push('ownerKey must be a non-empty string');
  if (!Array.isArray(c.tagIds)) problems.push('tagIds must be an array');
  if (problems.length) throw new Error(`Property carrier refused: ${problems.join('; ')} (got ${JSON.stringify(carrier)})`);
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
  // `scopeTags` are the carrier's OWN non-property tags, kept on the record
  // so a scoped passive reader (engine/skillXp.js: skillXpMult for the tracks
  // the class card names) can ask which mounts speak for a track without a
  // second table. Empty for the carriers that carry none.
  owned[sourceKey] = { kind: carrier.kind, id: carrier.id, instanceId: carrier.instanceId || carrier.id, rules, scopeTags: [...(carrier.scopeTags || [])] };
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
 * relicCarrier(registries, relicId, ownerKey) → the carrier a held relic
 * presents, or null when it confers no property (a passives-only relic, whose
 * numbers still reach the readers through passiveSum's upgrade-aware path).
 *
 * `instanceId` is the relic id: a relic is held once, so the id already names
 * the copy. Equipment needs its item ref because the same armament can sit in
 * two hands.
 */
export function relicCarrier(registries, relicId, ownerKey) {
  const def = registries.relics.get(relicId);
  const tagIds = def && Array.isArray(def.propertyTags) ? def.propertyTags : [];
  return tagIds.length ? { kind: 'relic', id: relicId, instanceId: relicId, ownerKey, tagIds: [...tagIds] } : null;
}

/**
 * classCarrier(registries, classId, ownerKey) → the carrier the class card
 * presents (plan phase 5a): the CORE ZONE's one card, mounted like a relic,
 * conferring the property tags the class carries in tagging.csv (`favored`),
 * scoped by its other tags (the item types it names). Null when the class
 * carries no property.
 */
export function classCarrier(registries, classId, ownerKey, coreTags = []) {
  const def = registries.classes && registries.classes.get ? registries.classes.get(classId) : null;
  const own = def && Array.isArray(def.propertyTags) ? def.propertyTags : [];
  // The run's picked tree nodes (plan phase 5b, run.coreTags) are the core
  // card's own tagging rows: they mount beside the class's authored tags.
  const rules = registries.propertyRules;
  const picked = (Array.isArray(coreTags) ? coreTags : []).filter((id) => rules && typeof rules.has === 'function' && rules.has(id) && !own.includes(id));
  const tagIds = [...own, ...picked];
  return tagIds.length && def
    ? { kind: 'class', id: classId, instanceId: classId, ownerKey, tagIds, scopeTags: [...(def.tags || [])] }
    : null;
}

/** The core tags an entity's seat holds: the seat's own in co-op, the combat's in solo. */
function coreTagsOf(combat, owner) {
  if (combat.players instanceof Map) {
    for (const P of combat.players.values()) if (P.entity === owner) return P.coreTags || [];
  }
  return combat.coreTags || [];
}

/**
 * syncClassProperties(combat, entity) — mount the entity's class card once,
 * as syncRelicProperties mounts a relic: a class never changes mid-fight, so
 * this only ever adds.
 */
export function syncClassProperties(combat, entity) {
  const owner = entity || (combat && combat.player);
  if (!combat || !owner || !owner.classId) return;
  const ownerKey = triggerOwnerKey(combat, owner);
  const carrier = classCarrier(combat.registries, owner.classId, ownerKey, coreTagsOf(combat, owner));
  if (!carrier) return;
  const owned = combat.propertyMounts && combat.propertyMounts[ownerKey];
  if (!owned || !owned[propertySourceKey(carrier)]) mountProperties(combat, carrier);
}

/**
 * syncRelicProperties(combat, entity) — mount every relic the entity holds that
 * is not mounted yet. Relics are never taken away mid-run, so this only ever
 * adds: `addRelic` calls it for the one new relic and combat start calls it for
 * the lot, and a relic mounted twice would throw rather than double-fire.
 */
export function syncRelicProperties(combat, entity) {
  const owner = entity || (combat && combat.player);
  if (!combat || !owner) return;
  const ownerKey = triggerOwnerKey(combat, owner);
  for (const relicId of owner.relicIds || []) {
    const carrier = relicCarrier(combat.registries, relicId, ownerKey);
    if (!carrier) continue;
    const owned = combat.propertyMounts && combat.propertyMounts[ownerKey];
    if (!owned || !owned[propertySourceKey(carrier)]) mountProperties(combat, carrier);
  }
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
