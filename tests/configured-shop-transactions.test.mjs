import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, gameProfileShopPurchasePlan, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSalePlan, gameProfileShopSalePlans, commitGameProfileShopSale } from '../src/model/gameProfileShopSales.js';
import { syncFlaskGrowth } from '../src/model/flaskgrowth.js';
import { equipPiece, ownership, pieceItemRef } from '../src/model/loadout.js';
import { mountKey } from '../src/model/cardMounts.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { allocateAttributePoint, rederivePools } from '../src/model/levelup.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture(seed = 71) {
  const run = createRunState({ seed, classId: 'reaver', registries }), rng = createRng(seed);
  run.cinders = 100000;
  const stock = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  return { run, rng, stock };
}
const bytes = value => JSON.stringify(value);
const purchase = (fixture, index, quote = null) => purchaseGameProfileShopOffer(registries, fixture.run, 'market', index, fixture.rng, quote);

test('every purchased category replaces its slot with a different same-category eligible item or sells out', () => {
  const kinds = new Set(fixture().stock.options.map(option => option.kind));
  for (const kind of kinds) {
    const f = fixture(), index = f.stock.options.findIndex(option => option.kind === kind), before = structuredClone(f.stock);
    const receipt = purchase(f, index);
    const stock = f.run.gameProfileRewardOffers['shop:market'];
    assert.equal(receipt.kind, kind);
    assert.equal(f.run.cinders, 100000 - receipt.price);
    assert.equal(stock.tradeRevision, 1);
    if (receipt.replacement) {
      assert.equal(receipt.replacement.kind, kind);
      assert.notEqual(receipt.replacement.id, receipt.id);
      assert(!before.options.some(option => option.id === receipt.replacement.id));
      assert.equal(stock.taken.includes(index), false);
      assert.equal(gameProfileShopPurchasePlan(registries, f.run, 'market', index).ok, true);
      assert(Number.isSafeInteger(receipt.replacement.price));
    } else assert(stock.taken.includes(index));
    for (let i = 0; i < stock.options.length; i++) if (i !== index) assert.deepEqual(stock.options[i], before.options[i]);
    const restored = JSON.parse(bytes(f.run)), beforeReload = bytes(restored);
    assert.deepEqual(gameProfileShopStock(registries, restored, createRng(9999), { shopId: 'market' }), stock);
    assert.equal(bytes(restored), beforeReload);
  }
});

test('repeated card purchases from one slot create unique owned instances and stale confirmation refuses', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'combatCards');
  const quote = gameProfileShopPurchasePlan(registries, f.run, 'market', index);
  assert(quote.ok);
  purchase(f, index, quote);
  const afterFirst = bytes(f.run), counters = f.rng.getCounters();
  assert.throws(() => purchase(f, index, quote), /changed/);
  assert.equal(bytes(f.run), afterFirst);
  assert.deepEqual(f.rng.getCounters(), counters);
  for (let i = 0; i < 5; i++) purchase(f, index);
  const instances = [...f.run.deck, ...f.run.sideboard].map(card => card.instanceId);
  assert.equal(new Set(instances).size, instances.length);
});

test('exhausted weapon-art pool never substitutes another category or the purchased art', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'weaponArts');
  const receipt = purchase(f, index);
  assert.equal(receipt.replacement, null);
  assert(f.run.gameProfileRewardOffers['shop:market'].taken.includes(index));
  const before = bytes(f.run);
  assert.throws(() => purchase(f, index), /sold out/);
  assert.equal(bytes(f.run), before);
});

test('purchase refusals and a failed restock leave inventory, money, stock and RNG unchanged', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'combatCards');
  const before = bytes(f.run), counters = f.rng.getCounters();
  const badRng = { ...f.rng, int() { throw new Error('price failure'); } };
  assert.throws(() => purchaseGameProfileShopOffer(registries, f.run, 'market', index, badRng), /price failure/);
  assert.equal(bytes(f.run), before); assert.deepEqual(f.rng.getCounters(), counters);
  f.run.cinders = 0;
  const poor = bytes(f.run);
  assert.throws(() => purchase(f, index), /Insufficient/);
  assert.equal(bytes(f.run), poor); assert.deepEqual(f.rng.getCounters(), counters);
});

