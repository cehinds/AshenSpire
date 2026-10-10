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

export function combatSceneryGround(sizes, actors, fallback) {
  const enemyIds = new Set(actors.filter(actor => actor.side === 'enemy').map(actor => actor.slot.id));
  const grounds = sizes.filter(size => enemyIds.has(size.id) && Number.isFinite(size.ground)).map(size => size.ground);
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
export function alternativeCombatComposition({ sizes, actors, width, height, handTop, handLeft = 0, solo = true }) {
  const enemies = actors.filter(actor => actor.side === 'enemy');
  const enemyFits = sizes.filter(size => enemies.some(actor => actor.slot.id === size.id));
  const center = enemyFits.length ? (Math.min(...enemyFits.map(f => f.x)) + Math.max(...enemyFits.map(f => f.x))) / 2 : width * .55;
  const fitted = sizes.map(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    const player = actor.side === 'player';
    const spacious = height > 300;
    const factor = player ? (solo ? 1.28 : 1) : spacious ? 1 : .8;
    const availablePlayerHeight = player && solo && Number.isFinite(handTop)
      ? Math.max(1, handTop - actor.leading - 32) : Infinity;
    const visibleHeight = Math.min(size.visibleHeight * factor, height * (player ? .8 : .7), availablePlayerHeight);
    const ratio = visibleHeight / size.visibleHeight;
    const halfWidth = actor.visibleWidth * size.scale * ratio / 2;
    const proposedX = player ? (solo ? Math.max(size.x + width * .035, handLeft + halfWidth) : size.x)
      : (size.x - center) * (spacious ? 1.3 : 1) + width * (spacious ? .66 : .68);
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, proposedX));
    const ground = player && solo && Number.isFinite(handTop)
      ? Math.max(visibleHeight + actor.leading + 6, handTop - 26)
      : Math.max(visibleHeight + actor.leading + 6, player ? (size.ground ?? actor.slot.ground)
        : spacious ? height * .48 + ((size.ground ?? actor.slot.ground) - height * .9) * .25
          : (size.ground ?? actor.slot.ground) - height * .07);
    return { ...size, x, ground, visibleHeight, scale: size.scale * ratio, multiplier: size.multiplier * ratio,
      separationHalf: halfWidth, separationSide: player ? 'player' : 'enemy' };
  });
  // A short landscape strip has no room above the row for spread overheads;
  // its depth ranks keep their packed overhead lanes instead.
  return width <= height * 2 ? separateEnemies(fitted, width) : fitted.map(({ separationHalf, separationSide, ...fit }) => fit);
}

// Depth ranks share a formation column, so a phone can stack one enemy
// wholly behind another. Sweep enemies apart in x order until their art no
// longer overlaps (their overhead intent and HP need the room); enemies
// already apart never move. The row stays between the player's centre line
// and the stage edge; when it cannot fit there, the enemies share the
// overlap evenly rather than crowding onto the player.
function separateEnemies(fits, width) {
  const enemies = fits.filter(fit => fit.separationSide === 'enemy').sort((a, b) => a.x - b.x);
  const players = fits.filter(fit => fit.separationSide === 'player');
  const left = Math.max(6, ...players.map(fit => fit.x));
  const right = width - 6;
  if (enemies.length) {
    const pairs = enemies.slice(1).reduce((sum, cur, i) => sum + enemies[i].separationHalf + cur.separationHalf, 0);
    const room = right - left - enemies[0].separationHalf - enemies.at(-1).separationHalf;
    const spacing = pairs > 0 && room < pairs ? Math.max(.4, room / pairs) : 1;
    enemies[0].x = Math.max(enemies[0].x, left + enemies[0].separationHalf);
    for (let i = 1; i < enemies.length; i++) {
      const prev = enemies[i - 1], cur = enemies[i];
      cur.x = Math.max(cur.x, prev.x + (prev.separationHalf + cur.separationHalf) * spacing);
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const next = enemies[i + 1];
      const limit = next ? next.x - (next.separationHalf + enemies[i].separationHalf) * spacing : right - enemies[i].separationHalf;
      enemies[i].x = Math.min(enemies[i].x, limit);
    }
  }
  return fits.map(({ separationHalf, separationSide, ...fit }) => fit);
}
