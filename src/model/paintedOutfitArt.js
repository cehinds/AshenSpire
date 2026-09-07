import { PAINTED_OUTFITS } from '../content/paintedOutfits.js';

export function paintedOutfit(classId, armourId = 'default') {
  const id = !armourId || armourId === 'default' ? classId : `${classId}-${armourId}`;
  return PAINTED_OUTFITS[id] || PAINTED_OUTFITS[classId] || null;
}

// Armor item images use the full-body menu pose on every selection surface.
export function armourMenuAsset(classId, armourId = 'default') {
  return paintedOutfit(classId, armourId)?.menu.stand || null;
}
