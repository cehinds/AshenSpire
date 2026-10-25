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
  assert.ok(b >= 1 && b <= 5);
  assert.equal(map.bossId, map.bossIds[0]);
  assert.equal(new Set(map.bossIds.map(id => map.nodes[id].encounterId)).size, b, 'bosses are distinct');
  assert.equal(map.shrineIds.length, b);
  assert.equal(map.shrineId, map.shrineIds[0]);
  const lanes = map.columns / b;
  assert.ok(Number.isInteger(lanes) && lanes >= 1);
  assert.deepEqual(map.startIds, ['n1_0'], 'depth 1 is a single start node');
  assert.equal(map.nodes.n1_0.col, (map.columns - 1) / 2, 'the start node is centred');
  const secondDepth = Object.values(map.nodes).filter(node => node.floor === 2);
  assert.deepEqual([...map.nodes.n1_0.next].sort(), secondDepth.map(node => node.id).sort(), 'the start reaches the first node(s) of every branch');
  assert.equal(new Set(secondDepth.map(node => node.branch)).size, b, 'every branch is reachable from the start');
  assert.equal(Object.keys(map.nodes).length, 1 + (count - 1 - rests.filter(f => f > 1).length) * map.columns + rests.filter(f => f > 1).length * b + b);
  for (let k = 0; k < b; k++) {
    const own = Object.values(map.nodes).filter(node => node.branch === k);
    assert.equal(own.filter(node => node.type === 'shrine').map(node => node.floor).sort((x, y) => x - y).join(), rests.join(), `branch ${k} has its own rest at every rest floor`);
    assert.ok(own.some(node => node.actualType === 'elite' && node.floor >= minimumThreatFloor), `branch ${k} has an elite`);
    assert.equal(own.filter(node => node.type === 'boss').length, 1);
    const preboss = own.filter(node => node.next.includes(map.bossIds[k]));
    assert.ok(preboss.length && preboss.every(node => node.type === 'shrine' && node.floor === count));
    assert.ok(map.shrineIds.includes(preboss[0].id));
  }
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
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4], 'branch count varies from 1 up to the bosses available (4 at act 3)');
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
  assert.equal(widest, 4, 'the final act offers four distinct bosses');
});
test('branch width, length, rest placement and exposed node types follow JSON settings', () => {
  const { reg, run } = setup({ branchColumns: 4, prebossNodes: 5, restFloors: [2, 5], hideUnknownNodes: false, maxBranches: 1 });
  const map = buildActMap(reg, createRng(7), run.seatOrder[0], 1);
  assert.equal(map.columns, 4);
  assert.equal(map.floors, 6);
  verifyPaths(map, [2, 5]);
  assert.ok(Object.values(map.nodes).some(node => ['monster', 'merchant', 'treasure'].includes(node.type)));
  assert.equal(map.nodes.n2_0.col, 1.5);
  const noRests = setup({ prebossNodes: 3, restsPerAct: 0, restFloors: [], requirePrebossRest: false, branchColumns: 2 });
  const noRestMap = buildActMap(noRests.reg, createRng(7), noRests.run.seatOrder[0], 1);
  verifyPaths(noRestMap, []);
  assert.equal(noRestMap.shrineId, null);
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
  run.mapNodeId = run.mapGraph.nodes.n1_0.next[1];
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
  assert.equal(open.nodes.n3_0.type, 'shrine', 'rests moved to depth 3 so depth 1 can be a fight');
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
  const birth = knowledge();
  assert.deepEqual([...birth.drawn].sort(), ['n1_0', ...run.mapGraph.bossIds].sort(), 'every branch boss is a landmark from birth');
  assert.equal(birth.rung.get('n1_0'), KNOWN);
  assert.equal(birth.rung.get('n6_0'), HIDDEN);
  run.path = ['n1_0']; run.mapNodeId = 'n1_0';
  const atRest = knowledge();
  for (const id of run.mapGraph.nodes.n1_0.next) assert.ok(atRest.drawn.has(id));
  assert.equal(atRest.rung.get('n6_0'), KNOWN, 'reaching Rest reveals the next Rest landmark');
  for (const node of Object.values(run.mapGraph.nodes).filter(node => node.floor === 3)) {
    assert.equal(atRest.rung.get(node.id), HIDDEN);
    assert.equal(knowledge(run, true).rung.get(node.id), HIDDEN, 'type reveals do not bypass fog');
  }
  run.path.push('n2_0'); run.mapNodeId = 'n2_0';
  const atSplit = knowledge();
  for (const id of atRest.drawn) assert.ok(atSplit.drawn.has(id), 'previously revealed options stay lit');
  for (const id of run.mapGraph.nodes.n2_0.next) assert.ok(atSplit.drawn.has(id));
  assert.equal(atSplit.rung.get('n3_2'), HIDDEN, 'unconnected choices remain fogged');
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
