// src/model/artCharge.js — the Weapon Art charge meter's one reader
// (SPEC §12.2.1). DOM-free and engine-free: the engine's bus listener
// (engine/artCharge.js) and the combat screen both ask these questions, so the
// hand, the HUD and the play always agree on what a meter holds.
//
// State is `combat.artCharge = { [armamentId]: integer }`. A missing entry is
// 0, and every read clamps to the weapon's CURRENT max, so a snapshot written
// under other balance numbers never shows more pips than the meter has.

import { equippedIn, slotHand } from './loadout.js';
import { ownerItemRef } from './cardMounts.js';

/** balance.weaponArtCharge, or null when the content carries no meter rules. */
export function artChargeRules(registries) {
  const rules = registries && registries.balance && registries.balance.weaponArtCharge;
  return rules && typeof rules === 'object' ? rules : null;
}

/** The unleashed form authored for an Art card id, or null. */
export function unleashedFormFor(registries, cardId) {
  const forms = registries && registries.weaponArtUnleashed;
  return forms && typeof cardId === 'string' && Object.hasOwn(forms, cardId) ? forms[cardId] : null;
}

function armamentById(registries, id) {
  return (((registries && registries.equipment) || {}).armaments || []).find((piece) => piece && piece.id === id) || null;
}

/** The combat-kit Art card id an armament lends, or null. */
export function artCardIdOf(piece) {
  return (piece && piece.weaponCardPackage && piece.weaponCardPackage.combatKit && piece.weaponCardPackage.combatKit.artCardId) || null;
}

/**
 * artChargeMax(registries, weaponId) → the meter's size; 0 means no meter.
 * A weapon has a meter only when the rules exist, its combat-kit Art has an
 * unleashed form, and its max (per-weapon row, else the default) is above 0.
 */
export function artChargeMax(registries, weaponId) {
  const rules = artChargeRules(registries);
  if (!rules) return 0;
  const piece = armamentById(registries, weaponId);
  if (!piece || !unleashedFormFor(registries, artCardIdOf(piece))) return 0;
  const byWeapon = rules.maxByWeapon || {};
  const max = Object.hasOwn(byWeapon, weaponId) ? byWeapon[weaponId] : rules.defaultMax;
  return Number.isInteger(max) && max > 0 ? max : 0;
}

/** The stored charge for a weapon, clamped to its current max. */
export function artChargeValue(combat, weaponId) {
  const max = artChargeMax(combat.registries, weaponId);
  const raw = combat.artCharge && Number.isInteger(combat.artCharge[weaponId]) ? combat.artCharge[weaponId] : 0;
  return Math.max(0, Math.min(max, raw));
}

/**
 * The armaments the player's hands hold right now, right hand first, each
 * once (a two-handed piece fills both hand slots but has one meter).
 */
export function equippedWeaponIds(registries, loadout, classId) {
  if (!loadout) return [];
  const out = [];
  const slots = ((registries && registries.equipment) || {}).slots || [];
  for (const hand of ['right', 'left']) {
    for (const slot of slots.filter((row) => slotHand(row) === hand)) {
      const piece = equippedIn(registries, loadout, classId, slot.id);
      if (piece && piece.kind !== 'armor' && !out.includes(piece.id)) out.push(piece.id);
    }
  }
  return out;
}

/** Is this weapon in one of the player's hands in this fight? */
export function isWeaponEquipped(combat, weaponId) {
  return equippedWeaponIds(combat.registries, combat.loadout, combat.player && combat.player.classId).includes(weaponId);
}

/**
 * The armament a card (instance, card ref or damage event) was lent by, or
 * null: `sourceArmamentId` (stamped on kit and attack cards), else the
 * `grantedBy` owner when it names an armament.
 */
export function lendingWeaponOf(registries, card) {
  if (!card) return null;
  const direct = card.sourceArmamentId || card.weaponId;
  if (typeof direct === 'string' && armamentById(registries, direct)) return direct;
  const ref = ownerItemRef({ grantedBy: card.grantedBy });
  if (ref && ref.startsWith('armament/')) {
    const id = ref.slice('armament/'.length);
    if (armamentById(registries, id)) return id;
  }
  return null;
}

/**
 * artUnleashFor(combat, inst) → { weaponId, value, max, ready, form } for a
 * `weaponArt` instance whose lender has a meter, else null. `ready` is the
 * unleash condition: the lender is equipped, the meter is full, and this
 * card id has an unleashed form.
 */
export function artUnleashFor(combat, inst) {
  if (!inst || inst.equipmentRole !== 'weaponArt') return null;
  const weaponId = lendingWeaponOf(combat.registries, inst);
  if (!weaponId) return null;
  const max = artChargeMax(combat.registries, weaponId);
  if (!max) return null;
  const form = unleashedFormFor(combat.registries, inst.cardId);
  const value = artChargeValue(combat, weaponId);
  const equipped = isWeaponEquipped(combat, weaponId);
  return { weaponId, value, max, form, ready: !!form && equipped && value >= max };
}

/**
 * artChargeView(combat) → one row per equipped weapon that has a meter:
 * { weaponId, name, artCardId, artName, value, max, full }. The HUD's input.
 */
export function artChargeView(combat) {
  const registries = combat.registries;
  const rows = [];
  for (const weaponId of equippedWeaponIds(registries, combat.loadout, combat.player && combat.player.classId)) {
    const max = artChargeMax(registries, weaponId);
    if (!max) continue;
    const piece = armamentById(registries, weaponId);
    const artCardId = artCardIdOf(piece);
    const value = artChargeValue(combat, weaponId);
    const artDef = registries.cards && registries.cards.has && registries.cards.has(artCardId) ? registries.cards.get(artCardId) : null;
    rows.push({ weaponId, name: piece.name || weaponId, artCardId, artName: (artDef && artDef.name) || artCardId, value, max, full: value >= max });
  }
  return rows;
}

/**
 * artChargeSnapshotProblems(value) → field-addressed problems for a saved
 * `artCharge` map (absent is fine: an older snapshot resumes with 0s).
 */
export function artChargeSnapshotProblems(value) {
  if (value === undefined) return [];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['artCharge must be an object keyed by armament id'];
  const problems = [];
  for (const [id, charge] of Object.entries(value)) {
    if (!id || !Number.isInteger(charge) || charge < 0) problems.push(`artCharge.${id || '<empty>'} must be a non-negative integer`);
  }
  return problems;
}
