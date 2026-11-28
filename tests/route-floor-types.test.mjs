// routes.floorTypes: a pinned depth is that room type on every lane, in every act; without it the
// map draws as before; a bad table fails with a plain message. Depths, types and limits come from
// the loaded Core route config, so retuning routes.json moves the inputs, not the expectations.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import {
  resolveGameProfile,
  applyGameProfileToContent,
  bindGameProfileRegistries,
} from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { RouteShapeOf } from '../src/model/routeShape.js';
import {
  DepthRange,
  PossibleRestDepths,
  PinnableDepths,
  BranchFullDepth,
  RestWalk,
} from '../engine/kernel/routeDepths.js';
import {
  BranchLaneCount,
  BranchOpenings,
  BranchWalk,
  BranchSteps,
} from '../engine/kernel/routeBranchShapes.js';
import {
  RouteRoomTypes,
  ELITE_ROOM,
  SHOP_ROOM,
} from '../engine/kernel/routeFloorPins.js';

const SEEDS = [
  1,
  2,
  3,
  4,
  5,
  6,
];
const FLOOR_TYPES_PATH = '$/modules/routes/floorTypes';
const ELITE_REFUSAL = 'can leave a lane no free floor for its elite';
const SHOP_REFUSAL = 'can leave a branch no free floor for its shop';
const LANE_ID = /^n(\d+)_(\d+)$/;

function SetupCore(routes = {})
{
  const author = {
    formatVersion: 1,
    core: 'ashen.core@2.0.0',
    modules: { routes },
  };
  const profile = resolveGameProfile(author);
  const content = applyGameProfileToContent(contentBundle, profile);
  const registries = bindGameProfileRegistries(createRegistries(content), profile);
  const run = createRunState({
    seed: 73,
    classId: 'reaver',
    registries,
  });
  return { registries, run };
}

// The route facts every test derives its depths and types from.
function RouteConfig(routes = {})
{
  const core = SetupCore(routes);
  const settings = core.registries.gameProfile.modules.routes;
  const shape = RouteShapeOf(core.registries);
  const types = RouteRoomTypes(core.registries.gameProfile.content.routes, shape);
  const restDepths = PossibleRestDepths(settings);
  const count = settings.prebossNodes;
  const plain = types.pinnable.find(type => type !== ELITE_ROOM && type !== SHOP_ROOM);
  const fullDepth = BranchFullDepth(count, shape);
  const openLast = count - shape.narrowDepthsBeforeBoss;
  const eliteFirst = Math.max(fullDepth, settings.minimumThreatFloor);
  const shopLast = Math.min(shape.guaranteedShopDepths.last, count);
  return {
    core,
    settings,
    shape,
    types,
    count,
    plain,
    acts: settings.acts,
    eliteSpan: PinnableDepths(restDepths, eliteFirst, openLast),
    shopSpan: PinnableDepths(restDepths, shape.guaranteedShopDepths.first, shopLast),
    branchDepths: PinnableDepths(restDepths, shape.firstBranchDepth, count),
    restDepths,
  };
}

function BuildMap(core, seed, act)
{
  const rng = createRng(seed);
  const map = buildActMap(core.registries, rng, core.run.seatOrder[act - 1], act);
  return { map, counters: rng.getCounters() };
}

function EachMap(core, acts, visit)
{
  for (const seed of SEEDS)
  {
    for (let act = 1; act <= acts; act++)
    {
      visit(BuildMap(core, seed, act).map, `seed ${seed} act ${act}`);
    }
  }
}

function PinAll(depths, type)
{
  return Object.fromEntries(depths.map(depth => [depth, type]));
}

// A shop pinned on a branch depth outside the elite span covers every branch's shop.
function ShopPinOutside(config, span)
{
  const depth = config.branchDepths.find(candidate => !span.includes(candidate));
  return { [depth]: SHOP_ROOM };
}

function RoomsByLane(map)
{
  const lanes = new Map();
  for (const node of Object.values(map.nodes))
  {
    const match = LANE_ID.exec(node.id);
    if (!match || node.branch == null || node.actualType === 'rest') continue;
    const lane = `${node.branch}:${match[2]}`;
    if (!lanes.has(lane)) lanes.set(lane, new Set());
    lanes.get(lane).add(node.actualType);
  }
  return lanes;
}

function BranchesWith(map, room)
{
  const rooms = Object.values(map.nodes).filter(node => node.actualType === room);
  return new Set(rooms.map(node => node.branch));
}

function DepthList(depths)
{
  return depths.join(', ');
}