test('a full inventory refuses configured weapon purchases at inspection and commitment without rolling', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'weapons');
  const quote = gameProfileShopPurchasePlan(registries, f.run, 'market', index);
  const equipped = new Set(Object.values(f.run.loadout.sets).flat());
  f.run.loadout.storage = registries.equipment.armaments.filter(row => !equipped.has(row.id) && row.id !== f.stock.options[index].id)
    .slice(0, registries.balance.equipment.storageSlots).map(row => row.id);
  assert.equal(f.run.loadout.storage.length, registries.balance.equipment.storageSlots);
  const before = bytes(f.run), counters = f.rng.getCounters();
  assert.match(gameProfileShopPurchasePlan(registries, f.run, 'market', index).reason, /Inventory is full/);
  assert.throws(() => purchase(f, index, quote), /Inventory is full/);
  assert.equal(bytes(f.run), before); assert.deepEqual(f.rng.getCounters(), counters);
});

test('saved flat-price stock buys at its saved price and restocks at the current configured price', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'combatCards');
  f.stock.price = 7;
  for (const option of f.stock.options) delete option.price;
  f.stock.taken = [f.stock.options.findIndex(option => option.kind === 'weapons')];
  const receipt = purchase(f, index);
  assert.equal(receipt.price, 7); assert(receipt.replacement.price > 7);
  assert(f.run.gameProfileRewardOffers['shop:market'].taken.length === 1, 'historically sold slots stay sold');
  const restored = JSON.parse(bytes(f.run)), identity = restored.sideboard.at(-1).instanceId;
  const sale = gameProfileShopSalePlan(registries, restored, 'market', 'combatCards', identity);
  assert(sale.ok); assert(sale.price < 7, 'legacy flat-price purchases cannot be resold at a profit after reload');
  const beforeSale = restored.cinders;
  commitGameProfileShopSale(registries, restored, 'market', sale);
  assert(restored.cinders < beforeSale + 7);
});

test('sales cover configured weapons, armor, relics, utility potions and spare cards without legacy stock', () => {
  for (const kind of ['weapons', 'armor', 'relics', 'potions', 'combatCards', 'weaponArts']) {
    const f = fixture(), index = f.stock.options.findIndex(option => option.kind === kind);
    const bought = purchase(f, index);
    const identity = kind === 'armor' ? `${f.run.class}:${bought.id}` : kind === 'potions' ? f.run.flasks.length - 1
      : ['combatCards', 'weaponArts'].includes(kind) ? f.run.sideboard.at(-1).instanceId : bought.id;
    const quote = gameProfileShopSalePlan(registries, f.run, 'market', kind, identity);
    assert(quote.ok, `${kind}: ${quote.reason}`);
    assert(quote.price < bought.price, 'immediate sale never profits');
    const before = f.run.cinders, legacy = bytes(f.run.shopStock);
    commitGameProfileShopSale(registries, f.run, 'market', quote);
    assert.equal(f.run.cinders, before + quote.price);
    assert.equal(bytes(f.run.shopStock), legacy);
    const sold = bytes(f.run);
    assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', quote));
    assert.equal(bytes(f.run), sold);
  }
});

test('sales refuse equipped gear, active or bound cards, refillable flasks and changed quotes atomically', () => {
  const f = fixture(), equipped = Object.values(f.run.loadout.sets).flat().find(id => registries.equipment.armaments.some(piece => piece.id === id));
  assert.match(gameProfileShopSalePlan(registries, f.run, 'market', 'weapons', equipped).reason, /Unequip/);
  const card = f.run.deck[0];
  assert.equal(gameProfileShopSalePlan(registries, f.run, 'market', 'combatCards', card.instanceId).ok, false);
  f.run.sideboard.push({ ...card, instanceId: 'bound-sale', grantedBy: equipped });
  assert.match(gameProfileShopSalePlan(registries, f.run, 'market', 'combatCards', 'bound-sale').reason, /bound/);
  f.run.sideboard.push({ cardId: card.cardId, instanceId: 'source-only', sourceArmamentId: equipped });
  assert.match(gameProfileShopSalePlan(registries, f.run, 'market', 'combatCards', 'source-only').reason, /bound/);
  const refillable = registries.flasks.all().find(def => def.kind === 'hp' || def.effects.some(effect => effect.op === 'heal'));
  f.run.flasks.push({ flaskId: refillable.id });
  assert.match(gameProfileShopSalePlan(registries, f.run, 'market', 'potions', f.run.flasks.length - 1).reason, /cannot be sold/);
  const index = f.stock.options.findIndex(option => option.kind === 'combatCards');
  purchase(f, index);
  const quote = gameProfileShopSalePlans(registries, f.run, 'market').find(row => row.ok && row.kind === 'combatCards');
  purchase(f, index);
  const before = bytes(f.run);
  assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', quote), /changed/);
  assert.equal(bytes(f.run), before);
});

