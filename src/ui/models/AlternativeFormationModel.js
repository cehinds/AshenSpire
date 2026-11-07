import { FORMATION_ROWS, playerFormationCell, perspectiveEnemyCellOrder } from '../../model/formationLayout.js';
import { uiConfig } from '../../config/generated/ui.js';

const GRID = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;

const BAND_LETTERS = { 'enemy-back': 'A', 'enemy-front': 'B', 'extra-combatants': 'C', 'player-front': 'D', 'player-back': 'E' };
const BAND_IDS = Object.keys(BAND_LETTERS);

// The bands the grid draws, top to bottom, each with its `row`: its offset in strip heights from the profile's top.
// The extra enemy rank is drawn only when the formation policy enables it (owner, 2026-11-05). The team gap
// (`teamGapRows` strip heights of open ground) sits between the last enemy band and the first player band.
// A profile may set its own `teamGapRows` (a phone needs a wider gap to read than a desktop); `grid.teamGapRows` is the default.
export function perspectiveBandRows(grid = GRID, extraEnabled = false, profile = null) {
  const gap = profile?.teamGapRows ?? grid.teamGapRows;
  const active = grid.bands.filter(band => !band.optional || extraEnabled);
  const gapAt = active.findIndex(band => band.side === 'player');
  let row = 0;
  const bands = active.map((band, i) => {
    if (i === gapAt) row += gap;
    const placed = { ...band, row };
    row += 1;
    return placed;
  });
  return { bands, rows: row, gap };
}

