// The alternative camera changes presentation only. Cell IDs and occupancy
// remain the same, including the movement grid's vacant destinations.
export function alternativeFormation(plan, width, height, narrow) {
  const columns = plan.columns || 2, rows = plan.rows || 3;
  const place = cell => {
    const enemy = cell.side ? cell.side === 'enemy' : Number(cell.cell.slice(1)) > columns;
    const column = cell.column / Math.max(1, columns - 1);
    const row = cell.row / Math.max(1, rows - 1);
    const x = enemy ? (narrow ? .59 + column * .25 : .60 + column * .23)
      : (narrow ? .20 + column * .08 : .23 + column * .07);
    const ground = height * ((enemy ? .82 : .92) + (row - .5) * (narrow ? .16 : .12));
    return { ...cell, side: enemy ? 'enemy' : 'player', x: width * x,
      ground, fitGround: ground, width: Math.min(width * (narrow ? .22 : .13), 180),
      artWidth: width * (narrow ? .28 : .30), depth: .96 + row * .08 };
  };
  plan.cells = plan.cells.map(place);
  plan.slots = plan.slots.map(place);
  plan.ground = Math.max(...plan.cells.map(c => c.ground));
  return plan;
}

export function fitAlternativeSprites({ width, height, actors, narrow }) {
  return actors.filter(a => a.visibleHeight > 0 && a.visibleWidth > 0).map(a => {
    const sideCount = actors.filter(b => b.side === a.side).length;
    const lowSilhouette = ['blightHound','stitchedHound','lanternMoth','graveWisp','stitchCrab','cinderMantis'].includes(a.enemyId);
    const ratio = a.side === 'player' ? 1 : lowSilhouette ? .50 : Math.min(1.3, a.ratio);
    const requested = height * (narrow ? .46 : .73) * ratio * a.slot.depth;
    const widthLimit = width * (narrow ? (sideCount > 2 ? .24 : .34) : (sideCount > 2 ? .20 : .31));
    const visibleHeight = Math.max(1, Math.min(requested * Math.min(1.25, a.multiplier || 1),
      a.slot.ground - a.leading - 6, widthLimit * a.visibleHeight / a.visibleWidth,
      2 * Math.min(a.slot.x - 5, width - a.slot.x - 5) * a.visibleHeight / a.visibleWidth));
    return { id:a.slot.id, scale:visibleHeight/a.visibleHeight, visibleHeight, multiplier:1, x:a.slot.x };
  });
}
