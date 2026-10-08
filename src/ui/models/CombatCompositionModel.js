// Approved option C. These are presentation transforms after the shared art
// fit, so enemy stature and formation addresses remain gameplay facts.
export function combatComposition({ sizes, actors, width, height, handTop, handLeft = 0, solo = true }) {
  const enemies = actors.filter(actor => actor.side === 'enemy');
  const enemyFits = sizes.filter(size => enemies.some(actor => actor.slot.id === size.id));
  const center = enemyFits.length ? (Math.min(...enemyFits.map(f => f.x)) + Math.max(...enemyFits.map(f => f.x))) / 2 : width * .55;
  return sizes.map(size => {
    const actor = actors.find(actor => actor.slot.id === size.id);
    const player = actor.side === 'player';
    const factor = player ? (solo ? 1.28 : 1) : .8;
    const visibleHeight = Math.min(size.visibleHeight * factor, height * (player ? .8 : .7));
    const ratio = visibleHeight / size.visibleHeight;
    const halfWidth = actor.visibleWidth * size.scale * ratio / 2;
    const proposedX = player ? (solo ? Math.max(size.x + width * .035, handLeft + halfWidth * .65) : size.x) : size.x - center + width * .55;
    const x = Math.max(halfWidth + 6, Math.min(width - halfWidth - 6, proposedX));
    const ground = player && solo && Number.isFinite(handTop)
      ? handTop + visibleHeight * .5
      : Math.max(visibleHeight + actor.leading + 6, (size.ground ?? actor.slot.ground) - (player ? 0 : height * .07));
    return { ...size, x, ground, visibleHeight, scale: size.scale * ratio, multiplier: size.multiplier * ratio };
  });
}
