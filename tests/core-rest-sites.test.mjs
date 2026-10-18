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
  assert.deepEqual(rules.restFloors, [3, 5, 7]);
  assert.equal(rules.requirePrebossRest, true);
  for (const seed of [1, 2, 3, 41, 99]) {
    const run = createRunState({ seed, classId: 'reaver', registries, runId: `rest-sites-${seed}` });
    for (const tier of [1, 2, 3]) {
      const map = buildActMap(registries, createRng(seed), run.seatOrder[0], tier);
      const rests = Object.values(map.nodes).filter(node => node.type === 'shrine');
      assert.deepEqual(rests.map(node => node.floor).sort((a, b) => a - b), [3, 5, 7]);
      const boss = map.nodes.boss;
      const before = Object.values(map.nodes).filter(node => node.next.includes('boss'));
      assert.ok(before.length && before.every(node => node.type === 'shrine' && node.floor === boss.floor - 1));
    }
  }
});
