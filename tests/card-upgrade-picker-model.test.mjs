// Card upgrades UI 2/5: the picker's read model. Rows show Free / 1 Smithing Stone, 'maxed' and 'cap' rows are
// disabled "Fully upgraded", and the preview faces are the plan's own (the rolled step), so preview == commit.
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';
import { commitCardUpgrade } from '../src/model/cardUpgradeService.js';
import { upgradePreviewHtml } from '../src/ui/components/card.js';
import { projectGameCard } from '../src/model/gameProfile.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const strike = run => run.deck.find(c => c.cardId === 'core.strike');

test('rows: a fresh Strike is Free, its second upgrade is 1 Smithing Stone', () => {
  const run = newRun(); run.smithingStones = 1;
  const row = () => cardUpgradeModel(registries, run).rows.find(r => r.instanceId === strike(run).instanceId);
  assert.equal(row().costLabel, 'Free');
  assert.equal(row().disabled, false);
  commitCardUpgrade(run, registries, row().plan);
  assert.equal(row().costLabel, '1 Smithing Stone');
  assert.equal(row().upgrades, 1);
});

test('rows: the 10-upgrade cap and a maxed card are disabled "Fully upgraded" and cannot be selected', () => {
  const run = newRun(); run.smithingStones = 50;
  const card = strike(run);
  card.upgraded = true; card.upgradeSteps = Array.from({ length: 10 }, () => ({ k: 'dmg', n: 1 }));
  const model = cardUpgradeModel(registries, run, card.instanceId);
  const row = model.rows.find(r => r.instanceId === card.instanceId);
  assert.deepEqual([row.code, row.disabled, row.costLabel], ['cap', true, 'Fully upgraded']);
  assert.equal(model.selected, null, 'a disabled row is never the selection');
  assert.equal(model.canConfirm, false);
});

test('rows: a short purse keeps the row selectable but blocks Confirm with the reason', () => {
  const run = newRun(); run.smithingStones = 0;
  const card = strike(run);
  card.upgraded = true; card.upgradeSteps = [{ k: 'authored' }];
  const model = cardUpgradeModel(registries, run, card.instanceId);
  assert.equal(model.selected.instanceId, card.instanceId);
  assert.equal(model.canConfirm, false);
  assert.match(model.blockedReasons[0], /Smithing Stone/);
});

test('the preview shows the plan face, so it equals the card after commit', () => {
  const run = newRun();
  const model = cardUpgradeModel(registries, run, strike(run).instanceId);
  const html = upgradePreviewHtml(registries, { cardId: 'core.strike' }, model.faces);
  assert.match(html, /Strike → Strike\+/);
  commitCardUpgrade(run, registries, model.selected.plan);
  assert.equal(model.faces.after.name, projectGameCard(run, strike(run)).name);
  assert.deepEqual(JSON.parse(JSON.stringify(model.faces.after)), JSON.parse(JSON.stringify(projectGameCard(run, strike(run)))));
});

test('the preview without faces is unchanged (authored upgrade)', () => {
  assert.match(upgradePreviewHtml(registries, { cardId: 'core.strike' }), /Strike → Strike\+/);
});

test('the Core rest model lists Upgrade Card with a preview per upgradable deck card, and none for a Current profile', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const { beginGameProfileRest } = await import('../src/model/gameProfileRest.js');
  const { buildActMap } = await import('../src/engine/actmap.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { gameProfileRestModel } = await import('../src/ui/models/GameProfileRestModel.js');
  const profile = resolveGameProfile('core');
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'picker-rest' });
  run.mapGraph = buildActMap(reg, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id;
  const visit = beginGameProfileRest(run, '1:' + run.mapNodeId);
  const model = gameProfileRestModel(reg, run, visit);
  const service = model.services.find(s => s.id === 'upgradeCard');
  assert.equal(service.available, true);
  assert.equal(service.title, 'Upgrade Card');
  assert.ok(model.cardPreviews.size > 0);
  assert.ok([...model.cardPreviews.values()].every(p => p.available));
});
