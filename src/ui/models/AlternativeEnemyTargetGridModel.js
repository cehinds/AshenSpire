import { directPlacement } from './targetDirectPlacement.js';
import { assignCells } from './targetCellAssignment.js';
// Screen-pixel geometry; DOM zoom conversion belongs to the renderer.
const overlaps = (a, b, gap) => a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
  && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;
// A target with a ground anchor puts its square's bottom edge on that line; otherwise its centre is y.
const anchorY = (target, edge) => Number.isFinite(target.ground) ? target.ground - edge / 2 : target.y;

export function alternativeEnemyTargetGrid({ width, height, targets, obstacles = [], hardObstacles = [], size = 88, gap = 6, inset = 8 }) {
  if (!targets.length || width <= 0 || height <= 0) return [];
  // A foe's box placed directly on its anchor wins when every foe fits; the lattice below is the fallback.
  const direct = directPlacement({ width, height, targets, obstacles, hardObstacles, edges: [size, 72, 56, 48].filter(value => value <= size), gap, inset });
  if (direct) return direct;
  let cells = [], chosen = null;
  // A cell over an owned obstacle (a foe's own controls) is reserved for that foe only.
  const eligible = (cell, target) => !cell.owners?.length || cell.owners.every(id => id === target.id);
  const plain = ({ owners, ...cell }) => cell;
  const distanceTo = (target, cell) => (cell.left + cell.width / 2 - target.x) ** 2 + (cell.top + cell.height / 2 - anchorY(target, cell.height)) ** 2;
  // Hard-only fallback: closest eligible pairs first, allowing partial placement.
  const closestPairs = grid => {
    const pairs = targets.flatMap((target, index) => grid.flatMap((cell, slot) => eligible(cell, target) ? [{ index, slot,
      distance: distanceTo(target, cell),
    }] : [])).sort((a, b) => a.distance - b.distance || a.index - b.index || a.slot - b.slot);
    const used = new Set(), placed = new Map();
    for (const pair of pairs) {
      if (placed.has(pair.index) || used.has(pair.slot)) continue;
      placed.set(pair.index, { id: targets[pair.index].id, ...plain(grid[pair.slot]) });
      used.add(pair.slot);
    }
    return targets.flatMap((_, index) => placed.has(index) ? [placed.get(index)] : []);
  };
  // Shift the entire lattice when an intent row leaves a narrow free band.
  // Anchored origins also let a lone target sit exactly on its enemy center.
  for (const blocks of [[...obstacles, ...hardObstacles], [...obstacles.filter(rect => rect.owner), ...hardObstacles]]) {
  for (const edge of [...new Set([size, 72, 56, 48].filter(value => value <= size))]) {
    const pitch = edge + gap;
    const origins = (span, anchors, blocks, start, length) => [...new Set([
      inset, (span - edge) / 2, ...anchors.map(value => value - edge / 2),
      ...blocks.flatMap(rect => [rect[start] + rect[length] + gap, rect[start] - edge - gap]),
    ].map(value => inset + ((value - inset) % pitch + pitch) % pitch))];
    const xs = origins(width, targets.map(target => target.x), blocks, 'left', 'width');
    const ys = origins(height, targets.map(target => anchorY(target, edge)), blocks, 'top', 'height');
    let score = Infinity;
    for (const startX of xs) for (const startY of ys) {
      const grid = [];
      for (let top = startY; top + edge <= height - inset; top += pitch) {
        for (let left = startX; left + edge <= width - inset; left += pitch) {
          const cell = { left, top, width: edge, height: edge };
          const hits = blocks.filter(rect => overlaps(cell, rect, gap));
          // Hard and unowned obstacles block the cell; owned ones only claim it.
          if (hits.some(rect => !rect.owner)) continue;
          grid.push({ ...cell, owners: [...new Set(hits.map(rect => rect.owner))] });
        }
      }
      if (grid.length < targets.length) continue;
      const assigned = assignCells(targets, grid, { eligible, distance: distanceTo });
      if (!assigned) continue;
      const distance = targets.reduce((sum, target) => sum + Math.min(...grid.filter(cell => eligible(cell, target)).map(cell =>
        (cell.left + edge / 2 - target.x) ** 2 + (cell.top + edge / 2 - anchorY(target, edge)) ** 2)), 0);
      if (distance < score) { score = distance; cells = grid; chosen = assigned; }
    }
    if (chosen) break;
  }
  if (chosen) break;
  }
  // If inspection controls occupy every safe cell, retain a separate square
  // for every foe instead of leaving unplaced controls at stale coordinates.
  // Last resort: shrink toward the 44px floor, keeping only hard obstacles
  // (player sprite, cards, tools, buttons) blocked. A foe with no slot even then
  // is left unplaced; the picker hides its button and the sprite stays targetable.
  if (!chosen) {
    let fallback = [];
    for (const edge of [...new Set([48, 44, Math.min(48, width - 2 * inset, height - 2 * inset)])]) {
      if (edge <= 0 || edge > width - 2 * inset || edge > height - 2 * inset) continue;
      const grid = [];
      for (let top = inset; top + edge <= height - inset; top += edge + gap) {
        for (let left = inset; left + edge <= width - inset; left += edge + gap) {
          const cell = { left, top, width: edge, height: edge };
          // Unowned soft obstacles are dropped here; owned ones still claim the cell.
          if (hardObstacles.some(rect => overlaps(cell, rect, gap))) continue;
          const owners = obstacles.filter(rect => rect.owner && overlaps(cell, rect, gap)).map(rect => rect.owner);
          grid.push({ ...cell, owners: [...new Set(owners)] });
        }
      }
      if (grid.length > fallback.length) fallback = grid;
      if (grid.length >= targets.length) break;
    }
    cells = fallback;
  }
  if (chosen) return chosen.map(plain);
  return closestPairs(cells);
}
