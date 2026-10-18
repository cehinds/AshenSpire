// Screen-pixel geometry; DOM zoom conversion belongs to the renderer.
const overlaps = (a, b, gap) => a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
  && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;

// Each foe's ideal square, centred on its x with its bottom on its ground line
// (or its centre on y without one). Tried largest edge first; the first edge at
// which every foe's square is inside the field, clear of hard and unowned
// obstacles, clear of other foes' controls and disjoint from the other squares
// wins. Returns null when no edge fits, so the caller falls back to its lattice.
export function directPlacement({ width, height, targets, obstacles = [], hardObstacles = [], edges, gap, inset }) {
  for (const edge of edges) {
    const cells = targets.map(target => ({
      id: target.id,
      left: target.x - edge / 2,
      top: Number.isFinite(target.ground) ? target.ground - edge : target.y - edge / 2,
      width: edge,
      height: edge,
    }));
    const inside = cells.every(cell => cell.left >= inset && cell.top >= inset
      && cell.left + edge <= width - inset && cell.top + edge <= height - inset);
    if (!inside) continue;
    const clear = cells.every((cell, index) => {
      if (hardObstacles.some(rect => overlaps(cell, rect, gap))) return false;
      if (obstacles.some(rect => overlaps(cell, rect, gap) && (!rect.owner || rect.owner !== targets[index].id))) return false;
      return cells.every((other, otherIndex) => otherIndex === index || !overlaps(cell, other, gap));
    });
    if (clear) return cells;
  }
  return null;
}