function RefusedWith(routes, phrase)
{
  const matches = error => error.path === FLOOR_TYPES_PATH && error.message.includes(phrase);
  assert.throws(() => SetupCore(routes), matches, phrase);
}

test('a pinned depth is that room type on every lane, for every seed and act', () =>
{
  const config = RouteConfig();
  const eliteDepth = config.eliteSpan[0];
  const shopDepth = config.shopSpan.find(depth => depth !== eliteDepth);
  const floorTypes = { [shopDepth]: SHOP_ROOM, [eliteDepth]: ELITE_ROOM };
  const randomElites = (config.settings.typeWeights || {})[ELITE_ROOM] > 0;
  EachMap(SetupCore({ floorTypes }), config.acts, (map, label) =>
  {
    for (const [depth, room] of Object.entries(floorTypes))
    {
      const nodes = Object.values(map.nodes).filter(node => node.floor === Number(depth));
      assert.ok(nodes.length >= map.bossIds.length, `${label} has depth ${depth}`);
      for (const node of nodes) assert.equal(node.actualType, room, `${label} ${node.id}`);
    }
    if (randomElites) return;
    const others = Object.values(map.nodes)
      .filter(node => node.actualType === ELITE_ROOM && node.floor !== eliteDepth);
    assert.deepEqual(others.map(node => node.id), [], `${label}: the pin is each lane's elite`);
  });
});

test('without floorTypes the map and its draws are the same as with an empty table', () =>
{
  const config = RouteConfig();
  const cleared = SetupCore({ floorTypes: null });
  assert.deepEqual(config.core.registries.gameProfile.content.routes.floorTypes, {});
  for (const seed of SEEDS)
  {
    for (let act = 1; act <= config.acts; act++)
    {
      const authored = BuildMap(config.core, seed, act);
      const absent = BuildMap(cleared, seed, act);
      assert.deepEqual(absent.map.nodes, authored.map.nodes, `seed ${seed} act ${act}`);
      assert.deepEqual(absent.counters, authored.counters, 'no extra map draws');
    }
  }
});

test('every lane keeps its elite when pins leave it one free floor', () =>
{
  const config = RouteConfig();
  const pinned = config.eliteSpan.slice(0, -1);
  const shopPin = ShopPinOutside(config, config.eliteSpan);
  const floorTypes = { ...PinAll(pinned, config.plain), ...shopPin };
  EachMap(SetupCore({ floorTypes }), config.acts, (map, label) =>
  {
    for (const [lane, rooms] of RoomsByLane(map))
    {
      assert.ok(rooms.has(ELITE_ROOM), `${label} lane ${lane} has an elite`);
    }
  });
  const noElite = { ...PinAll(config.eliteSpan, config.plain), ...shopPin };
  RefusedWith({ floorTypes: noElite }, ELITE_REFUSAL);
});

test('a late minimumThreatFloor still guards the lane elite', () =>
{
  const config = RouteConfig();
  const openLast = config.count - config.shape.narrowDepthsBeforeBoss;
  const lateDepth = config.branchDepths.find(depth => depth > openLast);
  const late = { prebossNodes: config.count, minimumThreatFloor: lateDepth };
  const { map } = BuildMap(SetupCore(late), 1, 1);
  const elites = Object.values(map.nodes).filter(node => node.actualType === ELITE_ROOM);
  assert.ok(elites.length > 0, 'without pins the late route has elites');
  const floorTypes = { [lateDepth]: config.plain };
  RefusedWith({ ...late, floorTypes }, `${ELITE_REFUSAL}. Unpin one of depths ${lateDepth},`);
});

// Fixed rests (restFloorSpread 0) leave no spare rest-span floors, so pins can use up the shop.
function FixedRestConfig()
{
  return RouteConfig({ restFloorSpread: 0 });
}

function NoRandomShops(config)
{
  const weights = config.settings.typeWeights;
  if (!weights) return {};
  return { typeWeights: { ...weights, [SHOP_ROOM]: 0 } };
}

test('every branch keeps its shop when pins leave it two free floors', () =>
{
  const config = FixedRestConfig();
  const floorTypes = PinAll(config.shopSpan.slice(0, -2), config.plain);
  const routes = {
    restFloorSpread: 0,
    ...NoRandomShops(config),
    floorTypes,
  };
  EachMap(SetupCore(routes), config.acts, (map, label) =>
  {
    const shops = BranchesWith(map, SHOP_ROOM);
    map.bossIds.forEach((bossId, branch) =>
    {
      assert.ok(shops.has(branch), `${label} branch ${branch} has a shop`);
    });
  });
});

