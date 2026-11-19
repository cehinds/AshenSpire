// Route spread (owner, 2026-11-18): eleven pre-boss depths, a start rest from act 2, rests 2-5 non-rest nodes apart,
// one pre-boss rest per branch linked only to its own boss, and a V-shaped board whose other branches stay out of sight.
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { mapKnowledge } from '../src/model/map/mapknowledge.js';
import { PlaceRestFloors } from '../src/engine/actmap.js';

const profile = resolveGameProfile('core');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const rules = gameContent(reg, 'routes');
const baseRun = createRunState({ seed: 73, classId: 'reaver', registries: reg });
const SEEDS = 120, COUNT = 11;
const mapFor = (seed, tier) => buildActMap(reg, createRng(seed), baseRun.seatOrder[tier - 1], tier);
const allMaps = function* () { for (let seed = 1; seed <= SEEDS; seed++) for (let tier = 1; tier <= 3; tier++) yield [seed, tier, mapFor(seed, tier)]; };

test('every act has eleven pre-boss depths and the boss on depth twelve', () => {
  assert.equal(rules.prebossNodes, COUNT);
  for (const [seed, tier, map] of allMaps()) {
    assert.equal(map.floors, COUNT + 1, `seed ${seed} act ${tier}`);
    for (const id of map.bossIds) assert.equal(map.nodes[id].floor, COUNT + 1);
    assert.equal(Math.max(...Object.values(map.nodes).filter(n => n.type !== 'boss').map(n => n.floor)), COUNT);
  }
});

test('act 1 opens on a combat node; acts 2 and 3 open on a rest', () => {
  assert.equal(rules.startRestFromAct, 2);
  for (const [seed, tier, map] of allMaps()) {
    const start = map.nodes.n1_0;
    assert.deepEqual(map.startIds, ['n1_0']);
    if (tier === 1) { assert.equal(start.type, 'monster', `seed ${seed}`); assert.equal(start.actualType, 'fight'); }
    else { assert.equal(start.type, 'shrine', `seed ${seed} act ${tier}`); assert.equal(start.actualType, 'rest'); }
    assert.ok(start.next.length >= 1);
  }
});

// Non-rest nodes between rests on every path: the start counts as a rest when depth 1 is not one, and the gap that ends at the
// pre-boss rest is not limited.
test('every path keeps 2 to 5 non-rest nodes between rests, except before the pre-boss rest', () => {
  const { min, max } = rules.restGap;
  assert.deepEqual([min, max], [2, 5]);
  const seen = { gaps: new Set(), midDepths: new Set() };
  for (const [seed, tier, map] of allMaps()) {
    const walk = (id, since) => {
      const node = map.nodes[id];
      if (node.type === 'boss') return;
      if (node.type === 'shrine') {
        if (node.floor > 1 && node.floor < COUNT) { assert.ok(since >= min && since <= max, `seed ${seed} act ${tier}: ${since} non-rest nodes before ${id}`); seen.gaps.add(since); seen.midDepths.add(`${tier}:${node.floor}`); }
        since = 0;
      } else since += 1;
      for (const next of node.next) walk(next, since);
    };
    walk('n1_0', 0);
  }
  for (let tier = 1; tier <= 3; tier++) assert.ok([...seen.midDepths].filter(key => key.startsWith(`${tier}:`)).length >= 2, `act ${tier} moves its mid rest between seeds`);
  assert.ok([...seen.gaps].every(gap => gap >= min && gap <= max));
});

test('PlaceRestFloors keeps the default layout and draws the mid rest only inside the gap limits', () => {
  const rng = createRng(1);
  assert.deepEqual(PlaceRestFloors(rng, [1, 6, 11], 11, {}), [1, 6, 11], 'no restGap: authored floors stand');
  const options = { restGap: { min: 2, max: 5 }, restFloorSpread: 1 };
  const act2 = new Set(), act1 = new Set();
  for (let seed = 1; seed <= 60; seed++) { act2.add(PlaceRestFloors(createRng(seed), [1, 6, 11], 11, options)[1]); act1.add(PlaceRestFloors(createRng(seed), [6, 11], 11, options)[0]); }
  assert.deepEqual([...act2].sort(), [5, 6, 7]);
  assert.deepEqual([...act1].sort(), [5, 6]);
});