test('sales retain armor upgrade and mount records, retire class grants, and preserve unrelated legacy stock', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'armor');
  const bought = purchase(f, index), def = registries.equipment.armour.find(row => row.id === bought.id && row.classId === f.run.class);
  const ref = pieceItemRef(def);
  assert.equal(ref, `armor/${f.run.class}/${bought.id}`);
  f.run.itemUpgradeLevels[ref] = 2;
  f.run.itemMounts = { [ref]: { [mountKey.extra(ref, 1)]: { card: f.run.deck[0].cardId, upgraded: false, extractions: 0 } } };
  f.run.classMilestones = { sample: { classId: f.run.class, level: 1, grants: { armory: { state: 'taken', selection: { id: ref } } } } };
  f.run.shopStock = { kind: 'blacksmith', tradeRevision: 91, offerings: ['smith'] };
  const legacy = structuredClone(f.run.shopStock), ledger = bytes([f.run.itemUpgradeLevels, f.run.itemMounts]);
  const quote = gameProfileShopSalePlan(registries, f.run, 'market', 'armor', `${f.run.class}:${bought.id}`);
  assert.equal(quote.tier, 2); assert.equal(quote.itemRef, ref);
  assert(quote.mounts.some(mount => mount.cardId === f.run.deck[0].cardId));
  commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.equal(bytes([f.run.itemUpgradeLevels, f.run.itemMounts]), ledger);
  assert.deepEqual(f.run.shopStock, legacy);
  assert.equal(f.run.classMilestones.sample.grants.armory.state, 'spent');
  assert.equal(f.run.classMilestones.sample.grants.armory.spentReason, 'sold');
});

test('a flask-growth relic sale shrinks capacity and clamps currents through the shared growth model', () => {
  const f = fixture(), growth = registries.balance.flaskGrowth.find(row => row.source === 'relic');
  f.run.relics.push(growth.id); syncFlaskGrowth(registries, f.run);
  const capacity = f.run.flaskCharges.capacity;
  f.run.classMilestones = { sample: { classId: f.run.class, level: 1, grants: { relic: { state: 'taken', selection: { id: growth.id } } } } };
  const quote = gameProfileShopSalePlan(registries, f.run, 'market', 'relics', growth.id);
  assert(quote.ok, quote.reason);
  commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.equal(f.run.flaskCharges.capacity, capacity - growth.amount);
  assert(f.run.flaskCharges.hpCurrent <= f.run.flaskCharges.hp);
  assert.equal(f.run.classMilestones.sample.grants.relic.state, 'spent');
});

test('configured merchants sell one consumable at a time and invalidate old count quotes', () => {
  const f = fixture(), def = registries.consumables.all()[0];
  f.run.consumables[def.id] = 2;
  const quote = gameProfileShopSalePlan(registries, f.run, 'market', 'consumables', def.id), before = f.run.cinders;
  assert(quote.ok, quote.reason);
  commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.equal(f.run.consumables[def.id], 1); assert.equal(f.run.cinders, before + quote.price);
  const after = bytes(f.run);
  assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', quote), /changed/);
  assert.equal(bytes(f.run), after);
});

test('armament sale quotes disclose the bound tier and attached cards retained on reacquisition', () => {
  const f = fixture(), index = f.stock.options.findIndex(option => option.kind === 'weapons'), bought = purchase(f, index);
  f.run.itemUpgradeLevels[`armament/${bought.id}`] = 2;
  const quote = gameProfileShopSalePlan(registries, f.run, 'market', 'weapons', bought.id);
  assert.equal(quote.tier, 2); assert.equal(quote.itemRef, `armament/${bought.id}`);
  assert(Array.isArray(quote.mounts));
  assert(quote.mounts.every(row => row.cardId && row.cardName));
});

test('foreign-class armor remains sellable when its bare ID matches the equipped current-class outfit', () => {
  const f = fixture(), own = registries.equipment.armour.find(row => row.classId === f.run.class && registries.equipment.armour.some(other => other.id === row.id && other.classId !== row.classId));
  const foreign = registries.equipment.armour.find(row => row.id === own.id && row.classId !== own.classId);
  f.run.loadout.boughtArmour = [own, foreign].map(({ classId, id }) => ({ classId, id }));
  f.run.loadout.sets.armor = [own.id];
  const blocked = gameProfileShopSalePlan(registries, f.run, 'market', 'armor', `${own.classId}:${own.id}`);
  assert.match(blocked.reason, /Unequip/);
  const quote = gameProfileShopSalePlan(registries, f.run, 'market', 'armor', `${foreign.classId}:${foreign.id}`);
  assert(quote.ok, quote.reason);
  commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.deepEqual(f.run.loadout.boughtArmour, [{ classId: own.classId, id: own.id }]);
  assert.deepEqual(f.run.loadout.sets.armor, [own.id]);
});

