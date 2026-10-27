import { applyNodeRefill } from '../src/model/nodeRefill.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { refreshBossDestinationLabels } from '../src/model/bossDestinationLabels.js';
import { buildActMap, bossEncounterForNode } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { mapKnowledge, resolveMapMode, nearestShrine, litNodes, HIDDEN, KNOWN } from '../src/model/map/mapknowledge.js';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

function setup(routes = {}) {
  // Core authors three rest depths (D10); a test that moves the rest floors states its own count.
  if (routes.restFloors && routes.restsPerAct === undefined) routes = { ...routes, restsPerAct: routes.restFloors.length };
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { routes } });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg });
  return { reg, run };
}
// Branched Core maps (owner, 2026-10-25): depth 1 is shared, then every branch has its own lanes, rests, elites and boss.
const restSetHas = floor => [3, 6, 9].includes(floor);
function verifyPaths(map, rests) {
  const reached = new Set();
  function walk(id, length = 0, visitedRests = [], branch = null) {
    const node = map.nodes[id];
    reached.add(id);
    if (node.branch != null) {
      assert.ok(branch == null || branch === node.branch, `${id} leaves branch ${branch}`);
      branch = node.branch;
    }
    const nextRests = node.type === 'shrine' ? [...visitedRests, node.floor] : visitedRests;
    if (node.type === 'boss') {
      assert.equal(length + 1, map.floors);
      assert.deepEqual(nextRests, rests);
      assert.deepEqual(node.next, []);
      return;
    }
    assert.ok(node.next.length, `dead end ${id}`);
    for (const next of node.next) {
      assert.equal(map.nodes[next].floor, node.floor + 1);
      walk(next, length + 1, nextRests, branch);
    }
  }
  for (const start of map.startIds) { assert.equal(map.nodes[start].floor, 1); walk(start); }
  assert.equal(reached.size, Object.keys(map.nodes).length);
}
function verifyBranches(map, { rests, count, minimumThreatFloor = 3 }) {
  const b = map.bossIds.length;
  assert.ok(b >= 1 && b <= 3, 'Core caps the branch count at three (owner, 2026-10-27)');
  assert.equal(map.bossId, map.bossIds[0]);
  assert.equal(new Set(map.bossIds.map(id => map.nodes[id].encounterId)).size, b, 'bosses are distinct');
  assert.equal(map.shrineId, map.shrineIds[0]);
  const lanes = map.columns / b;
  assert.ok(Number.isInteger(lanes) && lanes >= 1);
  assert.deepEqual(map.startIds, ['n1_0'], 'depth 1 is a single start node');
  assert.equal(map.nodes.n1_0.col, (map.columns - 1) / 2, 'the start node is centred');
  const secondDepth = Object.values(map.nodes).filter(node => node.floor === 2);
  assert.deepEqual([...map.nodes.n1_0.next].sort(), secondDepth.map(node => node.id).sort(), 'the start reaches the first node(s) of every branch');
  assert.equal(new Set(secondDepth.map(node => node.branch)).size, b, 'every branch is reachable from the start');
  assert.ok(map.columns <= 6, 'the board stays within 2 * branchColumns columns');
  for (let k = 0; k < b; k++) {
    const own = Object.values(map.nodes).filter(node => node.branch === k && node.type !== 'boss');
    const widthAt = floor => own.filter(node => node.floor === floor).length;
    // Owner 2026-10-27: each branch is a tree. It opens narrow (one node, or two when it has three lanes), widens outward, then may narrow again.
    assert.ok(widthAt(2) === 1 || (widthAt(2) === 2 && lanes >= 3), `branch ${k} opens narrow (${widthAt(2)} of ${lanes})`);
    let peaked = false;
    for (let floor = 2; floor <= count; floor++) {
      const width = widthAt(floor), cols = own.filter(node => node.floor === floor).map(node => node.col).sort((x, y) => x - y);
      assert.ok(width >= 1 && width <= lanes);
      assert.ok(cols.every((col, i) => i === 0 || col === cols[i - 1] + 1), `branch ${k} lanes at depth ${floor} are contiguous`);
      assert.ok(cols.every(col => col >= k * lanes && col < (k + 1) * lanes), 'a branch stays in its own columns');
      if (floor > 2 && width < widthAt(floor - 1)) { peaked = true; assert.ok(floor >= count - 1, `branch ${k} narrows only over the last two depths`); }
      if (floor > 2 && peaked) assert.ok(width <= widthAt(floor - 1), `branch ${k} never re-widens after narrowing`);
      if (lanes >= 2 && floor >= count - 3 && floor > 2) assert.ok(width >= 2, `branch ${k} never collapses to one path at depth ${floor}`);
      // A rest depth gives every lane that exists its own rest node.
      if (rests.includes(floor)) assert.ok(own.filter(node => node.floor === floor).every(node => node.type === 'shrine'), `branch ${k} rest depth ${floor} is all rests`);
      else if (floor > 2) assert.ok(own.filter(node => node.floor === floor).every(node => node.type !== 'shrine'));
    }
    assert.equal(Math.max(...Array.from({ length: count - 1 }, (_, i) => widthAt(i + 2))), lanes, `branch ${k} fills its lanes`);
    assert.ok(own.some(node => node.actualType === 'elite' && node.floor >= minimumThreatFloor), `branch ${k} has an elite`);
    // The elite guarantee is per lane: every lane that exists on a non-rest depth at or past the threat floor holds an elite.
    for (const col of new Set(own.map(node => node.col))) {
      const laneNodes = own.filter(node => node.col === col);
      if (laneNodes.some(node => node.floor >= Math.max(2, minimumThreatFloor) && node.type !== 'shrine')) assert.ok(laneNodes.some(node => node.actualType === 'elite' && node.floor >= minimumThreatFloor), `branch ${k} lane at column ${col} has an elite`);
    }
    assert.equal(Object.values(map.nodes).filter(node => node.branch === k && node.type === 'boss').length, 1);
    const preboss = own.filter(node => node.next.includes(map.bossIds[k]));
    assert.equal(preboss.length, widthAt(count), 'every path joins at the branch boss');
    assert.ok(preboss.every(node => node.floor === count));
    if (rests.includes(count)) assert.ok(preboss.every(node => node.type === 'shrine' && map.shrineIds.includes(node.id)));
  }
  if (rests.includes(count)) assert.equal(map.shrineIds.length, Object.values(map.nodes).filter(node => node.floor === count && node.branch != null).length);
  for (const node of Object.values(map.nodes)) if (node.branch != null) for (const next of node.next) assert.equal(map.nodes[next].branch, node.branch, `${node.id} -> ${next} crosses branches`);
}
test('every seeded core map splits into distinct-boss branches, each with its own rests, elite and boss, across all three acts', () => {
  const { reg, run } = setup();
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    for (let tier = 1; tier <= 3; tier++) {
      const seat = run.seatOrder[tier - 1];
      const map = buildActMap(reg, createRng(seed), seat, tier);
      verifyPaths(map, [3, 6, 9]);
      verifyBranches(map, { rests: [3, 6, 9], count: 9 });
      assert.equal(map.floors, 10);
      seen.add(map.bossIds.length);
      // Floor 1 is a fight (routes.firstFloor, owner 2026-10-18): one fight node per column, drawn as fights.
      for (const id of map.startIds) { assert.equal(map.nodes[id].actualType, 'fight'); assert.equal(map.nodes[id].type, 'monster'); assert.ok(map.nodes[id].next.length >= 1); }
      for (const node of Object.values(map.nodes)) if (['elite', 'boss'].includes(node.actualType)) assert.ok(node.floor >= 3);
      for (const id of map.bossIds) assert.equal(bossEncounterForNode(reg, map, id, { seat, tier }), map.nodes[id].encounterId);
      assert.deepEqual(map, buildActMap(reg, createRng(seed), seat, tier), 'replays identically');
      for (const node of Object.values(map.nodes)) {
        if (['rest', 'elite', 'boss'].includes(node.actualType) || node.floor === 1) assert.notEqual(node.type, 'event');
        else { assert.equal(node.type, 'event'); assert.ok(node.resolved); }
      }
    }
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3], 'branch count varies from 1 to the Core cap of 3');
  for (const tier of [1, 3]) {
    const counts = new Set();
    for (let seed = 1; seed <= 40; seed++) counts.add(buildActMap(reg, createRng(seed), run.seatOrder[tier - 1], tier).bossIds.length);
    assert.ok(counts.size >= 3, `tier ${tier} rolls at least three distinct branch counts over 40 seeds (got ${[...counts]})`);
  }
});
test('branch count never exceeds the distinct bosses of the act or maxBranches', () => {
  const capped = setup({ maxBranches: 2 });
  for (let seed = 1; seed <= 30; seed++) assert.ok(buildActMap(capped.reg, createRng(seed), capped.run.seatOrder[0], 1).bossIds.length <= 2);
  const single = setup({ maxBranches: 1 });
  const map = buildActMap(single.reg, createRng(3), single.run.seatOrder[0], 1);
  assert.deepEqual(map.bossIds, ['boss_0']);
  assert.equal(map.columns, 3);
  const act3 = setup();
  let widest = 0;
  for (let seed = 1; seed <= 60; seed++) widest = Math.max(widest, buildActMap(act3.reg, createRng(seed), act3.run.seatOrder[2], 3).bossIds.length);
  assert.equal(widest, 3, 'Core caps the branch count at 3 even where four bosses exist');
  const uncapped = setup({ maxBranches: 5 });
  let widest5 = 0;
  for (let seed = 1; seed <= 60; seed++) widest5 = Math.max(widest5, buildActMap(uncapped.reg, createRng(seed), uncapped.run.seatOrder[2], 3).bossIds.length);
  assert.equal(widest5, 4, 'the final act offers four distinct bosses');
});
test('branch width, length, rest placement and exposed node types follow JSON settings', () => {
  const { reg, run } = setup({ branchColumns: 4, prebossNodes: 5, restFloors: [2, 5], hideUnknownNodes: false, maxBranches: 1 });
  const map = buildActMap(reg, createRng(7), run.seatOrder[0], 1);
  assert.equal(map.columns, 4);
  assert.equal(map.floors, 6);
  verifyPaths(map, [2, 5]);
  assert.ok(Object.values(map.nodes).some(node => ['monster', 'merchant', 'treasure'].includes(node.type)));
  assert.ok(Object.values(map.nodes).filter(node => node.floor === 2).every(node => node.type === 'shrine' && node.col >= 0 && node.col < 4), 'a rest sits on its own lane');
  const noRests = setup({ prebossNodes: 3, restsPerAct: 0, restFloors: [], requirePrebossRest: false, branchColumns: 2 });
  const noRestMap = buildActMap(noRests.reg, createRng(7), noRests.run.seatOrder[0], 1);
  verifyPaths(noRestMap, []);
  assert.equal(noRestMap.shrineId, null);
});
test('each branch is a tree that forks outward, joins at its boss, and remerges only rarely (owner, 2026-10-27)', () => {
  const { reg, run } = setup();
  let eligibleGaps = 0, remergeEdges = 0, intoRestGaps = 0, intoRestRemerges = 0, branches = 0, singleStarts = 0, allRestGapsRemerged = 0, forkEdges = 0, narrowEdges = 0, paths = 0, multiLane = 0, forkedBranches = 0;
  for (let seed = 1; seed <= 200; seed++) {
    for (let tier = 1; tier <= 3; tier++) {
      const map = buildActMap(reg, createRng(seed), run.seatOrder[tier - 1], tier);
      verifyPaths(map, [3, 6, 9]);
      verifyBranches(map, { rests: [3, 6, 9], count: 9 });
      const b = map.bossIds.length, lanes = map.columns / b;
      for (let k = 0; k < b; k++) {
        const own = Object.values(map.nodes).filter(node => node.branch === k && node.type !== 'boss');
        const parents = {};
        for (const node of own) for (const next of node.next) (parents[next] ||= []).push(node.id);
        const at = (floor, col) => own.find(node => node.floor === floor && node.col === col);
        branches++;
        if (own.filter(node => node.floor === 2).length === 1) singleStarts++;
        let restGapRemerges = 0, restGaps = 0, forks = 0;
        for (let floor = 2; floor < 9; floor++) {
          const layer = own.filter(node => node.floor === floor);
          let remerges = 0;
          for (const node of layer) for (const id of node.next) {
            const target = map.nodes[id];
            if (target.col === node.col) continue;
            assert.equal(Math.abs(target.col - node.col), 1, 'cross-lane edges join neighbours');
            if (!at(floor + 1, node.col)) { narrowEdges++; assert.ok(floor + 1 >= 8, 'a lane ends only over the last two depths'); }
            else if (parents[id].length > 1) remerges++;
            else { forks++; forkEdges++; }
          }
          assert.ok(remerges <= 1, 'at most one remerge edge per gap');
          remergeEdges += remerges;
          if (layer.some(node => at(floor + 1, node.col + 1) && at(floor, node.col + 1) && at(floor + 1, node.col))) eligibleGaps++;
          if (restSetHas(floor + 1)) { restGaps++; if (remerges) restGapRemerges++; }
        }
        intoRestGaps += restGaps; intoRestRemerges += restGapRemerges;
        if (restGapRemerges === restGaps) allRestGapsRemerged++;
        if (forks) forkedBranches++;
        if (lanes >= 2) multiLane++;
        // Distinct root-to-boss paths of the branch.
        const memo = {};
        const count = id => memo[id] ??= (map.nodes[id].type === 'boss' ? 1 : map.nodes[id].next.reduce((sum, next) => sum + count(next), 0));
        paths += own.filter(node => node.floor === 2).reduce((sum, node) => sum + count(node.id), 0);
      }
      assert.deepEqual(map, buildActMap(reg, createRng(seed), run.seatOrder[tier - 1], tier), 'replays identically');
    }
  }
  assert.equal(forkedBranches, multiLane, 'every branch with more than one lane forks at least once');
  const rate = remergeEdges / eligibleGaps;
  assert.ok(rate > 0.1 && rate < 0.3, `remerges are rare but not absent (got ${rate.toFixed(3)} per eligible gap)`);
  assert.equal(allRestGapsRemerged, 0, 'no branch remerges into every rest depth');
  assert.ok(singleStarts / branches > 0.5 && singleStarts < branches, 'most branches open with one node, some with two');
  assert.ok(paths / branches > 2, `branches are trees with several paths (got ${(paths / branches).toFixed(2)})`);
  assert.ok(narrowEdges > 0, 'lanes sometimes narrow before the boss');
  console.log(`# sub-branches over 200 seeds x 3 acts: ${branches} branches, ${(singleStarts / branches * 100).toFixed(1)}% open with one node, ${(forkEdges / branches).toFixed(2)} fork edges and ${(paths / branches).toFixed(2)} paths per branch, remerge ${(rate * 100).toFixed(1)}% per eligible gap, into-rest remerge ${(intoRestRemerges / intoRestGaps * 100).toFixed(1)}%`);
});
test('a one-depth branched route links every entrance to its branch boss', () => {
  const named = setup();
  const fresh = buildActMap(named.reg, createRng(4), named.run.seatOrder[0], 1);
  assert.ok(fresh.bossIds.every(id => fresh.nodes[id].destinationLabel), 'branch bosses are named on a fresh map');
  for (const maxBranches of [1, 2]) {
    const { reg, run } = setup({ prebossNodes: 1, restsPerAct: 0, restFloors: [], requirePrebossRest: false, minimumThreatFloor: 2, branchColumns: 5, maxBranches });
    for (let seed = 1; seed <= 20; seed++) {
      const map = buildActMap(reg, createRng(seed), run.seatOrder[0], 1);
      for (const id of map.startIds) assert.ok(map.nodes[id].next.length && map.nodes[id].next.every(next => map.bossIds.includes(next)), `${id} reaches a boss (seed ${seed})`);
    }
  }
});
test('branched map choices survive a run round trip without regeneration', () => {
  const { reg, run } = setup();
  run.mapGraph = buildActMap(reg, createRng(9), run.seatOrder[0], 1);
  run.mapNodeId = run.mapGraph.nodes.n1_0.next[0];
  const save = createSaveManager(createMemoryStorage());
  save.saveRun(run, null);
  const loaded = save.loadRun(reg);
  assert.ok(loaded, JSON.stringify(save.runStatus()));
  assert.deepEqual(loaded.mapGraph, refreshBossDestinationLabels(reg, run.mapGraph, 1));
  assert.equal(loaded.mapNodeId, run.mapNodeId);
  assert.deepEqual(loaded.mapGraph.nodes[loaded.mapNodeId].next, run.mapGraph.nodes[run.mapNodeId].next);
});
test('route source defaults bind branch width and invalid dimensions fail before play', () => {
  const { catalog, authors } = compileGameProfiles();
  const changed = structuredClone(catalog);
  changed.packs['ashen.core-content@2.0.0'].content.routes.branchColumns = 5;
  const profile = resolveGameAuthor(authors.core, changed);
  assert.equal(profile.modules.routes.branchColumns, 5);
  assert.equal(profile.content.routes.branchColumns, 5);
  for (const branchColumns of [0, 1, 6, 2.5]) assert.throws(() => setup({ branchColumns }), /branchColumns/);
  assert.throws(() => setup({ prebossNodes: 5, restFloors: [2, 6] }), /restFloors/);
  assert.throws(() => setup({ restFloors: [3, 6] }), /restFloors.*requirePrebossRest/);
});

