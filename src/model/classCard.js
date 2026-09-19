// src/model/classCard.js — the class card, DERIVED (plan phase 5a, proposal §4).
//
// The character's core zone holds one card: the class. Its face is read off
// the fields that own the facts today — the class row (name, glyph, tint,
// description), the class's free starting kit (the weapon), its ability card
// and its starting relic (the kit), and its tagging rows (the schools it
// leans to, the item types it favours, the properties it carries). No second
// authored shape: a class card is a projection, the way zones are (§13.4a).

/** The item-type ids a class favours, from its class-domain tagging rows. */
export function favoredGroups(registries, classId) {
  const def = registries.classes.get(classId);
  const itemTypes = new Set((Array.isArray(registries.nodes) ? registries.nodes : []).filter((n) => n.parentId === 'itemType').map((n) => n.id));
  return def ? (def.tags || []).filter((t) => itemTypes.has(t)) : [];
}

/**
 * classCard(registries, classId) → { id, kind: 'class', zone: 'core', name,
 * glyph, tint, description, kit: { weaponKitId, rightHand, leftHand,
 * abilityCardId, relicId }, favored: [itemTypeId], schools: [cardSchool],
 * propertyTags: [propertyId] }
 */
export function classCard(registries, classId) {
  const def = registries.classes.get(classId);
  if (!def) throw new Error(`classCard: unknown class '${classId}'`);
  const kits = ((registries.equipment || {}).startingKits) || [];
  const baseline = kits.find((row) => row.classId === classId && row.baseline === true) || null;
  const schools = new Set((Array.isArray(registries.nodes) ? registries.nodes : []).filter((n) => n.parentId === 'card').map((n) => n.id));
  return {
    id: def.id,
    kind: 'class',
    zone: 'core',
    name: def.name,
    glyph: def.glyph || null,
    tint: def.cardTint || null,
    description: def.description || '',
    kit: {
      weaponKitId: baseline ? baseline.id : null,
      rightHand: baseline ? baseline.rightHand || null : null,
      leftHand: baseline ? baseline.leftHand || null : null,
      abilityCardId: def.abilityCard || null,
      signatureCardId: def.startingSignatureCard || null,
      relicId: def.kitRelic || null,
      startingRelicId: def.startingRelic || null,
    },
    favored: favoredGroups(registries, classId),
    schools: (def.tags || []).filter((t) => schools.has(t)),
    propertyTags: [...(def.propertyTags || [])],
  };
}
