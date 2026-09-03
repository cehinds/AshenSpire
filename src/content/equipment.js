// src/content/equipment.js — armaments, armour, slots, and the mod vocabulary.
//
// Authored CSV/JSON content feeds this file and nothing else does:
//
//   content/source/weapons.csv       every armament (weapon / shield / staff)
//   content/source/outfits.csv       every armour set (an outfit IS a set)
//   content/source/equipSlots.csv    what you can wear, and when you may swap
//   content/source/equipMods.csv     what a mod string is allowed to say
//   content/source/equipTargets.csv  which card each mod prefix rewrites
//   content/source/armouryUi.json     Armoury-only presentation choices
//
// This module only NORMALISES them — the CSV compiler coerces a single value
// to a string and a pipe-separated one to an array, so every list-shaped
// column has to be forced back to an array exactly once, here. No balance
// numbers and no behaviour live in this file; see model/loadout.js for what
// the mods actually do.

import { weapons } from './generated/weapons.js';
import { outfits } from './generated/outfits.js';
import { equipSlots } from './generated/equipSlots.js';
import { equipMods } from './generated/equipMods.js';
import { equipTargets } from './generated/equipTargets.js';
import { basicCardProfiles } from './generated/basicCardProfiles.js';
import { cardExposure } from './generated/cardExposure.js';
import { startingKits } from './generated/startingKits.js';
import { equipmentRequirements } from './generated/equipmentRequirements.js';
import { itemUpgradeChanges } from './generated/itemUpgradeChanges.js';
import { cardEquipmentExceptions } from './generated/cardEquipmentExceptions.js';
import { equipmentGrants } from './generated/equipmentGrants.js';
import { TAGGING } from './tags.js';
import { armouryUi } from './generated/armouryUi.js';

/** '' → [], 'a' → ['a'], ['a','b'] → ['a','b']. */
function list(v) {
  if (v === '' || v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export const ITEM_TYPE_TAG_PREFIX = 'item:';

/** `item:magic-focus` -> `Magic Focus`; adding a new type is a content tag. */
export function itemTypeLabel(tag) {
  if (typeof tag !== 'string' || !tag.startsWith(ITEM_TYPE_TAG_PREFIX)) return null;
  return tag.slice(ITEM_TYPE_TAG_PREFIX.length)
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function normPiece(row) {
  const attributes = Object.fromEntries(equipmentRequirements
    .filter((requirement) => requirement.itemId === row.id)
    .map((requirement) => [requirement.attributeId, requirement.minimum]));
  // TAGS ARE NOT HERE. They are rows in content/source/tagging.csv, and
  // model/registries.js stamps `entityTags`, `itemTypeTags`, `itemTypes` and
  // the gameplay `tags` set onto the piece at boot — the same four fields this
  // function used to build, from the same authored words, one table later. The
  // split is unchanged: `tags` stays the familiar gameplay/presentation set and
  // an item card still never infers its type from `kind` or a UI call site.
  return {
    ...row,
    artKey: row.artKey || row.id,
    mods: list(row.mods),
    ...(Object.keys(attributes).length ? { requirements: { attributes } } : {}),
  };
}

/** Every armament: weapons, shields and staves, in authoring order. */
export const ARMAMENTS = weapons.map(normPiece);

/** Every armour set. `id` is unique per class, not globally — key by both. */
export const ARMOUR = outfits.map((row) => ({ ...normPiece(row), kind: 'armor' }));

/** Slot definitions, ordered. */
export const SLOTS = equipSlots
  .map((row) => ({ ...row, kinds: list(row.kinds) }))
  .sort((a, b) => a.order - b.order);

/** The registered modifier fields, keyed by field name. */
export const MOD_FIELDS = new Map(equipMods.map((m) => [m.field, m]));

const ARMAMENT_BY_ID = new Map(ARMAMENTS.map((a) => [a.id, a]));
const SLOT_BY_ID = new Map(SLOTS.map((s) => [s.id, s]));

export function armamentById(id) {
  return ARMAMENT_BY_ID.get(id) || null;
}

export function slotById(id) {
  return SLOT_BY_ID.get(id) || null;
}

/** Armour sets belonging to one class, in authoring order. */
export function armourForClass(classId) {
  return ARMOUR.filter((o) => o.classId === classId);
}

/** The set a class starts in — the one row per class with no unlock. */
export function startingArmour(classId) {
  return armourForClass(classId).find((o) => o.unlock === '') || null;
}

/** Armour is keyed by (classId, id) because ids repeat across classes. */
export function armourById(classId, id) {
  return armourForClass(classId).find((o) => o.id === id) || null;
}

/** Which armaments may go in a slot, by the slot's `kinds` gate. */
export function armamentsForSlot(slotId) {
  const slot = slotById(slotId);
  if (!slot) return [];
  return ARMAMENTS.filter((a) => slot.kinds.includes(a.kind));
}

/**
 * The card a mod prefix rewrites for a given class, e.g.
 * cardForTarget('power', 'herald') → 'urgentHeal'. Class-specific rows win
 * over the '*' fallback.
 */
export function cardForTarget(target, classId) {
  const exact = equipTargets.find((t) => t.target === target && t.classId === classId);
  if (exact) return exact.cardId;
  const any = equipTargets.find((t) => t.target === target && t.classId === '*');
  return any ? any.cardId : null;
}

/** Every mod prefix that resolves to a card (for validation and tests). */
export const CARD_TARGETS = [...new Set(equipTargets.map((t) => t.target))];

/** Equipment-bound core card profiles, authored once and selected by role. */
export const BASIC_CARD_PROFILES = basicCardProfiles.map((row) => ({
  ...row,
  mods: list(row.mods),
}));

/** Explicit damage carriers; school and buildup are never inferred from tags. */
export const CARD_EXPOSURE = cardExposure.map((row) => ({ ...row }));

/** Class-listed starting kits; hand ids stay explicit so validation can name them. */
export const STARTING_KITS = startingKits.map((row) => ({ ...row }));

/** Raw item/stat minima retained so validation can detect duplicate authored rows. */
export const EQUIPMENT_REQUIREMENTS = equipmentRequirements.map((row) => ({ ...row }));

/** Exact item/tier upgrade facts. Interpretation belongs to model/itemUpgrades.js. */
export const ITEM_UPGRADE_CHANGES = itemUpgradeChanges.map((row) => ({ ...row }));

/** Registered exceptional card→weapon bonds; ordinary fit is class/tag based. */
export const CARD_EQUIPMENT_EXCEPTIONS = cardEquipmentExceptions.map((row) => ({ ...row }));

/**
 * Raw authored card tag ids, carried into registries for compatibility checks.
 * The card slice of the one association table (content/source/tagging.csv),
 * folded back to one row per card because that is the shape equipment fit reads.
 */
export const CARD_EQUIPMENT_TAGGING = (() => {
  const byCard = new Map();
  for (const row of TAGGING) {
    if (row.family !== 'card') continue;
    const tags = byCard.get(row.objectId);
    if (tags) tags.push(row.tagId);
    else byCard.set(row.objectId, [row.tagId]);
  }
  return [...byCard].map(([cardId, tags]) => ({ cardId, tags }));
})();

/** The payload half of the `bound` tag: cards a piece carries with it. */
export const EQUIPMENT_GRANTS = equipmentGrants.map((row) => ({ ...row, cards: list(row.cards) }));

/** Armoury-only presentation choices authored in JSON. */
export const ARMOURY_UI = { ...armouryUi };
