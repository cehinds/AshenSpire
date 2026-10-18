import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYERED_SCENES, INTRO_LAYERED_SCENES } from '../src/content/layeredEnvironments.js';
import { layeredCombatScene } from '../src/model/layeredEnvironments.js';

test('every authored Crownfall site resolves exactly across save/load', () => {
  assert.ok(Object.keys(INTRO_LAYERED_SCENES).length > 0);
  for (const [nodeId, mapped] of Object.entries(INTRO_LAYERED_SCENES)) {
    const expected = LAYERED_SCENES[typeof mapped === 'string' ? mapped : mapped.sceneId];
    assert.ok(expected, nodeId);
    const run = Object.freeze({ seedString: 'LAYERED', journey: Object.freeze({ currentNodeId: nodeId }) });
    const original = JSON.stringify(run);
    const selected = layeredCombatScene(run);
    assert.equal(selected.id, expected.id, nodeId);
    assert.deepEqual(selected, layeredCombatScene(JSON.parse(original)));
    assert.equal(JSON.stringify(run), original);
  }
});

test('night and weather are presentation inputs without gameplay randomness', () => {
  const nodeId = 'crownfall';
  const run = { mapNodeId: nodeId, presentationTimeId: 'night', presentationWeatherId: 'snow', rngState: 1234 };
  const original = JSON.stringify(run);
  const selected = layeredCombatScene(run);
  assert.equal(selected.timeId, 'night');
  assert.equal(selected.weatherId, 'snow');
  assert.equal(selected.id, 'city-street-night');
  assert.ok(selected.layers.some(layer => layer.role === 'backdrop' && layer.asset.includes('city-street-night')));
  assert.equal(JSON.stringify(run), original);
});

test('indoor scenes exclude precipitation even when outdoor weather is requested', () => {
  const indoor = Object.values(LAYERED_SCENES).find(scene => scene.interior);
  assert.ok(indoor);
  for (const weather of ['rain', 'snow']) {
    const selected = layeredCombatScene({ mapNodeId: 'indoor-fixture', presentationWeatherId: weather,
      mapGraph: { nodes: { 'indoor-fixture': { layeredSceneId: indoor.id } } } });
    assert.equal(selected.weatherId, 'clear');
    assert.equal(selected.interior, true);
    assert.ok(selected.layers.every(layer => layer.purpose !== 'weather' && layer.role !== 'particles'));
  }
});

test('unknown or mismatched sites preserve the atlas fallback', () => {
  assert.equal(layeredCombatScene({}), null);
  assert.equal(layeredCombatScene({ mapNodeId: 'not-authored' }), null);
  assert.equal(layeredCombatScene({ mapNodeId: 'unmapped', mapGraph: { nodes: { unmapped: { type: 'boss', displayName: 'Unknown Fortress' } } } }, { region: { id: 'drowned-coast' } }), null);
});


test('known authored settings stay within their region', () => {
  const run = { mapNodeId: 'fixture', mapGraph: { nodes: { fixture: { type: 'fight' } } } };
  assert.equal(layeredCombatScene(run, { region: { id: 'hollow-weald' } }).id, 'forest-path');
  const legacyMonster = { ...run, mapGraph: { nodes: { fixture: { type: 'monster' } } } };
  assert.equal(layeredCombatScene(legacyMonster, { region: { id: 'ashen-crown' } }).id, 'open-road');
  assert.equal(layeredCombatScene(run, { region: { id: 'pale-marches' } }), null);
  assert.equal(layeredCombatScene(run, { region: { id: 'cinder-reach' } }), null);
  const city = { ...run, mapGraph: { nodes: { fixture: { type: 'merchant' } } } };
  assert.equal(layeredCombatScene(city, { region: { id: 'pale-marches' } }).id, 'snowy-street');
  assert.equal(layeredCombatScene(city, { region: { id: 'cinder-reach' } }), null);
  assert.equal(layeredCombatScene(run, { region: { id: 'drowned-coast' } }), null);
});

