// The rest Smith / card-upgrade receipt: the diff of a committed rest service names the upgraded card
// with its faces, and main.js shows it for those services (not for level-up, which has its own door).
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { snapshotRunForDiff, diffRunSnapshots } from '../src/model/runChangeReceipt.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('a rest card upgrade diffs to an upgraded card row with before and after faces', () => {
  const run = createRunState({ seed: 73, classId: 'reaver', registries, runId: 'rest-receipt' });
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find((n) => n.type === 'shrine' && n.floor === 3).id;
  beginGameProfileRest(run, `1:${run.mapNodeId}`);
  const card = run.deck.find((c) => c.cardId === 'core.strike');
  const quote = planCardUpgrade(run, registries, card.instanceId);
  run.hp = Math.max(1, run.hp - 10);
  const before = snapshotRunForDiff(run);
  commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId, quote });
  const diff = diffRunSnapshots(before, snapshotRunForDiff(run), registries);
  const row = diff.rows.find((r) => r.kind === 'card');
  assert.equal(row.change, 'upgraded'); assert.equal(row.instanceId, card.instanceId);
  assert.ok(row.faces && row.faces.before !== row.faces.after);
  assert.ok(diff.rows.some((r) => r.label === 'HP'), 'the rest heal is part of the receipt');
});

test('main.js shows the receipt for smith and upgradeCard and skips level-up', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const at = src.indexOf("const before = snapshotRunForDiff(run);\n      commitGameProfileRest");
  assert.ok(at > 0, 'the rest commit snapshots first');
  const block = src.slice(at, at + 900);
  assert.match(block, /service === 'smith' \|\| service === 'upgradeCard'/);
  assert.doesNotMatch(block, /levelUp'\)\s*\{?\s*showRunReceipt/);
});
