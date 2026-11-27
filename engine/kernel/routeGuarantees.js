// A branched route gives every lane one guaranteed elite and, with shopsPerBranch, every branch
// one guaranteed shop, drawn as buildBranchedActMap does: elites first, on any free depth of the
// lane, then the shop on a free shop-depth slot no elite took. For every branch shape and rest
// placement the builder can roll, pins are refused when they break a guarantee that held without.
import { DepthRange, RestPlacements } from './routeDepths.js';
import { BranchLaneCounts, BranchShapes } from './routeBranchShapes.js';
import { ELITE_ROOM, SHOP_ROOM } from './routeFloorPins.js';

const NO_PINS = new Map();

function laneOpen(active, depth, lane)
{
  const open = active[depth];
  return !!open && lane >= open.lo && lane <= open.hi;
}

function branchOpen(active, depth)
{
  return !!active[depth];
}

// The depths a lane's guaranteed elite may take, or null when a pinned elite already holds it.
function eliteDepths(rules, active, lane, rests, pinned)
{
  const laneDepths = DepthRange(rules.firstElite, rules.count)
    .filter(depth => laneOpen(active, depth, lane));
  const pinnedElite = laneDepths.some(depth => pinned.get(depth) === ELITE_ROOM);
  if (pinnedElite)
  {
    return null;
  }
  return laneDepths.filter(depth => !rests.has(depth) && !pinned.has(depth));
}

function laneHoldsElite(rules, active, lane, rests, pinned)
{
  const depths = eliteDepths(rules, active, lane, rests, pinned);
  return depths === null || depths.length > 0;
}

// A lane keeps a shop slot unless its only one may be its own elite's depth.
function laneKeepsShopSlot(rules, active, lane, rests, pinned)
{
  const slots = DepthRange(rules.shopFirst, rules.shopLast)
    .filter(depth => laneOpen(active, depth, lane) && !rests.has(depth) && !pinned.has(depth));
  if (slots.length !== 1)
  {
    return slots.length > 1;
  }
  const elites = rules.elites
    ? eliteDepths(rules, active, lane, rests, pinned)
    : null;
  return elites === null || !elites.includes(slots[0]);
}

function branchHoldsShop(rules, active, lanes, rests, pinned)
{
  const shopDepths = DepthRange(rules.shopFirst, rules.shopLast)
    .filter(depth => branchOpen(active, depth));
  const pinnedShop = shopDepths.some(depth => pinned.get(depth) === SHOP_ROOM);
  if (pinnedShop)
  {
    return true;
  }
  return DepthRange(0, lanes - 1)
    .some(lane => laneKeepsShopSlot(rules, active, lane, rests, pinned));
}

function pinnedOn(pinned, depths)
{
  return depths.filter(depth => pinned.has(depth));
}

function brokenElite(rules, active, lanes, rests, pinned)
{
  for (const lane of DepthRange(0, lanes - 1))
  {
    const broken = !laneHoldsElite(rules, active, lane, rests, pinned)
      && laneHoldsElite(rules, active, lane, rests, NO_PINS);
    if (broken)
    {
      const depths = DepthRange(rules.firstElite, rules.count)
        .filter(depth => laneOpen(active, depth, lane));
      return pinnedOn(pinned, depths);
    }
  }
  return null;
}

function brokenShop(rules, active, lanes, rests, pinned)
{
  const broken = !branchHoldsShop(rules, active, lanes, rests, pinned)
    && branchHoldsShop(rules, active, lanes, rests, NO_PINS);
  if (!broken)
  {
    return null;
  }
  return pinnedOn(pinned, DepthRange(rules.shopFirst, rules.shopLast));
}

function eliteText(depths)
{
  return `floorTypes can leave a lane no free floor for its elite. Unpin one of depths`
    + ` ${depths.join(', ')}, or pin an elite`;
}

function shopText(depths, rules)
{
  return `floorTypes can leave a branch no free floor for its shop. Unpin one of depths`
    + ` ${depths.join(', ')}, or pin a shop on depth ${rules.shopFirst} to ${rules.shopLast}`;
}

// The rest placements every act can roll; acts before startRestFromAct drop depth 1.
function actRestPlacements(routes, shape)
{
  const authored = routes.restFloors || [];
  const variants = [authored];
  const startRest = routes.startRestFromAct ?? null;
  if (startRest !== null && startRest > 1 && authored.includes(1))
  {
    variants.push(authored.filter(depth => depth !== 1));
  }
  const spread = routes.restFloorSpread || 0;
  const lowest = shape.firstBranchDepth;
  return variants.flatMap(restFloors =>
    RestPlacements(restFloors, routes.prebossNodes, routes.restGap, spread, lowest));
}

function guaranteeRules(routes, shape, types)
{
  const shopsWanted = routes.shopsPerBranch > 0 && types.pinnable.includes(SHOP_ROOM);
  return {
    count: routes.prebossNodes,
    firstElite: Math.max(shape.firstBranchDepth, routes.minimumThreatFloor),
    shopFirst: shape.guaranteedShopDepths.first,
    shopLast: Math.min(shape.guaranteedShopDepths.last, routes.prebossNodes),
    elites: types.pinnable.includes(ELITE_ROOM),
    shops: shopsWanted,
  };
}

function caseProblems(rules, active, lanes, rests, pinned)
{
  const problems = {};
  if (rules.elites)
  {
    problems.elite = brokenElite(rules, active, lanes, rests, pinned);
  }
  if (rules.shops)
  {
    problems.shop = brokenShop(rules, active, lanes, rests, pinned);
  }
  return problems;
}

// One plain sentence per broken guarantee, from the first shape and rests that break it.
export function GuaranteeProblems(routes, shape, types, pinned)
{
  if (routes.maxBranches == null || pinned.size === 0)
  {
    return [];
  }
  const rules = guaranteeRules(routes, shape, types);
  const found = {};
  for (const placement of actRestPlacements(routes, shape))
  {
    const rests = new Set(placement);
    for (const lanes of BranchLaneCounts(routes))
    {
      for (const active of BranchShapes(lanes, routes, shape))
      {
        const problems = caseProblems(rules, active, lanes, rests, pinned);
        found.elite = found.elite || problems.elite;
        found.shop = found.shop || problems.shop;
      }
    }
  }
  const texts = [];
  if (found.elite)
  {
    texts.push(eliteText(found.elite));
  }
  if (found.shop)
  {
    texts.push(shopText(found.shop, rules));
  }
  return texts;
}
