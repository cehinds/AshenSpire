// Every lane shape drawBranchShape (src/engine/actmap.js) can draw, walked without the RNG. A
// shape maps each branch depth to its open lanes { lo, hi }. Both share these constants; a draw
// that can go either way (fork, narrow) is followed both ways, so no reachable shape is missed.
import { BranchFullDepth } from './routeDepths.js';

// The board is at most this many times branchColumns lanes wide, shared by the branches.
export const BOARD_LANES_PER_COLUMN = 2;
// A branch needs this many lanes before it may open two lanes wide, or narrow once.
export const TWO_LANE_OPENING_LANES = 3;
export const NARROW_MIN_LANES = 3;
const NEVER = 0;
const ALWAYS = 100;

export function BranchLaneCount(columns, branchCount)
{
  const shared = Math.floor(BOARD_LANES_PER_COLUMN * columns / branchCount);
  return Math.max(1, Math.min(columns, shared));
}

// Every lane count a branch can have, one per possible branch count.
export function BranchLaneCounts(routes)
{
  const counts = new Set();
  for (let branchCount = 1; branchCount <= routes.maxBranches; branchCount++)
  {
    counts.add(BranchLaneCount(routes.branchColumns, branchCount));
  }
  return [...counts];
}

function forkChoices(forkPercent)
{
  const choices = [];
  if (forkPercent == null || forkPercent > NEVER)
  {
    choices.push(true);
  }
  if (forkPercent == null || forkPercent < ALWAYS)
  {
    choices.push(false);
  }
  return choices;
}

function openings(lanes)
{
  const widths = lanes >= TWO_LANE_OPENING_LANES
    ? [1, 2]
    : [1];
  return widths.flatMap(width =>
  {
    const low = Math.floor((lanes - width) / 2);
    const high = Math.ceil((lanes - width) / 2);
    return [...new Set([low, high])].map(lo => ({ lo, hi: lo + width - 1 }));
  });
}

function forkSteps(open, floor, walk)
{
  const { lanes, fillBy, forks } = walk;
  const remaining = fillBy - floor;
  const steps = [];
  for (const left of forks)
  {
    for (const right of forks)
    {
      const next = { ...open };
      if (open.lo > 0 && (left || open.lo >= remaining))
      {
        next.lo = open.lo - 1;
      }
      if (open.hi < lanes - 1 && (right || lanes - 1 - open.hi >= remaining))
      {
        next.hi = open.hi + 1;
      }
      steps.push(next);
    }
  }
  return steps;
}

function narrowSteps(open, floor, walk)
{
  const steps = [{ ...open }];
  const narrowing = floor >= walk.count - walk.shape.narrowDepthsBeforeBoss;
  if (narrowing && open.hi - open.lo + 1 >= NARROW_MIN_LANES)
  {
    steps.push({ lo: open.lo + 1, hi: open.hi });
    steps.push({ lo: open.lo, hi: open.hi - 1 });
  }
  return steps;
}

function uniqueSteps(steps)
{
  const seen = new Map();
  for (const step of steps)
  {
    seen.set(`${step.lo}:${step.hi}`, step);
  }
  return [...seen.values()];
}

function extend(shapes, active, floor, walk)
{
  if (floor >= walk.count)
  {
    shapes.push(active);
    return;
  }
  const open = active[floor];
  const steps = floor < walk.fillBy
    ? forkSteps(open, floor, walk)
    : narrowSteps(open, floor, walk);
  for (const next of uniqueSteps(steps))
  {
    extend(shapes, { ...active, [floor + 1]: next }, floor + 1, walk);
  }
}

// Every shape one branch of `lanes` lanes can take, as { [depth]: { lo, hi } }.
export function BranchShapes(lanes, routes, shape)
{
  const count = routes.prebossNodes;
  const first = shape.firstBranchDepth;
  if (count < first)
  {
    return [{}];
  }
  const walk = {
    lanes,
    count,
    shape,
    fillBy: BranchFullDepth(count, shape),
    forks: forkChoices(routes.forkPercent),
  };
  const shapes = [];
  for (const open of openings(lanes))
  {
    extend(shapes, { [first]: open }, first, walk);
  }
  return shapes;
}
