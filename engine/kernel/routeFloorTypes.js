// routes.floorTypes (owner, 2026-11-27): pins every node on a depth to one room type, like
// firstFloor pins depth 1. One table for every act; the map build and the resolver share it.
// Room types come from the route's visibleTypes and hiddenTypes; limits from its settings.
const ELITE_TYPE = 'elite';
const ROUTE_PLACED_TYPES = ['rest', 'boss'];
const WHOLE_NUMBER = /^[0-9]+$/;
const SHAPE_PROBLEM = 'floorTypes must map a depth to a room type, like { "4": "shop" }';
// Branch shape (drawBranchShape, src/engine/actmap.js): every lane is open from the full depth
// until two depths before the boss, where a wide branch may narrow.
const EARLIEST_FULL_DEPTH = 3;
const FULL_DEPTHS_BEFORE_BOSS = 3;
const NARROW_DEPTHS_BEFORE_BOSS = 2;
const SHOP_TYPE = 'shop';
// Depth 1 is the shared start node; each branch's own lanes begin on depth 2.
const FIRST_BRANCH_DEPTH = 2;
// shopsPerBranch puts each branch's guaranteed shop on a depth in this range.
export const GUARANTEED_SHOP_DEPTHS = Object.freeze({ first: 4, last: 8 });

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// The route's room types, and those a depth can be pinned to (not placed by the route itself).
function routeTypesOf(routeContent) {
  const hiddenTypes = routeContent.hiddenTypes || [];
  const visibleTypes = routeContent.visibleTypes || [];
  const all = [...new Set([...hiddenTypes, ...visibleTypes])];
  const pinnable = all.filter(type => !ROUTE_PLACED_TYPES.includes(type));
  return { all, pinnable };
}

// The depths a rest can land on: the authored ones, plus the restFloorSpread window of each rest
// that PlaceRestFloors may move (src/engine/actmap.js). Depth 1 and the pre-boss depth never move.
function possibleRestDepths(routes) {
  const authored = routes.restFloors || [];
  const depths = new Set(authored);
  if (!routes.restGap) return depths;
  const spread = routes.restFloorSpread || 0;
  for (const floor of authored) {
    if (floor === 1 || floor === routes.prebossNodes) continue;
    for (let depth = floor - spread; depth <= floor + spread; depth++) depths.add(depth);
  }
  return depths;
}

function floorTypeProblem(depthKey, type, context) {
  const { routes, types, restDepths } = context;
  const lastDepth = routes.prebossNodes;
  const depth = Number(depthKey);
  const wholeNumber = WHOLE_NUMBER.test(depthKey);
  if (!wholeNumber || depth < 1 || depth > lastDepth) {
    return `depth "${depthKey}" must be a whole number from 1 to ${lastDepth}`;
  }
  if (!types.all.includes(type)) {
    return `depth ${depth}: "${type}" is not a room type this route uses`;
  }
  if (!types.pinnable.includes(type)) {
    return `depth ${depth} cannot be "${type}": the route places that room itself`;
  }
  if (restDepths.has(depth)) return `depth ${depth} is or can become a rest floor`;
  if (type === ELITE_TYPE && depth < routes.minimumThreatFloor) {
    return `depth ${depth}: an elite needs depth ${routes.minimumThreatFloor} or later`;
  }
  const firstFloor = routes.firstFloor ?? null;
  if (depth === 1 && firstFloor !== null) return 'depth 1 is already set by firstFloor';
  return null;
}

