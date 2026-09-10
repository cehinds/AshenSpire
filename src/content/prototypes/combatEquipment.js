import { attackDescriptor } from '../../model/attackTags.js';
import { deriveEquipmentCombatProfile } from '../../model/equipmentCombatProfile.js';
import { combatRules } from '../combatRules.js';

// Prototype tuning only. Catalog weapon weights/requirements remain authoritative;
// armor has an explicit weight independent of its defensive rating.
export const prototypeEquipmentRules = {
  oneHandStrengthMultiplier: 1.5,
  loadBands: [{ id: 'light', minimum: 0 }, { id: 'medium', minimum: 10 }, { id: 'heavy', minimum: 18 }],
  qualities: { standard: { sockets: 0 }, fine: { sockets: 1 }, superior: { sockets: 2 }, masterwork: { sockets: 3 } },
  runeTags: ['theme:blood'], buildupStatuses: ['bleed'],
  weapons: {
    greatsword: { family: 'blade', nativeHands: 2, allowedGrips: ['twoHand', 'oneHand'] },
    dagger: { family: 'blade', nativeHands: 1, allowedGrips: ['oneHand'] },
    ashStaff: { family: 'focus', nativeHands: 2, allowedGrips: ['twoHand', 'oneHand'] },
  },
  armor: {
    plate: { name: 'Plate test set', weight: 12, armor: 30, value: 90 },
    leather: { name: 'Leather test set', weight: 3, armor: 10, value: 45 },
    robes: { name: 'Robe test set', weight: 1, armor: 5, value: 30 },
    empty: { name: 'No armor', weight: 0, armor: 0, value: 0 },
  },
  bloodRune: { name: 'Blood Rune', scope: 'source', families: ['blade'], tags: ['theme:blood'], buildup: [{ status: 'bleed', amount: 1 }], value: 25 },
  weaponValue: 100,
};

export function prototypeEquipment(registries, build, options = {}) {
  const config = prototypeEquipmentRules;
  const weapon = registries.equipment.armaments.find(item => item.id === build.itemId);
  if (!weapon || !config.weapons[weapon.id]) throw new Error('Unknown prototype weapon');
  const armorId = options.armor || build.armorId;
  const armor = config.armor[armorId];
  if (!armor) throw new Error('Unknown prototype armor');
  const identity = attackDescriptor(weapon);
  const bloodRune = options.bloodRune ?? build.bloodRune ?? false;
  const item = { instanceId: `prototype/${weapon.id}/1`, itemId: weapon.id, name: weapon.name, kind: 'armament',
    weight: weapon.weight, requirements: weapon.requirements?.attributes || {}, tags: weapon.tags,
    sourceType: identity.source, damageType: identity.damageType, ...config.weapons[weapon.id],
    quality: 'fine', value: config.weaponValue, buildup: [],
    runes: bloodRune ? [{ ...config.bloodRune, instanceId: 'prototype/blood-rune/1' }] : [] };
  const equipment = { attributes: { ...build.attributes }, items: [item],
    hands: { mainHand: { instanceId: item.instanceId, grip: options.grip || build.grip }, offHand: null }, armorId: null };
  if (armorId !== 'empty') {
    equipment.armorId = `prototype/armor/${armorId}/1`;
    equipment.items.push({ ...armor, instanceId: equipment.armorId, itemId: `prototype-${armorId}`, kind: 'armor', quality: 'fine', runes: [] });
  }
  const profile = deriveEquipmentCombatProfile(equipment, combatRules, config);
  return { equipment: structuredClone(equipment), profile };
}
