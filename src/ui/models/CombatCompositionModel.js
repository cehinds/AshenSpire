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
export function combatArtworkKey({ width, height, zoom, presentation, appearance, handAnchor, actors }) {
  return JSON.stringify([width, height, zoom, presentation, appearance, handAnchor, actors.map(actor => [
    actor.slot.id, actor.slot.cell, actor.slot.x, actor.slot.ground, actor.slot.fitGround,
    actor.slot.depth, actor.slot.artWidth, actor.ratio, actor.multiplier, actor.art,
    actor.boxHeight, actor.visibleHeight, actor.visibleWidth, actor.footOffset,
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

// The perspective grid places every body on its cell's foot anchor: the
// sprite's feet stand on the cell's shadow. The shared fit already sized each
// body to its lane and its headroom; composition only keeps it in the field.
export function alternativeCombatComposition({ sizes, actors, width }) {
  const actorOf = size => actors.find(actor => actor.slot.id === size.id);
  const need = size => Math.max(0, size.visibleHeight + actorOf(size).leading + 6 - actorOf(size).slot.ground);
  // A field too short for a body and its overhead stack (a ~130px landscape
  // strip) must lower the feet. Every enemy drops by the same amount, so the
  // ranks and lanes keep their spacing instead of collapsing onto one line.
  const enemyDrop = Math.max(0, ...sizes.filter(size => actorOf(size).side === 'enemy').map(need));
  return sizes.map(size => {
    const actor = actorOf(size);
    const halfWidth = actor.visibleWidth * size.scale / 2;
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, actor.slot.x));
    const ground = actor.slot.ground + (actor.side === 'enemy' ? enemyDrop : need(size));
    return { ...size, x, ground };
  });
}
