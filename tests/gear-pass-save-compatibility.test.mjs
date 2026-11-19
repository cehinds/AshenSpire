import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { canonicalGameJSON } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { gameProfileEquipmentReceipt } from '../src/model/gameProfileGear.js';
import { equipmentCardModel } from '../src/model/equipmentCard.js';
import { gameProfileShopStock, GameProfileArmamentOffer } from '../src/model/gameProfileRewards.js';
import { coreBlacksmithShelves } from '../src/model/blacksmithStock.js';
import { GearSummary } from '../src/model/gearEffects.js';
import { runMods } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

function world(enabled) {
  const snapshot = structuredClone(resolveGameProfile('default'));
  if (!enabled) delete snapshot.modules.gear.typeEffectsVersion;
  const { hash: _hash, ...payload } = snapshot;
  snapshot.hash = 'sha256:' + createHash('sha256').update(canonicalGameJSON(payload)).digest('hex');
  const profile = resolveGameProfile(snapshot);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  return { profile, registries, run };
}

for (const enabled of [false, true]) {
  test(`saved gear profile ${enabled ? 'with' : 'without'} type effects keeps its pools, modifiers and combat behavior on reload`, () => {
    const { profile, registries, run } = world(enabled);
    const gear = gameProfileEquipmentReceipt(registries, run);
    const summary = GearSummary(registries, run.loadout, run.class, run);
    assert.equal(gear.sources.some(row => row.itemId === 'type'), enabled);
    assert.equal(gear.sources.some(row => row.sourceId === 'armor/reaver/default'), enabled, 'only the new profile maps the default outfit to its named gear');
    assert.equal(summary.cardRules.length > 0, enabled);
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    assert.equal(!!combat.player.itemProps?.cardRules?.length, enabled);
    assert.equal('spellsPlayedThisTurn' in combat.player.counters, enabled);
    assert.equal((combat.player.statuses.thorns?.stacks || 0) > 0, enabled);
    commitCombatSnapshot({ run, combat, nodeId: 'n1_4', encounterId: 'patrol' });
    const manager = createSaveManager(createMemoryStorage());
    manager.saveRun(run, combat.rng);
    const loaded = manager.loadRun(registries);
    assert.ok(loaded, JSON.stringify(manager.runStatus()));
    assert.equal(loaded.gameProfile.hash, profile.hash);
    assert.equal(loaded.maxHp, run.maxHp);
    assert.deepEqual(gameProfileEquipmentReceipt(registries, loaded), gear);
    const restored = restoreCombatSnapshot({ registries, snapshot: loaded.combatEntered.snapshot, rng: createRng(511), expectedGameProfile: loaded.gameProfile });
    assert.deepEqual(restored.player.itemProps, combat.player.itemProps);
    assert.equal((restored.player.statuses.thorns?.stacks || 0) > 0, enabled);
  });
}

test('an old profile keeps its existing regeneration modifier but gains no new Lantern Fire Thorns', () => {
  const { registries, run } = world(false);
  run.loadout.sets.leftHand[0] = 'lantern';
  const originalRegen = runMods(registries, run.loadout, run.class, run).startStatuses.find(row => row.status === 'regen')?.stacks || 0;
  const registry = { ...registries, equipment: { ...registries.equipment, armaments: registries.equipment.armaments.map(piece => piece.id === 'lantern' ? { ...piece, mods: [...piece.mods, 'self.regen=+2'] } : piece) } };
  const mods = runMods(registry, run.loadout, run.class, run);
  assert.equal(mods.startStatuses.find(row => row.status === 'regen')?.stacks, originalRegen + 2);
  assert.equal(mods.startStatuses.some(row => row.status === 'thornsFire'), false);
  assert.equal(GearSummary(registry, run.loadout, run.class, run).hitRules.length, 0);
});

