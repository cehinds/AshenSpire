import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';

// Shape of the Core 2 Act 1 map over many seeds (owner, 2026-11-14: a visible, forking act map).
const SEEDS = 300, WALKS = 20, FREE_DEPTHS = new Set([2, 4, 5, 7, 8]);
const FIGHTS = new Set(['fight', 'elite', 'boss']);

const profile = resolveGameProfile('core');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const run = createRunState({ seed: 73, classId: 'reaver', registries: reg });
const mapFor = seed => buildActMap(reg, createRng(seed), run.seatOrder[0], 1);

function measure() {
  let walks = 0, fightSum = 0, fightMin = Infinity, fightMax = 0, stepsIn = 0, forkSteps = 0, exitSum = 0, exitN = 0, shopMaps = 0, nodesAll = 0, hiddenAll = 0;
  const bad = { crossings: 0, unreachable: 0, deadWalks: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const map = mapFor(seed), rng = createRng(90000 + seed);
    const ids = Object.keys(map.nodes);
    nodesAll += ids.length;
    hiddenAll += ids.filter(id => map.nodes[id].type === 'event' && map.nodes[id].actualType !== 'event').length;
    for (const id of ids) if (map.nodes[id].actualType !== 'boss') { exitSum += map.nodes[id].next.length; exitN++; }
    const branches = new Set(ids.map(id => map.nodes[id].branch).filter(b => b != null));
    shopMaps += [...branches].every(b => ids.some(id => map.nodes[id].branch === b && map.nodes[id].actualType === 'shop' && map.nodes[id].floor >= 2 && map.nodes[id].floor <= 8)) ? 1 : 0;
    const seen = new Set(map.startIds);
    const stack = [...map.startIds];
    while (stack.length) for (const t of map.nodes[stack.pop()].next) if (!seen.has(t)) { seen.add(t); stack.push(t); }
    bad.unreachable += ids.length - seen.size;
    for (let w = 0; w < WALKS; w++) {
      let node = map.nodes[map.startIds[0]], fights = FIGHTS.has(node.actualType) ? 1 : 0;
      while (node.next.length) {
        const standing = node;
        node = map.nodes[node.next[rng.int('map', 0, node.next.length - 1)]];
        if (FREE_DEPTHS.has(node.floor)) { stepsIn++; if (standing.next.length >= 2 && new Set(standing.next.map(t => map.nodes[t].actualType)).size >= 2) forkSteps++; }
        if (FIGHTS.has(node.actualType)) fights++;
      }
      if (node.actualType !== 'boss') bad.deadWalks++;
      walks++; fightSum += fights; fightMin = Math.min(fightMin, fights); fightMax = Math.max(fightMax, fights);
    }
  }
  return { fightMean: fightSum / walks, fightMin, fightMax, forkShare: forkSteps / stepsIn, exits: exitSum / exitN, shopShare: shopMaps / SEEDS, hiddenShare: hiddenAll / nodesAll, ...bad };
}

test('Core act 1 map shape measurement', () => {
  const m = measure();
  console.log(`MEASURE fightsPerWalk mean=${m.fightMean.toFixed(3)} min=${m.fightMin} max=${m.fightMax}`);
  console.log(`MEASURE forkSteps share=${m.forkShare.toFixed(3)}`);
  console.log(`MEASURE exits mean=${m.exits.toFixed(3)}`);
  console.log(`MEASURE shopReachable share=${m.shopShare.toFixed(3)}`);
  console.log(`MEASURE hiddenNodes share=${m.hiddenShare.toFixed(3)}`);
  assert.equal(m.unreachable, 0);
  assert.equal(m.deadWalks, 0);
  assert.ok(m.fightMean > 0 && m.exits >= 1);
});
