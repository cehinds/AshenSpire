import { armourById } from '../content/equipment.js';
import { PAINTED_OUTFITS } from '../content/paintedOutfits.js';

// Authored aliases reuse a complete existing pose set for new armour.
export function armourArtKey(classId, armourId = 'default') {
  return armourById(classId, armourId)?.artKey || armourId || 'default';
}

/** The outfit's visual rig is independent of the wearer's gameplay class. */
export function armourArtClass(classId, armourId = 'default') {
  return armourById(classId, armourId)?.artClassId || classId;
}

export function paintedOutfit(classId, armourId = 'default') {
  const artClassId = armourArtClass(classId, armourId);
  armourId = armourArtKey(classId, armourId);
  const id = !armourId || armourId === 'default' ? artClassId : `${artClassId}-${armourId}`;
  return PAINTED_OUTFITS[id] || PAINTED_OUTFITS[artClassId] || null;
}

// Armor item images use the full-body menu pose on every selection surface.
export function armourMenuAsset(classId, armourId = 'default') {
  const piece = armourById(classId, armourId);
  if (piece?.inventoryArtKey) return `assets/equipment/icon_${piece.inventoryArtKey}.webp`;
  return paintedOutfit(classId, armourId)?.menu.stand || null;
}
