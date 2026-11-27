// routes.floorTypes (owner, 2026-11-27): a pinned depth is that room type on every lane, in every
// act; without it the Core map draws exactly as before; a bad entry fails with a plain message.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
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

const ACTS = [1, 2, 3];
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const SHOP_DEPTH = 4;
const ELITE_DEPTH = 8;
const PINNED = { [SHOP_DEPTH]: 'shop', [ELITE_DEPTH]: 'elite' };
const FLOOR_TYPES_PATH = '$/modules/routes/floorTypes';
// Core maps of seeds 3 and 7 (acts 1 and 3) rolled before floorTypes existed (dev 72a5ca42565).
// A retune of routes.json or the boss roster moves them: reprint with PRINT_GOLDEN=1.
const GOLDEN = {
  '3:1': 'aa29acd981926af5',
  '3:3': '01bb039faf5857a0',
  '7:1': '427f1b36738ef565',
  '7:3': 'f2d12a2b3d3ed146',
};

function SetupCore(routes = {})
{
  const author = { formatVersion: 1, core: 'ashen.core@2.0.0', modules: { routes } };
  const profile = resolveGameProfile(author);
  const content = applyGameProfileToContent(contentBundle, profile);
  const registries = bindGameProfileRegistries(createRegistries(content), profile);
  const run = createRunState({ seed: 73, classId: 'reaver', registries });
  return { registries, run };
}

function BuildMap(core, seed, act)
{
  const rng = createRng(seed);
  const map = buildActMap(core.registries, rng, core.run.seatOrder[act - 1], act);
  return { map, counters: rng.getCounters() };
}

function MapDigest(map)
{
  const rows = Object.keys(map.nodes).sort().map(id =>
  {
    const node = map.nodes[id];
    return [
      node.id,
      node.actualType,
      node.type,
      node.next,
      node.encounterId ?? null,
      node.resolved ?? null,
    ];
  });
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
}

function NodesAt(map, depth)
{
  return Object.values(map.nodes).filter(node => node.floor === depth);
}

test('a pinned depth is that room type on every lane, for every seed and act', () =>
{
  const core = SetupCore({ floorTypes: PINNED });
  for (const seed of SEEDS) for (const act of ACTS)
  {
    const { map } = BuildMap(core, seed, act);
    const shops = NodesAt(map, SHOP_DEPTH);
    const elites = NodesAt(map, ELITE_DEPTH);
    const label = `seed ${seed} act ${act}`;
    assert.ok(shops.length >= map.bossIds.length, `${label} has depth ${SHOP_DEPTH}`);
    for (const node of shops) assert.equal(node.actualType, 'shop', `${node.id} seed ${seed}`);
    for (const node of shops) assert.equal(node.type, 'merchant', `${node.id} seed ${seed}`);
    for (const node of elites) assert.equal(node.actualType, 'elite', `${node.id} seed ${seed}`);
    // The pinned elite depth is each lane's guaranteed elite, so Core rolls no other.
    const otherElites = Object.values(map.nodes)
      .filter(node => node.actualType === 'elite' && node.floor !== ELITE_DEPTH);
    assert.deepEqual(otherElites.map(node => node.id), [], label);
  }
});

test('without floorTypes a known seed rolls the same Core map and the same draws', () =>
{
  const core = SetupCore();
  const cleared = SetupCore({ floorTypes: null });
  assert.deepEqual(core.registries.gameProfile.content.routes.floorTypes, {});
  const got = {};
  for (const seed of [3, 7]) for (const act of [1, 3])
  {
    const authored = BuildMap(core, seed, act);
    const absent = BuildMap(cleared, seed, act);
    assert.deepEqual(MapDigest(absent.map), MapDigest(authored.map));
    assert.deepEqual(absent.counters, authored.counters, 'no extra map draws');
    got[`${seed}:${act}`] = MapDigest(authored.map);
  }
  if (process.env.PRINT_GOLDEN) console.log(JSON.stringify(got));
  assert.deepEqual(got, GOLDEN);
});

const INVALID = [
  [{ 0: 'shop' }, /depth "0" must be a whole number from 1 to 11/],
  [{ 12: 'shop' }, /depth "12" must be a whole number from 1 to 11/],
  [{ '4.5': 'shop' }, /depth "4\.5" must be a whole number/],
  [{ four: 'shop' }, /depth "four" must be a whole number/],
  [{ 6: 'shop' }, /depth 6 is or can become a rest floor/],
  [{ 5: 'shop' }, /depth 5 is or can become a rest floor/],
  [{ 4: 'dragon' }, /depth 4: "dragon" is not a room type this route uses/],
  [{ 4: 'rest' }, /depth 4 cannot be "rest": the route places that room itself/],
  [{ 4: 'boss' }, /depth 4 cannot be "boss"/],
  [{ 2: 'elite' }, /depth 2: an elite needs depth 3 or later/],
];

test('each invalid floorTypes entry fails at resolve time with its message', () =>
{
  for (const [floorTypes, message] of INVALID)
  {
    const isFloorTypesError = error =>
      error.path === FLOOR_TYPES_PATH && message.test(error.message);
    assert.throws(() => SetupCore({ floorTypes }), isFloorTypesError, JSON.stringify(floorTypes));
  }
  const noStartRest = {
    prebossNodes: 11,
    restFloors: [6, 11],
    restsPerAct: 2,
    startRestFromAct: null,
  };
  const firstFloorClash = { ...noStartRest, floorTypes: { 1: 'shop' } };
  assert.throws(() => SetupCore(firstFloorClash), /depth 1 is already set by firstFloor/);
  const atFloorTypes = error => error.path === FLOOR_TYPES_PATH;
  assert.throws(() => SetupCore({ floorTypes: ['shop'] }), atFloorTypes);
});

test('the map build refuses a bad floorTypes that skipped the resolver', () =>
{
  const core = SetupCore();
  const profile = core.registries.gameProfile;
  const routes = { ...profile.content.routes, floorTypes: { 6: 'shop' } };
  const gameProfile = { ...profile, content: { ...profile.content, routes } };
  const registries = { ...core.registries, gameProfile };
  const seat = core.run.seatOrder[0];
  const build = () => buildActMap(registries, createRng(1), seat, 1);
  assert.throws(build, /Invalid configured floorTypes: depth 6 is or can become a rest floor/);
});
