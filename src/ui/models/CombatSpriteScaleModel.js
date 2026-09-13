import { figureCeiling } from './CombatFormationModel.js';
// Presentation ratios only; encounter pools still own enemy classification.
const BOSS_SCALE = Object.freeze({ ashheartDragon: 3 });
export function combatSpriteRatio(stature, enemyId) {
  if (stature === 'large') return 1.75;
  if (stature === 'huge') return BOSS_SCALE[enemyId] || 2;
  return 1;
}

// Fit once for the formation. Fitting each actor independently cancels stature
// on cramped screens. Depth is applied to every actor in the same row.
export function fitCombatSprites({ width, height, actors }) {
  // The shared reference is the formation's figure ceiling (its one home),
  // not a flat 150: the figures grow with the stage.
  let base = Math.min(figureCeiling({ width, height }), height * .52);
  for (const a of actors) {
    const ratio = a.ratio * a.slot.depth;
    const maxHeight = Math.max(1, a.slot.ground - a.leading - 6);
    const maxWidth = Math.max(1, Math.min(a.slot.artWidth, width - 12));
    // Overhead controls anchor to the visible idle top, so transparent canvas
    // padding must not consume the clearance a second time.
    base = Math.min(base, maxHeight / ratio,
      maxWidth * a.visibleHeight / a.visibleWidth / ratio);
  }
  return actors.map(a => {
    const visibleHeight = base * a.ratio * a.slot.depth;
    const scale = visibleHeight / a.visibleHeight;
    const half = a.visibleWidth * scale / 2;
    return { id: a.slot.id, scale, visibleHeight,
      x: Math.max(half + 6, Math.min(width - half - 6, a.slot.x)) };
  });
}
