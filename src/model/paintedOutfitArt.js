import { armourById } from '../content/equipment.js';
import { PAINTED_OUTFITS } from '../content/paintedOutfits.js';
import { SHARED_OUTFIT_ART } from '../content/sharedOutfitArt.js';

export function sharedOutfit(classId, armourId) {
  return SHARED_OUTFIT_ART[`${classId}-${armourId}`] || null;
}

// Prefer the wearer's dedicated outfit; legacy aliases remain available.
export function armourArtKey(classId, armourId = 'default') {
  if (sharedOutfit(classId, armourId)) return armourId;
  return armourById(classId, armourId)?.artKey || armourId || 'default';
}

/** Shared painted outfits preserve the wearer; legacy rigs may use aliases. */
export function armourArtClass(classId, armourId = 'default') {
  if (sharedOutfit(classId, armourId)) return classId;
  return armourById(classId, armourId)?.artClassId || classId;
}

export function paintedOutfit(classId, armourId = 'default') {
  const shared = sharedOutfit(classId, armourId);
  if (shared) return shared;
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