test('pins that leave a branch no shop floor, alone or beside its elites, are refused', () =>
{
  const config = FixedRestConfig();
  const noShop = { restFloorSpread: 0, floorTypes: PinAll(config.shopSpan, config.plain) };
  RefusedWith(noShop, SHOP_REFUSAL);
  const shared = config.shopSpan.filter(depth => config.eliteSpan.includes(depth)).at(-1);
  const others = [...config.shopSpan, ...config.eliteSpan].filter(depth => depth !== shared);
  const sharedSlot = { restFloorSpread: 0, floorTypes: PinAll(others, config.plain) };
  RefusedWith(sharedSlot, SHOP_REFUSAL);
});

test('a shop pinned before the guaranteed shop depths does not stand in for the branch shop', () =>
{
  const config = RouteConfig();
  const shopFirst = config.shape.guaranteedShopDepths.first;
  const earlyDepth = config.branchDepths.find(depth => depth < shopFirst);
  const floorTypes = { [earlyDepth]: SHOP_ROOM };
  const core = SetupCore({ ...NoRandomShops(config), floorTypes });
  EachMap(core, config.acts, (map, label) =>
  {
    const { first, last } = config.shape.guaranteedShopDepths;
    const inSpan = Object.values(map.nodes).filter(node =>
      node.actualType === SHOP_ROOM && node.floor >= first && node.floor <= last);
    const branches = new Set(inSpan.map(node => node.branch));
    map.bossIds.forEach((bossId, branch) =>
    {
      assert.ok(branches.has(branch), `${label} branch ${branch} keeps its guaranteed shop`);
    });
  });
});

test('a profile pinned before routeShape keeps the historical branch shape', () =>
{
  const legacy = { gameProfile: { modules: { routes: {} } } };
  const shape = RouteShapeOf(legacy);
  assert.ok(Object.isFrozen(shape));
  assert.deepEqual(shape, {
    placedTypes: [
      'rest',
      'boss',
    ],
    firstBranchDepth: 2,
    earliestFullDepth: 3,
    fullDepthsBeforeBoss: 3,
    narrowDepthsBeforeBoss: 2,
    guaranteedShopDepths: {
      first: 4,
      last: 8,
    },
  });
});

// A short route whose free shop floors are one too early for an elite and every lane's elite slot.
function EarlyShopRoute(config)
{
  const shopFirst = config.shape.guaranteedShopDepths.first;
  const count = shopFirst + config.shape.narrowDepthsBeforeBoss + 1;
  const threat = count - config.shape.narrowDepthsBeforeBoss;
  const restFloors = [
    1,
    threat,
    count,
  ];
  return {
    prebossNodes: count,
    restFloors,
    restsPerAct: restFloors.length,
    restGap: null,
    minimumThreatFloor: threat,
    shopsPerBranch: 1,
  };
}

test('pinning the early shop floor is refused when the other is every elite slot', () =>
{
  const config = RouteConfig();
  const route = EarlyShopRoute(config);
  assert.doesNotThrow(() => SetupCore(route), 'the short route resolves without pins');
  const earlyDepth = config.shape.guaranteedShopDepths.first;
  const floorTypes = { [earlyDepth]: config.plain };
  RefusedWith({ ...route, floorTypes }, SHOP_REFUSAL);
});

// Rests on the first shop depth and the last; elites from the next depth (PR #3025 review).
function MidShopRoute(config)
{
  const shopFirst = config.shape.guaranteedShopDepths.first;
  const count = shopFirst + config.shape.narrowDepthsBeforeBoss + 1;
  const restFloors = [
    1,
    shopFirst,
    count,
  ];
  return {
    prebossNodes: count,
    restFloors,
    restsPerAct: restFloors.length,
    restGap: null,
    restFloorSpread: 0,
    minimumThreatFloor: shopFirst + 1,
    shopsPerBranch: 1,
  };
}

test('pinning the free shop floor beside the only elite slot is refused', () =>
{
  const config = RouteConfig();
  const route = MidShopRoute(config);
  const unpinned = SetupCore({ ...route, ...NoRandomShops(config) });
  EachMap(unpinned, 1, (map, label) =>
  {
    const shops = BranchesWith(map, SHOP_ROOM);
    map.bossIds.forEach((bossId, branch) =>
    {
      assert.ok(shops.has(branch), `${label} branch ${branch} has its shop without pins`);
    });
  });
  const floorTypes = { [route.minimumThreatFloor + 1]: config.plain };
  RefusedWith({ ...route, floorTypes }, SHOP_REFUSAL);
});

