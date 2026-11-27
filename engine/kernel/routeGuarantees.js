// A branched route gives every lane one guaranteed elite and, with shopsPerBranch, every branch
// one guaranteed shop, drawn as buildBranchedActMap does: elites first, on any free depth of the
// lane, then the shop on a free shop-depth slot no elite took. The check walks depth by depth over
// small states (open lanes, rest walk, each lane's progress), never whole map histories, and
// refuses pins when some reachable map breaks a guarantee that held there without them.
import { DepthRange, RestWalk } from './routeDepths.js';
import {
  BranchLaneCounts,
  BranchOpenings,
  BranchWalk,
  BranchSteps,
} from './routeBranchShapes.js';
import { ELITE_ROOM, SHOP_ROOM } from './routeFloorPins.js';

// Lane progress codes. CLOSED marks a lane not open (yet, or any more).
const CLOSED = -1;
// Shop walk, with pins: no free slot, none but its elite covered by a pin, one its elite may take.
const SLOT_NONE = 0;
const SLOT_COVERED = 1;
const SLOT_ELITE_ONE = 2;
// Shop walk, without pins: no slot, or one its elite may take; more keeps the shop.
const PLAIN_NONE = 0;
const PLAIN_ELITE_ONE = 1;
// Elite walk: open with no elite floor yet, one only without pins, or holding one with pins.
const ELITE_NONE = 0;
const ELITE_UNPINNED_ONLY = 1;
const ELITE_HELD = 2;

function floorFacts(rules, floor, rest, pinned)
{
  return {
    rest,
    pinnedType: pinned.get(floor) ?? null,
    inShop: floor >= rules.shopFirst && floor <= rules.shopLast,
    eliteable: rules.elites && floor >= rules.firstElite,
  };
}

// With pins the lane must keep failing; null means it now keeps a slot, so the path is dropped.
function nextSlot(slot, facts)
{
  if (facts.pinnedType === ELITE_ROOM)
  {
    return slot === SLOT_ELITE_ONE
      ? null
      : SLOT_COVERED;
  }
  if (facts.pinnedType !== null || !facts.inShop)
  {
    return slot;
  }
  return slot === SLOT_NONE && facts.eliteable
    ? SLOT_ELITE_ONE
    : null;
}

// Without pins; null means the lane keeps a slot, which the walk records in `kept`.
function nextPlain(plain, facts)
{
  if (!facts.inShop || plain === null)
  {
    return plain;
  }
  return plain === PLAIN_NONE && facts.eliteable
    ? PLAIN_ELITE_ONE
    : null;
}

// Each shop lane is two codes, the pinned slot and the plain one, side by side.
const SHOP_PLAN = {
  width: 2,
  open: (codes, lane) =>
  {
    codes[2 * lane] = SLOT_NONE;
    codes[2 * lane + 1] = PLAIN_NONE;
  },
  close: (walkState, lane) =>
  {
    walkState.codes[2 * lane] = CLOSED;
    walkState.codes[2 * lane + 1] = CLOSED;
  },
  apply: (walkState, lane, facts) =>
  {
    if (facts.rest)
    {
      return true;
    }
    const { codes } = walkState;
    const slot = nextSlot(codes[2 * lane], facts);
    if (slot === null)
    {
      return false;
    }
    const plain = nextPlain(codes[2 * lane + 1], facts);
    codes[2 * lane] = slot;
    codes[2 * lane + 1] = plain ?? PLAIN_NONE;
    walkState.flag = walkState.flag || plain === null;
    return true;
  },
  broken: walkState => walkState.flag,
};

const ELITE_PLAN = {
  width: 1,
  open: (codes, lane) =>
  {
    codes[lane] = ELITE_NONE;
  },
  close: (walkState, lane) =>
  {
    walkState.flag = walkState.flag || walkState.codes[lane] === ELITE_UNPINNED_ONLY;
    walkState.codes[lane] = CLOSED;
  },
  apply: (walkState, lane, facts) =>
  {
    if (facts.rest || !facts.eliteable)
    {
      return true;
    }
    const { codes } = walkState;
    const held = facts.pinnedType === null || facts.pinnedType === ELITE_ROOM;
    if (held)
    {
      codes[lane] = ELITE_HELD;
    }
    else if (codes[lane] === ELITE_NONE)
    {
      codes[lane] = ELITE_UNPINNED_ONLY;
    }
    return true;
  },
  broken: walkState => walkState.flag || walkState.codes.includes(ELITE_UNPINNED_ONLY),
};

function entryKey(entry, restWalk)
{
  const { open, restState, walkState } = entry;
  const flag = walkState.flag
    ? 1
    : 0;
  return `${open.lo}:${open.hi}|${restWalk.key(restState)}|${walkState.codes.join(',')}|${flag}`;
}

function enterFloor(plan, entry, before, facts)
{
  const walkState = entry.walkState;
  for (let lane = entry.open.lo; lane <= entry.open.hi; lane++)
  {
    const opened = !before || lane < before.lo || lane > before.hi;
    if (opened)
    {
      plan.open(walkState.codes, lane);
    }
    if (!plan.apply(walkState, lane, facts))
    {
      return false;
    }
  }
  return true;
}

function closedState(plan, walkState, before, after)
{
  const next = { codes: [...walkState.codes], flag: walkState.flag };
  for (let lane = before.lo; lane <= before.hi; lane++)
  {
    if (lane < after.lo || lane > after.hi)
    {
      plan.close(next, lane);
    }
  }
  return next;
}

