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
// minHeight (narrow layout, owner 2026-10-04): a second fit raises the shared
// base so the smallest figure reaches it. A side takes that lifted fit only if
// it stands in one row (a taller front figure would hang its intent over the
// row behind) and no figure on it comes out smaller than the plain fit.
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
  const isEnemy = a => (a.side ?? a.slot.side) ? (a.side ?? a.slot.side) === 'enemy' : a.slot.x > width / 2;
  const sideOf = enemy => actors.filter(a => isEnemy(a) === enemy);
  const spreadOf = enemy => {
    const xs = sideOf(enemy).map(a => a.slot.x);
    return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  };
  const headroomOf = a => Math.max(1, (a.slot.fitGround ?? a.slot.ground) - a.leading - 6);
  const fit = (base, lifted) => {
    // Lifted figures answer to their half of the field, keeping their side's
    // column spacing (so overhead intents never stack), not to their cell.
    const sideWidthOf = a => lifted ? Math.max(1, width / 2 - 12 - spreadOf(isEnemy(a)))
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
    return actors.map(a => {
      const requested = requestedOf(a);
      const multiplier = requested <= 1 ? requested : 1 + (requested - 1) * growthRoom;
      const visibleHeight = lifted
        ? Math.min(heightOf(a) * multiplier, headroomOf(a), sideWidthOf(a) * a.visibleHeight / a.visibleWidth)
        : heightOf(a) * multiplier;
      return { id: a.slot.id, scale: visibleHeight / a.visibleHeight, visibleHeight, multiplier, x: a.slot.x };
    });
  };
  const plain = fit(base, false);
  // Depth, authored display scales and the one-row phone lift may make a
  // friendly taller than an enemy. Keep every fitted figure at its existing
  // size and grow undersized enemies instead of reducing the player. Artwork
  // may overlap on a cramped field; target controls use separate hit areas.
  const withEnemyHeightFloor = fits => {
    const friendlyHeight = Math.max(0, ...fits.filter((_, i) => !isEnemy(actors[i])).map(f => f.visibleHeight));
    let enlarged = false;
    const result = fits.map((f, i) => {
      const actor = actors[i];
      if (!isEnemy(actor) || f.visibleHeight >= friendlyHeight) return f;
      enlarged = true;
      const scale = friendlyHeight / actor.visibleHeight;
      return { ...f, scale, visibleHeight: friendlyHeight,
        multiplier: f.multiplier * friendlyHeight / f.visibleHeight };
    });
    if (!enlarged) return result;
    const lastGround = Math.max(...actors.map(a => a.slot.ground));
    // Prefer moving the enemy artwork as one group, keeping formation spacing.
    // It may cross the team divider to remain inside the viewport. If the
    // enlarged group cannot fit, keep each figure visible where feasible;
    // independent target controls retain the original distinct slot anchors.
    const enemyIndices = actors.map((a, i) => i).filter(i => isEnemy(actors[i]));
    let lo = -Infinity, hi = Infinity;
    for (const i of enemyIndices) {
      const half = result[i].scale * actors[i].visibleWidth / 2;
      lo = Math.max(lo, 6 + half - result[i].x);
      hi = Math.min(hi, width - 6 - half - result[i].x);
    }
    const shift = Math.max(lo, Math.min(hi, 0));
    for (const i of enemyIndices) {
      const half = result[i].scale * actors[i].visibleWidth / 2;
      // The larger rear-row figure keeps its intent below the HUD/ribbon.
      // The last reserved foot line still protects meters and hand clearance;
      // this is an art anchor, not a change to domain formation cells.
      const ground = Math.min(lastGround,
        Math.max(actors[i].slot.ground, result[i].visibleHeight + actors[i].leading + 6));
      result[i] = { ...result[i], ...(ground > actors[i].slot.ground ? { ground } : {}), x: lo <= hi ? result[i].x + shift
        : half * 2 <= width - 12 ? Math.max(6 + half, Math.min(width - 6 - half, result[i].x)) : width / 2 };
    }
    return result;
  };
  if (!(minHeight > 0) || !actors.length) return withEnemyHeightFloor(plain);
  const raised = fit(Math.max(base, minHeight / Math.min(...actors.map(a => a.ratio * a.slot.depth))), true);
  const fits = plain.map(f => ({ ...f }));
  for (const enemy of [true, false]) {
    const idx = actors.map((a, i) => i).filter(i => isEnemy(actors[i]) === enemy);
    const rows = new Set(idx.map(i => actors[i].slot.row ?? Math.round(actors[i].slot.fitGround ?? actors[i].slot.ground)));
    if (!idx.length || rows.size > 1 || idx.some(i => raised[i].visibleHeight < plain[i].visibleHeight)) continue;
    // Slide the side as one group, so it stays on screen and on its own half.
    let lo = -Infinity, hi = Infinity;
    for (const i of idx) {
      const half = raised[i].scale * actors[i].visibleWidth / 2;
      lo = Math.max(lo, (enemy ? width / 2 : 6) + half - actors[i].slot.x);
      hi = Math.min(hi, (enemy ? width - 6 : width / 2) - half - actors[i].slot.x);
    }
    const shift = Math.min(Math.max(0, lo), hi);
    for (const i of idx) fits[i] = { ...raised[i], x: actors[i].slot.x + shift };
  }
  return withEnemyHeightFloor(fits);
}
