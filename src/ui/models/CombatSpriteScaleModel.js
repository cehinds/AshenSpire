import { figureCeiling } from './CombatFormationModel.js';
import { uiConfig } from '../../config/generated/ui.js';
// How far a figure may spread past its own formation cell, as a multiple of the
// cell's width. 1 boxed every figure into its cell, which on a phone (a cell is
// about 50 px) left the player a 50 px thumbnail under an empty sky; the
// screen-edge clamp below still keeps every figure on screen.
const ART_WIDTH_ALLOWANCE = uiConfig.presentation.combatFormationModel.sizing.artWidthAllowance;
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
  // Newly mounted artwork may not have a layout box yet. It must not poison
  // the shared fit with 0/0; the stage retries on image load / resize.
  actors = actors.filter(a => Number.isFinite(a.visibleHeight) && a.visibleHeight > 0
    && Number.isFinite(a.visibleWidth) && a.visibleWidth > 0);
  // The shared reference is the formation's figure ceiling (its one home),
  // not a flat 150: the figures grow with the stage.
  let base = Math.min(figureCeiling({ width, height }), height * .52);
  for (const a of actors) {
    const ratio = a.ratio * a.slot.depth;
    const maxHeight = Math.max(1, (a.slot.fitGround ?? a.slot.ground) - a.leading - 6);
    const maxWidth = Math.max(1, Math.min(a.slot.artWidth * ART_WIDTH_ALLOWANCE, 2 * Math.min(a.slot.x - 6, width - a.slot.x - 6)));
    // The card starts at the visible artwork, excluding transparent padding.
    base = Math.min(base, maxHeight / ratio,
      maxWidth * a.visibleHeight / a.visibleWidth / ratio);
  }
  // A presentation multiplier (Settings: player / enemy sprite scale, the
  // formation's display scale) grows a figure AFTER the shared fit, so the
  // size order holds. Apply the same fraction of requested growth to everyone
  // when any figure runs out of room. Independent side caps let the player
  // grow while an enemy stayed capped, reversing their intended size order.
  const requestedOf = a => Number.isFinite(a.multiplier) && a.multiplier > 0 ? a.multiplier : 1;
  const heightOf = a => base * a.ratio * a.slot.depth;
  const roomOf = a => Math.min(
    Math.max(1, (a.slot.fitGround ?? a.slot.ground) - a.leading - 6) / heightOf(a),
    2 * Math.max(1, Math.min(a.slot.x - 6, width - a.slot.x - 6)) / (heightOf(a) * a.visibleWidth / a.visibleHeight));
  const growthRoom = Math.min(1, ...actors.filter(a => requestedOf(a) > 1)
    .map(a => Math.max(0, roomOf(a) - 1) / (requestedOf(a) - 1)));
  return actors.map(a => {
    const requested = requestedOf(a);
    const multiplier = requested <= 1 ? requested : 1 + (requested - 1) * growthRoom;
    const visibleHeight = heightOf(a) * multiplier;
    const scale = visibleHeight / a.visibleHeight;
    return { id: a.slot.id, scale, visibleHeight, multiplier,
      x: a.slot.x };
  });
}
