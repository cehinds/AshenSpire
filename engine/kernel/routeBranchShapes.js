// The lane steps drawBranchShape (src/engine/actmap.js) can take, without the RNG. A branch's
// open lanes at a depth are { lo, hi }; a draw that can go either way (fork, narrow) yields both
// next steps, so walking the steps depth by depth reaches every shape the builder can draw.
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

// The open lanes a branch may start with on its first depth.
export function BranchOpenings(lanes)
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

// Everything the step walk needs for one branch of `lanes` lanes.
export function BranchWalk(lanes, routes, shape)
{
  const count = routes.prebossNodes;
  return {
    lanes,
    count,
    shape,
    fillBy: BranchFullDepth(count, shape),
    forks: forkChoices(routes.forkPercent),
    known: new Map(),
  };
}

// Every open-lane interval the branch may have on floor + 1, given `open` on floor.
export function BranchSteps(open, floor, walk)
{
  const key = `${floor}:${open.lo}:${open.hi}`;
  if (walk.known.has(key))
  {
    return walk.known.get(key);
  }
  const steps = floor < walk.fillBy
    ? forkSteps(open, floor, walk)
    : narrowSteps(open, floor, walk);
  const unique = uniqueSteps(steps);
  walk.known.set(key, unique);
  return unique;
}
