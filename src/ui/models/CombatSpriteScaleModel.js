import { figureCeiling } from './CombatFormationModel.js';
import { uiConfig } from '../../config/generated/ui.js';
// How far a figure may spread past its own formation cell, as a multiple of the
// cell's width. 1 boxed every figure into its cell, which on a phone (a cell is
// about 50 px) left the player a 50 px thumbnail under an empty sky; the
// screen-edge clamp below still keeps every figure on screen.
const ART_WIDTH_ALLOWANCE = uiConfig.presentation.combatFormationModel.sizing.artWidthAllowance;
export const NARROW_MIN_HEIGHT_FRACTION = uiConfig.presentation.combatFormationModel.sizing.narrowMinHeightFraction;
// Presentation ratios only; encounter pools still own enemy classification.
const BOSS_SCALE = Object.freeze({ ashheartDragon: 3 });
export function combatSpriteRatio(stature, enemyId) {
  if (stature === 'large') return 1.75;
  if (stature === 'huge') return BOSS_SCALE[enemyId] || 2;
  return 1;
}

// Fit once for the formation. Fitting each actor independently cancels stature
// on cramped screens. Depth is applied to every actor in the same row.
// minHeight (narrow layout, owner 2026-10-04): the shared base is raised so the
// smallest figure reaches it, keeping stature and depth ratios. Each figure then
// answers only to its headroom and its own half of the field, not its cell.
export function fitCombatSprites({ width, height, actors, minHeight = 0 }) {
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
  // Only a side standing in one row can take the floor: a taller front figure
  // would hang its overhead intent across the figures behind it.
  const oneRow = side => {
    const grounds = actors.filter(a => (a.slot.x > width / 2) === side).map(a => a.slot.fitGround ?? a.slot.ground);
    return !grounds.length || Math.max(...grounds) - Math.min(...grounds) < 1;
  };
  const floored = minHeight > 0 && actors.length > 0 && oneRow(true) && oneRow(false);
  if (floored) base = Math.max(base, minHeight / Math.min(...actors.map(a => a.ratio * a.slot.depth)));
  const headroomOf = a => Math.max(1, (a.slot.fitGround ?? a.slot.ground) - a.leading - 6);
  // Floored figures keep their side's column spacing (so overhead intents
  // never stack); the widest figure is what is left of the half after it.
  const isEnemy = a => a.slot.x > width / 2;
  const spreadOf = side => {
    const xs = actors.filter(a => isEnemy(a) === side).map(a => a.slot.x);
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  };
  const spread = { true: spreadOf(true), false: spreadOf(false) };
  const sideWidthOf = a => floored ? Math.max(1, width / 2 - 12 - spread[isEnemy(a)])
    : 2 * Math.max(1, Math.min(a.slot.x - 6, width - a.slot.x - 6));
  // A presentation multiplier (Settings: player / enemy sprite scale, the
  // formation's display scale) grows a figure AFTER the shared fit, so the
  // size order holds. Apply the same fraction of requested growth to everyone
  // when any figure runs out of room. Independent side caps let the player
  // grow while an enemy stayed capped, reversing their intended size order.
  const requestedOf = a => Number.isFinite(a.multiplier) && a.multiplier > 0 ? a.multiplier : 1;
  const heightOf = a => base * a.ratio * a.slot.depth;
  const roomOf = a => Math.min(headroomOf(a) / heightOf(a),
    sideWidthOf(a) / (heightOf(a) * a.visibleWidth / a.visibleHeight));
  const growthRoom = Math.min(1, ...actors.filter(a => requestedOf(a) > 1)
    .map(a => Math.max(0, roomOf(a) - 1) / (requestedOf(a) - 1)));
  const fits = actors.map(a => {
    const requested = requestedOf(a);
    const multiplier = requested <= 1 ? requested : 1 + (requested - 1) * growthRoom;
    const visibleHeight = floored
      ? Math.min(heightOf(a) * multiplier, headroomOf(a), sideWidthOf(a) * a.visibleHeight / a.visibleWidth)
      : heightOf(a) * multiplier;
    const scale = visibleHeight / a.visibleHeight;
    return { id: a.slot.id, scale, visibleHeight, multiplier, x: a.slot.x };
  });
  if (!floored) return fits;
  // Slide each side as one group, so it stays on screen and on its own half.
  for (const side of [true, false]) {
    let lo = -Infinity, hi = Infinity;
    actors.forEach((a, i) => {
      if (isEnemy(a) !== side) return;
      const half = fits[i].scale * a.visibleWidth / 2;
      lo = Math.max(lo, (side ? width / 2 : 6) + half - a.slot.x);
      hi = Math.min(hi, (side ? width - 6 : width / 2) - half - a.slot.x);
    });
    const shift = Math.min(Math.max(0, lo), hi);
    actors.forEach((a, i) => { if (isEnemy(a) === side) fits[i].x = a.slot.x + shift; });
  }
  return fits;
}
