// Depth math for configured routes, shared by the map build and the resolver. `shape` is the
// routes module's routeShape. Rest placement here is the one PlaceRestFloors (actmap.js) draws
// from, so the resolver can walk every placement the builder can roll.

export function DepthRange(first, last)
{
  const length = Math.max(0, last - first + 1);
  return Array.from({ length }, (_, index) => first + index);
}

function movingRests(sorted, count)
{
  return sorted.filter(floor => floor !== 1 && floor !== count);
}

// The depths a rest can land on: the authored ones, widened by restFloorSpread when it moves.
export function PossibleRestDepths(routes)
{
  const depths = new Set(routes.restFloors || []);
  if (!routes.restGap)
  {
    return depths;
  }
  const spread = routes.restFloorSpread || 0;
  for (const floor of movingRests(routes.restFloors || [], routes.prebossNodes))
  {
    for (const depth of DepthRange(floor - spread, floor + spread))
    {
      depths.add(depth);
    }
  }
  return depths;
}

// The depths from first to last a pin may use: those no rest can land on.
export function PinnableDepths(restDepths, first, last)
{
  return DepthRange(first, last).filter(depth => !restDepths.has(depth));
}

// The depth by which every lane of a branch is open.
export function BranchFullDepth(prebossNodes, shape)
{
  return Math.max(shape.earliestFullDepth, prebossNodes - shape.fullDepthsBeforeBoss);
}

// The depths one moving rest may take, given the rest placed before it and the next authored one.
export function RestCandidates(place)
{
  const {
    previous,
    authored,
    next,
    count,
    restGap,
    spread,
    lowest,
  } = place;
  const candidates = [];
  for (const floor of DepthRange(authored - spread, authored + spread))
  {
    const gap = floor - previous - 1;
    const outside = floor < lowest || floor >= count || gap < restGap.min || gap > restGap.max;
    const crowdsNext = next !== undefined && next - spread - floor - 1 < restGap.min;
    if (!outside && !crowdsNext)
    {
      candidates.push(floor);
    }
  }
  return candidates;
}

// The choices PlaceRestFloors may make for one rest: one draw among several, else the only one.
export function RestChoices(candidates, authored, spread)
{
  if (!candidates.length)
  {
    return [authored];
  }
  return spread > 0
    ? candidates
    : [candidates[0]];
}

function firstPartial(fixedFirst)
{
  if (fixedFirst)
  {
    return { placed: [1], previous: 1 };
  }
  return { placed: [], previous: 0 };
}

// Every rest placement an act can roll from these authored rest floors.
export function RestPlacements(restFloors, count, restGap, spread, lowest)
{
  const sorted = [...restFloors].sort((a, b) => a - b);
  if (!restGap)
  {
    return [sorted];
  }
  const movable = movingRests(sorted, count);
  const tail = sorted.includes(count)
    ? [count]
    : [];
  let partials = [firstPartial(sorted[0] === 1)];
  movable.forEach((authored, index) =>
  {
    const base = {
      authored,
      next: movable[index + 1],
      count,
      restGap,
      spread,
      lowest,
    };
    partials = partials.flatMap(({ placed, previous }) =>
    {
      const choices = RestChoices(RestCandidates({ ...base, previous }), authored, spread);
      return choices.map(chosen => ({ placed: [...placed, chosen], previous: chosen }));
    });
  });
  return partials.map(({ placed }) => [...placed, ...tail]);
}
