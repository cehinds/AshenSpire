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

function restWalkKey(state)
{
  return `${state.index}:${state.previous}`;
}

// The rest placement as a walk over depths, for checks that must not list every placement.
// steps(state, floor) gives each way the walk may go on `floor` and whether it is a rest.
export function RestWalk(restFloors, routes, lowest)
{
  const count = routes.prebossNodes;
  const sorted = [...restFloors].sort((a, b) => a - b);
  if (!routes.restGap)
  {
    const fixed = new Set(sorted);
    return {
      start: { index: 0, previous: 0 },
      key: restWalkKey,
      steps: (state, floor) => [{ state, rest: fixed.has(floor) }],
    };
  }
  const spread = routes.restFloorSpread || 0;
  const movable = movingRests(sorted, count);
  const fixed = new Set(sorted.filter(floor => !movable.includes(floor)));
  const choicesByState = new Map();
  const choicesOf = state =>
  {
    const key = restWalkKey(state);
    if (!choicesByState.has(key))
    {
      choicesByState.set(key, choicesFor(state));
    }
    return choicesByState.get(key);
  };
  const choicesFor = state =>
  {
    const place = {
      previous: state.previous,
      authored: movable[state.index],
      next: movable[state.index + 1],
      count,
      restGap: routes.restGap,
      spread,
      lowest,
    };
    return RestChoices(RestCandidates(place), place.authored, spread);
  };
  const steps = (state, floor) =>
  {
    if (state.index >= movable.length)
    {
      return [{ state, rest: fixed.has(floor) }];
    }
    const choices = choicesOf(state);
    const passed = choices.filter(choice => choice < floor);
    if (passed.length === choices.length)
    {
      const advanced = passed.map(choice => ({ index: state.index + 1, previous: choice }));
      return advanced.flatMap(next => steps(next, floor));
    }
    const ways = [];
    if (choices.includes(floor))
    {
      ways.push({ state: { index: state.index + 1, previous: floor }, rest: true });
    }
    if (Math.max(...choices) > floor)
    {
      ways.push({ state, rest: fixed.has(floor) });
    }
    return ways;
  };
  const start = sorted[0] === 1
    ? { index: 0, previous: 1 }
    : { index: 0, previous: 0 };
  return { start, key: restWalkKey, steps };
}
