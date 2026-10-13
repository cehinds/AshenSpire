// Assigns each target its own grid cell. Depth-first backtracking: targets with
// the fewest eligible cells choose first, and each tries its eligible unused cells
// nearest first. The first complete assignment wins, so a greedy pick that strands
// a later target is undone. Screen-pixel geometry only; no DOM access.
const NODE_LIMIT = 20000;

// `eligible(cell, target)` and `distance(target, cell)` come from the caller's grid.
// Returns one `{ id, ...cell }` per target in the original target order, or null when
// no complete one-to-one assignment exists or the search exceeds NODE_LIMIT.
export function assignCells(targets, cells, { eligible, distance }) {
  const options = targets.map(target => cells
    .map((cell, slot) => ({ cell, slot, distance: distance(target, cell) }))
    .filter(({ cell }) => eligible(cell, target))
    .sort((a, b) => a.distance - b.distance || a.slot - b.slot));
  if (options.some(list => !list.length)) return null;
  const order = targets.map((_, index) => index)
    .sort((a, b) => options[a].length - options[b].length || a - b);
  const used = new Set(), picked = new Array(targets.length);
  let visited = 0;
  const search = depth => {
    if (depth === order.length) return true;
    if (++visited > NODE_LIMIT) return false;
    const index = order[depth];
    for (const option of options[index]) {
      if (used.has(option.slot)) continue;
      used.add(option.slot);
      picked[index] = { id: targets[index].id, ...option.cell };
      if (search(depth + 1)) return true;
      used.delete(option.slot);
    }
    return false;
  };
  return search(0) ? picked : null;
}