test('the genuine pre-gear historical profile keeps Tower Shield pool suppression through save and reconcile', () => {
  const profile = resolveGameProfile(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url)))));
  assert.equal(profile.modules.gear.typeEffectsVersion, undefined);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  const outfit = registries.equipment.armour.find(row => row.classId === 'reaver' && row.id === 'default');
  const shown = equipmentCardModel(registries, outfit);
  assert.ok(!gameProfileEquipmentReceipt(registries, run).sources.some(row => row.sourceId === 'armor/reaver/default'));
  assert.ok(!shown.facts.some(row => ['Dexterity', 'Constitution', 'DEX', 'CON', 'dexterity', 'constitution'].includes(row.label)), 'old default armour inspector shows no named-gear attribute receipt that live combat does not grant');
  run.loadout.sets.leftHand[0] = 'towerShield';
  const source = gameProfileEquipmentReceipt(registries, run).sources.find(row => row.sourceId === 'armament/towerShield');
  assert.ok(source);
  assert.equal(source.hp, 0);
  assert.equal(runMods(registries, run.loadout, run.class, run).maxHp, 0, 'a resolved old-profile item suppresses its raw +10 HP even when its resolved HP is zero');
  reconcileRunLoadoutHp(registries, run);
  const maxHp = run.maxHp;
  const manager = createSaveManager(createMemoryStorage());
  manager.saveRun(run, null);
  const restored = manager.loadRun(registries);
  assert.ok(restored, JSON.stringify(manager.runStatus()));
  assert.equal(restored.maxHp, maxHp);
  reconcileRunLoadoutHp(registries, restored);
  assert.equal(restored.maxHp, maxHp);
  assert.equal(runMods(registries, restored.loadout, restored.class, restored).maxHp, 0);
});

test('an old profile future shop offer matches Dev items and RNG, and cached offers roll nothing', () => {
  // Oracle captured from clean Dev 66e473a77c with the original immutable 73ef profile bytes.
  const profile = resolveGameProfile(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url)))));
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 511 }), rng = createRng(41);
  const offer = gameProfileShopStock(registries, run, rng, { shopId: 'old-smith' });
  assert.deepEqual(offer.options.map(row => row.id), ['shortbow', 'dagger', 'straightSword', 'progression-whisperglass-die', 'sacrificialKnife', 'crackedLantern', 'base.modify-card-stance', 'base.weak', 'base.bind', 'poiseBreaker', 'greatswordSunderingHew', 'core.reaverSpecial', 'wondrousDraught', 'blightCoating', 'flaskOfFerocity', 'wayfarerPlate', 'nightweave', 'riteVestments']);
  assert.equal(rng.getCounters().shop, 21);
  assert.equal(Object.values(rng.getCounters()).reduce((sum, n) => sum + n, 0), 21);
  const before = rng.getCounters();
  assert.deepEqual(gameProfileShopStock(registries, structuredClone(run), rng, { shopId: 'old-smith' }), offer);
  assert.deepEqual(rng.getCounters(), before);
});

test('pre-type profiles keep Dev future armament and Blacksmith offers without new theme rolls', () => {
  // Independent oracle: clean Dev 66e473a77c, seed511 / offer RNG41, default profile before the opt-in existed.
  const { registries, run } = world(false), rng = createRng(41);
  const offer = GameProfileArmamentOffer(registries, run, rng, { offerId: 'old-boss', pool: 'boss' });
  assert.deepEqual(offer.options, [{ kind: 'weapons', id: 'kiteShield' }, { kind: 'armor', id: 'riteVestments' }]);
  assert.equal(rng.getCounters().cardRewards, 9);
  const other = world(false), smithRng = createRng(41);
  const smith = coreBlacksmithShelves(other.registries, smithRng, other.run);
  assert.deepEqual(smith.armaments, [{ id: 'lantern', tier: 3, cost: 170 }, { id: 'katana', tier: 2, cost: 187 }, { id: 'duskChime', tier: 3, cost: 370 }, { id: 'halberd', tier: 0, cost: 101 }, { id: 'towerShield', tier: 0, cost: 157 }, { id: 'torch', tier: 1, cost: 85 }]);
  assert.equal(smithRng.getCounters().shopOffers, 19);
});

test('old equipment inspectors do not advertise new Lantern or Torch vocabulary', () => {
  const { registries, run } = world(false);
  for (const id of ['lantern', 'torch']) {
    const piece = registries.equipment.armaments.find(row => row.id === id);
    const shown = equipmentCardModel(registries, piece);
    assert.ok(!shown.bonuses.some(row => /thorns|vulnerable/i.test(row.label)), id);
    run.loadout.sets.leftHand[0] = id;
    assert.ok(!runMods(registries, run.loadout, run.class, run).startStatuses.some(row => row.status === 'thornsFire'));
    assert.equal(GearSummary(registries, run.loadout, run.class, run).hitRules.length, 0);
  }
});
