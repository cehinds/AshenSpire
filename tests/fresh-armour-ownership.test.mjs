import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, RUN_SCHEMA_ACQUIRED_ARMOUR } from '../src/model/state.js';
import { inventoryRows } from '../src/model/inventoryPresentation.js';
import { equipPiece, ownership, stampDeck } from '../src/model/loadout.js';
import { startingArmourViews } from '../src/model/startingKits.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSalePlan, gameProfileShopSalePlans } from '../src/model/gameProfileShopSales.js';
import { createSaveManager, createMemoryStorage, RUN_KEY } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { rederivePools } from '../src/model/levelup.js';
import { swapRunClass } from '../src/model/classSwap.js';
import { equipClassCard } from '../src/model/classLibrary.js';
import { learnClassCard } from '../src/model/classLibraryState.js';

const registries = createRegistries(contentBundle);
const richMeta = {
  unlocked: (contentBundle.unlocks || []).map(row => row.id),
  found: registries.equipment.armour.map(row => row.id),
};
const armourIds = (r, run, meta = richMeta) => inventoryRows(r, run, meta)
  .filter(row => row.category === 'Armour').map(row => row.id);
const equipContext = run => ({ inCombat: false, classId: run.class,
  attributes: Object.fromEntries(Object.keys(run.attributes).map(id => [id, 99])) });
const equip = (r, run, id) => equipPiece(r, run.loadout, 'armor', 0, id,
  ownership(r, { meta: richMeta, loadout: run.loadout }), equipContext(run));

for (const classId of registries.classes.ids()) {
  test(`${classId} starts with only its selected armour, regardless of profile discoveries or stats`, () => {
    for (const choice of startingArmourViews(registries, classId, richMeta)) {
      const run = createRunState({ seed: 73, classId, registries, startingArmourId: choice.id, profileMeta: richMeta });
      assert.deepEqual(armourIds(registries, run), [choice.id]);
      for (const piece of registries.equipment.armour.filter(row => row.classId === classId && row.id !== choice.id)) {
        const before = structuredClone(run.loadout);
        assert.equal(equip(registries, run, piece.id), false, `${choice.id} does not grant ${piece.id}`);
        assert.deepEqual(run.loadout, before, 'refused equip leaves the loadout unchanged');
      }
      // A generic carried id is not an armour acquisition, even in malformed
      // or old storage. Only the armour slot can justify legacy worn ownership.
      const shared = registries.equipment.armour.find(row => row.classId === classId && row.sharedSet);
      run.loadout.storage.push(shared.id);
      assert.equal(ownership(registries, { loadout: run.loadout }).has(shared), false);
    }
  });
}

test('a purchase grants only the purchased class-qualified armour and persists after saving and unequipping', () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const r = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  for (const classId of r.classes.ids()) {
    const run = createRunState({ seed: 71, classId, registries: r,
      profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } } });
    const rng = createRng(run.seed);
    run.cinders = 100000;
    const stock = gameProfileShopStock(r, run, rng, { shopId: 'market' });
    const piece = r.equipment.armour.find(row => row.classId === classId && row.sharedSet);
    const foreign = r.equipment.armour.find(row => row.id === piece.id && row.classId !== classId);
    run.loadout.boughtArmour = [{ classId: foreign.classId, id: foreign.id }];
    assert.equal(ownership(r, { loadout: run.loadout }).has(piece), false, 'another class purchase is not this outfit');
    const index = 0;
    // A persisted merchant offer uses the ordinary quote, claim and payment path.
    stock.options[index] = { kind: 'armor', id: piece.id, price: 100 };
    const receipt = purchaseGameProfileShopOffer(r, run, 'market', index, rng);
    assert.equal(receipt.id, piece.id);
    assert.equal(run.cinders, 99900);
    assert.deepEqual(armourIds(r, run), ['default', piece.id]);
    assert.equal(equip(r, run, piece.id), true);
    assert.equal(equip(r, run, null), true);
    stampDeck(r, run, undefined, { adoptEquipmentBonuses: true });
    rederivePools(r, run, 'purchased armour removed');
    const saves = createSaveManager(createMemoryStorage());
    saves.saveRun(run, rng);
    const restored = saves.loadRun(r);
    assert.ok(restored, JSON.stringify(saves.runStatus()));
    assert.deepEqual(armourIds(r, restored), ['default', piece.id]);
    assert.equal(equip(r, restored, piece.id), true);
  }
});

test('loading legacy worn shared armour preserves it after unequip and a second save', () => {
  const run = createRunState({ seed: 91, classId: 'reaver', registries });
  const piece = registries.equipment.armour.find(row => row.classId === run.class && row.sharedSet);
  run.loadout.sets.armor[0] = piece.id;
  delete run.loadout.boughtArmour;
  stampDeck(registries, run, undefined, { adoptEquipmentBonuses: true });
  rederivePools(registries, run, 'legacy shared armour');
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(run.seed));
  const restored = saves.loadRun(registries);
  assert.ok(restored, JSON.stringify(saves.runStatus()));
  assert.ok(restored.loadout.boughtArmour.some(row => row.classId === run.class && row.id === piece.id));
  assert.equal(equip(registries, restored, null), true);
  stampDeck(registries, restored, undefined, { adoptEquipmentBonuses: true });
  rederivePools(registries, restored, 'legacy shared armour removed');
  saves.saveRun(restored, createRng(restored.seed));
  const again = saves.loadRun(registries);
  assert.ok(again, JSON.stringify(saves.runStatus()));
  assert.equal(equip(registries, again, piece.id), true);
});