test('buying and equipping replacement armor makes the starter sellable without restoring it after save', () => {
  const f = fixture(), starter = registries.equipment.armour.find(row => row.classId === f.run.class && row.id === f.run.loadout.sets.armor[0]);
  const identity = `${starter.classId}:${starter.id}`;
  assert.match(gameProfileShopSalePlans(registries, f.run, 'market').find(row => row.identity === identity).reason, /Unequip/);
  const bought = purchase(f, f.stock.options.findIndex(option => option.kind === 'armor'));
  const replacement = registries.equipment.armour.find(row => row.classId === f.run.class && row.id === bought.id);
  f.run.level = { xp: 0, level: 11, unspentPoints: 10 };
  for (const [id, minimum] of Object.entries(replacement.requirements?.attributes || {})) {
    while (f.run.attributes[id] < minimum) allocateAttributePoint(registries, f.run, id);
  }
  assert.equal(equipPiece(registries, f.run.loadout, 'armor', 0, bought.id,
    ownership(registries, { loadout: f.run.loadout }), { inCombat: false, classId: f.run.class, attributes: f.run.attributes }), true);
  rederivePools(registries, f.run, 'replacement armor equipped');
  const quote = gameProfileShopSalePlans(registries, f.run, 'market').find(row => row.identity === identity);
  assert(quote.ok, quote.reason);
  const before = f.run.cinders;
  commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.equal(f.run.cinders, before + quote.price);
  assert.equal(ownership(registries, { loadout: f.run.loadout }).has(starter), false);
  assert.equal(equipPiece(registries, f.run.loadout, 'armor', 0, starter.id,
    ownership(registries, { loadout: f.run.loadout }), { inCombat: false, classId: f.run.class, attributes: f.run.attributes }), false);
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(f.run, f.rng);
  const restored = saves.loadRun(registries);
  assert.ok(restored, JSON.stringify(saves.runStatus()));
  assert.equal(ownership(registries, { loadout: restored.loadout }).has(starter), false);
  assert(!gameProfileShopSalePlans(registries, restored, 'market').some(row => row.kind === 'armor' && row.identity === identity));
  const restoredBefore = bytes(restored);
  assert.throws(() => commitGameProfileShopSale(registries, restored, 'market', quote), /inventory/);
  assert.equal(bytes(restored), restoredBefore);
  assert.equal(ownership(registries, { meta: {}, profileWardrobe: true, loadout: restored.loadout }).has(starter), true, 'sale does not remove the profile wardrobe');
  // The ordinary configured purchase path grants a new owned copy.
  const stock = restored.gameProfileRewardOffers['shop:market'];
  stock.options[0] = { kind: 'armor', id: starter.id, price: 100 };
  stock.taken = stock.taken.filter(index => index !== 0);
  purchaseGameProfileShopOffer(registries, restored, 'market', 0, f.rng);
  assert.equal(ownership(registries, { loadout: restored.loadout }).has(starter), true);
});

test('armor sales exclude locked unowned sets and reject changed ownership, tiers and equipped quotes atomically', () => {
  const f = fixture();
  const locked = registries.equipment.armour.find(row => row.classId === f.run.class && row.unlock && row.id !== f.run.loadout.creationArmourGrant.id);
  assert.ok(locked);
  assert.equal(gameProfileShopSalePlan(registries, f.run, 'market', 'armor', `${locked.classId}:${locked.id}`).ok, false);
  assert(!gameProfileShopSalePlans(registries, f.run, 'market').some(row => row.kind === 'armor' && row.identity === `${locked.classId}:${locked.id}`));
  const bought = purchase(f, f.stock.options.findIndex(option => option.kind === 'armor'));
  const identity = `${f.run.class}:${bought.id}`, quote = gameProfileShopSalePlan(registries, f.run, 'market', 'armor', identity);
  f.run.itemUpgradeLevels[quote.itemRef] = 1;
  const upgraded = bytes(f.run);
  assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', quote), /changed/);
  assert.equal(bytes(f.run), upgraded);
  const current = gameProfileShopSalePlan(registries, f.run, 'market', 'armor', identity);
  f.run.loadout.sets.armor[0] = bought.id;
  const equipped = bytes(f.run);
  assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', current), /Unequip/);
  assert.equal(bytes(f.run), equipped);
});

test('an armor assigned to a spare prepared set must be removed before it can be sold', () => {
  const f = fixture();
  const bought = purchase(f, f.stock.options.findIndex(option => option.kind === 'armor'));
  f.run.loadout.sets.armor.push(bought.id);
  f.run.loadout.active.armor = 0;
  const quote = gameProfileShopSalePlan(registries, f.run, 'market', 'armor', `${f.run.class}:${bought.id}`);
  assert.match(quote.reason, /every set/);
  assert.equal(quote.ok, false);
});