test('intro dressing is inserted before ground and scene recipes remain unchanged', () => {
  const [nodeId, binding] = Object.entries(INTRO_LAYERED_SCENES).find(([, value]) => value.additionalProps?.length);
  const original = JSON.stringify(LAYERED_SCENES);
  const selected = layeredCombatScene({ mapNodeId: nodeId, presentationWeatherId: 'rain' });
  const ground = selected.layers.findIndex(layer => layer.role === 'ground');
  assert.ok(ground > 0);
  for (const prop of binding.additionalProps) assert.ok(selected.layers.indexOf(prop) < ground);
  assert.equal(JSON.stringify(LAYERED_SCENES), original);
});


test('indoor local ambient lighting survives default time selection', () => {
  const indoor = Object.values(LAYERED_SCENES).find(scene => scene.interior && !scene.layers.some(layer => layer.purpose === 'time-of-day'));
  assert.ok(indoor);
  const run = { mapNodeId: 'fixture', mapGraph: { nodes: { fixture: { layeredSceneId: indoor.id } } } };
  assert.ok(layeredCombatScene(run).layers.every(layer => layer.purpose !== 'time-of-day'));
  assert.ok(layeredCombatScene({ ...run, presentationTimeId: 'night' }).layers.some(layer => layer.filterId === 'night'));
});

test('real co-op fight snapshots select the same layered scenery as solo without changing session state', async () => {
  const { createSession } = await import('../tools/session.mjs');
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { initialClassTreeChoices } = await import('../src/model/classTree.js');
  const { registriesForClassMastery } = await import('../src/model/classMasteryRun.js');
  const { combatEnvironment } = await import('../src/model/environmentArt.js');
  const registries = createRegistries(contentBundle);
  const host = createSession({ registries, seedString: 'LAYERED', firstSeat: 'weald' });
  host.addMember({ id: 'p1', name: 'One', classId: 'rogue' });
  host.addMember({ id: 'p2', name: 'Two', classId: 'reaver' });
  host.start();
  for (const member of host.session.members.values()) {
    while (member.run.classMasteryState?.initialTreeTiers.length) {
      const choices = initialClassTreeChoices(registriesForClassMastery(registries, member.run), member.run);
      assert.equal(host.chooseMasteryNode(member.id, choices[0]).ok, true);
    }
  }
  const nodeId = host.session.mapGraph.startIds[0];
  for (const id of ['p1', 'p2']) assert.equal(host.chooseNode(id, nodeId).ok, true);
  const snapshot = host.snapshot();
  assert.equal(snapshot.scene.kind, 'combat');
  assert.equal(snapshot.cursorId, nodeId);
  assert.ok(Array.isArray(snapshot.map.nodes));
  const beforeSnapshot = JSON.stringify(snapshot), beforeSession = JSON.stringify(host.serialize());
  const selected = layeredCombatScene(snapshot, combatEnvironment(snapshot));
  assert.equal(selected.id, 'forest-path');
  const solo = { ...snapshot, mapNodeId: snapshot.cursorId, mapGraph: host.session.mapGraph };
  assert.deepEqual(selected, layeredCombatScene(solo, combatEnvironment(solo)));
  assert.equal(JSON.stringify(snapshot), beforeSnapshot);
  assert.equal(JSON.stringify(host.serialize()), beforeSession, 'selection never advances shared RNG or changes host state');
});

test('co-op final-tier boss uses the causeway while explicit solo and journey cursors retain priority', async () => {
  const { combatEnvironment } = await import('../src/model/environmentArt.js');
  const snapshot = { seedString: 'COOP-CAUSEWAY', actNumber: 3, seatOrder: ['weald', 'marches', 'reach'],
    cursorId: 'boss', map: { nodes: [{ id: 'boss', type: 'boss' }] } };
  const original = JSON.stringify(snapshot);
  assert.equal(layeredCombatScene(snapshot, combatEnvironment(snapshot)).id, 'dungeon-corridor');
  const solo = { ...snapshot, mapNodeId: 'solo', environmentRegionId: 'ashen-crown',
    mapGraph: { nodes: { solo: { type: 'fight', layeredSceneId: 'castle-grounds' } } } };
  assert.equal(layeredCombatScene(solo).id, 'castle-grounds');
  assert.equal(layeredCombatScene({ ...solo, journey: { currentNodeId: 'crownfall/forge' } }).id, 'intro-forge');
  assert.equal(JSON.stringify(snapshot), original);
});
