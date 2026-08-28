// src/engine/mapgen.js — procedural act-map generator (SPEC §3.8, §6)
//
// Faithful to StS's published algorithm: walk N paths bottom-to-top through a
// floors × columns grid (edges may merge, never cross), then type the nodes
// under per-floor rules and adjacency/count constraints with bounded retries.
//
// Pure: generateActMap({ config, rng }) — every knob comes from content
// (content/mapconfig.js); randomness only from the seeded 'map' stream.
// Headless: no document/window/localStorage/timers.

export const NODE_TYPES = Object.freeze([
  'monster',
  'event',
  'elite',
  'shrine',
  'merchant',
  'treasure',
  'boss',
]);

const TYPING_RETRIES = 40;

/**
 * generateActMap({ config, rng }) → {
 *   nodes: { [id]: { id, floor, col, type, next: [ids] } },
 *   startIds: [ids on floor 1],
 *   shrineId,                        // the single floor-N shrine (SPEC §6)
 *   bossId,                          // boss node above the shrine
 * }
 *
 * config = { floors, columns, pathCount, typeWeights, floorRules } — see
 * content/mapconfig.js. floorRules = { fixed: {floor: type},
 * noEliteOrShrineBefore, noShrineOn, minReachableElites, minReachableMerchants }.
 */
export function generateActMap({ config, rng }) {
  const floors = config.floors;
  const cols = config.columns;
  const rules = config.floorRules || {};
  const nodeId = (floor, col) => `n${floor}_${col}`;

  // ---- 1. Path walk (floors 1..floors-1); floor `floors` is the lone shrine.
  // edges[floor] = Map(fromCol → Set(toCol)) — used for the no-cross rule.
  const pathFloors = floors - 1;
  const edges = Array.from({ length: pathFloors }, () => new Map());
  const usedCols = Array.from({ length: pathFloors + 1 }, () => new Set()); // 1-based floors

  const starts = [];
  for (let p = 0; p < config.pathCount; p++) {
    let col = rng.int('map', 0, cols - 1);
    if (p === 1) {
      let guard = 0;
      while (col === starts[0] && ++guard < 50) col = rng.int('map', 0, cols - 1);
    }
    starts.push(col);
    usedCols[1].add(col);

    for (let floor = 1; floor < pathFloors; floor++) {
      let next = clamp(col + rng.int('map', -1, 1), 0, cols - 1);
      // No-cross rule (StS): if an existing edge from this floor would cross
      // ours, adopt its destination instead (paths merge rather than cross).
      for (const [fromCol, tos] of edges[floor]) {
        for (const toCol of tos) {
          const crosses =
            (fromCol < col && toCol > next) || (fromCol > col && toCol < next);
          if (crosses) next = toCol;
        }
      }
      if (!edges[floor].has(col)) edges[floor].set(col, new Set());
      edges[floor].get(col).add(next);
      col = next;
      usedCols[floor + 1].add(col);
    }
  }

  // ---- 2. Materialize nodes + wire edges.
  const nodes = {};
  const addNode = (floor, col) => {
    const id = nodeId(floor, col);
    if (!nodes[id]) nodes[id] = { id, floor, col, type: null, next: [] };
    return nodes[id];
  };
  for (let floor = 1; floor <= pathFloors; floor++) {
    for (const col of usedCols[floor]) addNode(floor, col);
  }
  for (let floor = 1; floor < pathFloors; floor++) {
    for (const [fromCol, tos] of edges[floor]) {
      const from = nodes[nodeId(floor, fromCol)];
      for (const toCol of tos) {
        const toId = nodeId(floor + 1, toCol);
        if (!from.next.includes(toId)) from.next.push(toId);
      }
    }
  }

  // Single pre-boss shrine row + boss (SPEC §6: floor `floors` is always a
  // lone Shrine; the Boss sits above it).
  const shrine = addNode(floors, Math.floor(cols / 2));
  shrine.type = 'shrine';
  for (const col of usedCols[pathFloors]) {
    nodes[nodeId(pathFloors, col)].next.push(shrine.id);
  }
  const boss = addNode(floors + 1, Math.floor(cols / 2));
  boss.type = 'boss';
  shrine.next.push(boss.id);

  // ---- 3. Node typing under constraints, bounded retries then relax.
  const rollable = Object.values(nodes).filter((n) => n.type === null);
  const fixed = rules.fixed || {};
  for (let attempt = 0; attempt < TYPING_RETRIES; attempt++) {
    for (const node of rollable) node.type = null;
    typeOnce(nodes, rollable, fixed, rules, config.typeWeights, rng, floors);
    if (countType(nodes, 'elite') >= (rules.minReachableElites || 0) &&
        countType(nodes, 'merchant') >= (rules.minReachableMerchants || 0)) {
      return finish(nodes, starts, shrine.id, boss.id, floors);
    }
  }
  // Relax (SPEC §6): force-place what the rolls never produced, on eligible
  // monster nodes (weakest constraint gives way; counts are a hard promise).
  relaxPlace(nodes, 'elite', rules.minReachableElites || 0, rules, rng);
  relaxPlace(nodes, 'merchant', rules.minReachableMerchants || 0, rules, rng);
  return finish(nodes, starts, shrine.id, boss.id, floors);
}

function typeOnce(nodes, rollable, fixed, rules, weights, rng, floors) {
  // Roll floor-by-floor so the adjacency rule can see typed parents.
  const byFloor = [...rollable].sort((a, b) => a.floor - b.floor);
  for (const node of byFloor) {
    if (fixed[node.floor]) {
      node.type = fixed[node.floor];
      continue;
    }
    const parents = Object.values(nodes).filter((p) => p.next.includes(node.id) && p.type);
    node.type = rollType(node, parents, rules, weights, rng);
  }
}

// Weighted roll with per-node hard filters (floor rules + no same non-monster
// type adjacent along an edge — SPEC §6).
function rollType(node, typedParents, rules, weights, rng) {
  const banned = new Set(typedParents.map((p) => p.type).filter((t) => t !== 'monster'));
  const entries = Object.entries(weights).filter(([type, w]) => {
    if (w <= 0) return false;
    if (banned.has(type)) return false;
    if ((type === 'elite' || type === 'shrine') && node.floor < (rules.noEliteOrShrineBefore || 0)) return false;
    if (type === 'shrine' && node.floor === rules.noShrineOn) return false;
    return true;
  });
  if (entries.length === 0) return 'monster';
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng.float('map') * total;
  for (const [type, w] of entries) {
    r -= w;
    if (r < 0) return type;
  }
  return 'monster';
}

function relaxPlace(nodes, type, min, rules, rng) {
  let have = countType(nodes, type);
  const eligible = Object.values(nodes).filter(
    (n) => n.type === 'monster' &&
      !(type === 'elite' && n.floor < (rules.noEliteOrShrineBefore || 0))
  );
  while (have < min && eligible.length > 0) {
    const idx = Math.floor(rng.float('map') * eligible.length);
    eligible.splice(idx, 1)[0].type = type;
    have++;
  }
}

function countType(nodes, type) {
  return Object.values(nodes).filter((n) => n.type === type).length;
}

function finish(nodes, startCols, shrineId, bossId, floors) {
  const startIds = [...new Set(startCols)].map((col) => `n1_${col}`);
  return { nodes, startIds, shrineId, bossId, floors };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
