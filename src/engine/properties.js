// src/engine/properties.js — the one mount path for property rules
// (docs/proposal-progression-and-property-system.md §3, plan phase 1b)
//
// A property tag confers behaviour only while a CARRIER holds it: the equipped
// weapon, the worn armour, a held relic, the class card, the place the run
// stands at (engine/locations.js). This
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
// WINDOW — the span over which the holder is held — and these five are the
// holders whose window the engine knows (worn, worn, owned, chosen, and a
// location's arrival-to-departure — engine/locations.js, plan phase 7). A kind
// gains a mount by gaining a window here, never by a content row.
// A companion (SPEC §14.3) is held from combat start while it travels with
// the run: it is mounted at createCombat and on restore, and leaves between
// fights (engine/runCombat.js runCombatEnd counts it down).
// A slotted sigil (SPEC §14.4) is held while the armament its slot is cut
// into is equipped: syncLoadoutProperties mounts and unmounts it with the worn
// pieces, so a swap (mid-fight included) takes it along. §15.4's attuned
// legendary shares the kind under the same `sigil:<id>` key: it is held by the
// run while attuned (syncSigilProperties), carries no `heldBy`, and is never
// slotted, so the two never meet.
const MOUNTABLE_KINDS = Object.freeze(['armament', 'armour', 'relic', 'class', 'location', 'companion', 'sigil']);

/** The key a carrier's mount lives under, per owner. */
export function propertySourceKey(carrier) {
  return `${carrier.kind}:${carrier.instanceId || carrier.id}`;
}

