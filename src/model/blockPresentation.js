// Arcane Ward is the magical portion of existing Block, not extra mitigation.
// Ordinary Block is spent first; old saves without provenance remain ordinary.
export function blockPresentation(entity) {
  const total = Number.isFinite(entity?.block) ? Math.max(0, Math.floor(entity.block)) : 0;
  const ward = Number.isFinite(entity?.wardBlock) ? Math.max(0, Math.min(total, Math.floor(entity.wardBlock))) : 0;
  return { defense: total - ward, ward };
}

export function reconcileWardBlock(entity) {
  if (entity.wardBlock !== undefined) entity.wardBlock = blockPresentation(entity).ward;
}

export function wardBlockReceipt(entity) {
  return entity.wardBlock === undefined ? {} : { wardBlockRemaining: blockPresentation(entity).ward };
}

// The health row's badges: Block, and every Ward the combatant holds — the
// magical share of Block plus the persistent Ward pool (expanded combat).
export function protectionPresentation(entity) {
  const { defense, ward } = blockPresentation(entity);
  const whole = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  // Barrier is Ward charged past full: it counts in the badge and gilds it.
  const barrier = whole(entity?.barrier);
  // wardPool is the Ward that is not Barrier: the magical Block share plus the persistent pool.
  const wardPool = ward + whole(entity?.persistentWard?.value);
  // Poise has no badge: the HP bar's gold trim and its tooltip carry value/max.
  return { defense, ward: wardPool + barrier, wardPool, wardGuard: ward, barrier, poise: whole(entity?.persistentPoise?.value), poiseMax: whole(entity?.persistentPoise?.max) };
}

// Which layer colours the HP bar's fill: the highest defence still standing,
// Barrier (blue) > Block (silver) > Ward (purple) > none (the Health red).
// Only the colour changes; the fill's length still means HP.
export function healthGuardTone({ barrier = 0, defense = 0, wardPool = 0 } = {}) {
  if (barrier > 0) return 'barrier';
  if (defense > 0) return 'block';
  if (wardPool > 0) return 'ward';
  return 'none';
}
