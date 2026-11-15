// Owner, 2026-11-15: "fog like before, but only unfog rest locations and locations already traveled".
import test from 'node:test';
import assert from 'node:assert/strict';
import { core2Registries } from './helpers/core2.mjs';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { resolveMapMode, mapKnowledge, litNodes } from '../src/model/map/mapknowledge.js';
import { gameModule } from '../src/model/gameProfile.js';

const registries = core2Registries();
const newRun = seed => {
  const run = createRunState({ seed, classId: 'reaver', registries, runId: `fog-rests-${seed}` });
  run.mapGraph = buildActMap(registries, createRng(seed), run.seatOrder[0], 1);
  return run;
};
const know = run => mapKnowledge({ graph: run.mapGraph, run, mode: resolveMapMode({}, run) });
const rests = run => Object.values(run.mapGraph.nodes).filter(node => node.type === 'shrine');

test('Core maps are fog, with fogRevealRests off', () => {
  const run = newRun(3);
  assert.equal(resolveMapMode({}, run), 'fog');
  assert.equal(gameModule(run, 'routes').fogRevealRests, false);
  assert.equal(resolveMapMode({ settings: { mapMode: 'path' } }, run), 'fog', 'a stale viewer path setting does not lift the fog');
});

test('no rest is lit at the start; only the entrance and the bosses', () => {
  for (const seed of [1, 3, 9, 41]) {
    const run = newRun(seed), k = know(run);
    assert.deepEqual([...k.drawn].sort(), [...run.mapGraph.startIds, ...run.mapGraph.bossIds].sort(), `${seed}`);
    for (const rest of rests(run)) assert.ok(!k.drawn.has(rest.id), `${seed}: ${rest.id} stays fogged`);
  }
});

test('visited nodes stay drawn and the light follows the player', () => {
  const run = newRun(9), g = run.mapGraph;
  const walk = [g.startIds[0]];
  while (walk.length < 4) { const next = g.nodes[walk[walk.length - 1]].next; if (!next.length) break; walk.push(next[0]); }
  let before = know(run).drawn;
  run.path = []; 
  for (const id of walk) {
    run.path.push(id); run.mapNodeId = id;
    const k = know(run);
    for (const seen of run.path) assert.ok(k.drawn.has(seen), `${seen} traveled stays revealed`);
    for (const to of g.nodes[id].next) assert.ok(k.drawn.has(to), `the split ahead of ${id} is lit`);
    before = k.drawn;
  }
  const farAway = Object.values(g.nodes).find(n => n.type !== 'shrine' && !walk.includes(n.id) && !walk.some(w => g.nodes[w].next.includes(n.id)) && !g.bossIds.includes(n.id));
  assert.ok(!before.has(farAway.id), 'a node beyond the split is still hidden');
});

test('with fogRevealRests off or absent the fog is the plain fog (legacy fixture)', () => {
  const run = newRun(3);
  const graph = run.mapGraph;
  const plain = litNodes({ graph, run: { path: [], mapNodeId: null } });
  const off = litNodes({ graph, run: { ...run, gameProfile: { modules: { routes: { fogRevealRests: false } } }, path: [] } });
  assert.deepEqual([...off].sort(), [...plain].sort());
  assert.ok(rests(run).some(r => !plain.has(r.id)), 'plain fog hides rests that are not on the trail');
  const on = litNodes({ graph, run: { ...run, gameProfile: { modules: { routes: { fogRevealRests: true } } }, path: [] } });
  for (const r of rests(run)) assert.ok(on.has(r.id));
});

test('fogTrailOnly: the trail plus one step from the CURRENT node only; a branch off a past node and the next rest stay fogged', () => {
  for (const seed of [1, 4, 9]) {
    const run = newRun(seed), g = run.mapGraph;
    assert.equal(gameModule(run, 'routes').fogTrailOnly, true);
    const walk = [g.startIds[0]];
    while (walk.length < 4) { const next = g.nodes[walk[walk.length - 1]].next; if (!next.length) break; walk.push(next[0]); }
    run.path = walk; run.mapNodeId = walk[walk.length - 1];
    const k = know(run), here = g.nodes[run.mapNodeId];
    const allowed = new Set([...walk, ...here.next, ...g.startIds, ...g.bossIds]);
    assert.deepEqual([...k.drawn].sort(), [...allowed].sort(), `${seed}: nothing beyond the trail, one step ahead, entrance and bosses`);
    for (const id of walk.slice(0, -1)) for (const to of g.nodes[id].next) if (!allowed.has(to)) assert.ok(!k.drawn.has(to), `${to}: a branch off a past node is hidden`);
  }
});
