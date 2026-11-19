import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { legacyCoreProfile } from './coreLegacyRoutes.mjs';

// A run saved before the visible-fork map keeps the routes content it was pinned with (tests/coreLegacyRoutes.mjs): maps built
// from it must roll draw for draw as they always did.
const profile = legacyCoreProfile();
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const run = createRunState({ seed: 73, classId: 'reaver', registries: reg });

const digest = map => createHash('sha256').update(JSON.stringify(Object.keys(map.nodes).sort().map(id => {
  const n = map.nodes[id];
  return [n.id, n.actualType, n.type, n.next, n.refill ?? null, n.resolved ?? null];
}))).digest('hex').slice(0, 16);
const GOLDEN = {"1:1":"2a85ff8c70edd962","1:3":"2a85ff8c70edd962","2:1":"887df68001ae93d1","2:3":"887df68001ae93d1","3:1":"de92f1a015b42a15","3:3":"de92f1a015b42a15","4:1":"506b1e09433af296","4:3":"506b1e09433af296","5:1":"464fcb059389034c","5:3":"464fcb059389034c","6:1":"c52df117b644485f","6:3":"c52df117b644485f","7:1":"4a149f2f55a25da5","7:3":"4a149f2f55a25da5","8:1":"3db0d86d938cff79","8:3":"3db0d86d938cff79","9:1":"6aec74eaf14798e9","9:3":"6aec74eaf14798e9","10:1":"00298f86f46f2a4c","10:3":"00298f86f46f2a4c","11:1":"c78a9fa9629f2138","11:3":"c78a9fa9629f2138","12:1":"20f6c4cbdbd69541","12:3":"20f6c4cbdbd69541"};

test('legacy routes content still rolls the same maps draw for draw', () => {
  const got = {};
  for (let seed = 1; seed <= 12; seed++) for (const tier of [1, 3]) got[`${seed}:${tier}`] = digest(buildActMap(reg, createRng(seed), run.seatOrder[tier - 1], tier));
  if (process.env.PRINT_GOLDEN) console.log(JSON.stringify(got));
  assert.deepEqual(got, GOLDEN);
});