test('each pre-boss rest is one node per branch with a single edge to its own boss', () => {
  for (const [seed, tier, map] of allMaps()) {
    const rests = Object.values(map.nodes).filter(n => n.type === 'shrine' && n.floor === COUNT);
    assert.equal(rests.length, map.bossIds.length, `seed ${seed} act ${tier}: one pre-boss rest per branch`);
    assert.deepEqual(map.shrineIds.slice().sort(), rests.map(n => n.id).sort());
    for (const rest of rests) {
      assert.equal(rest.next.length, 1);
      assert.equal(map.nodes[rest.next[0]].type, 'boss');
      assert.equal(map.nodes[rest.next[0]].branch, rest.branch, 'linked to its own boss');
      assert.ok(map.bossIds.filter(id => map.nodes[id].branch === rest.branch).includes(rest.next[0]));
    }
    // Nothing else reaches a boss.
    for (const node of Object.values(map.nodes)) if (node.next.some(id => map.nodes[id].type === 'boss')) assert.equal(node.floor, COUNT);
  }
});

const pathTo = (map, targetId) => {
  const parent = { n1_0: null }, queue = ['n1_0'];
  while (queue.length) { const id = queue.shift(); for (const next of map.nodes[id].next) if (!(next in parent)) { parent[next] = id; queue.push(next); } }
  const path = []; for (let at = targetId; at; at = parent[at]) path.unshift(at);
  return path;
};
const reachableFrom = (map, id) => { const seen = new Set([id]), stack = [id]; while (stack.length) for (const next of map.nodes[stack.pop()].next) if (!seen.has(next)) { seen.add(next); stack.push(next); } return seen; };

test('from a pre-boss rest no other branch\'s late nodes or boss are visible or reachable', () => {
  let checked = 0;
  for (const [seed, tier, map] of allMaps()) {
    if (map.bossIds.length < 2) continue;
    for (const rest of Object.values(map.nodes).filter(n => n.type === 'shrine' && n.floor === COUNT)) {
      const path = pathTo(map, rest.id);
      const run = { ...baseRun, path, mapNodeId: rest.id };
      const { drawn } = mapKnowledge({ graph: map, run, mode: 'fog' });
      for (const id of drawn) {
        const node = map.nodes[id];
        if (node.type === 'boss') assert.equal(node.branch, rest.branch, `seed ${seed} act ${tier}: ${id} boss drawn from ${rest.id}`);
        else if (node.branch != null && node.branch !== rest.branch) assert.ok(node.floor < 9, `seed ${seed} act ${tier}: ${id} (branch ${node.branch}, depth ${node.floor}) drawn from ${rest.id}`);
      }
      for (const id of reachableFrom(map, rest.id)) assert.ok(map.nodes[id].branch === rest.branch, `${id} reachable from ${rest.id}`);
      checked++;
    }
  }
  assert.ok(checked > 100);
});

test('the board widens like a V: branch centres move apart as depth grows, and the board is wider than the lanes alone', () => {
  let checked = 0;
  for (const [seed, tier, map] of allMaps()) {
    if (map.bossIds.length < 2) continue;
    const centre = (k, floor) => { const row = Object.values(map.nodes).filter(n => n.branch === k && n.floor === floor); return row.reduce((sum, n) => sum + n.col, 0) / row.length; };
    const last = map.bossIds.length - 1, gap = floor => centre(last, floor) - centre(0, floor);
    assert.ok(gap(COUNT + 1) > gap(2) + 1, `seed ${seed} act ${tier}: ${gap(2)} -> ${gap(COUNT + 1)}`);
    const lanes = Math.floor(6 / map.bossIds.length);
    assert.ok(map.columns > map.bossIds.length * lanes, 'the board is widened for the V');
    for (const node of Object.values(map.nodes)) assert.ok(node.col >= 0 && node.col <= map.columns - 1, `${node.id} sits on the board`);
    checked++;
  }
  assert.ok(checked > 50);
});

test('the same seed rolls the same map', () => {
  for (let seed = 1; seed <= 20; seed++) for (let tier = 1; tier <= 3; tier++) assert.deepEqual(mapFor(seed, tier), mapFor(seed, tier));
});
