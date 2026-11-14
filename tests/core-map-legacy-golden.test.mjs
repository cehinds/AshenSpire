import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

// A run saved before the visible-fork map keeps the routes content it was pinned with. This fixture is that old content
// (routes.json as shipped through 2026-11-13): maps built from it must roll draw for draw as they always did.
export const LEGACY_ROUTES = {
  acts: 3, prebossNodes: 9, bosses: 3, restsPerAct: 3,
  hiddenTypes: ['event', 'fight', 'treasure', 'shop'], visibleTypes: ['rest', 'elite', 'boss'],
  restFloors: [3, 6, 9], branchColumns: 3, minimumThreatFloor: 3, mapMode: 'fog', firstFloor: 'fight',
  shopShare: 0.15, requirePrebossRest: true, maxBranches: 3, startNodeRefills: true,
};
// The bundle binds every routes key; null means absent, so the old content re-resolves with the new keys switched off.
const { catalog, authors } = compileGameProfiles();
const changed = structuredClone(catalog);
changed.packs['ashen.core-content@2.0.0'].content.routes = { ...structuredClone(LEGACY_ROUTES), typeWeights: null, variedNeighbours: null, shopsPerBranch: null, forkPercent: null, crossLinkPercent: null };
const profile = resolveGameAuthor(authors.core, changed);
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const run = createRunState({ seed: 73, classId: 'reaver', registries: reg });

const digest = map => createHash('sha256').update(JSON.stringify(Object.keys(map.nodes).sort().map(id => {
  const n = map.nodes[id];
  return [n.id, n.actualType, n.type, n.next, n.refill ?? null, n.resolved ?? null];
}))).digest('hex').slice(0, 16);
const GOLDEN = {"1:1":"06c0b3b8895ef861","1:3":"6c2c5ecabdf18fd5","2:1":"a3c27d16e485f54d","2:3":"a9d88e72c42f21e7","3:1":"4062f62f428aea8d","3:3":"930bb73fbf9f0e05","4:1":"d45b20aed2f0ed65","4:3":"64605f54bfd7d28a","5:1":"b8a5d35cf1e7d9fa","5:3":"502a7a09d2457c42","6:1":"f9a2c8cb011e0236","6:3":"70966e19c20bfdab","7:1":"4e0cd3f47fbe4f86","7:3":"49dbfaba7d12b98d","8:1":"96b258483fb29492","8:3":"3ecdd45be279eafc","9:1":"704425a0f5875793","9:3":"b5f0b45dc203c663","10:1":"c232832381f76539","10:3":"fe092026062a6959","11:1":"72c784d97c1d2dfa","11:3":"816ab31d07fd6fa6","12:1":"478eba23b45df5ae","12:3":"dc116460284eb2ca"};

test('legacy routes content still rolls the same maps draw for draw', () => {
  const got = {};
  for (let seed = 1; seed <= 12; seed++) for (const tier of [1, 3]) got[`${seed}:${tier}`] = digest(buildActMap(reg, createRng(seed), run.seatOrder[tier - 1], tier));
  if (process.env.PRINT_GOLDEN) console.log(JSON.stringify(got));
  assert.deepEqual(got, GOLDEN);
});
