// Inventory icons may reuse authored artwork independently of the character rig.
export function armamentIconAsset(piece) {
  return `assets/equipment/icon_${piece.inventoryArtKey || piece.id}.webp`;
}
