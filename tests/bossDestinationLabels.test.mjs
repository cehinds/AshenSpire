import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildActMap, bossEncounterForNode } from '../src/engine/actmap.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { bossDestinationLabel, refreshBossDestinationLabels } from '../src/model/bossDestinationLabels.js';

const original = createRegistries(contentBundle);
function changedContent(replaceEnemies) {
  return createRegistries({
    ...contentBundle,
    enemies: contentBundle.enemies.map((enemy) => enemy.id === 'bellKeeper' ? { ...enemy, name: 'Renamed Bell Keeper' } : enemy),
    encounters: contentBundle.encounters.map((encounter) => replaceEnemies && encounter.id === 'bossBellKeeper'
      ? { ...encounter, enemies: ['glassRegent', 'bellKeeper'] } : encounter),
  });
}
function withoutLabels(graph) {
  return { ...graph, nodes: Object.fromEntries(Object.entries(graph.nodes).map(([id, node]) => {
    const { destinationLabel, ...rest } = node;
    return [id, rest];
  })) };
}

for (const replaceEnemies of [false, true]) {
  test(`solo and LAN labels follow current ${replaceEnemies ? 'encounter composition' : 'enemy names'} without changing saved identity or RNG`, () => {
    const current = changedContent(replaceEnemies);
    const run = createRunState({ seed: 808, classId: 'reaver', registries: original });
    run.mapGraph = buildActMap(original, createRng(808), 1);
    const id = run.mapGraph.bossIds.find((id) => run.mapGraph.nodes[id].encounterId === 'bossBellKeeper');
    run.mapNodeId = id;
    const before = JSON.stringify(run);
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run);
    const loaded = saves.loadRun(current);
    assert(loaded);
    const expected = replaceEnemies ? 'Bellfoundry · The Glass Regent & Renamed Bell Keeper' : 'Bellfoundry · Renamed Bell Keeper';
    assert.equal(loaded.mapGraph.nodes[id].destinationLabel, expected);
    assert.equal(bossEncounterForNode(current, loaded.mapGraph, id, 1), 'bossBellKeeper');
    assert.deepEqual(withoutLabels(loaded.mapGraph), withoutLabels(run.mapGraph));
    assert.deepEqual(loaded.streamCounters, run.streamCounters);
    assert.equal(loaded.mapNodeId, id);
    assert.equal(JSON.stringify(run), before);

    const host = createSession({ registries: original, seedString: 'GOLDBOUGH' });
    host.addMember({ id: 'p1', name: 'Label tester', classId: 'reaver' }); host.start();
    const saved = structuredClone(host.serialize());
    const terminal = saved.mapGraph.bossIds.find((id) => saved.mapGraph.nodes[id].encounterId === 'bossBellKeeper');
    saved.cursorId = saved.mapGraph.shrineId; saved.reachableIds = [terminal];
    const savedBytes = JSON.stringify(saved);
    const restored = restoreSession(current, saved);
    assert.equal(restored.snapshot().map.nodes.find((node) => node.id === terminal).destinationLabel, expected);
    const roundTrip = restored.serialize();
    assert.deepEqual(withoutLabels(roundTrip.mapGraph), withoutLabels(saved.mapGraph));
    assert.deepEqual(roundTrip.rng, saved.rng);
    assert.equal(roundTrip.cursorId, saved.cursorId);
    assert.equal(JSON.stringify(saved), savedBytes);
  });
}

test('new map labels and refreshed labels have one source and unchanged labels retain graph identity', () => {
  const graph = buildActMap(original, createRng(909), 1);
  for (const id of graph.bossIds) assert.equal(graph.nodes[id].destinationLabel, bossDestinationLabel(original, graph.nodes[id].encounterId));
  assert.equal(refreshBossDestinationLabels(original, graph, 1), graph);
});
