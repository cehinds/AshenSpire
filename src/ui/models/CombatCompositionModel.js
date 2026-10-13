// Presentation transforms after the shared fit. The foreground player and
// distant enemy group do not change gameplay formation addresses or stature.
export function stableHandAnchor(previous, layoutKey, { left, top } = {}) {
  if (previous?.key === layoutKey) return previous;
  if (!Number.isFinite(top)) return null;
  return { key: layoutKey, left: Number.isFinite(left) ? left : 0, top };
}

// Text, selection and intent changes can repack controls without refitting the
// artwork. Only layout, presentation settings, art geometry or formation changes
// invalidate the settled body sizes and foot positions.
export function combatArtworkKey({ width, height, zoom, wide = false, presentation, appearance, handAnchor, actors }) {
  return JSON.stringify([width, height, zoom, wide, presentation, appearance, handAnchor, actors.map(actor => [
    actor.slot.id, actor.slot.cell, actor.slot.x, actor.slot.ground, actor.slot.fitGround,
    actor.slot.depth, actor.slot.artWidth, actor.ratio, actor.multiplier, actor.art,
    actor.boxHeight, actor.visibleHeight, actor.visibleWidth, actor.edgeWidth, actor.footOffset,
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

export function combatComposition({ sizes, actors, width, height, handTop, solo = true }) {
  const enemies = actors.filter(actor => actor.side === 'enemy');
  const enemyFits = sizes.filter(size => enemies.some(actor => actor.slot.id === size.id));
  const center = enemyFits.length ? (Math.min(...enemyFits.map(f => f.x)) + Math.max(...enemyFits.map(f => f.x))) / 2 : width * .55;
  // Full-grid fitting can leave a two-enemy encounter as thumbnails. Lift the
  // enemy group uniformly, preserving its relative stature and depth ratios.
  const enemyFloor = Math.min(120, width * .17, Math.max(64, height * .26));
  const enemyFactor = Math.max(.5, enemyFloor / Math.min(...enemyFits.map(f => f.visibleHeight)));
  return sizes.map(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    const player = actor.side === 'player';
    const factor = player ? (solo ? Math.max(1.28, Math.min(240, width * .32, height * .6) / size.visibleHeight) : 1) : enemyFactor;
    const visibleHeight = Math.min(size.visibleHeight * factor, height * (player ? .8 : .7));
    const ratio = visibleHeight / size.visibleHeight;
    const halfWidth = actor.visibleWidth * size.scale * ratio / 2;
    const proposedX = player ? (solo ? width * .32 : size.x) : (size.x - center) * .72 + width * .76;
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, proposedX));
    const ground = player && solo && Number.isFinite(handTop)
      ? handTop + visibleHeight * .12
      : Math.max(visibleHeight + actor.leading + 6, player ? (size.ground ?? actor.slot.ground) : height * .34);
    return { ...size, x, ground, visibleHeight, scale: size.scale * ratio, multiplier: size.multiplier * ratio };
  });
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

// The perspective grid is the live path (the default appearance). The legacy
// composition below is kept for the classic-field tests and any caller that
// passes no perspectiveGrid; every form factor takes the same placement.
export function alternativeCombatComposition(options) {
  return options.perspectiveGrid
    ? perspectiveGridComposition(options)
    : legacyAlternativeComposition(options);
}

// The perspective grid places every body on its cell's foot anchor: the
// sprite's feet stand on the cell's shadow. The shared fit already sized each
// body to its lane and its headroom; composition only keeps it in the field.
function perspectiveGridComposition({ sizes, actors, width }) {
  return sizes.map(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    // The selected pilot's wide blade/cape uses the existing screen-edge clamp.
    // Keep idle fitting, uniform pose scale, and domain cell addresses intact.
    const halfWidth = Math.max(actor.visibleWidth, actor.edgeWidth || 0) * size.scale / 2;
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, actor.slot.x));
    return { ...size, x, ground: actor.slot.ground };
  });
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
    const factor = player ? (solo ? 1.28 : 1) : spacious ? 1 : .8;
    const availablePlayerHeight = player && solo && Number.isFinite(handTop)
      ? Math.max(1, handTop - actor.leading - 32) : Infinity;
    const visibleHeight = Math.min(size.visibleHeight * factor, height * (player ? .8 : .7), availablePlayerHeight);
    const ratio = visibleHeight / size.visibleHeight;
    const halfWidth = actor.visibleWidth * size.scale * ratio / 2;
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
    return { ...size, x, ground, visibleHeight, scale: size.scale * ratio, multiplier: size.multiplier * ratio,
      ...(sceneryGround === undefined ? {} : { sceneryGround }),
      ...(standingGround === undefined ? {} : { standingGround }),
      separationHalf: halfWidth, separationSide: player ? 'player' : 'enemy' };
  });
  return fitted;
}