function LaneIntervals(map, branch, lanes, lastDepth)
{
  const open = {};
  for (const node of Object.values(map.nodes))
  {
    const match = LANE_ID.exec(node.id);
    if (!match || node.branch !== branch || node.floor > lastDepth)
    {
      continue;
    }
    const lane = Number(match[2]) - branch * lanes;
    const span = open[node.floor] ?? { lo: lane, hi: lane };
    open[node.floor] = { lo: Math.min(span.lo, lane), hi: Math.max(span.hi, lane) };
  }
  return open;
}

function SameLanes(a, b)
{
  return a.lo === b.lo && a.hi === b.hi;
}

// True when the walk's steps can draw this branch's open lanes, depth by depth.
function ShapeIsWalked(drawn, walk, first, lastDepth)
{
  if (!BranchOpenings(walk.lanes).some(open => SameLanes(open, drawn[first])))
  {
    return false;
  }
  for (let floor = first; floor < lastDepth; floor++)
  {
    const steps = BranchSteps(drawn[floor], floor, walk);
    if (!steps.some(step => SameLanes(step, drawn[floor + 1])))
    {
      return false;
    }
  }
  return true;
}

// True when the rest walk can place exactly these rests.
function RestsAreWalked(rests, restWalk, count)
{
  let states = [restWalk.start];
  for (let floor = 1; floor <= count && states.length; floor++)
  {
    states = states.flatMap(state => restWalk.steps(state, floor))
      .filter(way => way.rest === rests.has(floor))
      .map(way => way.state);
  }
  return states.length > 0;
}

test('every branch shape and rest placement the builder rolls is one the resolver walks', () =>
{
  const config = RouteConfig();
  const { settings, shape, count } = config;
  const lastDepth = count - 1;
  const lowest = shape.firstBranchDepth;
  const restVariants = [
    settings.restFloors,
    settings.restFloors.filter(depth => depth !== 1),
  ].map(restFloors => RestWalk(restFloors, settings, lowest));
  EachMap(config.core, config.acts, (map, label) =>
  {
    const lanes = BranchLaneCount(settings.branchColumns, map.bossIds.length);
    const walk = BranchWalk(lanes, settings, shape);
    map.bossIds.forEach((bossId, branch) =>
    {
      const drawn = LaneIntervals(map, branch, lanes, lastDepth);
      const walked = ShapeIsWalked(drawn, walk, lowest, lastDepth);
      assert.ok(walked, `${label} branch ${branch} shape is walked`);
    });
    const restDepths = Object.values(map.nodes)
      .filter(node => node.actualType === 'rest')
      .map(node => node.floor);
    const rests = new Set(restDepths);
    const walked = restVariants.some(restWalk => RestsAreWalked(rests, restWalk, count));
    assert.ok(walked, `${label} rests ${[...rests].join(',')} are walked`);
  });
});

// Budget for resolving the largest route the routes schema allows, with a few pins.
const RESOLVE_BUDGET_MS = 200;
const HEAP_BUDGET_BYTES = 64 * 1024 * 1024;
const LARGE_ROUTE_RESTS = 5;
const SCHEMA_FILE = fileURLToPath(new URL('../engine/modules/routes/settings.schema.json',
  import.meta.url));

function LargestRoute()
{
  const schema = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8')).properties;
  const count = schema.prebossNodes.maximum;
  const gapSchema = schema.restGap.anyOf.find(option => option.type === 'object').properties;
  const step = Math.floor(count / LARGE_ROUTE_RESTS);
  const middle = DepthRange(1, LARGE_ROUTE_RESTS - 1).map(index => index * step);
  const restFloors = [
    1,
    ...middle,
    count,
  ];
  return {
    prebossNodes: count,
    restFloors,
    restsPerAct: restFloors.length,
    branchColumns: schema.branchColumns.maximum,
    maxBranches: schema.maxBranches.maximum,
    restGap: { min: gapSchema.min.minimum, max: gapSchema.max.maximum },
    restFloorSpread: schema.restFloorSpread.anyOf[0].maximum,
  };
}

test('the largest route the schema allows resolves with pins in bounded time and memory', () =>
{
  const route = LargestRoute();
  const config = RouteConfig(route);
  const free = config.branchDepths.filter(depth => depth >= config.settings.minimumThreatFloor);
  const floorTypes = {
    [config.shopSpan[0]]: config.plain,
    [free[Math.floor(free.length / 2)]]: ELITE_ROOM,
    [free.at(-1)]: config.plain,
  };
  const author = {
    formatVersion: 1,
    core: 'ashen.core@2.0.0',
    modules: { routes: { ...route, floorTypes } },
  };
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const profile = resolveGameProfile(author);
  const elapsed = performance.now() - started;
  const heapGrowth = process.memoryUsage().heapUsed - heapBefore;
  assert.ok(elapsed < RESOLVE_BUDGET_MS, `resolved in ${elapsed.toFixed(0)} ms`);
  assert.ok(heapGrowth < HEAP_BUDGET_BYTES, `heap grew ${heapGrowth} bytes`);
  assert.deepEqual(profile.modules.routes.floorTypes, floorTypes);
});

