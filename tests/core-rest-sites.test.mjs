import assert from 'node:assert/strict';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('Core has three rest sites per act and the floor before the boss is always one (D10)', () => {
  const rules = gameContent(registries, 'routes');
  assert.equal(rules.restsPerAct, 3);
  assert.deepEqual(rules.restFloors, [3, 6, 9]);
  assert.equal(rules.requirePrebossRest, true);
  for (const seed of [1, 2, 3, 41, 99]) {
    const run = createRunState({ seed, classId: 'reaver', registries, runId: `rest-sites-${seed}` });
    for (const tier of [1, 2, 3]) {
      const map = buildActMap(registries, createRng(seed), run.seatOrder[0], tier);
      // Each branch has its own three rests; the floor before the boss is a rest on every branch.
      for (const bossId of map.bossIds) {
        const branch = map.nodes[bossId].branch;
        const rests = Object.values(map.nodes).filter(node => node.type === 'shrine' && node.branch === branch);
        // Owner 2026-10-27: every lane has its own rest at each rest floor (a rest never merges lanes).
        const lanes = map.columns / map.bossIds.length;
        assert.deepEqual([...new Set(rests.map(node => node.floor))].sort((a, b) => a - b), [3, 6, 9]);
        assert.equal(rests.length, 3 * lanes);
        const before = Object.values(map.nodes).filter(node => node.next.includes(bossId));
        assert.ok(before.length && before.every(node => node.type === 'shrine' && node.floor === map.nodes[bossId].floor - 1));
      }
    }
  }
});

test('15% of the randomly typed Core nodes are shops and fixed nodes never are (D9)', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries, runId: 'shop-share' });
  let eligible = 0, shops = 0;
  for (let seed = 1; seed <= 300; seed++) for (const tier of [1, 2, 3]) {
    const map = buildActMap(registries, createRng(seed), run.seatOrder[tier - 1], tier);
    for (const node of Object.values(map.nodes)) {
      if (['rest', 'boss'].includes(node.actualType) || node.floor === 1) { assert.notEqual(node.actualType, 'shop'); continue; }
      if (node.actualType === 'elite') continue;
      eligible++; if (node.actualType === 'shop') shops++;
    }
  }
  assert.ok(Math.abs(shops / eligible - 0.15) <= 0.03, `shop share ${shops}/${eligible}`);
});

test('an all-services rest listing Strategize has a description string and does not throw (review finding)', async () => {
  const { t } = await import('../src/ui/strings.js');
  assert.notEqual(t('gameProfile.rest.description.strategizeAll'), 'gameProfile.rest.description.strategizeAll');
});
