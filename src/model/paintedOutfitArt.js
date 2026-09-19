import { armourById } from '../content/equipment.js';
import { PAINTED_OUTFITS } from '../content/paintedOutfits.js';

// Authored aliases reuse a complete existing pose set for new armour.
export function armourArtKey(classId, armourId = 'default') {
  return armourById(classId, armourId)?.artKey || armourId || 'default';
}

export function paintedOutfit(classId, armourId = 'default') {
  armourId = armourArtKey(classId, armourId);
  const id = !armourId || armourId === 'default' ? classId : `${classId}-${armourId}`;
  return PAINTED_OUTFITS[id] || PAINTED_OUTFITS[classId] || null;
}

// Armor item images use the full-body menu pose on every selection surface.
export function armourMenuAsset(classId, armourId = 'default') {
  return paintedOutfit(classId, armourId)?.menu.stand || null;
}