// Guaranteed shop depths that start on the shared opening, depth 1 (PR #3025 follow-up).
function OpeningShopRoute(config)
{
  const firstBranch = config.shape.firstBranchDepth;
  const shopLast = firstBranch + config.shape.narrowDepthsBeforeBoss;
  const restFloors = config.settings.restFloors.filter(depth => depth > shopLast);
  return {
    route: {
      prebossNodes: config.count,
      restFloors,
      restsPerAct: restFloors.length,
      firstFloor: null,
      startRestFromAct: null,
      restGap: null,
      routeShape: { guaranteedShopDepths: { first: 1, last: shopLast } },
    },
    branchShopDepths: DepthRange(firstBranch, shopLast),
  };
}

test('a shop pinned on the shared opening does not stand in for a branch shop', () =>
{
  const config = RouteConfig();
  const { route, branchShopDepths } = OpeningShopRoute(config);
  const openingShop = { 1: SHOP_ROOM };
  assert.doesNotThrow(() => SetupCore({ ...route, floorTypes: openingShop }));
  const floorTypes = { ...openingShop, ...PinAll(branchShopDepths, config.plain) };
  RefusedWith({ ...route, floorTypes }, SHOP_REFUSAL);
});

function InvalidTables(config)
{
  const {
    count,
    plain,
    types,
    settings,
    restDepths,
  } = config;
  const restDepth = [...restDepths].find(depth => depth > 1 && depth < count);
  const unknown = `${types.all.join('')}x`;
  const earlyDepth = config.branchDepths.find(depth => depth < settings.minimumThreatFloor);
  const tables = [
    [{ 0: plain }, `depth "0" must be a whole number from 1 to ${count}`],
    [{ [count + 1]: plain }, `depth "${count + 1}" must be a whole number from 1 to ${count}`],
    [{ [`${config.branchDepths[0]}.5`]: plain }, 'must be a whole number'],
    [{ four: plain }, 'depth "four" must be a whole number'],
    [{ [restDepth]: plain }, `depth ${restDepth} is or can become a rest floor`],
    [{ [config.branchDepths[0]]: unknown }, `"${unknown}" is not a room type this route uses`],
  ];
  for (const placed of config.shape.placedTypes)
  {
    tables.push([{ [config.branchDepths[0]]: placed }, `cannot be "${placed}"`]);
  }
  if (earlyDepth !== undefined)
  {
    const message = `an elite needs depth ${settings.minimumThreatFloor} or later`;
    tables.push([{ [earlyDepth]: ELITE_ROOM }, message]);
  }
  return tables;
}

test('each invalid floorTypes entry fails at resolve time with its message', () =>
{
  const config = RouteConfig();
  for (const [floorTypes, phrase] of InvalidTables(config)) RefusedWith({ floorTypes }, phrase);
  const restFloors = config.settings.restFloors.filter(depth => depth !== 1);
  const noStartRest = {
    prebossNodes: config.count,
    restFloors,
    restsPerAct: restFloors.length,
    startRestFromAct: null,
    firstFloor: config.settings.firstFloor ?? config.plain,
  };
  RefusedWith({ ...noStartRest, floorTypes: { 1: config.plain } }, 'already set by firstFloor');
  assert.throws(() => SetupCore({ floorTypes: [config.plain] }), { path: FLOOR_TYPES_PATH });
});

test('the map build refuses a bad floorTypes that skipped the resolver', () =>
{
  const config = RouteConfig();
  const profile = config.core.registries.gameProfile;
  const restDepth = [...config.restDepths].find(depth => depth > 1 && depth < config.count);
  const floorTypes = { [restDepth]: config.plain };
  const routes = { ...profile.content.routes, floorTypes };
  const gameProfile = { ...profile, content: { ...profile.content, routes } };
  const registries = { ...config.core.registries, gameProfile };
  const build = () => buildActMap(registries, createRng(1), config.core.run.seatOrder[0], 1);
  assert.throws(build, new RegExp(`Invalid configured floorTypes: depth ${restDepth} is or can`));
});
