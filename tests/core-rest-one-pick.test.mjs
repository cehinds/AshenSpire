// Core rest is ONE pick: Rest (a partial heal) or a service. Arriving and the services restore nothing.
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { smithingPlan } from '../src/model/smithing.js';
import { restSmithMaxTier } from '../src/model/blacksmithConfig.js';
import { gameProfileRestModel } from '../src/ui/models/GameProfileRestModel.js';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const LEGACY_RESTS = { servicesPerVisit: 'all', services: ['smith', 'levelUp', 'upgradeCard'],
  recovery: { hp: 'full', sp: 'full', mp: 'full', healingFlasks: 'full', mpFlasks: 'full' }, smith: { free: true, tiersPerService: 1 } };
function fixture({ legacy = false } = {}) {
  const run = createRunState({ seed: 73, classId: 'reaver', registries, runId: 'rest-one-pick' });
  if (legacy) run.gameProfile.content.rests = structuredClone(LEGACY_RESTS);
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine' && n.floor === 3).id;
  run.hp = 10; run.mana = 0; run.stamina = 0; run.smithingStones = 0;
  run.flaskCharges.hpCurrent = 0; run.flaskCharges.manaCurrent = 0;
  const visit = beginGameProfileRest(run, '1:' + run.mapNodeId);
  return { run, visit };
}
const pools = run => [run.hp, run.mana, run.stamina, run.flaskCharges.hpCurrent, run.flaskCharges.manaCurrent];

test('shipped Core rests: one service per visit, rest first, hp 0.3', () => {
  const rests = gameContent(profile, 'rests');
  assert.equal(rests.servicesPerVisit, 1);
  assert.deepEqual(rests.services, ['rest', 'smith', 'upgradeCard']);
  assert.equal(rests.recovery.hp, 0.3);
});

test('arriving at a rest site changes no pool', () => {
  const { run } = fixture();
  assert.deepEqual(pools(run), [10, 0, 0, 0, 0]);
});

test('rest heals ceil(30% max HP), refills mana, stamina and both flasks, and closes the visit', () => {
  const { run } = fixture();
  const receipt = commitGameProfileRest(registries, run, 'rest', {});
  assert.equal(run.hp, Math.min(run.maxHp, 10 + Math.ceil(0.3 * run.maxHp)));
  assert.equal(run.hp, receipt.hp);
  assert.equal(run.mana, run.maxMana);
  assert.equal(run.stamina, run.maxStamina);
  assert.equal(run.flaskCharges.hpCurrent, run.flaskCharges.hp);
  assert.equal(run.flaskCharges.manaCurrent, run.flaskCharges.mana);
  assert.throws(() => commitGameProfileRest(registries, run, 'smith', {}), /unavailable or spent/);
  assert.throws(() => commitGameProfileRest(registries, run, 'rest', {}), /unavailable or spent/);
});

test('smith restores nothing and closes the visit', () => {
  const { run } = fixture();
  const candidate = smithingPlan(registries, run, undefined, { free: true, maxTier: restSmithMaxTier(run) }).candidates[0];
  commitGameProfileRest(registries, run, 'smith', { itemRef: candidate.itemRef });
  assert.equal(run.hp, 10);
  assert.deepEqual(pools(run).slice(3), [0, 0]);
  assert.throws(() => commitGameProfileRest(registries, run, 'rest', {}), /unavailable or spent/);
});

test('upgradeCard restores nothing and closes the visit', () => {
  const { run } = fixture();
  const card = run.deck.find(c => c.cardId === 'core.strike');
  commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: card.instanceId, quote: planCardUpgrade(run, registries, card.instanceId) });
  assert.deepEqual(pools(run), [10, 0, 0, 0, 0]);
  assert.throws(() => commitGameProfileRest(registries, run, 'rest', {}), /unavailable or spent/);
});

test('the legacy rests block (servicesPerVisit "all", no rest service) still heals on arrival', () => {
  const { run } = fixture({ legacy: true });
  assert.equal(run.hp, run.maxHp);
  assert.equal(run.flaskCharges.hpCurrent, run.flaskCharges.hp);
  commitGameProfileRest(registries, run, 'upgradeCard', { instanceId: run.deck[0].instanceId });
  assert.equal(run.hp, run.maxHp);
});

test('servicesPerVisit 1 needs strategize or rest as the fallback', () => {
  const catalog = loadGameProfileCatalog();
  const resolve = services => resolveGameAuthor({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { rest: { services } } }, catalog);
  assert.throws(() => resolve(['smith', 'upgradeCard']), /Strategize recovery fallback/);
  assert.doesNotThrow(() => resolve(['rest', 'smith']));
  assert.doesNotThrow(() => resolve(['strategize', 'smith']));
});

test('the UI model lists rest first with the HP number in its description', () => {
  const { run, visit } = fixture();
  const model = gameProfileRestModel(registries, run, visit);
  assert.equal(model.services[0].id, 'rest');
  const gain = Math.ceil(0.3 * run.maxHp);
  assert.match(model.services[0].description, new RegExp(`Heal ${gain} HP \\(30%\\)`));
  for (const row of model.services.filter(row => row.id !== 'rest')) assert.doesNotMatch(row.description, /restore|heal/i);
});
