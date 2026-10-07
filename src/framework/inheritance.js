// src/framework/inheritance.js — whitelisted equipment→card inheritance
// (framework contract: Whitelisted inheritance).
//
// The allowlist IS the PERMITS relation set: a property family crosses from
// equipment onto a card only when the card's classification PERMITS it.
// Lore and presentation properties never create mechanics; inheritance is an
// allowlist, never `copy every tag`.

const NEVER_INHERITED_DOMAINS = new Set(['PRESENTATION', 'INTERNAL']);

/**
 * filterInheritable(registries, cardClassificationIds, candidateInstances)
 * -> the subset of candidate PropertyInstances the card may inherit.
 */
export function filterInheritable(registries, cardClassificationIds, candidates) {
  const props = registries.properties;
  const permitted = [];
  for (const classificationId of cardClassificationIds) {
    // A classification's own PERMITS rows, plus rows inherited via INHERITS
    // (Strike INHERITS Attack, so Strike permits what Attack permits).
    collectPermits(props, classificationId, permitted, new Set());
  }
  return candidates.filter((candidate) => {
    const def = props.require(candidate.propertyId);
    if (NEVER_INHERITED_DOMAINS.has(def.domain)) return false;
    return permitted.some((targetId) => props.isA(candidate.propertyId, targetId));
  });
}

function collectPermits(props, classificationId, out, seen) {
  if (seen.has(classificationId)) return;
  seen.add(classificationId);
  for (const rel of props.relationsFrom(classificationId, 'PERMITS')) {
    out.push(rel.targetPropertyId);
  }
  for (const rel of props.relationsFrom(classificationId, 'INHERITS')) {
    collectPermits(props, rel.targetPropertyId, out, seen);
  }
}
