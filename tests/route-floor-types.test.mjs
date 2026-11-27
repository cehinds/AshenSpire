// routes.floorTypes: a pinned depth is that room type on every lane, in every act; without it the
// map draws as before; a bad table fails with a plain message. Depths, types and limits come from
// the loaded Core route config, so retuning routes.json moves the inputs, not the expectations.
import assert from 'node:assert/strict';
import test from 'node:test';
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
  RouteDepths,
  PinnableDepths,
  BranchFullDepth,
} from '../engine/kernel/routeDepths.js';
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
  const depths = RouteDepths(settings, shape);
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
    eliteSpan: PinnableDepths(depths, eliteFirst, openLast),
    shopSpan: PinnableDepths(depths, shape.guaranteedShopDepths.first, shopLast),
    branchDepths: PinnableDepths(depths, shape.firstBranchDepth, count),
    restDepths: depths.restDepths,
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
  const keep = `Keep one of depths ${DepthList(config.eliteSpan)} unpinned`;
  RefusedWith({ floorTypes: noElite }, `leaves a lane no free floor for its elite. ${keep}`);
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
  RefusedWith({ ...late, floorTypes }, `Keep depth ${lateDepth} unpinned, or pin an elite`);
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
  const keepShop = `Keep one of depths ${DepthList(config.shopSpan)} unpinned`;
  const noShop = { restFloorSpread: 0, floorTypes: PinAll(config.shopSpan, config.plain) };
  RefusedWith(noShop, `leaves a branch no free floor for its shop. ${keepShop}`);
  const shared = config.shopSpan.filter(depth => config.eliteSpan.includes(depth)).at(-1);
  const others = [...config.shopSpan, ...config.eliteSpan].filter(depth => depth !== shared);
  const sharedSlot = { restFloorSpread: 0, floorTypes: PinAll(others, config.plain) };
  const keepTwo = `Keep two of depths ${DepthList(config.shopSpan)} unpinned`;
  RefusedWith(sharedSlot, `leaves a branch's shop only floors its elites can take. ${keepTwo}`);
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