test('Core authors fog and pins it over a stale viewer path setting (owner, 2026-10-19)', () => {
  const { reg, run } = setup();
  run.mapGraph = buildActMap(reg, createRng(9), run.seatOrder[0], 1);
  assert.equal(run.gameProfile.modules.routes.mapMode, 'fog');
  const mode = resolveMapMode({ settings: { mapMode: 'path' } }, run);
  assert.equal(mode, 'fog', 'configured policy must not inherit a stale viewer path setting');
  const knowledge = mapKnowledge({ graph: run.mapGraph, run, mode });
  assert(knowledge.counts.hidden > 0, 'fog hides the unvisited route');
  assert(knowledge.drawn.size < Object.keys(run.mapGraph.nodes).length);
});
test('firstFloor forces depth 1 and is refused where it cannot hold (owner, 2026-10-18)', () => {
  const build = routes => { const { reg, run } = setup(routes); return buildActMap(reg, createRng(5), run.seatOrder[0], 1); };
  const open = build({});
  assert.deepEqual(open.startIds, ['n1_0']);
  assert.equal(open.nodes.n1_0.actualType, 'fight');
  assert.ok(Object.values(open.nodes).filter(node => node.floor === 3).every(node => node.type === 'shrine'), 'rests moved to depth 3 so depth 1 can be a fight');
  const restFirst = build({ firstFloor: null, requirePrebossRest: false, restFloors: [1, 6] });
  assert.deepEqual(restFirst.startIds, ['n1_0']);
  assert.equal(restFirst.nodes.n1_0.type, 'shrine');
  const shop = build({ firstFloor: 'shop' });
  for (const id of shop.startIds) assert.equal(shop.nodes[id].actualType, 'shop');
  assert.throws(() => build({ firstFloor: 'fight', requirePrebossRest: false, restFloors: [1, 6] }), /firstFloor/, 'depth 1 cannot be both a rest and a fight');
  assert.throws(() => setup({ firstFloor: 'rest', restFloors: [3, 7] }), /firstFloor/, 'rest is not a forceable lane type');
  assert.throws(() => setup({ firstFloor: 'boss' }), /firstFloor/);
  assert.throws(() => build({ firstFloor: 'elite' }), /firstFloor/, 'an elite cannot open before minimumThreatFloor');
});
test('a configured fog route reveals only landmarks, then the split and next rest; the trail persists on load', () => {
  const { reg, run } = setup({ mapMode: 'fog', requirePrebossRest: false, restFloors: [1, 6], firstFloor: null }); // the Rest-first route, authored explicitly
  run.mapGraph = buildActMap(reg, createRng(9), run.seatOrder[0], 1);
  const mode = resolveMapMode({ settings: { mapMode: 'path' } }, run);
  assert.equal(mode, 'fog', 'configured policy must not inherit a stale whole-map viewer setting');
  const knowledge = (subject = run, reveal = false) => mapKnowledge({ graph: subject.mapGraph, run: subject, mode, reveal });
  const graphNodes = Object.values(run.mapGraph.nodes);
  const rest6 = graphNodes.find(node => node.floor === 6).id, split = run.mapGraph.nodes.n1_0.next[0];
  const birth = knowledge();
  assert.deepEqual([...birth.drawn].sort(), ['n1_0', ...run.mapGraph.bossIds].sort(), 'every branch boss is a landmark from birth');
  assert.equal(birth.rung.get('n1_0'), KNOWN);
  assert.equal(birth.rung.get(rest6), HIDDEN);
  run.path = ['n1_0']; run.mapNodeId = 'n1_0';
  const atRest = knowledge();
  for (const id of run.mapGraph.nodes.n1_0.next) assert.ok(atRest.drawn.has(id));
  assert.equal(atRest.rung.get(rest6), KNOWN, 'reaching Rest reveals the next Rest landmark');
  for (const node of Object.values(run.mapGraph.nodes).filter(node => node.floor === 3)) {
    assert.equal(atRest.rung.get(node.id), HIDDEN);
    assert.equal(knowledge(run, true).rung.get(node.id), HIDDEN, 'type reveals do not bypass fog');
  }
  run.path.push(split); run.mapNodeId = split;
  const atSplit = knowledge();
  for (const id of atRest.drawn) assert.ok(atSplit.drawn.has(id), 'previously revealed options stay lit');
  for (const id of run.mapGraph.nodes[split].next) assert.ok(atSplit.drawn.has(id));
  const unconnected = graphNodes.find(node => node.floor === 3 && !run.mapGraph.nodes[split].next.includes(node.id));
  assert.ok(unconnected, 'a floor-3 node is not reachable from the split');
  assert.equal(atSplit.rung.get(unconnected.id), HIDDEN, 'unconnected choices remain fogged');
  const save = createSaveManager(createMemoryStorage()); save.saveRun(run, null);
  const loaded = save.loadRun(reg); assert.ok(loaded, JSON.stringify(save.runStatus()));
  assert.deepEqual(knowledge(loaded).drawn, atSplit.drawn);
});
test('authored threat threshold controls generation, validates boss depth, and current keeps its viewer mode', () => {
  const { reg, run } = setup({ minimumThreatFloor: 5 });
  let elites = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const map = buildActMap(reg, createRng(seed), run.seatOrder[0], 1);
    for (const node of Object.values(map.nodes)) if (node.actualType === 'elite') { assert.ok(node.floor >= 5); elites++; }
  }
  assert.ok(elites > 0, 'eligible later depths still offer elites');
  assert.throws(() => setup({ minimumThreatFloor: 9 }), /prebossNodes.*minimumThreatFloor/);
  assert.throws(() => setup({ prebossNodes: 1, restsPerAct: 1, restFloors: [1] }), /prebossNodes.*minimumThreatFloor/);
  assert.equal(resolveMapMode({}, { gameProfile: resolveGameProfile('current') }), 'fog');
  assert.equal(resolveMapMode({ settings: { mapMode: 'path' } }, { gameProfile: resolveGameProfile('current') }), 'path');
  const authored = setup({ mapMode: 'path' });
  assert.equal(resolveMapMode({}, authored.run), 'path');
});

