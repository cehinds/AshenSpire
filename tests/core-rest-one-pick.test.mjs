// Core rest is ONE pick: Rest (a partial heal) or a service. Arriving and the services restore nothing.
import test from 'node:test';
import '../src/engine/runCombat.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest, previewGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { planCardUpgrade } from '../src/model/cardUpgradeService.js';
import { smithingPlan } from '../src/model/smithing.js';
import { restSmithMaxTier } from '../src/model/blacksmithConfig.js';
import { gameProfileRestModel } from '../src/ui/models/GameProfileRestModel.js';
import { loadGameProfileCatalog } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { SmithProbeAuthor, SmithProbeQuery, SMITH_PROBE_OPEN } from '../tools/lib/smith-shot-fixture.mjs';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const smithProfile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { gear: { statPoints: { perRank: 1 } } } });
const smithRegistries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, smithProfile)), smithProfile);
const LEGACY_RESTS = { servicesPerVisit: 'all', services: ['smith', 'levelUp', 'upgradeCard'],
  recovery: { hp: 'full', sp: 'full', mp: 'full', healingFlasks: 'full', mpFlasks: 'full' }, smith: { free: true, tiersPerService: 1 } };
function fixture({ legacy = false, smith = false } = {}) {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: smith ? smithRegistries : registries, runId: 'rest-one-pick' });
  if (legacy) run.gameProfile.content.rests = structuredClone(LEGACY_RESTS);
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = Object.values(run.mapGraph.nodes).find(n => n.type === 'shrine').id;
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
  const { run } = fixture({ smith: true });
  const candidate = smithingPlan(registries, run, undefined, { free: true, maxTier: restSmithMaxTier(run) }).candidates[0];
  const deficit = run.maxHp - run.hp;
  commitGameProfileRest(registries, run, 'smith', { itemRef: candidate.itemRef });
  // A Smith commit preserves the deficit and does not recover spent resources.
  assert.equal(run.maxHp - run.hp, deficit);
  assert.deepEqual(pools(run).slice(1), [0, 0, 0, 0]);
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

function smithProbeFixture(free) {
  const author = SmithProbeAuthor({ free }), profile = resolveGameProfile(author);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 73, classId: gameContent(profile, 'classes')[0].id, registries, runId: 'smith-probe' });
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  const node = Object.values(run.mapGraph.nodes).find(row => row.type === 'shrine');
  assert.ok(node, 'the current profile supplies a rest node');
  run.mapNodeId = node.id;
  const visit = beginGameProfileRest(run);
  return { author, profile, registries, run, visit };
}

test('Smith probe query canonically resolves its small override without editing the current author', () => {
  const source = readFileSync(new URL('../games/ashenspire/game.json', import.meta.url), 'utf8');
  const query = new URLSearchParams(SmithProbeQuery().slice(1));
  assert.equal(query.get('shot'), 'smith');
  const author = JSON.parse(query.get('gameProfile')), resolved = resolveGameProfile(author);
  const ordinary = resolveGameProfile(JSON.parse(source));
  assert.equal(resolved.modules.gear.statPoints.perRank, 1);
  assert.equal(resolved.modules.rest.mode, 'configured');
  assert.equal(resolved.modules.rest.servicesPerVisit, 1);
  assert.deepEqual(resolved.modules.rest.services, ['rest', 'smith']);
  assert.deepEqual(resolved.modules.rest.smith, { ...ordinary.modules.rest.smith, free: true, tiersPerService: 1 });
  assert.deepEqual(resolved.modules.rest.recovery, ordinary.modules.rest.recovery);
  assert.equal(resolved.hash, resolveGameProfile(SmithProbeAuthor()).hash);
  author.modules.gear.statPoints.perRank = 0;
  assert.equal(SmithProbeAuthor().modules.gear.statPoints.perRank, 1, 'each caller owns its author copy');
  assert.equal(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url), 'utf8'), source);
});

for (const free of [true, false]) test(`Smith probe ${free ? 'free' : 'paid'} quote, payment and canonical save agree`, () => {
  const { author, profile, registries, run, visit } = smithProbeFixture(free);
  const authorBefore = structuredClone(author), profileBefore = structuredClone(profile);
  assert.equal(registries.gameProfile.hash, profile.hash);
  assert.equal(run.gameProfile.hash, profile.hash);
  const plan = smithingPlan(registries, run, undefined, { free, maxTier: restSmithMaxTier(run) });
  const candidate = plan.candidates.find(row => !row.capped);
  assert.ok(candidate, 'the controlled point gain supplies an effectful owned item');
  assert.ok(candidate.changes.some(change => change.before !== change.after));
  run.smithingStones = candidate.cost;
  const model = gameProfileRestModel(registries, run, visit);
  assert.equal(model.services.find(row => row.id === 'smith').available, true);
  assert.equal(model.services.find(row => row.id === 'smith').reason, '');
  const shown = model.smith.candidates.find(row => row.itemRef === candidate.itemRef);
  assert.equal(shown.cost, candidate.cost);
  const before = structuredClone(run), payload = { itemRef: candidate.itemRef };
  const preview = previewGameProfileRest(registries, run, 'smith', payload);
  assert.deepEqual(run, before, 'quoting and previewing consume nothing');
  commitGameProfileRest(registries, run, 'smith', payload);
  assert.equal(run.itemUpgradeLevels[candidate.itemRef], candidate.nextLevel);
  assert.equal(run.smithingStones, before.smithingStones - shown.cost);
  assert.equal(run.lastSmithingReceipt.spent, shown.cost);
  assert.equal(run.lastSmithingReceipt.free, free);
  assert.equal(run.smithingStones, preview.run.smithingStones);
  assert.equal(run.itemUpgradeLevels[candidate.itemRef], preview.run.itemUpgradeLevels[candidate.itemRef]);
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, null);
  const restored = saves.loadRun(registries);
  assert.ok(restored, JSON.stringify(saves.runStatus()));
  assert.equal(restored.gameProfile.hash, profile.hash);
  assert.deepEqual(restored.itemUpgradeLevels, run.itemUpgradeLevels);
  assert.equal(restored.smithingStones, run.smithingStones);
  assert.equal(restored.gameProfileRestVisits[restored.gameProfileRestVisitId].service, 'smith');
  assert.deepEqual(author, authorBefore);
  assert.deepEqual(profile, profileBefore);
});

test('Smith reachability check refuses disabled reasons and opens one real nonempty dialog', () => {
  let clicks = 0, mounted = false;
  const option = { getAttribute: () => 'true', querySelector: () => ({ textContent: 'Nothing to upgrade.' }), click: () => { clicks++; mounted = true; } };
  const document = { querySelector: selector => selector === '#smith-opt' ? option : mounted ? {} : null };
  assert.throws(() => runInNewContext(SMITH_PROBE_OPEN, { document }), /Smith fixture unavailable: Nothing to upgrade/);
  assert.equal(clicks, 0);
  option.getAttribute = () => 'false';
  assert.equal(runInNewContext(SMITH_PROBE_OPEN, { document }), true);
  assert.equal(clicks, 1);
  assert.equal(runInNewContext(SMITH_PROBE_OPEN, { document }), true);
  assert.equal(clicks, 1, 'an already mounted dialog is not opened again');
});