function assertCarrier(carrier) {
  const c = carrier || {};
  const problems = [];
  if (!MOUNTABLE_KINDS.includes(c.kind)) {
    problems.push(`kind '${c.kind}' has no hold span to mount on (mountable: ${MOUNTABLE_KINDS.join(', ')})`);
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
  owned[sourceKey] = {
    kind: carrier.kind, id: carrier.id, instanceId: carrier.instanceId || carrier.id, rules, scopeTags: [...(carrier.scopeTags || [])],
    // The worn piece a slotted sigil rides (SPEC §14.4), so the loadout diff
    // knows the mount is its to take away.
    ...(carrier.heldBy ? { heldBy: carrier.heldBy } : {}),
  };
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

/**
 * The carriers a loadout presents: every worn piece that holds a property
 * tag, and every sigil set into a slot of a worn armament (SPEC §14.4) —
 * `{ kind: 'sigil', id, instanceId: id }`, one per sigil, since a sigil is
 * owned at most once. `sigilSlots` is `run.sigilSlots` (keyed like itemMounts);
 * none given, no sigil mounts.
 */
export function loadoutCarriers(registries, loadout, classId, ownerKey, itemUpgradeLevels = {}, sigilSlots = null) {
  const worn = equippedPieces(registries, loadout, classId, { itemUpgradeLevels });
  const pieces = worn
    .filter((piece) => Array.isArray(piece.propertyTags) && piece.propertyTags.length)
    .map((piece) => ({
      kind: piece.kind === 'armor' ? 'armour' : 'armament',
      id: piece.id,
      instanceId: pieceItemRef(piece),
      ownerKey,
      tagIds: [...piece.propertyTags],
    }));
  const sigils = [];
  if (sigilSlots && typeof sigilSlots === 'object' && registries.sigils) {
    const seen = new Set();
    for (const piece of worn) {
      const itemRef = pieceItemRef(piece);
      if (!itemRef || seen.has(itemRef) || !Array.isArray(sigilSlots[itemRef])) continue;
      seen.add(itemRef);
      for (const id of sigilSlots[itemRef]) {
        if (typeof id !== 'string' || !registries.sigils.has(id) || sigils.some((c) => c.id === id)) continue;
        const tagIds = registries.sigils.get(id).propertyTags || [];
        if (tagIds.length) sigils.push({ kind: 'sigil', id, instanceId: id, ownerKey, tagIds: [...tagIds], heldBy: itemRef });
      }
    }
  }
  return [...pieces, ...sigils];
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
  // Only the class's OWN tree mounts (the review of #1192): a pick the tree
  // does not hold is the load door's — another class's node refused, one a
  // content update dropped let go with a ledger row — never this carrier's
  // to confer.
  const rules = registries.propertyRules;
  const tree = new Set((Array.isArray(registries.classTree) ? registries.classTree : []).filter((row) => row && row.classId === classId).map((row) => row.nodeId));
  const picked = (Array.isArray(coreTags) ? coreTags : []).filter((id) => tree.has(id) && rules && typeof rules.has === 'function' && rules.has(id) && !own.includes(id));
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
 * companionCarrier(registries, companionId, ownerKey) → the carrier a
 * travelling companion presents (SPEC §14.3), or null when it confers
 * nothing. Its tags are its tagging.csv property rows, resolved through
 * carrierRules like a relic's; `instanceId` is the id, since one of each
 * travels at a time.
 */
export function companionCarrier(registries, companionId, ownerKey) {
  const def = registries.companions && registries.companions.has(companionId) ? registries.companions.get(companionId) : null;
  const tagIds = def && Array.isArray(def.propertyTags) ? def.propertyTags : [];
  return tagIds.length ? { kind: 'companion', id: companionId, instanceId: companionId, ownerKey, tagIds: [...tagIds] } : null;
}

/**
 * syncCompanionProperties(combat) — mount every companion the fight carries
 * (`combat.companions`) that is not mounted yet, under the solo player. A
 * companion never joins or leaves mid-fight, so this only ever adds.
 */
export function syncCompanionProperties(combat) {
  const owner = combat && combat.player;
  if (!owner || !Array.isArray(combat.companions)) return;
  const ownerKey = triggerOwnerKey(combat, owner);
  for (const id of combat.companions) {
    const carrier = companionCarrier(combat.registries, id, ownerKey);
    if (!carrier) continue;
    const owned = combat.propertyMounts && combat.propertyMounts[ownerKey];
    if (!owned || !owned[propertySourceKey(carrier)]) mountProperties(combat, carrier);
  }
}

/**
 * sigilCarrier(registries, sigilId, ownerKey) → the carrier an ATTUNED
 * legendary sigil presents (SPEC §15.4), or null for anything else. No
 * `heldBy`: the run holds it, not a piece, so syncLoadoutProperties leaves it.
 */
export function sigilCarrier(registries, sigilId, ownerKey) {
  const def = registries.sigils && registries.sigils.has(sigilId) ? registries.sigils.get(sigilId) : null;
  if (!def || def.rarity !== 'legendary') return null;
  const tagIds = Array.isArray(def.propertyTags) ? def.propertyTags : [];
  return tagIds.length ? { kind: 'sigil', id: sigilId, instanceId: sigilId, ownerKey, tagIds: [...tagIds] } : null;
}

/**
 * syncSigilProperties(combat, entity, attunedSigils) — mount every attuned
 * legendary (SPEC §15.4) that is not mounted yet, as syncRelicProperties
 * mounts relics. Attunement never changes mid-fight, so this only adds. Solo
 * reads `combat.attunedSigils`; a co-op seat hands in its own list.
 */
export function syncSigilProperties(combat, entity, attunedSigils) {
  const owner = entity || (combat && combat.player);
  if (!combat || !owner) return;
  const ids = attunedSigils !== undefined ? attunedSigils : combat.attunedSigils;
  if (!Array.isArray(ids)) return;
  const ownerKey = triggerOwnerKey(combat, owner);
  for (const id of ids) {
    const carrier = sigilCarrier(combat.registries, id, ownerKey);
    if (!carrier) continue;
    const owned = combat.propertyMounts && combat.propertyMounts[ownerKey];
    if (!owned || !owned[propertySourceKey(carrier)]) mountProperties(combat, carrier);
  }
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
export function syncLoadoutProperties(combat, entity, loadout, itemUpgradeLevels, sigilSlots) {
  // A CO-OP SEAT CARRIES ITS OWN KIT. Solo reads the one loadout off the
  // combat; a party's seats each hand in theirs, under their own owner key,
  // for the reason the relic sync states — mounted under whichever seat is
  // active, a second seat's staff confers nothing (Codex, #1203).
  const owner = entity || (combat && combat.player);
  if (!combat || !owner) return;
  const kit = loadout !== undefined ? loadout : combat.loadout;
  const tiers = itemUpgradeLevels !== undefined ? itemUpgradeLevels : combat.itemUpgradeLevels;
  // The slots ride the combat (`combat.sigilSlots`, SPEC §14.4) for the solo
  // seat; a co-op seat handing in its own kit carries none in v1.
  const slots = sigilSlots !== undefined ? sigilSlots : (loadout === undefined ? combat.sigilSlots : null);
  const ownerKey = triggerOwnerKey(combat, owner);
  const wanted = kit
    ? loadoutCarriers(combat.registries, kit, owner.classId, ownerKey, tiers || {}, slots || null)
    : [];
  const wantedKeys = new Set(wanted.map(propertySourceKey));
  const current = (combat.propertyMounts && combat.propertyMounts[ownerKey]) || {};
  for (const [sourceKey, mount] of Object.entries(current)) {
    if ((LOADOUT_KINDS.has(mount.kind) || (mount.kind === 'sigil' && mount.heldBy)) && !wantedKeys.has(sourceKey)) {
      unmountProperties(combat, { ...mount, ownerKey, tagIds: [] });
    }
  }
  for (const carrier of wanted) {
    const owned = combat.propertyMounts && combat.propertyMounts[ownerKey];
    if (!owned || !owned[propertySourceKey(carrier)]) mountProperties(combat, carrier);
  }
}
