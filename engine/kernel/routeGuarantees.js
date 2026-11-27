// A branched route promises every lane an elite and, with shopsPerBranch, every branch a shop,
// each on a free depth. Elites are placed first and a shop never takes an elite's slot. Each
// promise is a requirement: it holds when a pin covers it or one of its spans has enough free
// depths. Pins are refused only when they break a requirement that held without them.
import {
  BranchFullDepth,
  LaneLastDepths,
  PinnableDepths,
  SureFreeCount,
} from './routeDepths.js';
import {
  ELITE_ROOM,
  SHOP_ROOM,
  HasPinnedRoom,
} from './routeFloorPins.js';

const NO_PINS = new Map();

// A span of depths that must hold `needed` free floors.
function freeSpan(first, last, needed)
{
  return {
    first,
    last,
    needed,
  };
}

// A pinned `room` from first to last that keeps a promise on its own.
function pinCover(room, first, last)
{
  return {
    room,
    first,
    last,
  };
}

function laneEliteRequirements(routes, shape)
{
  const fullDepth = BranchFullDepth(routes.prebossNodes, shape);
  const first = Math.max(fullDepth, routes.minimumThreatFloor);
  const lastDepths = LaneLastDepths(routes.prebossNodes, shape).filter(last => last >= first);
  return lastDepths.map(last => ({
    group: ELITE_ROOM,
    subject: 'a lane no free floor for its elite',
    fix: 'an elite',
    spans: [freeSpan(first, last, 1)],
    coveredBy: [pinCover(ELITE_ROOM, fullDepth, last)],
  }));
}

function shopSpan(routes, shape)
{
  const { first, last } = shape.guaranteedShopDepths;
  return { first, last: Math.min(last, routes.prebossNodes) };
}

// Only a shop pinned on a guaranteed shop depth stands in for the branch's shop.
function branchShopRequirement(routes, shape)
{
  const shop = shopSpan(routes, shape);
  return {
    group: SHOP_ROOM,
    subject: 'a branch no free floor for its shop',
    fix: 'a shop',
    spans: [freeSpan(shop.first, shop.last, 1)],
    coveredBy: [pinCover(SHOP_ROOM, shop.first, shop.last)],
  };
}

// Two free shop depths while every lane is open, or one too early for an elite, keep the shop.
function sharedSlotRequirement(routes, shape)
{
  const shop = shopSpan(routes, shape);
  const fullDepth = BranchFullDepth(routes.prebossNodes, shape);
  const eliteFirst = Math.max(fullDepth, routes.minimumThreatFloor);
  const openLast = routes.prebossNodes - shape.narrowDepthsBeforeBoss;
  const earliestElite = Math.max(shape.firstBranchDepth, routes.minimumThreatFloor);
  return {
    group: SHOP_ROOM,
    subject: "a branch's shop only floors its elites can take",
    fix: 'a shop',
    spans: [
      freeSpan(shop.first, Math.min(shop.last, openLast), 2),
      freeSpan(shop.first, earliestElite - 1, 1),
    ],
    coveredBy: [
      pinCover(SHOP_ROOM, shop.first, shop.last),
      pinCover(ELITE_ROOM, eliteFirst, openLast),
    ],
  };
}

// The requirements this route makes, from its settings and routeShape.
export function RouteRequirements(routes, shape, types)
{
  if (routes.maxBranches == null)
  {
    return [];
  }
  const elites = types.pinnable.includes(ELITE_ROOM);
  const shops = routes.shopsPerBranch > 0 && types.pinnable.includes(SHOP_ROOM);
  const requirements = elites
    ? laneEliteRequirements(routes, shape)
    : [];
  if (shops)
  {
    requirements.push(branchShopRequirement(routes, shape));
  }
  if (shops && elites)
  {
    requirements.push(sharedSlotRequirement(routes, shape));
  }
  return requirements;
}

function holds(requirement, depths, pinned)
{
  const covered = requirement.coveredBy
    .some(cover => HasPinnedRoom(pinned, cover.room, cover.first, cover.last));
  if (covered)
  {
    return true;
  }
  return requirement.spans
    .some(span => SureFreeCount(depths, pinned, span.first, span.last) >= span.needed);
}

function problemText(requirement, depths)
{
  const span = requirement.spans[0];
  const choices = PinnableDepths(depths, span.first, span.last);
  const amount = span.needed === 1
    ? 'one'
    : 'two';
  const keep = choices.length === 1
    ? `Keep depth ${choices[0]}`
    : `Keep ${amount} of depths ${choices.join(', ')}`;
  return `floorTypes leaves ${requirement.subject}. ${keep} unpinned, or pin ${requirement.fix}`;
}

// One plain sentence per broken promise; a later requirement of a broken group is skipped.
export function RequirementProblems(requirements, depths, pinned)
{
  const broken = new Set();
  const problems = [];
  for (const requirement of requirements)
  {
    const skipped = broken.has(requirement.group);
    if (skipped || holds(requirement, depths, pinned) || !holds(requirement, depths, NO_PINS))
    {
      continue;
    }
    broken.add(requirement.group);
    problems.push(problemText(requirement, depths));
  }
  return problems;
}
