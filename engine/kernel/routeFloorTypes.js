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

// A branched route gives every lane one elite on a free depth. Pins must leave one free
// (or pin an elite) on the depths where every lane is open.
function laneEliteProblem(context, pinned) {
  const { routes, types, restDepths } = context;
  if (routes.maxBranches == null || !types.pinnable.includes(ELITE_TYPE)) return null;
  const first = Math.max(BranchFullDepth(routes.prebossNodes), routes.minimumThreatFloor);
  const last = routes.prebossNodes - NARROW_DEPTHS_BEFORE_BOSS;
  const open = depthRange(first, last).filter(depth => !restDepths.has(depth));
  const free = open.filter(depth => !pinned.has(depth));
  const pinnedElite = open.some(depth => pinned.get(depth) === ELITE_TYPE);
  if (!open.length || free.length || pinnedElite) return null;
  const choices = open.join(', ');
  return `floorTypes leaves a lane no floor for its elite. Keep one of depths ${choices} unpinned`
    + ' or pin it to elite';
}

// shopsPerBranch gives every branch one shop on a free depth of GUARANTEED_SHOP_DEPTHS. Pins
// must leave one free there, or pin a shop on a branch depth; a branch has a lane on each.
function branchShopProblem(context, pinned) {
  const { routes, types, restDepths } = context;
  if (routes.maxBranches == null || !(routes.shopsPerBranch > 0)) return null;
  if (!types.pinnable.includes(SHOP_TYPE)) return null;
  const last = Math.min(GUARANTEED_SHOP_DEPTHS.last, routes.prebossNodes);
  const range = depthRange(GUARANTEED_SHOP_DEPTHS.first, last);
  const open = range.filter(depth => !restDepths.has(depth));
  const free = open.filter(depth => !pinned.has(depth));
  const pinnedShop = [...pinned].some(([depth, type]) =>
    type === SHOP_TYPE && depth >= FIRST_BRANCH_DEPTH);
  if (!open.length || free.length || pinnedShop) return null;
  const choices = open.join(', ');
  return `floorTypes leaves a branch no floor for its shop. Keep one of depths ${choices} unpinned`
    + ' or pin it to shop';
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
  const context = { routes, types, restDepths: possibleRestDepths(routes) };
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
  return slotProblems.filter(problem => problem !== null);
}

// The pinned depths as a Map of depth number to room type; empty when floorTypes is absent.
export function PinnedFloorTypes(floorTypes) {
  if (!isPlainObject(floorTypes)) return new Map();
  return new Map(Object.entries(floorTypes).map(([depthKey, type]) => [Number(depthKey), type]));
}
