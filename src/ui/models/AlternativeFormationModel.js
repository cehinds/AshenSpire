import { uiConfig } from '../../config/generated/ui.js';

const GRID = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;

// Spread k actors evenly over a rank of `lanes`: one stands in the middle
// lane, two take the outer lanes, three fill the rank.
export function perspectiveLanePattern(count, lanes) {
  if (count <= 0) return [];
  if (count >= lanes) return Array.from({ length: lanes }, (_, i) => i);
  if (count === 1) return [Math.floor((lanes - 1) / 2)];
  return Array.from({ length: count }, (_, i) => Math.round(i * (lanes - 1) / (count - 1)));
}

// The alternative camera changes presentation only. It lays one uniform grid
// over the field: every cell is the same parallelogram, and each cell's
// foot anchor (its shadow) is where the sprite's feet stand. Enemies fill the
// back rank first, then the front rank; the player's party shares one rank.
// Cell IDs stay gameplay addresses: column = depth (outer = back), row = lane.
export function alternativeFormation(plan, width, height, narrow) {
  // A short strip (landscape phone) has no room for depth above the bodies'
  // overhead controls; its ranks sit low and close together.
  const profile = height < GRID.shortBelowPx ? GRID.short : narrow ? GRID.narrow : GRID.wide;
  const lanes = plan.rows || 3;
  // The grid is sheared: every row slides right in proportion to its height
  // above the party's baseline, so lanes run on a diagonal and cells are
  // equal parallelograms. The lane width leaves room for the full shear.
  // The party's name and meters sit below its feet; on a short field the
  // whole grid rises together so they stay inside the field and no rank
  // overlaps another.
  const playerFoot = height * profile.playerRowHeight * GRID.footFraction.player;
  const lift = Math.max(0, height * profile.playerTop + playerFoot - (height - GRID.playerBelowFootPx));
  const baseline = height * (profile.playerTop + profile.playerRowHeight) - lift;
  const shear = y => profile.skew * (baseline - y);
  const laneWidth = (width * (profile.right - profile.left) - shear(height * profile.enemyTop - lift)) / lanes;
  const place = cell => {
    const enemy = cell.side ? cell.side === 'enemy' : Number(cell.cell.slice(1)) > plan.columns;
    // Enemy column 0 is the outermost (back) column; the player's front
    // column has no perspective rank.
    if (!enemy && cell.column > 0) return null;
    const rank = enemy ? (cell.column === 0 ? 0 : 1) : 0;
    const lane = enemy ? cell.row : lanes - 1 - cell.row;
    const rowHeight = height * (enemy ? profile.enemyRowHeight : profile.playerRowHeight);
    const foot = rowHeight * (enemy ? GRID.footFraction.enemy : GRID.footFraction.player);
    const top = height * (enemy ? profile.enemyTop : profile.playerTop) + rank * rowHeight - lift;
    const ground = top + foot;
    const laneLeft = width * profile.left + lane * laneWidth;
    // `box` is the cell's unsheared rectangle at its mid-height; `skew` shears
    // it about that centre line into the drawn parallelogram.
    const left = laneLeft + shear(top + rowHeight / 2);
    return { ...cell, side: enemy ? 'enemy' : 'player', lane, rank,
      formationRow: enemy && rank === 0 ? 'back-row' : 'front-row',
      x: laneLeft + laneWidth / 2 + shear(ground), ground, fitGround: ground,
      box: { left, top, width: laneWidth, height: rowHeight, skew: profile.skew },
      width: Math.min(laneWidth * GRID.bodyWidthFraction, GRID.bodyWidthMaxPx),
      artWidth: laneWidth, depth: enemy ? (rank === 0 ? GRID.depth.back : GRID.depth.front) : GRID.depth.player,
      layer: enemy ? rank : 2 };
  };
  plan.cells = plan.cells.map(place).filter(Boolean);
  const cellAt = (side, rank, lane) => plan.cells.find(c => c.side === side && c.rank === rank && c.lane === lane);
  const enemies = plan.slots.filter(slot => slot.side === 'enemy');
  const friends = plan.slots.filter(slot => slot.side !== 'enemy');
  // Back rank first, spread across the lanes; the remainder fills the front.
  const back = Math.min(enemies.length, lanes);
  const enemyCells = [...perspectiveLanePattern(back, lanes).map(lane => cellAt('enemy', 0, lane)),
    ...perspectiveLanePattern(enemies.length - back, lanes).map(lane => cellAt('enemy', 1, lane))];
  // The lead player keeps the lane of their gameplay cell; others fill the rest.
  const lead = friends.length ? lanes - 1 - friends[0].row : 0;
  const friendLanes = [lead, ...Array.from({ length: lanes }, (_, i) => i).filter(i => i !== lead)];
  plan.slots = [
    ...friends.map((slot, i) => ({ ...cellAt('player', 0, friendLanes[i % lanes]), id: slot.id })),
    ...enemies.map((slot, i) => ({ ...enemyCells[i], id: slot.id })),
  ];
  plan.ground = Math.max(...plan.cells.map(c => c.ground));
  return plan;
}

export function fitAlternativeSprites({ width, height, actors, narrow }) {
  return actors.filter(a => a.visibleHeight > 0 && a.visibleWidth > 0).map(a => {
    const sideCount = actors.filter(b => b.side === a.side).length;
    const lowSilhouette = ['blightHound','stitchedHound','lanternMoth','graveWisp','stitchCrab','cinderMantis'].includes(a.enemyId);
    const ratio = a.side === 'player' ? 1 : lowSilhouette ? .50 : Math.min(1.3, a.ratio);
    const requested = height * (narrow ? .46 : .73) * ratio * a.slot.depth;
    const widthLimit = Math.min(width * (narrow ? (sideCount > 2 ? .24 : .34) : (sideCount > 2 ? .20 : .31)),
      a.slot.artWidth ? a.slot.artWidth * .96 : Infinity);
    const visibleHeight = Math.max(1, Math.min(requested * Math.min(1.25, a.multiplier || 1),
      a.slot.ground - a.leading - 6, widthLimit * a.visibleHeight / a.visibleWidth,
      2 * Math.min(a.slot.x - 5, width - a.slot.x - 5) * a.visibleHeight / a.visibleWidth));
    return { id:a.slot.id, scale:visibleHeight/a.visibleHeight, visibleHeight, multiplier:1, x:a.slot.x };
  });
}

// True when a field-space point lies inside a perspective cell's parallelogram.
export function perspectiveCellContains(box, x, y) {
  if (y < box.top || y > box.top + box.height) return false;
  const centre = box.left + box.width / 2 + (box.skew || 0) * (box.top + box.height / 2 - y);
  return Math.abs(x - centre) <= box.width / 2;
}
