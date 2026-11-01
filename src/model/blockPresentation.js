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
  // Barrier is a stacked status now (SPEC 4.1a), not a pool: nothing here is "charged past full".
  const barrier = 0;
  // wardPool is the Ward that is not Barrier: the magical Block share plus the persistent pool.
  const wardPool = ward + whole(entity?.persistentWard?.value);
  // Ward status stacks (SPEC 4.1a) turn the Poise badge purple and draw Poise over the HP bar on the HP scale.
  const wardStacks = whole(entity?.statuses?.ward?.stacks);
  return { defense, ward: wardPool + barrier, wardPool, wardBlock: ward, barrier, wardStacks, maxHp: whole(entity?.maxHp), poise: whole(entity?.persistentPoise?.value), poiseMax: whole(entity?.persistentPoise?.max) };
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
