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
import { mapKnowledge, resolveMapMode, HIDDEN, KNOWN } from '../src/model/mapknowledge.js';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

function setup(routes = {}) {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { routes } });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg });
  return { reg, run };
}
function verifyPaths(map, rests) {
  const reached = new Set();
  function walk(id, length = 0, visitedRests = []) {
    const node = map.nodes[id];
    reached.add(id);
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
      walk(next, length + 1, nextRests);
    }
  }
  for (const start of map.startIds) { assert.equal(map.nodes[start].floor, 1); walk(start); }
  assert.equal(reached.size, Object.keys(map.nodes).length);
}
test('every seeded core branch visits eight levels and both rests across all three acts', () => {
  const { reg, run } = setup();
  for (let seed = 1; seed <= 20; seed++) {
    const bosses = new Set();
    for (let tier = 1; tier <= 3; tier++) {
      const seat = run.seatOrder[tier - 1];
      const map = buildActMap(reg, createRng(seed), seat, tier);
      verifyPaths(map, [3, 7]);
      assert.equal(map.floors, 8);
      // Floor 1 is a fight (routes.firstFloor, owner 2026-10-18): three fight lanes to choose from, drawn as fights.
      assert.deepEqual(map.startIds, ['n1_0', 'n1_1', 'n1_2']);
      for (const id of map.startIds) { assert.equal(map.nodes[id].actualType, 'fight'); assert.equal(map.nodes[id].type, 'monster'); assert.ok(map.nodes[id].next.length >= 2); }
      assert.equal(Object.values(map.nodes).filter(node => node.floor === 1).length, 3);
      assert.equal(map.shrineId, 'n7_0');
      for (const node of Object.values(map.nodes)) if (['elite', 'boss'].includes(node.actualType)) assert.ok(node.floor >= 3);
      assert.equal(Object.keys(map.nodes).length, 18);
      assert.ok(Object.values(map.nodes).some(node => node.next.length > 1));
      assert.equal(Object.values(map.nodes).filter(node => node.type === 'shrine').length, 2);
      assert.equal(Object.values(map.nodes).filter(node => node.type === 'boss').length, 1);
      for (const node of Object.values(map.nodes).filter(node => node.next.includes(map.bossId))) assert.equal(node.type, 'shrine', 'every boss predecessor is a rest');
      assert.equal(bossEncounterForNode(reg, map, map.bossId, { seat, tier }), map.nodes.boss.encounterId);
      bosses.add(map.nodes.boss.encounterId);
      assert.deepEqual(map, buildActMap(reg, createRng(seed), seat, tier));
      for (const node of Object.values(map.nodes)) {
        if (['rest', 'elite', 'boss'].includes(node.actualType) || node.floor === 1) assert.notEqual(node.type, 'event');
        else { assert.equal(node.type, 'event'); assert.ok(node.resolved); }
      }
    }
    assert.equal(bosses.size, 3);
  }
});
test('branch width, length, rest placement and exposed node types follow JSON settings', () => {
  const { reg, run } = setup({ branchColumns: 4, prebossNodes: 5, restFloors: [2, 5], hideUnknownNodes: false });
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

test('Core authors a fully visible map and pins it over a stale viewer fog setting (owner, 2026-10-18)', () => {
  const { reg, run } = setup();
  run.mapGraph = buildActMap(reg, createRng(9), run.seatOrder[0], 1);
  assert.equal(run.gameProfile.modules.routes.mapMode, 'path');
  const mode = resolveMapMode({ settings: { mapMode: 'fog' } }, run);
  assert.equal(mode, 'path', 'configured policy must not inherit a stale viewer fog setting');
  const knowledge = mapKnowledge({ graph: run.mapGraph, run, mode });
  assert.equal(knowledge.counts.hidden, 0);
  assert.equal(knowledge.drawn.size, Object.keys(run.mapGraph.nodes).length);
});
test('firstFloor forces depth 1 and is refused where it cannot hold (owner, 2026-10-18)', () => {
  const build = routes => { const { reg, run } = setup(routes); return buildActMap(reg, createRng(5), run.seatOrder[0], 1); };
  const open = build({});
  assert.deepEqual(open.startIds, ['n1_0', 'n1_1', 'n1_2']);
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
  assert.deepEqual([...birth.drawn].sort(), ['boss', 'n1_0']);
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