test('a class swap retains the baseline it grants after another armour is equipped', () => {
  const run = createRunState({ seed: 92, classId: 'reaver', registries });
  swapRunClass(registries, run, 'starseer');
  assert.deepEqual(armourIds(registries, run), ['default']);
  const shared = { classId: 'starseer', id: 'nightweave' };
  run.loadout.boughtArmour.push(shared);
  assert.equal(equip(registries, run, shared.id), true);
  assert.equal(equip(registries, run, 'default'), true, 'the swap-granted baseline remains owned after replacing it');
  swapRunClass(registries, run, 'reaver');
  assert.deepEqual(armourIds(registries, run), ['default'], 'another class acquisition does not fill the original inventory');
});

test('setting aside a class preserves its previously worn legacy outfit', () => {
  const run = createRunState({ seed: 93, classId: 'reaver', registries });
  learnClassCard(registries, run, 'starseer');
  run.loadout.sets.armor[0] = 'vigil';
  equipClassCard(registries, run, 'starseer');
  assert.deepEqual(armourIds(registries, run), ['default']);
  equipClassCard(registries, run, 'reaver');
  assert.equal(run.loadout.sets.armor[0], 'vigil');
  assert.equal(equip(registries, run, 'default'), true);
  assert.equal(equip(registries, run, 'vigil'), true, 'remembered worn armour remains owned after replacing it');
  assert.deepEqual(armourIds(registries, run), ['default', 'vigil']);
});

test('a save from before acquired-only armour keeps every unworn set the old rule owned; a fresh run does not', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const loadBytes = (bytes) => {
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, bytes);
    const saves = createSaveManager(storage);
    const run = saves.loadRun(registries);
    assert.ok(run, JSON.stringify(saves.runStatus()));
    return run;
  };
  const oldBytes = corpus.versions[String(RUN_SCHEMA_ACQUIRED_ARMOUR - 1)].bytes;
  const old = loadBytes(oldBytes);
  const oldClassShared = registries.equipment.armour.filter(row => row.classId === old.class && row.sharedSet);
  assert.ok(oldClassShared.length > 0);
  for (const piece of oldClassShared) {
    assert.equal(old.loadout.sets.armor.includes(piece.id), false, `${piece.id} is not worn`);
    assert.ok(old.loadout.boughtArmour.some(row => row.classId === old.class && row.id === piece.id), `${piece.id} recorded as acquired`);
    assert.equal(ownership(registries, { loadout: old.loadout }).has(piece), true, `${piece.id} still owned`);
  }
  assert.equal(old.loadout.boughtArmour.some(row => row.classId !== old.class), false, 'no other class armour is granted');
  const grant = old.loadout.creationArmourGrant;
  assert.equal(old.loadout.boughtArmour.some(row => row.classId === grant.classId && row.id === grant.id), false, 'the creation grant is not recorded twice');

  const fresh = createRunState({ seed: 0x10a5, classId: old.class, registries });
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(fresh, createRng(fresh.seed));
  const reloaded = loadBytes(storage.getItem(RUN_KEY));
  for (const piece of oldClassShared) {
    assert.equal(ownership(registries, { loadout: reloaded.loadout }).has(piece), false, `a fresh run does not own ${piece.id}`);
  }
});

test('armour kept from a pre-v27 save is owned but not for sale; armour bought on the new rule is', () => {
  const corpus = JSON.parse(readFileSync(new URL('./fixtures/run-save-schema-versions.json', import.meta.url), 'utf8'));
  const loadBytes = (bytes) => {
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, bytes);
    const saves = createSaveManager(storage);
    const run = saves.loadRun(registries);
    assert.ok(run, JSON.stringify(saves.runStatus()));
    return { run, saves };
  };
  const { run } = loadBytes(corpus.versions[String(RUN_SCHEMA_ACQUIRED_ARMOUR - 1)].bytes);
  const kept = registries.equipment.armour.filter(row => row.classId === run.class && !row.unlock
    && !run.loadout.sets.armor.includes(row.id));
  assert.ok(kept.some(row => row.sharedSet));
  const bought = registries.equipment.armour.find(row => row.classId === run.class && row.unlock);
  // The legacy profile has no configured merchant: borrow a Core merchant's
  // shelf, and record the purchase the way the merchant does.
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const merchantRun = createRunState({ seed: 71, classId: run.class, registries: core });
  const rng = createRng(run.seed);
  run.gameProfileRewardOffers = { ...run.gameProfileRewardOffers,
    'shop:market': structuredClone(gameProfileShopStock(core, merchantRun, createRng(71), { shopId: 'market' })) };
  run.loadout.boughtArmour.push({ classId: run.class, id: bought.id });
  const storage = createMemoryStorage();
  createSaveManager(storage).saveRun(run, rng);
  const reloaded = loadBytes(storage.getItem(RUN_KEY)).run;
  for (const subject of [run, reloaded]) {
    const offered = gameProfileShopSalePlans(registries, subject, 'market').filter(plan => plan.kind === 'armor').map(plan => plan.identity);
    for (const piece of kept) {
      assert.equal(ownership(registries, { loadout: subject.loadout }).has(piece), true, `${piece.id} still owned`);
      assert.equal(offered.includes(`${piece.classId}:${piece.id}`), false, `${piece.id} is not offered for sale`);
      assert.equal(gameProfileShopSalePlan(registries, subject, 'market', 'armor', `${piece.classId}:${piece.id}`).ok, false, `${piece.id} cannot be sold`);
    }
    assert.ok(offered.includes(`${bought.classId}:${bought.id}`), `${bought.id}, bought on the new rule, is offered`);
    assert.equal(gameProfileShopSalePlan(registries, subject, 'market', 'armor', `${bought.classId}:${bought.id}`).ok, true);
  }
});