function addEntry(frontier, entry, restWalk)
{
  const key = entryKey(entry, restWalk);
  if (!frontier.has(key))
  {
    frontier.set(key, entry);
  }
}

function restStatesBefore(restWalk, firstDepth)
{
  let states = [restWalk.start];
  for (let floor = 1; floor < firstDepth; floor++)
  {
    states = states.flatMap(state => restWalk.steps(state, floor).map(way => way.state));
  }
  return states;
}

function firstFrontier(plan, rules, context)
{
  const { walk, restWalk, pinned } = context;
  const frontier = new Map();
  const blank = Array(walk.lanes * plan.width).fill(CLOSED);
  for (const open of BranchOpenings(walk.lanes))
  {
    for (const restState of restStatesBefore(restWalk, rules.firstDepth))
    {
      for (const way of restWalk.steps(restState, rules.firstDepth))
      {
        const facts = floorFacts(rules, rules.firstDepth, way.rest, pinned);
        const walkState = { codes: [...blank], flag: false };
        const entry = { open, restState: way.state, walkState };
        if (enterFloor(plan, entry, null, facts))
        {
          addEntry(frontier, entry, restWalk);
        }
      }
    }
  }
  return frontier;
}

function nextFrontier(plan, rules, frontier, floor, context)
{
  const { walk, restWalk, pinned } = context;
  const next = new Map();
  for (const entry of frontier.values())
  {
    for (const open of BranchSteps(entry.open, floor, walk))
    {
      const closed = closedState(plan, entry.walkState, entry.open, open);
      for (const way of restWalk.steps(entry.restState, floor + 1))
      {
        const facts = floorFacts(rules, floor + 1, way.rest, pinned);
        const walkState = { codes: [...closed.codes], flag: closed.flag };
        const step = { open, restState: way.state, walkState };
        if (enterFloor(plan, step, entry.open, facts))
        {
          addEntry(next, step, restWalk);
        }
      }
    }
  }
  return next;
}

// True when some map this branch can draw breaks the plan's guarantee.
function walkFindsBreak(plan, rules, context)
{
  let frontier = firstFrontier(plan, rules, context);
  for (let floor = rules.firstDepth; floor < rules.count && frontier.size; floor++)
  {
    frontier = nextFrontier(plan, rules, frontier, floor, context);
  }
  return [...frontier.values()].some(entry => plan.broken(entry.walkState));
}

function guaranteeRules(routes, shape, types)
{
  // A branch exists from firstBranchDepth on; the shared opening holds no branch shop.
  const shopFirst = Math.max(shape.guaranteedShopDepths.first, shape.firstBranchDepth);
  const shopLast = Math.min(shape.guaranteedShopDepths.last, routes.prebossNodes);
  return {
    count: routes.prebossNodes,
    firstDepth: shape.firstBranchDepth,
    firstElite: Math.max(shape.firstBranchDepth, routes.minimumThreatFloor),
    shopFirst,
    shopLast,
    elites: types.pinnable.includes(ELITE_ROOM),
    shops: routes.shopsPerBranch > 0 && types.pinnable.includes(SHOP_ROOM),
  };
}

// The rest walks every act can take; acts before startRestFromAct drop depth 1.
function actRestWalks(routes, shape)
{
  const authored = routes.restFloors || [];
  const variants = [authored];
  const startRest = routes.startRestFromAct ?? null;
  if (startRest !== null && startRest > 1 && authored.includes(1))
  {
    variants.push(authored.filter(depth => depth !== 1));
  }
  return variants.map(restFloors => RestWalk(restFloors, routes, shape.firstBranchDepth));
}

function pinnedIn(pinned, first, last)
{
  return DepthRange(first, last).filter(depth => pinned.has(depth));
}

function brokenGuarantees(rules, routes, shape, pinned)
{
  const pinnedShop = pinnedIn(pinned, rules.shopFirst, rules.shopLast)
    .some(depth => pinned.get(depth) === SHOP_ROOM);
  const broken = { elite: false, shop: false };
  for (const restWalk of actRestWalks(routes, shape))
  {
    for (const lanes of BranchLaneCounts(routes))
    {
      const context = { walk: BranchWalk(lanes, routes, shape), restWalk, pinned };
      const checkElite = rules.elites && !broken.elite;
      broken.elite = broken.elite || (checkElite && walkFindsBreak(ELITE_PLAN, rules, context));
      const checkShop = rules.shops && !pinnedShop && !broken.shop;
      broken.shop = broken.shop || (checkShop && walkFindsBreak(SHOP_PLAN, rules, context));
    }
  }
  return broken;
}

// One plain sentence per broken guarantee.
export function GuaranteeProblems(routes, shape, types, pinned)
{
  const count = routes.prebossNodes;
  if (routes.maxBranches == null || pinned.size === 0 || count < shape.firstBranchDepth)
  {
    return [];
  }
  const rules = guaranteeRules(routes, shape, types);
  const broken = brokenGuarantees(rules, routes, shape, pinned);
  const texts = [];
  if (broken.elite)
  {
    const depths = pinnedIn(pinned, rules.firstElite, count).join(', ');
    texts.push('floorTypes can leave a lane no free floor for its elite. Unpin one of depths'
      + ` ${depths}, or pin an elite`);
  }
  if (broken.shop)
  {
    const depths = pinnedIn(pinned, rules.shopFirst, rules.shopLast).join(', ');
    texts.push('floorTypes can leave a branch no free floor for its shop. Unpin one of depths'
      + ` ${depths}, or pin a shop on depth ${rules.shopFirst} to ${rules.shopLast}`);
  }
  return texts;
}
