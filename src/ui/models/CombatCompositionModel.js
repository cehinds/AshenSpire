import { uiConfig } from '../../config/generated/ui.js';
import { separateRow } from './CombatViewportSizeModel.js';

// Presentation transforms after the shared fit. The foreground player and
// distant enemy group do not change gameplay formation addresses or stature.
export function stableHandAnchor(previous, layoutKey, { left, top } = {}) {
  if (previous?.key === layoutKey) return previous;
  if (!Number.isFinite(top)) return null;
  return { key: layoutKey, left: Number.isFinite(left) ? left : 0, top };
}

// Text, selection and intent changes can repack controls without refitting the
// artwork. Only layout, presentation settings, art geometry or formation changes
// invalidate the settled body sizes and foot positions. The measured header
// keepout is layout geometry too, including captions outside its border box.
export function combatArtworkKey({ width, height, zoom, wide = false, presentation, handAnchor, ceiling = 0, actors }) {
  return JSON.stringify([width, height, zoom, wide, presentation, handAnchor, ceiling, actors.map(actor => [
    actor.slot.id, actor.slot.cell, actor.slot.x, actor.slot.ground, actor.slot.fitGround,
    actor.slot.depth, actor.slot.artWidth, actor.ratio, actor.multiplier, actor.art,
    actor.boxHeight, actor.visibleHeight, actor.visibleWidth, actor.edgeWidth, actor.footOffset, actor.artLeading,
  ])], (_key, value) => typeof value === 'number' ? Math.round(value * 1000) / 1000 : value);
}

export function stableCombatArtwork(previous, key, sizes) {
  return previous?.key === key ? previous : { key, sizes: sizes.map(size => ({ ...size })) };
}

// The line the backdrop camera frames its ground anchor on. A fit may carry
// its own `sceneryGround` (a short portrait phone keeps the near-row framing,
// with its horizon and landmark in view, while its enemies stand further back).
export function combatSceneryGround(sizes, actors, fallback) {
  const enemyIds = new Set(actors.filter(actor => actor.side === 'enemy').map(actor => actor.slot.id));
  const grounds = sizes.filter(size => enemyIds.has(size.id) && Number.isFinite(size.sceneryGround ?? size.ground))
    .map(size => size.sceneryGround ?? size.ground);
  return grounds.length ? Math.min(...grounds) : fallback;
}

// The farthest-back enemy foot line, which the backdrop keeps on its floor.
export function combatStandingGround(sizes, actors, fallback) {
  const enemyIds = new Set(actors.filter(actor => actor.side === 'enemy').map(actor => actor.slot.id));
  const grounds = sizes.filter(size => enemyIds.has(size.id) && Number.isFinite(size.standingGround ?? size.ground))
    .map(size => size.standingGround ?? size.ground);
  return grounds.length ? Math.min(...grounds) : fallback;
}

// Attach the foreground player's feet to the battlefield edge, above the
// health strip and card-band tools. Selection never changes this resting fit.
// Share of the field height a short portrait phone lifts its enemies by, so
// their figures stand a little further back. Intents and HP plates stay under
// the turn ribbon (the headroom clamp), so the lift shortens the figure-to-plate gap.
export const SHORT_PHONE_ENEMY_LIFT = .05;

// Fields taller than 300 px (tablets and larger) spread their enemies across
// the field's width about SPACIOUS_ROW_CENTRE. TODO(config): move these to the
// combat layout config.
export const SPACIOUS_ROW_CENTRE = .66;
const SPACIOUS_SPREAD = 1.3;
// Room the intent and HP plates need under the turn ribbon, above each figure.
export const SPACIOUS_RIBBON_RESERVE = 30;

// The perspective grid is the live path. The legacy composition below is kept
// for any caller that passes no perspectiveGrid; every form factor takes the
// same placement.
export function alternativeCombatComposition(options) {
  return options.perspectiveGrid
    ? perspectiveGridComposition(options)
    : legacyAlternativeComposition(options);
}