function depthRange(first, last) {
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

// Each moving rest lands on exactly one depth of its restFloorSpread window, so a window holding
// several depths always leaves the others free. Overlapping windows merge and share their rests.
function restWindows(routes) {
  const spread = routes.restFloorSpread || 0;
  if (!routes.restGap || spread === 0) return [];
  const movable = (routes.restFloors || [])
    .filter(floor => floor !== 1 && floor !== routes.prebossNodes)
    .sort((a, b) => a - b);
  const windows = [];
  for (const floor of movable) {
    const first = Math.max(FIRST_BRANCH_DEPTH, floor - spread);
    const last = Math.min(routes.prebossNodes - 1, floor + spread);
    const previous = windows.at(-1);
    if (previous && first <= previous.last) {
      previous.last = Math.max(previous.last, last);
      previous.rests += 1;
      continue;
    }
    windows.push({ first, last, rests: 1 });
  }
  return windows;
}

// How many depths from first to last are sure to be free (no rest, no pin) in every act.
function sureFreeDepths(context, pinned, first, last) {
  const { restDepths, windows } = context;
  const range = depthRange(first, last);
  const plain = range.filter(depth => !restDepths.has(depth) && !pinned.has(depth));
  let count = plain.length;
  for (const window of windows) {
    const inside = range.filter(depth => depth >= window.first && depth <= window.last);
    count += Math.max(0, inside.length - window.rests);
  }
  return { count, plain };
}

// The depths from first to last that a pin may use: the ones no rest can land on.
function pinnableDepths(context, first, last) {
  return depthRange(first, last).filter(depth => !context.restDepths.has(depth));
}

// Pins cause a problem only when they turn a route that had room into one that has none.
function pinsUseUp(context, pinned, first, last, needed) {
  const withPins = sureFreeDepths(context, pinned, first, last).count;
  const withoutPins = sureFreeDepths(context, new Map(), first, last).count;
  return withPins < needed && withoutPins >= needed;
}

function eliteDepths(routes) {
  const first = Math.max(BranchFullDepth(routes.prebossNodes), routes.minimumThreatFloor);
  const last = routes.prebossNodes - NARROW_DEPTHS_BEFORE_BOSS;
  return { first, last };
}

function shopDepths(routes) {
  const last = Math.min(GUARANTEED_SHOP_DEPTHS.last, routes.prebossNodes);
  return { first: GUARANTEED_SHOP_DEPTHS.first, last };
}

function hasPinnedType(pinned, type, first, last) {
  return [...pinned].some(([depth, pinnedType]) =>
    pinnedType === type && depth >= first && depth <= last);
}

// A branched route gives every lane one elite on a free depth. Pins must leave one free
// (or pin an elite) on the depths where every lane is open.
function laneEliteProblem(context, pinned) {
  const { routes, types } = context;
  if (routes.maxBranches == null || !types.pinnable.includes(ELITE_TYPE)) return null;
  const { first, last } = eliteDepths(routes);
  if (hasPinnedType(pinned, ELITE_TYPE, first, last)) return null;
  if (!pinsUseUp(context, pinned, first, last, 1)) return null;
  const choices = pinnableDepths(context, first, last).join(', ');
  return `floorTypes leaves a lane no floor for its elite. Keep one of depths ${choices} unpinned`
    + ' or pin it to elite';
}

// shopsPerBranch gives every branch one shop on a free depth of GUARANTEED_SHOP_DEPTHS. Pins
// must leave one free there, or pin a shop on a branch depth; a branch has a lane on each.
function branchShopProblem(context, pinned) {
  const { routes, types } = context;
  if (routes.maxBranches == null || !(routes.shopsPerBranch > 0)) return null;
  if (!types.pinnable.includes(SHOP_TYPE)) return null;
  if (hasPinnedType(pinned, SHOP_TYPE, FIRST_BRANCH_DEPTH, routes.prebossNodes)) return null;
  const { first, last } = shopDepths(routes);
  if (!pinsUseUp(context, pinned, first, last, 1)) return null;
  const choices = pinnableDepths(context, first, last).join(', ');
  return `floorTypes leaves a branch no floor for its shop. Keep one of depths ${choices} unpinned`
    + ' or pin it to shop';
}

// Guaranteed elites are placed before the shop, and a shop never takes an elite's slot. Two free
// shop depths before the narrowing keep the shop: a lane open on the first is open on the second,
// and its one elite takes only one. A free shop depth too early for an elite keeps it too.
function sharedSlotProblem(context, pinned) {
  const { routes, types } = context;
  if (routes.maxBranches == null || !(routes.shopsPerBranch > 0)) return null;
  if (!types.pinnable.includes(SHOP_TYPE) || !types.pinnable.includes(ELITE_TYPE)) return null;
  if (hasPinnedType(pinned, SHOP_TYPE, FIRST_BRANCH_DEPTH, routes.prebossNodes)) return null;
  const elite = eliteDepths(routes);
  if (hasPinnedType(pinned, ELITE_TYPE, elite.first, elite.last)) return null;
  const shop = shopDepths(routes);
  const earliestElite = Math.max(FIRST_BRANCH_DEPTH, routes.minimumThreatFloor);
  const early = sureFreeDepths(context, pinned, shop.first, earliestElite - 1).count;
  if (early > 0) return null;
  if (!pinsUseUp(context, pinned, shop.first, Math.min(shop.last, elite.last), 2)) return null;
  const choices = pinnableDepths(context, shop.first, shop.last).join(', ');
  return "floorTypes leaves a branch's shop one floor that its elites can take. Keep two of"
    + ` depths ${choices} unpinned, or pin a shop`;
}

// The depth by which every lane of a branch is open.
export function BranchFullDepth(prebossNodes) {
  return Math.max(EARLIEST_FULL_DEPTH, prebossNodes - FULL_DEPTHS_BEFORE_BOSS);
}

// Every problem with routes.floorTypes, as plain sentences. Absent, null or {} has none.
// `routes` holds the settings; `routeContent` the route's visibleTypes and hiddenTypes.
export function RouteFloorTypeProblems(routes, routeContent) {
  const floorTypes = routes.floorTypes ?? null;
  if (floorTypes === null) return [];
  if (!isPlainObject(floorTypes)) return [SHAPE_PROBLEM];
  const types = routeTypesOf(routeContent);
  const restDepths = possibleRestDepths(routes);
  const context = { routes, types, restDepths, windows: restWindows(routes) };
  const problems = [];
  for (const [depthKey, type] of Object.entries(floorTypes)) {
    const problem = floorTypeProblem(depthKey, type, context);
    if (problem !== null) problems.push(problem);
  }
  if (problems.length) return problems;
  const pinned = PinnedFloorTypes(floorTypes);
  const slotProblems = [
    laneEliteProblem(context, pinned),
    branchShopProblem(context, pinned),
  ];
  const found = slotProblems.filter(problem => problem !== null);
  if (found.length) return found;
  const sharedProblem = sharedSlotProblem(context, pinned);
  return sharedProblem === null
    ? []
    : [sharedProblem];
}

// The pinned depths as a Map of depth number to room type; empty when floorTypes is absent.
export function PinnedFloorTypes(floorTypes) {
  if (!isPlainObject(floorTypes)) return new Map();
  return new Map(Object.entries(floorTypes).map(([depthKey, type]) => [Number(depthKey), type]));
}
