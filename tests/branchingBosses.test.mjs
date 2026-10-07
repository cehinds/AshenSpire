import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { LEGACY_ACT_BOSSES } from '../src/content/mapconfig.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { buildActMap, bossEncounterForNode } from '../src/engine/actmap.js';
import { litNodes } from '../src/model/mapknowledge.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRunState } from '../src/model/state.js';
import { defaultSeatOrder } from '../src/model/seats.js';

const legacyIds = Object.values(LEGACY_ACT_BOSSES);
const singleBundle = { ...contentBundle, encounters: contentBundle.encounters.filter((encounter) => encounter.pool !== 'boss' || legacyIds.includes(encounter.id)) };
const single = createRegistries(singleBundle);
const template = singleBundle.encounters.find((row) => row.id === LEGACY_ACT_BOSSES[1]);
const additions = Array.from({ length: 8 }, (_, i) => ({ ...template, id: `branchBoss${i}`, enemies: [i % 2 ? 'blightHound' : 'graveWisp'] }));
const expanded = createRegistries({ ...singleBundle, encounters: [...singleBundle.encounters, ...additions] });
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`ok ${name}`); }
const topology = (graph) => Object.values(graph.nodes).map(({ id, floor, col, type, next }) => ({ id, floor, col, type, next }));

test('a single-boss pool preserves generated geometry and map RNG', () => {
  for (const act of [1, 2, 3]) for (let seed = 1; seed <= 20; seed++) {
    const originalRng = createRng(seed), nextRng = createRng(seed);
    const seat = defaultSeatOrder(single)[act - 1];
    const original = generateActMap({ config: single.mapConfig(act), rng: originalRng });
    const next = buildActMap(single, nextRng, seat, act);
    assert.deepEqual(topology(next), topology(original));
    assert.equal(nextRng.getCounters().map, originalRng.getCounters().map);
    assert.deepEqual(next.bossIds, [original.bossId]);
    assert.equal(bossEncounterForNode(single, next, next.bossId, { seat, tier: act }), LEGACY_ACT_BOSSES[act]);
  }
});

test('three and four terminal choices use adjacent centered columns instead of the map edges', () => {
  for (const count of [3, 4]) {
    const registries = createRegistries({ ...singleBundle, encounters: [...singleBundle.encounters, ...additions.slice(0, count - 1)] });
    const graph = buildActMap(registries, createRng(54), 'weald', 1, { columns: 7 });
    const cols = graph.bossIds.map(id => graph.nodes[id].col);
    assert.equal(cols.length, count);
    assert.deepEqual(cols, Array.from({ length: count }, (_, i) => Math.floor((7 - count) / 2) + i));
    assert.equal(cols.at(-1) - cols[0], count - 1);
    assert.deepEqual(graph.nodes[graph.shrineId].next, graph.bossIds);
  }
});

test('seeded terminal choices are distinct, all reachable through the guaranteed rest, with no dead ends', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 80; seed++) {
    const graph = buildActMap(expanded, createRng(seed), 'weald', 1, { columns: 2 });
    assert.deepEqual(graph, buildActMap(expanded, createRng(seed), 'weald', 1, { columns: 2 }));
    assert.equal(graph.bossIds.length, 2);
    const encounters = graph.bossIds.map((id) => bossEncounterForNode(expanded, graph, id, { seat: 'weald', tier: 1 }));
    assert.equal(new Set(encounters).size, 2);
    encounters.forEach((id) => seen.add(id));
    const reached = new Set(), queue = [...graph.startIds];
    while (queue.length) {
      const id = queue.shift();
      if (reached.has(id)) continue;
      reached.add(id);
      const node = graph.nodes[id];
      assert(node, 'every edge resolves');
      assert(node.next.length || graph.bossIds.includes(id), 'only terminal bosses end a path');
      queue.push(...node.next);
    }
    assert.equal(reached.size, Object.keys(graph.nodes).length);
    assert.equal(graph.nodes[graph.shrineId].type, 'shrine');
    assert.deepEqual(graph.nodes[graph.shrineId].next, graph.bossIds);
    for (const id of graph.bossIds) {
      const parents = Object.values(graph.nodes).filter((node) => node.next.includes(id));
      assert(parents.every((parent) => parent.id === graph.shrineId));
      assert(graph.nodes[id].destinationLabel);
    }
    const visible = litNodes({ graph, run: { path: [] } });
    assert(graph.bossIds.every((id) => visible.has(id)), 'fog reveals every terminal');
    const restored = JSON.parse(JSON.stringify(graph));
    assert.deepEqual(restored.bossIds.map((id) => bossEncounterForNode(expanded, restored, id, { seat: 'weald', tier: 1 })), encounters);
  }
  assert.equal(seen.size, additions.length + 1, 'all pool members occur across seeds');
});

test('legacy unentered bosses retain explicit original act identity after pool expansion without mutation', () => {
  for (const act of [1, 2, 3]) {
    const graph = generateActMap({ config: single.mapConfig(act), rng: createRng(act) });
    const before = JSON.stringify(graph);
    assert.equal(bossEncounterForNode(expanded, graph, graph.bossId, { seat: defaultSeatOrder(expanded)[act - 1], tier: act }), LEGACY_ACT_BOSSES[act]);
    assert.equal(JSON.stringify(graph), before);
  }
});