// The perspective grid places every body on its cell's foot anchor: the
// sprite's feet stand on the cell's shadow. The shared fit already sized each
// body to its lane and its headroom; composition only keeps it in the field.
function perspectiveGridComposition({ sizes, actors, width, handTop, solo = true }) {
  // Once the sizing rule slid any figure to clear a neighbour, its x for every
  // figure is authoritative: the cell footprint clamp below would pull a
  // neighbour back across the cleared gap.
  const trustSizeX = sizes.some(size => size.slid === true);
  const placed = sizes.map(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    // The selected pilot's wide blade/cape uses the existing screen-edge clamp.
    // Keep idle fitting, uniform pose scale, and domain cell addresses intact.
    const halfWidth = actor.visibleWidth * size.scale / 2;
    // The sizing rule may have slid a figure sideways to clear a neighbour
    // (size.x); the foot inset then only keeps the ground inside the cell.
    const moved = (size.slid === true || trustSizeX) && Number.isFinite(size.x);
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, moved ? size.x : actor.slot.x));
    // Owner 2026-11-06: every figure's feet (its shadow's centre) stand inside the DRAWN cell, footInCellFraction of
    // the cell's height above its bottom line, never on a line. The drawn cell is the slot's own box.
    // The party keeps its own x (its fit already cleared its neighbours); only the ground moves.
    const shadowHeight = (actor.boxHeight ?? actor.visibleHeight ?? 150) * size.scale * .08;
    const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
    const box = actor.slot.box;
    const wanted = box ? { ...actor.slot, ground: box.top + box.height * (1 - grid.footInCellFraction) } : actor.slot;
    const inner = box ? insetPerspectiveFootprint(wanted, { width: halfWidth * 2, height: shadowHeight }) : null;
    const stripFits = inner && box.height >= shadowHeight + 2 * grid.footprintInsetPx;
    // A strip too short for the shadow plus both insets (a landscape phone's 9px strip) stands the foot at its middle, so it stays inside.
    const ground = inner ? (stripFits ? inner.ground : box.top + box.height / 2) : actor.slot.ground;
    const foot = inner ? (actor.side === 'enemy' ? { x: inner.x, ground } : { x, ground }) : { x, ground };
    // A lone player's feet never stand inside the hand area: the ground line
    // moves up to the hand's top edge (the fit already sized the body for it).
    if (actor.side === 'player' && solo && Number.isFinite(handTop)) foot.ground = Math.min(foot.ground, handTop);
    return { ...size, ...foot, ...(moved ? { x } : {}) };
  });
  // The footprint clamp can pull two neighbours of one band back together;
  // clear them again on the final positions, as the fit did.
  const bands = new Map();
  placed.forEach(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    const key = `${actor.side}:${actor.slot.visualBand ?? actor.slot.row ?? Math.round(actor.slot.ground / 10)}`;
    bands.set(key, [...(bands.get(key) || []), { size, x: size.x, width: actor.visibleWidth * size.scale }]);
  });
  for (const band of bands.values()) {
    if (band.length < 2) continue;
    separateRow(band, width);
    for (const row of band) row.size.x = row.x;
  }
  return placed;
}

