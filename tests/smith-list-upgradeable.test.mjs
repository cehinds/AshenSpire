// Owner ask 2026-11-01: the "Upgrade an Item" list shows only items that can be upgraded;
// Blacksmith-gated ones sink to the bottom, disabled; the default pick is the first upgradeable item.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { smithingPlan } from '../src/model/smithing.js';
import { restSmithMaxTier } from '../src/model/blacksmithConfig.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';
import { smithCandidateRows } from '../src/ui/models/SmithWorkspaceModel.js';
import { classifySmithCandidate, orderSmithCandidates, defaultSmithSelection } from '../src/ui/models/smithCandidateOrder.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(configuredContentBundle(applyGameProfileToContent(contentBundle, profile))), profile);

const cand = (over) => ({ itemRef: 'armament/x', currentLevel: 1, nextLevel: 2, ...over });

test('classification: capped needs a Blacksmith, no next tier is hidden, a stone shortfall stays upgradeable', () => {
  assert.equal(classifySmithCandidate(cand({})), 'upgradeable');
  assert.equal(classifySmithCandidate(cand({ capped: true })), 'needsBlacksmith');
  assert.equal(classifySmithCandidate(cand({ affordable: false, shortfall: 3 })), 'upgradeable');
  assert.equal(classifySmithCandidate(cand({ nextLevel: 1 })), 'hidden');
  assert.equal(classifySmithCandidate(cand({ nextLevel: null })), 'hidden');
  assert.equal(classifySmithCandidate(null), 'hidden');
});

test('ordering: hidden dropped, upgradeable first, Blacksmith-gated last, plan order kept', () => {
  const list = [cand({ itemRef: 'a', capped: true }), cand({ itemRef: 'b' }), cand({ itemRef: 'c', nextLevel: 1 }), cand({ itemRef: 'd', capped: true }), cand({ itemRef: 'e' })];
  assert.deepEqual(orderSmithCandidates(list).map((c) => c.itemRef), ['b', 'e', 'a', 'd']);
  assert.equal(defaultSmithSelection(orderSmithCandidates(list)), 'b');
  assert.equal(defaultSmithSelection([cand({ capped: true })]), null, 'all gated: nothing is preselected');
});

function restRun(levels) {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'list' });
  run.itemUpgradeLevels = levels;
  run.smithingStones = 5;
  return run;
}

test('rest site: a tier-2 greatsword is listed last and disabled; the Blacksmith plan shows it upgradeable', () => {
  const run = restRun({ 'armament/greatsword': 2 });
  const rest = smithSelectionModel(reg, smithingPlan(reg, run, undefined, { maxTier: restSmithMaxTier(run) }));
  const gs = rest.properties.candidates.find((c) => c.itemRef === 'armament/greatsword');
  assert.ok(gs, 'still listed');
  assert.equal(gs.needsBlacksmith, true);
  assert.equal(rest.properties.candidates.at(-1).itemRef, 'armament/greatsword', 'sorted to the bottom');
  const row = smithCandidateRows(rest).at(-1);
  assert.deepEqual([row.disabled, row.status.id], [true, 'smith.row.needsBlacksmith']);
  const picked = smithSelectionModel(reg, smithingPlan(reg, run, undefined, { maxTier: restSmithMaxTier(run) }), 'armament/greatsword');
  assert.equal(picked.properties.canConfirm, false);
  assert.match(picked.properties.blockedReasons.join(' '), /Blacksmith/);
  // Only the greatsword is left to upgrade here, and it is gated: nothing is preselected.
  assert.deepEqual(rest.properties.candidates.map((c) => c.itemRef), ['armament/greatsword']);
  assert.equal(rest.properties.selected, null);
  assert.equal(rest.variant, 'choose');
  // At a Blacksmith the same item is upgradeable and enabled.
  const smith = smithSelectionModel(reg, smithingPlan(reg, run), 'armament/greatsword');
  assert.equal(smith.properties.selected.needsBlacksmith, false);
  assert.equal(smith.properties.canConfirm, true);
  assert.equal(smith.properties.candidates.some((c) => c.needsBlacksmith), false);
});

test('a stone shortfall keeps the item in place and normal, with the stone blocker', () => {
  const run = restRun({});
  run.smithingStones = 0;
  const model = smithSelectionModel(reg, smithingPlan(reg, run, undefined, { maxTier: restSmithMaxTier(run) }));
  const first = model.properties.selected;
  assert.ok(first && !first.needsBlacksmith && !first.affordable);
  assert.match(model.properties.blockedReasons.join(' '), /Smithing Stone/);
  assert.equal(smithCandidateRows(model).some((r) => r.disabled), false);
});