test('invalid new destination identities fail instead of silently rerolling', () => {
  const graph = buildActMap(expanded, createRng(7), 'weald', 1);
  const node = graph.nodes[graph.bossIds[0]];
  delete node.encounterId;
  assert.throws(() => bossEncounterForNode(expanded, graph, node.id, { seat: 'weald', tier: 1 }), /no valid encounter/);
  node.encounterId = LEGACY_ACT_BOSSES[2];
  assert.throws(() => bossEncounterForNode(expanded, graph, node.id, { seat: 'weald', tier: 1 }), /no valid encounter/);
  assert.throws(() => bossEncounterForNode(expanded, graph, graph.startIds[0], { seat: 'weald', tier: 1 }), /not a boss/);
});

test('live LAN host enters the selected terminal encounter and transports all choices', () => {
  const session = createSession({ registries: expanded, seedString: 'GOLDBOUGH', firstSeat: 'weald' });
  session.addMember({ id: 'p1', name: 'Route tester', classId: 'reaver' });
  session.start();
  const graph = session.session.mapGraph;
  const id = graph.bossIds.find((id) => graph.nodes[id].encounterId !== LEGACY_ACT_BOSSES[1]);
  const destination = graph.nodes[id];
  const snapshot = session.snapshot();
  assert.deepEqual(snapshot.map.bossIds, graph.bossIds);
  assert.equal(snapshot.map.nodes.find((node) => node.id === id).destinationLabel, destination.destinationLabel);
  session.session.reachableIds = [...graph.bossIds];
  session.chooseNode('p1', id);
  assert.equal(session.session.cursorId, id);
  assert.equal(session.scene.kind, 'combat');
  assert.deepEqual(session.live.combat.enemies.map((enemy) => enemy.enemyId), expanded.encounters.get(destination.encounterId).enemies);
});

test('real save loading preserves new and legacy topology and selected encounter without RNG changes', () => {
  for (const legacy of [false, true]) {
    const run = createRunState({ seed: 71, classId: 'reaver', registries: expanded });
    run.mapGraph = legacy
      ? generateActMap({ config: single.mapConfig(1), rng: createRng(71) })
      : buildActMap(expanded, createRng(71), 'weald', 1);
    run.mapNodeId = legacy ? run.mapGraph.bossId : run.mapGraph.bossIds.at(-1);
    const identity = bossEncounterForNode(expanded, run.mapGraph, run.mapNodeId, { seat: 'weald', tier: 1 });
    const original = JSON.stringify({ graph: run.mapGraph, cursor: run.mapNodeId, counters: run.streamCounters });
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run);
    const loaded = saves.loadRun(expanded);
    assert(loaded, 'valid route save loads through real save manager');
    assert.equal(JSON.stringify({ graph: loaded.mapGraph, cursor: loaded.mapNodeId, counters: loaded.streamCounters }), original);
    assert.equal(bossEncounterForNode(expanded, loaded.mapGraph, loaded.mapNodeId, { seat: 'weald', tier: 1 }), identity);
  }
});

test('solo load archives invalid persisted boss IDs even without a content-version change', () => {
  for (const invalid of ['removedBoss', 'loneSoldier', LEGACY_ACT_BOSSES[2], undefined]) {
    const run = createRunState({ seed: 79, classId: 'reaver', registries: expanded });
    run.mapGraph = buildActMap(expanded, createRng(79), 'weald', 1);
    const id = run.mapGraph.bossIds.at(-1);
    if (invalid === undefined) delete run.mapGraph.nodes[id].encounterId;
    else run.mapGraph.nodes[id].encounterId = invalid;
    const graph = JSON.stringify(run.mapGraph);
    const saves = createSaveManager(createMemoryStorage()); saves.saveRun(run);
    assert.equal(saves.loadRun(expanded), null);
    const status = saves.runStatus(); assert.equal(status.state, 'archived');
    assert.match(status.reason, /Saved boss destination.*invalid encounter/);
    assert.equal(JSON.stringify(JSON.parse(saves.getArchive(status.archiveId).save).mapGraph), graph);
  }
});

test('LAN restore refuses dangling, wrong-pool, wrong-act and missing new boss IDs without altering saved data', () => {
  const host = createSession({ registries: expanded, seedString: 'GOLDBOUGH', firstSeat: 'weald' });
  host.addMember({ id: 'p1', name: 'Route tester', classId: 'reaver' }); host.start();
  for (const invalid of ['removedBoss', 'loneSoldier', LEGACY_ACT_BOSSES[2], undefined]) {
    const saved = structuredClone(host.serialize()); const id = saved.mapGraph.bossIds.at(-1);
    if (invalid === undefined) delete saved.mapGraph.nodes[id].encounterId;
    else saved.mapGraph.nodes[id].encounterId = invalid;
    const before = JSON.stringify(saved);
    assert.throws(() => restoreSession(expanded, saved), /Saved boss destination.*invalid encounter/);
    assert.equal(JSON.stringify(saved), before);
  }
  for (const legacy of [false, true]) {
    const saved = structuredClone(host.serialize());
    if (legacy) saved.mapGraph = generateActMap({ config: single.mapConfig(1), rng: createRng(91) });
    const before = JSON.stringify({ graph: saved.mapGraph, rng: saved.rng });
    const restored = restoreSession(expanded, saved).serialize();
    assert.equal(JSON.stringify({ graph: restored.mapGraph, rng: restored.rng }), before);
  }
});

console.log(`branching bosses: ${passed} passed`);