// Constrain the shadow's complete bounding envelope inside its skewed cell.
// The active kit draws an 8%-high ellipse centred on the sprite's foot.
// Its full bounding envelope, rather than only its centre, owns this cell.
// Configured clearance is in physical field pixels, independent of CSS zoom.
// Moving the anchor never refits artwork.
export function insetPerspectiveFootprint(slot, { width, height = 12,
  inset = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.footprintInsetPx }) {
  const box = slot.box;
  if (!box) return { x: slot.x, ground: slot.ground };
  const above = height / 2, below = height / 2;
  const ground = Math.max(box.top + above + inset,
    Math.min(box.top + box.height - below - inset, slot.ground));
  const skew = box.skew || 0;
  const centreAt = y => box.left + box.width / 2 + skew * (box.top + box.height / 2 - y);
  const half = width / 2 + inset;
  const low = Math.max(centreAt(ground - above), centreAt(ground + below)) - box.width / 2 + half;
  const high = Math.min(centreAt(ground - above), centreAt(ground + below)) + box.width / 2 - half;
  // Extremely wide custom art may exceed a cell. Preserve its authored size
  // and centre it rather than silently shrinking it to satisfy presentation.
  return { x: low <= high ? Math.max(low, Math.min(high, slot.x)) : (low + high) / 2, ground,
    footprintFits: low <= high && box.height >= above + below + 2 * inset };
}

// The pre-grid composition: a spacious field (above 300 px) spreads its back
// row; a shorter one keeps the phone's depth rows.
function legacyAlternativeComposition({ sizes, actors, width, height, handTop, handLeft = 0, solo = true }) {
  const enemies = actors.filter(actor => actor.side === 'enemy');
  const enemyFits = sizes.filter(size => enemies.some(actor => actor.slot.id === size.id));
  const center = enemyFits.length ? (Math.min(...enemyFits.map(f => f.x)) + Math.max(...enemyFits.map(f => f.x))) / 2 : width * .55;
  const spacious = height > 300;
  const spread = spacious ? SPACIOUS_SPREAD : 1;
  const fitted = sizes.map(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    const player = actor.side === 'player';
    // Placement only: size is the viewport rule's alone (CombatViewportSizeModel).
    const visibleHeight = size.visibleHeight;
    const halfWidth = actor.visibleWidth * size.scale / 2;
    const proposedX = player ? (solo ? Math.max(size.x + width * .035, handLeft + halfWidth) : size.x)
      : (size.x - center) * spread + width * (spacious ? SPACIOUS_ROW_CENTRE : .68);
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, proposedX));
    // Enemies stand back on the floor, about half-way up the field. A short
    // portrait field (a phone with browser bars) keeps that depth too, rather
    // than dropping its enemies onto the player's foot line; the clamp keeps
    // their intent and HP clear under the ribbon. Only a short landscape strip
    // (width > 2 x height) keeps the near foot line for its stacked lanes.
    const backRow = spacious || width <= height * 2;
    const nearRow = Math.max(visibleHeight + actor.leading + 6, (size.ground ?? actor.slot.ground) - height * .07);
    // A short portrait phone lifts its back row a little more (SHORT_PHONE_ENEMY_LIFT,
    // a share of the field height). Its standing line stays on the unlifted
    // depth, so the backdrop camera frames the same horizon as before.
    const backGround = height * .48 + ((size.ground ?? actor.slot.ground) - height * .9) * .25;
    const lift = !player && backRow && !spacious ? height * SHORT_PHONE_ENEMY_LIFT : 0;
    const ground = player && solo && Number.isFinite(handTop)
      ? Math.max(visibleHeight + actor.leading + 6, handTop - 26)
      : Math.max(visibleHeight + actor.leading + 6 - lift, player ? (size.ground ?? actor.slot.ground)
        : backRow ? backGround - lift
          : nearRow);
    // A short portrait field frames its backdrop on the near row, as it did
    // before its enemies moved back, so the horizon and landmark stay in view;
    // the backdrop then keeps the back-row feet on its floor.
    const sceneryGround = !player && backRow && !spacious ? nearRow : undefined;
    const standingGround = lift ? backGround : undefined;
    return { ...size, x, ground, visibleHeight, scale: size.scale, multiplier: size.multiplier,
      ...(sceneryGround === undefined ? {} : { sceneryGround }),
      ...(standingGround === undefined ? {} : { standingGround }),
      separationHalf: halfWidth, separationSide: player ? 'player' : 'enemy' };
  });
  return fitted;
}
