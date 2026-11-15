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

test('Core maps are fog, with fogRevealRests on', () => {
  const run = newRun(3);
  assert.equal(resolveMapMode({}, run), 'fog');
  assert.equal(gameModule(run, 'routes').fogRevealRests, true);
  assert.equal(resolveMapMode({ settings: { mapMode: 'path' } }, run), 'fog', 'a stale viewer path setting does not lift the fog');
});

test('every rest site is drawn from the start and an unvisited non-rest node ahead is hidden', () => {
  for (const seed of [1, 3, 9, 41]) {
    const run = newRun(seed), k = know(run);
    assert.ok(rests(run).length >= 3);
    for (const rest of rests(run)) assert.ok(k.drawn.has(rest.id), `${seed}: ${rest.id} is a rest and is drawn`);
    const start = new Set(run.mapGraph.startIds), boss = new Set(run.mapGraph.bossIds);
    const ahead = Object.values(run.mapGraph.nodes).filter(n => n.type !== 'shrine' && !start.has(n.id) && !boss.has(n.id));
    assert.ok(ahead.length);
    for (const n of ahead) assert.ok(!k.drawn.has(n.id), `${seed}: ${n.id} (${n.type}) stays fogged`);
    assert.ok(k.counts.hidden > 0);
  }
});

test('visited nodes stay drawn and the light follows the player; rests never go dark', () => {
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
    for (const r of rests(run)) assert.ok(k.drawn.has(r.id));
    for (const old of before) assert.ok(k.drawn.has(old), 'the light never closes');
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
  const on = litNodes({ graph, run: { ...run, path: [] } });
  for (const r of rests(run)) assert.ok(on.has(r.id));
});
