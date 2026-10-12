// Screen-pixel geometry; DOM zoom conversion belongs to the renderer.
const overlaps = (a, b, gap) => a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
  && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;

export function alternativeEnemyTargetGrid({ width, height, targets, obstacles = [], hardObstacles = [], size = 88, gap = 6, inset = 8 }) {
  if (!targets.length || width <= 0 || height <= 0) return [];
  let cells = [];
  // A cell over an owned obstacle (a foe's own controls) is reserved for that foe only.
  const eligible = (cell, target) => !cell.owners?.length || cell.owners.every(id => id === target.id);
  const plain = ({ owners, ...cell }) => cell;
  // Closest eligible pairs first so an already-centered foe keeps its own cell.
  // Acceptance and the final return both use this, so a lattice is only kept
  // when every foe gets a distinct eligible cell.
  const assignCells = grid => {
    const pairs = targets.flatMap((target, index) => grid.flatMap((cell, slot) => eligible(cell, target) ? [{ index, slot,
      distance: (cell.left + cell.width / 2 - target.x) ** 2 + (cell.top + cell.height / 2 - target.y) ** 2,
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
  for (const blocks of [[...obstacles, ...hardObstacles], hardObstacles]) {
  for (const edge of [...new Set([size, 72, 56, 48].filter(value => value <= size))]) {
    const pitch = edge + gap;
    const origins = (span, anchors, blocks, start, length) => [...new Set([
      inset, (span - edge) / 2, ...anchors.map(value => value - edge / 2),
      ...blocks.flatMap(rect => [rect[start] + rect[length] + gap, rect[start] - edge - gap]),
    ].map(value => inset + ((value - inset) % pitch + pitch) % pitch))];
    const xs = origins(width, targets.map(target => target.x), blocks, 'left', 'width');
    const ys = origins(height, targets.map(target => target.y), blocks, 'top', 'height');
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
      if (assignCells(grid).length < targets.length) continue;
      const distance = targets.reduce((sum, target) => sum + Math.min(...grid.filter(cell => eligible(cell, target)).map(cell =>
        (cell.left + edge / 2 - target.x) ** 2 + (cell.top + edge / 2 - target.y) ** 2)), 0);
      if (distance < score) { score = distance; cells = grid; }
    }
    if (cells.length >= targets.length) break;
  }
  if (cells.length >= targets.length) break;
  }
  // If inspection controls occupy every safe cell, retain a separate square
  // for every foe instead of leaving unplaced controls at stale coordinates.
  // Last resort: shrink toward the 44px floor, keeping only hard obstacles
  // (player sprite, cards, tools, buttons) blocked. A foe with no slot even then
  // is left unplaced; the picker hides its button and the sprite stays targetable.
  if (cells.length < targets.length) {
    let fallback = [];
    for (const edge of [...new Set([48, 44, Math.min(48, width - 2 * inset, height - 2 * inset)])]) {
      if (edge <= 0 || edge > width - 2 * inset || edge > height - 2 * inset) continue;
      const grid = [];
      for (let top = inset; top + edge <= height - inset; top += edge + gap) {
        for (let left = inset; left + edge <= width - inset; left += edge + gap) {
          const cell = { left, top, width: edge, height: edge, owners: [] };
          if (!hardObstacles.some(rect => overlaps(cell, rect, gap))) grid.push(cell);
        }
      }
      if (grid.length > fallback.length) fallback = grid;
      if (grid.length >= targets.length) break;
    }
    cells = fallback;
  }
  return assignCells(cells);
}
