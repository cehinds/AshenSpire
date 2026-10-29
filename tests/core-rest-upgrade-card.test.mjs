// Card upgrades UI 1/5: the Core rest service `upgradeCard` upgrades one deck card per visit through the card-upgrade service.
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest, restServiceUsed } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { upgradeCount } from '../src/model/cardUpgrade.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture(stones = 0) {
  const run = createRunState({ seed: 73, classId: 'reaver', registries, runId: 'rest-upgrade-card' });
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id;
  const visit = beginGameProfileRest(run, '1:' + run.mapNodeId);
  run.smithingStones = stones;
  return { run, visit };
}
const strike = run => run.deck.find(c => c.cardId === 'core.strike');

test('Core rests list upgradeCard; the service is in the schema enum', () => {
  assert.ok(gameContent(registries, 'rests').services.includes('upgradeCard'));
});

test('upgradeCard commits the planned step: free first upgrade, receipt, healed, once per visit', () => {
  const { run, visit } = fixture(0);
  const card = strike(run);
  const quote = planCardUpgrade(run, registries, card.instanceId);
  const receipt = commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId, quote });
  assert.equal(receipt.upgrade.n, 1);
  assert.deepEqual(strike(run).upgradeSteps, [quote.step]);
  assert.equal(restServiceUsed(run.gameProfileRestVisits[visit.id], 'upgradeCard'), true);
  assert.equal(run.smithingStones, 0);
  assert.throws(() => commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId }), /unavailable or spent/);
  assert.equal(upgradeCount(strike(run)), 1);
});

test('a second upgrade of the card in a later visit costs a stone; none with 0 stones', () => {
  const { run } = fixture(0);
  const card = strike(run);
  commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId });
  const next = fixture(0).run;
  const c2 = strike(next);
  c2.upgraded = true; c2.upgradeSteps = [{ k: 'authored' }];
  assert.throws(() => commitGameProfileRest(registries, next, 'upgradeCard', { instanceId: c2.instanceId }), /Smithing Stone/);
  assert.equal(upgradeCount(c2), 1);
  next.smithingStones = 1;
  commitGameProfileRest(registries, next, 'upgradeCard', { instanceId: c2.instanceId });
  assert.equal(next.smithingStones, 0);
  assert.equal(upgradeCount(strike(next)), 2);
});

test('a stale quote is refused and the visit stays unspent', () => {
  const { run, visit } = fixture(0);
  const card = strike(run);
  const quote = planCardUpgrade(run, registries, card.instanceId);
  assert.throws(() => commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId, quote: { ...quote, step: { k: 'dmg', n: 99 } } }), /out of date/);
  assert.equal(restServiceUsed(run.gameProfileRestVisits[visit.id], 'upgradeCard'), false);
  assert.equal(upgradeCount(card), 0);
});
