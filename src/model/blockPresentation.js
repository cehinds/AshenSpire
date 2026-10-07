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