test('a rest lights only its own branch\'s next rest, never a sibling branch\'s', () => {
  const { reg, run } = setup();
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const map = buildActMap(reg, createRng(seed), run.seatOrder[0], 1);
    if (map.bossIds.length < 2) continue;
    for (const rest of Object.values(map.nodes).filter(node => node.type === 'shrine' && node.floor === 3)) {
      const found = nearestShrine({ graph: map, from: rest.id });
      assert.equal(map.nodes[found.id].branch, rest.branch);
      const lit = litNodes({ graph: map, run: { path: [rest.id], mapNodeId: rest.id } });
      for (const id of lit) if (map.nodes[id].type === 'shrine' && id !== rest.id) assert.equal(map.nodes[id].branch, rest.branch, `${id} lit from ${rest.id}`);
      checked++;
    }
  }
  assert.ok(checked > 10);
});

test('the start node refills HP and both flasks on entry unless startNodeRefills is false', () => {
  const start = routes => { const { reg, run } = setup(routes); return { run, map: buildActMap(reg, createRng(11), run.seatOrder[0], 1) }; };
  const on = start({});
  assert.equal(on.map.nodes.n1_0.refill, true, 'default is on');
  assert.ok(Object.values(on.map.nodes).filter(node => node.id !== 'n1_0').every(node => !node.refill), 'only the start refills');
  const hurt = () => ({ maxHp: 80, hp: 12, flaskCharges: { capacity: 3, hp: 2, mana: 1, hpCurrent: 0, manaCurrent: 0 } });
  const run = hurt();
  assert.equal(applyNodeRefill(run, on.map.nodes.n1_0), true);
  assert.deepEqual([run.hp, run.flaskCharges.hpCurrent, run.flaskCharges.manaCurrent], [80, 2, 1]);
  const scarce = hurt();
  assert.equal(applyNodeRefill(scarce, on.map.nodes.n1_0, { healMult: 0.5 }), true);
  assert.deepEqual([scarce.hp, scarce.flaskCharges.hpCurrent, scarce.flaskCharges.manaCurrent], [46, 2, 1],
    'Scarce Embers halves the HP restored (12 + floor(68 * 0.5)) but flasks still refill');
  const other = hurt();
  assert.equal(applyNodeRefill(other, on.map.nodes[on.map.nodes.n1_0.next[0]]), false);
  assert.equal(other.hp, 12);
  const legacy = hurt();
  const { refill, ...old } = on.map.nodes.n1_0;
  assert.equal(applyNodeRefill(legacy, old), false, 'a saved graph without the flag does nothing new');
  assert.equal(legacy.hp, 12);
  const off = start({ startNodeRefills: false });
  assert.ok(!('refill' in off.map.nodes.n1_0) || off.map.nodes.n1_0.refill !== true);
  const spent = hurt();
  assert.equal(applyNodeRefill(spent, off.map.nodes.n1_0), false);
  assert.equal(spent.hp, 12);
});
