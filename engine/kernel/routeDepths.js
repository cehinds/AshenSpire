// Depth math for configured routes, shared by the map build and the resolver. `shape` is the
// routes module's routeShape. A moving rest lands on exactly one depth of its restFloorSpread
// span, so a span of several depths always leaves the others free; overlapping spans merge.

export function DepthRange(first, last) {
  const length = Math.max(0, last - first + 1);
  return Array.from({ length }, (_, index) => first + index);
}

// The depths a rest can land on: the authored ones, widened by restFloorSpread when it moves.
export function PossibleRestDepths(routes) {
  const authored = routes.restFloors || [];
  const depths = new Set(authored);
  if (!routes.restGap) return depths;
  const spread = routes.restFloorSpread || 0;
  for (const floor of movingRests(routes)) {
    for (const depth of DepthRange(floor - spread, floor + spread)) depths.add(depth);
  }
  return depths;
}

function movingRests(routes) {
  const authored = routes.restFloors || [];
  return authored.filter(floor => floor !== 1 && floor !== routes.prebossNodes);
}

// Merged spans of the moving rests, each with how many rests land inside it.
export function RestSpans(routes, shape) {
  const spread = routes.restFloorSpread || 0;
  if (!routes.restGap || spread === 0) return [];
  const spans = [];
  for (const floor of [...movingRests(routes)].sort((a, b) => a - b)) {
    const first = Math.max(shape.firstBranchDepth, floor - spread);
    const last = Math.min(routes.prebossNodes - 1, floor + spread);
    const previous = spans.at(-1);
    if (previous && first <= previous.last) {
      previous.last = Math.max(previous.last, last);
      previous.rests += 1;
      continue;
    }
    spans.push({ first, last, rests: 1 });
  }
  return spans;
}

// How many depths from first to last are sure to be free of rests and pins in every act.
export function SureFreeCount(depths, pinned, first, last) {
  const range = DepthRange(first, last);
  const plain = range.filter(depth => !depths.restDepths.has(depth) && !pinned.has(depth));
  let count = plain.length;
  for (const span of depths.restSpans) {
    const inside = range.filter(depth => depth >= span.first && depth <= span.last);
    count += Math.max(0, inside.length - span.rests);
  }
  return count;
}

// The depths from first to last a pin may use: those no rest can land on.
export function PinnableDepths(depths, first, last) {
  return DepthRange(first, last).filter(depth => !depths.restDepths.has(depth));
}

// The depth by which every lane of a branch is open.
export function BranchFullDepth(prebossNodes, shape) {
  return Math.max(shape.earliestFullDepth, prebossNodes - shape.fullDepthsBeforeBoss);
}

// Every depth a lane can end on: a wide branch may close a lane near the boss.
export function LaneLastDepths(prebossNodes, shape) {
  const first = prebossNodes - shape.narrowDepthsBeforeBoss;
  return DepthRange(first, prebossNodes);
}

// The rest facts every check reads, built once per route.
export function RouteDepths(routes, shape) {
  return { restDepths: PossibleRestDepths(routes), restSpans: RestSpans(routes, shape) };
}
