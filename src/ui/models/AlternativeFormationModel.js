import { FORMATION_ROWS, playerFormationCell, perspectiveEnemyCellOrder } from '../../model/formationLayout.js';
import { uiConfig } from '../../config/generated/ui.js';

const GRID = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;

export function validatePerspectiveGrid(grid) {
  const ids = ['enemy-back','enemy-front','extra-combatants','player'];
  if (!Array.isArray(grid.bands) || grid.bands.length !== ids.length
    || grid.bands.some((band, i) => band.id !== ids[i] || band.index !== i
      || ![band.anchor?.x, band.anchor?.y].every(n => Number.isFinite(n) && n > 0 && n < 1)
      || !(band.depth > 0) || !Number.isFinite(band.layer))) throw new Error('Invalid perspective visual bands');
  for (const key of ['wide','narrow','short', ...Object.keys(grid.profiles || {}).map(key => `profiles.${key}`)]) {
    const p = key.startsWith('profiles.') ? grid.profiles[key.slice(9)] : grid[key];
    if (![p?.left,p?.right,p?.top,p?.rowHeight,p?.skew].every(Number.isFinite)
      || p.left < 0 || p.right > 1 || p.left >= p.right || p.top < 0 || p.rowHeight <= 0
      || p.top + p.rowHeight * ids.length > 1 || p.skew < 0) throw new Error(`Invalid perspective ${key} profile`);
  }
  if (!Number.isFinite(grid.footprintInsetPx) || grid.footprintInsetPx < 0) throw new Error('Invalid perspective footprint clearance');
  if (!(grid.playerArtworkScale > 0) || !(grid.miniHudScale > 0) || !(grid.enemyMiniHudScale > 0)) throw new Error('Invalid perspective figure/HUD scale');
  return grid;
}
validatePerspectiveGrid(GRID);


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
export function alternativeFormation(plan, width, height, narrow, presentation = {}) {
  // A short strip (landscape phone) has no room for depth above the bodies'
  // overhead controls; its ranks sit low and close together.
  const formFactor = presentation.formFactor || (narrow ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop');
  const profile = height < GRID.shortBelowPx ? GRID.short : GRID.profiles?.[formFactor] || (narrow ? GRID.narrow : GRID.wide);
  const lanes = plan.rows || 3;
  // The grid is sheared: every row slides right in proportion to its height
  // above the party's baseline, so lanes run on a diagonal and cells are
  // equal parallelograms. The lane width leaves room for the full shear.
  // The party's name and meters sit below its feet; on a short field the
  // whole grid rises together so they stay inside the field and no rank
  // overlaps another.
  const rowHeight = height * profile.rowHeight;
  const baseline = height * (profile.top + 4 * profile.rowHeight);
  const shear = y => profile.skew * (baseline - y);
  const laneWidth = Math.max(1, (width * (profile.right - profile.left)
    - shear(height * profile.top)) / lanes);
  const place = cell => {
    const enemy = cell.side ? cell.side === 'enemy' : Number(cell.cell.slice(1)) > plan.columns;
    if (!enemy && cell.column > 0) return null;
    const rank = enemy ? Math.min(2, cell.column) : 0;
    const role = enemy ? ['enemy-back','enemy-front','extra'][rank] : 'player';
    const band = GRID.bands.find(b => b.id === (role === 'extra' ? 'extra-combatants' : role));
    const lane = enemy ? cell.row : lanes - 1 - cell.row;
    const top = height * profile.top + band.index * rowHeight;
    const ground = top + band.anchor.y * rowHeight;
    const laneLeft = width * profile.left + lane * laneWidth;
    const left = laneLeft + shear(top + rowHeight / 2);
    return { ...cell, side: enemy ? 'enemy' : 'player', lane, rank, visualBand: 'ABCD'[band.index], formationRole: role,
      formationRow: enemy && rank === 0 ? 'back-row' : 'front-row',
      x: laneLeft + band.anchor.x * laneWidth + shear(ground), ground, fitGround: ground,
      box: { left, top, width: laneWidth, height: rowHeight, skew: profile.skew },
      width: Math.min(laneWidth * GRID.bodyWidthFraction, GRID.bodyWidthMaxPx),
      artWidth: laneWidth, miniHudLeft: left + profile.skew * rowHeight / 2 + GRID.miniHudInsetPx,
      miniHudWidth: laneWidth - 2 * GRID.miniHudInsetPx, miniHudTop: top, depth: band.depth, layer: band.layer };
  };
  plan.cells = plan.cells.map(place).filter(Boolean);
  // Display the full four-band lattice even when Core forbids extra-row
  // occupancy. Visual-only cells never enter the gameplay/targeting cell map.
  const extraVisualCells = Array.from({ length: lanes }, (_, row) => ({ cell: `${FORMATION_ROWS[row]}5`, row, column: 2, side: 'enemy', visualOnly: true }))
    .filter(cell => !plan.cells.some(existing => existing.cell === cell.cell)).map(place);
  plan.visualCells = [...plan.cells, ...extraVisualCells];
  const cellAt = (side, rank, lane) => plan.cells.find(c => c.side === side && c.rank === rank && c.lane === lane);
  const enemies = plan.slots.filter(slot => slot.side === 'enemy');
  const friends = plan.slots.filter(slot => slot.side !== 'enemy');
  // Renderer fallback and the engine use the same default address order.
  const enemyCells = perspectiveEnemyCellOrder({ rows: lanes, extraCells: plan.cells.filter(c => c.formationRole === 'extra') })
    .map(address => plan.cells.find(cell => cell.side === 'enemy' && cell.cell === address)).filter(Boolean);
  // The lead player keeps the lane of their gameplay cell; others fill the rest.
  const lead = friends.length ? lanes - 1 - friends[0].row : 0;
  const friendLanes = [lead, ...Array.from({ length: lanes }, (_, i) => i).filter(i => i !== lead)];
  plan.slots = [
    ...friends.map((slot, i) => ({ ...cellAt('player', 0, friendLanes[i % lanes]), id: slot.id })),
    // Past the grid's capacity (12 enemy cells at six lanes) an enemy shares an
    // occupied cell rather than losing its geometry.
    ...enemies.map((slot, i) => ({ ...(enemyCells[i] ?? enemyCells[i % enemyCells.length]), id: slot.id })),
  ];
  if (presentation.formationOccupancy?.length) {
    const dimensions = { columns: plan.columns, rows: plan.rows, perspective: true };
    const occupied = new Map(presentation.formationOccupancy.map(actor => [actor.id,
      actor.side === 'player' ? playerFormationCell(actor.cell, dimensions) : actor.cell]));
    plan.slots = plan.slots.map(slot => {
      const cell = plan.cells.find(cell => cell.cell === occupied.get(slot.id) && cell.side === slot.side);
      return cell ? { ...cell, id: slot.id } : slot;
    });
  }
  // All four bands occupy the same space whether extra occupancy is enabled or not.
  plan.visualBands = GRID.bands.map(band => ({ ...band, top: height * profile.top + band.index * rowHeight, height: rowHeight }));
  plan.ground = Math.max(...plan.cells.map(c => c.ground));
  return plan;
}

const LOW_SILHOUETTES = ['blightHound', 'stitchedHound', 'lanternMoth', 'graveWisp', 'stitchCrab', 'cinderMantis'];

// An enemy's class (minion / elite / boss) is its stature; actors measured in
// tests may carry only the ratio combatSpriteRatio derived from it.
const enemyClass = a => a.stature ?? a.frame?.dataset?.stature ?? (a.ratio >= 2 ? 'huge' : a.ratio > 1 ? 'large' : 'normal');

export function fitAlternativeSprites({ width, height, actors, narrow }) {
  const fits = actors.filter(a => a.visibleHeight > 0 && a.visibleWidth > 0).map(a => {
    const enemy = a.side !== 'player';
    const sideCount = actors.filter(b => b.side === a.side).length;
    const low = enemy && LOW_SILHOUETTES.includes(a.enemyId);
    const ratio = !enemy ? 1 : low ? .50 : Math.min(1.3, a.ratio);
    // Owner (2026-10-12): an enemy class stands one height in every rank, so
    // the rank depth shrink applies to the party only.
    const requested = height * (enemy ? (narrow ? .46 : .73) : (narrow ? .46 : .31)) * ratio * (enemy ? 1 : a.slot.depth * GRID.playerArtworkScale);
    // Reserve the complete artwork envelope, including weapons and capes,
    // inside the common horizontal intersection of the cell's two edges.
    const boxWidth = a.slot.box ? a.slot.box.width - Math.abs(a.slot.box.skew || 0) * a.slot.box.height - 2 * Math.abs((a.slot.box.skew || 0) * (a.slot.box.top + a.slot.box.height / 2 - a.slot.ground)) : a.slot.artWidth;
    const widthLimit = Math.min(width - 12, boxWidth ? Math.max(1, boxWidth - 2 * GRID.footprintInsetPx) : Infinity);
    // Enemy foot anchors can move inward inside their own cell after fitting.
    // Reserve screen edges at that available centre as well as the preferred
    // side-biased anchor, so a newly occupied right lane cannot shrink the
    // entire enemy class before its footprint receives the inset.
    const box = enemy ? a.slot.box : null;
    const cellCentre = box ? box.left + box.width / 2 + (box.skew || 0) * (box.top + box.height / 2 - a.slot.ground) : a.slot.x;
    const edgeRoom = Math.max(Math.min(a.slot.x - 5, width - a.slot.x - 5),
      Math.min(cellCentre - 5, width - cellCentre - 5));
    // A 130px landscape field can leave less headroom than the measured
    // Inspect/intent union. Keep one cell-height of readable silhouette in
    // that impossible case; the controls are packed independently, so they
    // must not collapse the body and make composition move its foot anchor.
    const shortFloor = height < GRID.shortBelowPx ? Math.min(a.slot.box?.height ?? 1, requested) : 1;
    // A spacious rank retains its approved body size when the readable HUD grows.
    // Its HUD is packed separately; viewport, cell width and edge bounds remain hard.
    const spaciousFloor = enemy && !narrow && height >= GRID.shortBelowPx && sideCount <= 3
      ? Math.min(height * GRID.spaciousEnemyClassHeightFraction * ratio * Math.min(1, a.multiplier || 1),
        a.slot.ground - (a.artLeading ?? a.leading) - 6, widthLimit * a.visibleHeight / a.visibleWidth,
        2 * edgeRoom * a.visibleHeight / a.visibleWidth) : 1;
    const visibleHeight = Math.max(shortFloor, spaciousFloor, Math.min(requested * Math.min(1.25, a.multiplier || 1),
      a.slot.ground - a.leading - 6, widthLimit * a.visibleHeight / a.visibleWidth,
      2 * edgeRoom * a.visibleHeight / a.visibleWidth));
    return { a, enemy, low, visibleHeight: Math.min(visibleHeight, widthLimit * a.visibleHeight / a.visibleWidth) };
  });
  // Every enemy of one class takes the class's smallest fitted height, so no
  // member outgrows its own lane, headroom or edge. Low creatures stay at half
  // of their class height.
  const classUnit = new Map();
  for (const fit of fits.filter(fit => fit.enemy)) {
    const key = enemyClass(fit.a), unit = fit.visibleHeight / (fit.low ? .5 : 1);
    classUnit.set(key, Math.min(classUnit.get(key) ?? Infinity, unit));
  }
  return fits.map(({ a, enemy, low, visibleHeight: own }) => {
    const visibleHeight = enemy ? classUnit.get(enemyClass(a)) * (low ? .5 : 1) : own;
    return { id: a.slot.id, scale: visibleHeight / a.visibleHeight, visibleHeight, multiplier: 1, x: a.slot.x };
  });
}

// True when a field-space point lies inside a perspective cell's parallelogram.
export function perspectiveCellContains(box, x, y) {
  if (y < box.top || y > box.top + box.height) return false;
  const centre = box.left + box.width / 2 + (box.skew || 0) * (box.top + box.height / 2 - y);
  return Math.abs(x - centre) <= box.width / 2;
}