export function validatePerspectiveGrid(grid) {
  const bad = !Array.isArray(grid.bands) || grid.bands.length !== BAND_IDS.length
    || grid.bands.some((band, i) => band.id !== BAND_IDS[i] || band.index !== i
      || !['enemy', 'player'].includes(band.side)
      || !(Number.isFinite(band.anchor?.x) && band.anchor.x > 0 && band.anchor.x < 1)
      // Feet may stand on the cell's bottom edge (y = 1): that is where the owner wants them.
      || !(Number.isFinite(band.anchor?.y) && band.anchor.y > 0 && band.anchor.y <= 1)
      || !(band.depth > 0) || !Number.isFinite(band.layer));
  if (bad || grid.bands.filter(band => band.side === 'player').length < 2
    || grid.bands.findIndex(band => band.side === 'player') <= grid.bands.findLastIndex(band => band.side === 'enemy')
    || !(Number.isFinite(grid.teamGapRows) && grid.teamGapRows > 0)) throw new Error('Invalid perspective visual bands');
  // The default drawing (extra rank off) must fit the field; with the rank on, the model shrinks the strips to fit.
  for (const key of ['wide','narrow','short', ...(grid.shortLandscape ? ['shortLandscape'] : []), ...Object.keys(grid.profiles || {}).map(key => `profiles.${key}`)]) {
    const p = key.startsWith('profiles.') ? grid.profiles[key.slice(9)] : grid[key];
    if (![p?.left,p?.right,p?.top,p?.rowHeight,p?.skew].every(Number.isFinite)
      || p.left < 0 || p.right > 1 || p.left >= p.right || p.top < 0 || p.rowHeight <= 0
      || !(p.teamGapRows === undefined || (Number.isFinite(p.teamGapRows) && p.teamGapRows > 0))
      || p.top + p.rowHeight * perspectiveBandRows(grid, false, p).rows > 1 || p.skew < 0) throw new Error(`Invalid perspective ${key} profile`);
  }
  if (!Number.isFinite(grid.footprintInsetPx) || grid.footprintInsetPx < 0) throw new Error('Invalid perspective footprint clearance');
  if (!(grid.playerArtworkScale > 0) || !(grid.miniHudScale > 0) || !(grid.enemyMiniHudScale > 0)) throw new Error('Invalid perspective figure/HUD scale');
  if (!(grid.desktopMiniHudScale > 0) || !(grid.desktopEnemyMiniHudScale > 0)) throw new Error('Invalid perspective desktop HUD scale');
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
// The landscape strip's ranks are tuned for a ~146px field. On a taller or narrower one the same skew shears the grid
// too far: a back-rank cell's artwork width is laneWidth - 2*skew*cellHeight, the lane itself narrows by the shear
// (laneWidth = (A - d*skew*rowHeight*H, d = strip heights from the grid top to the party baseline)/lanes, A the grid's width) and at 844x240 the width clamped to 1px. The skew is
// capped so the artwork keeps at least `minArtLaneFraction` (m) of the UNSHEARED lane width A/lanes:
//   (A - d*s*rH)/L - 2srH >= m*A/L   =>   s <= A*(1 - m) / (rowHeight*H*(d + 2L)), d the strip heights from the top of the grid to the party's baseline.
export function shortLandscapeProfile(width, height, lanes = 3) {
  const near = GRID.shortLandscape;
  const area = width * (near.right - near.left);
  // `drop` is the shear's span in strip heights: the top of the enemy back strip down to the party's baseline (two enemy strips, the gap, one player strip).
  const drop = 3 + (near.teamGapRows ?? GRID.teamGapRows);
  const cap = area * (1 - near.minArtLaneFraction) / (near.rowHeight * height * (drop + 2 * lanes));
  return near.skew <= cap ? near : { ...near, skew: cap };
}

export function alternativeFormation(plan, width, height, narrow, presentation = {}) {
  // A short strip (landscape phone) has no room for depth above the bodies'
  // overhead controls; its ranks sit low and close together.
  const formFactor = presentation.formFactor || (narrow ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop');
  // Owner 2026-10-28: a short LANDSCAPE strip (phone on its side, min width as the layout's own 600px container query)
  // stands its ranks low so the bodies get the height; a short portrait field keeps the original short profile.
  const shortProfile = width >= 600 && GRID.shortLandscape ? shortLandscapeProfile(width, height, plan.rows || 3) : GRID.short;
  const profile = height < GRID.shortBelowPx ? shortProfile : GRID.profiles?.[formFactor] || (narrow ? GRID.narrow : GRID.wide);
  const lanes = plan.rows || 3;
  // The grid is sheared: every row slides right in proportion to its height
  // above the party's baseline, so lanes run on a diagonal and cells are
  // equal parallelograms. The lane width leaves room for the full shear.
  // The party's name and meters sit below its feet; on a short field the
  // whole grid rises together so they stay inside the field and no rank
  // overlaps another.
  // The extra enemy rank is drawn only when Core enables it (its cells then come with the plan).
  const extraEnabled = plan.cells.some(c => c.formationRole === 'extra');
  const { bands: activeBands, rows: bandRows, gap: gapRows } = perspectiveBandRows(GRID, extraEnabled, profile);
  // The profile's strip height holds for the default drawing; with the extra rank on, the strips shrink to stay in the field.
  const stripFraction = Math.min(profile.rowHeight, (1 - profile.top) / bandRows);
  const rowHeight = height * stripFraction;
  const bandOf = id => activeBands.find(b => b.id === id);
  // Owner 2026-11-06: the party's lowest strip must not hide under the hand. When the hand's top (field px, from
  // presentation.handTop) is above where a figure's feet would stand in that strip, the whole grid rises by the
  // difference, up to handLiftMaxFraction of the field, so the feet stand inside the drawn cell and above the hand.
  const lowestBand = activeBands.findLast(b => b.side === 'player');
  const frontBottom = height * profile.top + (lowestBand.row + 1) * rowHeight;
  const lift = Number.isFinite(presentation.handTop) && GRID.footInCellFraction > 0
    ? Math.max(0, Math.min(height * (GRID.handLiftMaxFraction ?? 0), frontBottom - GRID.footInCellFraction * rowHeight - presentation.handTop)) : 0;
  const gridTop = height * profile.top - lift;
  const bandTop = band => gridTop + band.row * rowHeight;
  // The party's baseline (zero shear) is the bottom of its front strip, where the lead player's feet stand.
  const baseline = bandTop(bandOf('player-front')) + rowHeight;
  const shear = y => profile.skew * (baseline - y);
  const laneWidth = Math.max(1, (width * (profile.right - profile.left)
    - shear(gridTop)) / lanes);
  const place = cell => {
    const enemy = cell.side ? cell.side === 'enemy' : Number(cell.cell.slice(1)) > plan.columns;
    if (!enemy && cell.column > 0) return null;
    const rank = enemy ? Math.min(2, cell.column) : 0;
    const role = enemy ? ['enemy-back','enemy-front','extra'][rank] : cell.backRank ? 'player-back' : 'player-front';
    const band = bandOf(role === 'extra' ? 'extra-combatants' : role);
    const lane = enemy ? cell.row : lanes - 1 - cell.row;
    const top = bandTop(band);
    const ground = top + band.anchor.y * rowHeight;
    // A short strip has no room for a lane-wide bar: it would lie across the neighbouring
    // lane's body. The profile may narrow the HUD to a fraction of the lane, kept centred.
    const hudWidth = laneWidth * (profile.hudWidthFraction ?? 1), hudInset = (laneWidth - hudWidth) / 2; // hudCenterOnBody (desktop, widescreen): the bar is centred on the body's x, not the lane's.
    const laneLeft = width * profile.left + lane * laneWidth;
    const left = laneLeft + shear(top + rowHeight / 2);
    const bodyX = laneLeft + band.anchor.x * laneWidth + shear(ground);
    return { ...cell, side: enemy ? 'enemy' : 'player', lane, rank, visualBand: BAND_LETTERS[band.id], closeBottom: band === activeBands.findLast(b => b.side === band.side),
      teamEdge: band === activeBands.findLast(b => b.side === 'enemy') ? 'enemy-end' : band === activeBands.find(b => b.side === 'player') ? 'player-start' : '', formationRole: role,
      formationRow: enemy && rank === 0 ? 'back-row' : 'front-row',
      x: bodyX, ground, fitGround: ground,
      box: { left, top, width: laneWidth, height: rowHeight, skew: profile.skew },
      width: Math.min(laneWidth * GRID.bodyWidthFraction, GRID.bodyWidthMaxPx),
      artWidth: laneWidth, miniHudLeft: profile.hudCenterOnBody ? bodyX - hudWidth / 2 + GRID.miniHudInsetPx : left + profile.skew * rowHeight / 2 + GRID.miniHudInsetPx + hudInset,
      miniHudWidth: hudWidth - 2 * GRID.miniHudInsetPx, miniHudTop: top, depth: band.depth, layer: band.layer };
  };
  plan.cells = plan.cells.map(place).filter(Boolean);
  // The player's back strip (reach) is drawn as visual-only cells; the extra enemy strip exists only when enabled.
  // The gap between the teams has no cells: it is open ground. Visual-only cells never enter the gameplay/targeting cell map.
  const backVisualCells = Array.from({ length: lanes }, (_, row) => ({ cell: `${FORMATION_ROWS[row]}2`, row, column: 0, side: 'player', backRank: true, visualOnly: true })).map(place);
  plan.visualCells = [...plan.cells, ...backVisualCells];
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
  // Display only: a range rank (melee = front, reach = back) moves a slot to the other strip of its side, keeping its lane.
  // Strips are chosen by band id, never by cell id or the `formationRow` label (A2-C2 are labelled front-row but draw as the back strip).
  const ranks = presentation.rangeRanks;
  if (ranks) {
    const wanted = slot => {
      const rank = ranks[slot.id];
      if (!rank || !slot.formationRole) return null;
      const id = slot.side === 'enemy' ? (rank === 'front' ? 'enemy-front' : 'enemy-back') : (rank === 'front' ? 'player-front' : 'player-back');
      return id === slot.formationRole ? null : id;
    };
    // A slot that keeps its strip holds its lane; a mover takes its own lane in the new strip, or the nearest free one
    // (the strip's lowest-lane side on a tie); only a full strip shares a lane.
    const taken = new Set(plan.slots.filter(slot => !wanted(slot)).map(slot => `${slot.side}:${slot.formationRole}:${slot.lane}`));
    plan.slots = plan.slots.map(slot => {
      const bandId = wanted(slot);
      if (!bandId) return slot;
      const strip = plan.visualCells.filter(c => c.side === slot.side && c.formationRole === bandId);
      const free = strip.filter(c => !taken.has(`${c.side}:${bandId}:${c.lane}`));
      const pool = free.length ? free : strip;
      const target = pool.reduce((best, c) => !best || Math.abs(c.lane - slot.lane) < Math.abs(best.lane - slot.lane) ? c : best, null);
      if (!target) return slot;
      taken.add(`${target.side}:${bandId}:${target.lane}`);
      return { ...target, id: slot.id };
    });
  }
  plan.visualBands = activeBands.map(band => ({ ...band, top: bandTop(band), height: rowHeight }));
  plan.teamGap = { top: bandTop(bandOf('player-front')) - gapRows * rowHeight, height: gapRows * rowHeight };
  plan.ground = Math.max(...plan.cells.map(c => c.ground));
  return plan;
}

const LOW_SILHOUETTES = ['blightHound', 'stitchedHound', 'lanternMoth', 'graveWisp', 'stitchCrab', 'cinderMantis'];

// An enemy's class (minion / elite / boss) is its stature; actors measured in
// tests may carry only the ratio combatSpriteRatio derived from it.
const enemyClass = a => a.stature ?? a.frame?.dataset?.stature ?? (a.ratio >= 2 ? 'huge' : a.ratio > 1 ? 'large' : 'normal');

// SUPERSEDED (owner, 2026-11-02): the live battlefield sizes every combatant with
// CombatViewportSizeModel. The class sharing, spacious-rank floor and headroom
// terms below no longer run in the app; kept only for the legacy fit tests.
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
    // The browser rounds scaled sprite boxes separately from their alpha bounds.
    // Half a physical pixel reserves that rounding at each hard cell edge.
    const widthLimit = Math.min(width - 12, boxWidth ? Math.max(1, boxWidth - 2 * (GRID.footprintInsetPx + .5)) : Infinity);
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

// The height the overhead group (intent + health row) takes above a head. Pure config, no DOM and no selection
// state: a selected frame hides its meters, so a measured height would refit the art on every click (owner
// 2026-10-28). Desktop and widescreen draw the taller health row; a short desktop window steps it down (the
// `min-width: 1200px and max-height: 800px` rule in styles/combat-target-responsive.css).
export function overheadGroupHeightPx(grid, { wide = false, shortWindow = false, tall = true } = {}) {
  // `tall` is the 1200px-wide window the taller health row is drawn at: a desktop form factor at 1101-1199 wide
  // still renders the phone-height group.
  if (!wide || !tall) return grid.miniHudGroupHeightPx;
  return shortWindow ? grid.desktopShortMiniHudGroupHeightPx : grid.desktopMiniHudGroupHeightPx;
}
