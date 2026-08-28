// src/engine/mapgen.js — procedural act-map generator (SPEC §3.8, §6)
//
// Faithful to StS's published algorithm: walk N paths bottom-to-top through a
// floors × columns grid (edges may merge, never cross), then type the nodes
// under per-floor rules and adjacency/count constraints with bounded retries.
//
// Pure: generateActMap({ config, rng }) — every knob comes from content
// (content/mapconfig.js); randomness only from the seeded 'map' stream.
// Headless: no document/window/localStorage/timers.

import { resolveFloorPlan } from '../model/floorplan.js';
import { createRng, sweepSeed } from './rng.js';

const TYPING_RETRIES = 40;

/**
 * sampleActShape(config, seeds) → { seeds, nodes: {mean,min,max}, byType: {...} }
 *
 * HOW BIG IS AN ACT AT THIS CONFIG, over a distribution and never on one seed.
 *
 * Constantine asked for a 30-minute run, and the thing that drives run length is
 * how many nodes he has to stop on. He cannot be handed a knob and a promise —
 * he has to be handed the number, and it has to move while he drags. So this is
 * the ONE sampler: the Custom Climb screen prints it live, tools/mapplan.mjs
 * prints it in the before/after table, and the tests assert on it. Three readers,
 * one measurement, so a screen can never quote a figure the tool disagrees with.
 *
 * Seeds come from `sweepSeed` (engine/rng.js) for the reason written there: a
 * sweep whose seeds all collapse to 0 prints a perfect distribution of one graph.
 *
 * WHAT IT IS NOT: wall-clock. Nobody in this tree can measure minutes. Node count
 * is the driver of run length, not run length, and every caller says so out loud.
 */
export function sampleActShape(config, seeds = 24) {
  const counts = [];
  const byType = {};
  for (let i = 0; i < seeds; i++) {
    const g = generateActMap({ config, rng: createRng(sweepSeed(i)) });
    const all = Object.values(g.nodes);
    counts.push(all.length);
    for (const n of all) byType[n.type] = (byType[n.type] || 0) + 1;
  }
  const stat = (xs) => ({
    mean: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100,
    min: Math.min(...xs),
    max: Math.max(...xs),
  });
  const perAct = {};
  for (const [t, n] of Object.entries(byType)) perAct[t] = Math.round((n / seeds) * 100) / 100;
  return { seeds, nodes: stat(counts), byType: perAct };
}

/**
 * generateActMap({ config, rng }) → {
 *   nodes: { [id]: { id, floor, col, type, next: [ids] } },
 *   startIds: [ids on floor 1],
 *   shrineId,                        // the single floor-N shrine (SPEC §6)
 *   bossId,                          // boss node above the shrine
 * }
 *
 * config = { floors, columns, pathCount, entries?, typeWeights, unknownWeights,
 * floorRules } — see content/mapconfig.js. Floor rules are ANCHORS; this
 * function never reads them directly and never sees an absolute floor number
 * that content typed. `resolveFloorPlan` (model/floorplan.js) is the one place
 * that turns an anchor into a floor, so the generator, the validator and
 * tools/mapplan.mjs cannot disagree about what a rule meant.
 */
export function generateActMap({ config, rng }) {
  const floors = config.floors;
  const cols = config.columns;
  // NO `config.floorRules || {}`. That fallback generated an unauthored map
  // from an empty object and called it a default — "where a defect goes to be
  // quiet" (Viki). Bad config is loud, here and at boot in validate.js.
  const { plan, errors } = resolveFloorPlan(config);
  if (!plan || errors.length) {
    throw new Error(`mapgen: this act's floor rules do not resolve — ${
      errors.map((e) => `${e.key}: ${e.msg}`).join(' · ') || 'floorRules missing'}`);
  }
  const rules = plan;
  const nodeId = (floor, col) => `n${floor}_${col}`;

  // ---- 1. Path walk (floors 1..floors-1); floor `floors` is the lone shrine.
  // edges[floor] = Map(fromCol → Set(toCol)) — used for the no-cross rule.
  const pathFloors = floors - 1;
  const edges = Array.from({ length: pathFloors }, () => new Map());
  const usedCols = Array.from({ length: pathFloors + 1 }, () => new Set()); // 1-based floors

  // ---- ENTRANCES vs WALKERS, and they were the same thing until now.
  //
  // Constantine asked for one path. Measured literally that is a CORRIDOR: 13
  // nodes, ZERO choices in the whole act, identical shape every seed (Viki, 300
  // seeds). What he described is one ENTRANCE with several routes behind it —
  // and mapgen forbade exactly that, in the line this replaces: a guard that
  // re-rolled walker 2 onto a DIFFERENT column, which is the opposite of the ask.
  //
  //   entries: 1        one door, `pathCount` routes behind it
  //   entries: n        n doors, every walker enters through one of them
  //   entries: unset    TODAY'S RULE, byte for byte — walkers 1 and 2 are forced
  //                     apart and the rest land wherever they land
  //
  // UNSET IS THE DEFAULT ON PURPOSE. Setting this number re-rolls every seed in
  // the game, and which number it should be is a design call with his question
  // already on the board — not something to change under him tonight. The unset
  // branch draws from the rng in exactly the order it always did, so every
  // existing seed is unchanged; `tools/mapplan.mjs --entries 1` prints what the
  // other answer costs before anyone commits to it.
  const entries = Number.isInteger(config.entries) ? config.entries : null;
  const starts = [];
  for (let p = 0; p < config.pathCount; p++) {
    let col = rng.int('map', 0, cols - 1);
    if (entries == null ? p === 1 : p < entries) {
      // A door this act has not opened yet.
      let guard = 0;
      while (starts.includes(col) && ++guard < 50) col = rng.int('map', 0, cols - 1);
    } else if (entries != null) {
      // Every later walker comes in through a door that already exists.
      col = starts[rng.int('map', 0, entries - 1)];
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
  const fixed = plan.fixed;
  for (let attempt = 0; attempt < TYPING_RETRIES; attempt++) {
    for (const node of rollable) node.type = null;
    typeOnce(nodes, rollable, fixed, rules, config.typeWeights, rng, floors);
    if (countType(nodes, 'elite') >= plan.minElites &&
        countType(nodes, 'merchant') >= plan.minMerchants) {
      return finish(nodes, starts, shrine.id, boss.id, floors, cols);
    }
  }
  // Relax (SPEC §6): force-place what the rolls never produced, on eligible
  // monster nodes (weakest constraint gives way; counts are a hard promise).
  relaxPlace(nodes, 'elite', plan.minElites, plan, rng);
  relaxPlace(nodes, 'merchant', plan.minMerchants, plan, rng);
  return finish(nodes, starts, shrine.id, boss.id, floors, cols);
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
    if ((type === 'elite' || type === 'shrine') && node.floor < rules.eliteShrineFrom) return false;
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
      !(type === 'elite' && n.floor < rules.eliteShrineFrom)
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

function finish(nodes, startCols, shrineId, bossId, floors, columns) {
  const startIds = [...new Set(startCols)].map((col) => `n1_${col}`);
  // `columns` travels WITH the graph. The map screen used to hardcode
  // `7 * COL_X + 60` for its SVG width, so an act tuned to 6 or 9 columns drew
  // at 7 regardless — a tunable map whose view ignores the tuning is not
  // tunable (Marina made this a precondition of the rework, not a footnote).
  // Putting it on the graph rather than re-reading the act config means the
  // view and the generator cannot disagree, and it survives a save/load.
  return { nodes, startIds, shrineId, bossId, floors, columns };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
