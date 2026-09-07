import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { buildShopStock } from '../src/engine/encounters.js';
import { carriedIds } from '../src/model/loadout.js';
import { installPlan, extractionPlan, commitExtraction, commitInstall } from '../src/model/cardExtraction.js';
import { armamentPurchasePlan, armamentSalePlan, commitArmamentPurchase, commitArmamentSale, eligibleWeaponArts } from '../src/model/armamentTrading.js';

const registries = createRegistries(contentBundle);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`ok ${name}`); }
function fixture(reg = registries) {
  const run = createRunState({ seed: 671, classId: 'reaver', registries: reg });
  run.cinders = 1000;
  run.shopStock = buildShopStock(reg, createRng(671), run);
  return run;
}
const bytes = (run) => JSON.stringify(run);

test('stock is seeded, unique, excludes carried equipment and survives JSON reload', () => {
  const run = fixture();
  assert.deepEqual(run.shopStock, fixture().shopStock);
  assert.equal(run.shopStock.armaments.length, registries.balance.shop.armamentStock);
  assert.equal(new Set(run.shopStock.armaments.map((row) => row.id)).size, run.shopStock.armaments.length);
  assert(run.shopStock.armaments.every((row) => !carriedIds(run.loadout).includes(row.id)));
  assert.deepEqual(JSON.parse(bytes(run)).shopStock, run.shopStock);
});

test('a purchase spends once, stores once, removes its offer and rejects a stale double activation', () => {
  const run = fixture();
  const quote = armamentPurchasePlan(registries, run, run.shopStock.armaments[0]);
  const before = bytes(run);
  assert.equal(bytes(run), before, 'inspection is inert');
  assert.equal(commitArmamentPurchase(registries, run, quote).id, quote.item.id);
  assert.equal(run.cinders, 1000 - quote.cost);
  assert.equal(run.loadout.storage.filter((id) => id === quote.item.id).length, 1);
  assert(!run.shopStock.armaments.includes(quote.item));
  const purchased = bytes(run);
  assert.throws(() => commitArmamentPurchase(registries, run, quote), /no longer/);
  assert.equal(bytes(run), purchased);
});

test('insufficient funds, capacity, equipped duplicates and changed prices refuse without mutation', () => {
  for (const scenario of ['funds', 'capacity', 'equipped', 'price']) {
    const run = fixture();
    const quote = armamentPurchasePlan(registries, run, run.shopStock.armaments[0]);
    if (scenario === 'funds') run.cinders = quote.cost - 1;
    if (scenario === 'capacity') run.loadout.storage = registries.equipment.armaments.slice(0, registries.balance.equipment.storageSlots).map((p) => p.id);
    if (scenario === 'equipped') run.loadout.sets.rightHand[0] = quote.item.id;
    if (scenario === 'price') quote.item.cost++;
    const before = bytes(run);
    assert.throws(() => commitArmamentPurchase(registries, run, quote));
    assert.equal(bytes(run), before, scenario);
  }
});

test('sale retains discovery-independent tier/mount ledgers and extracted cards, removes item grants', () => {
  const run = fixture();
  const quote = armamentPurchasePlan(registries, run, run.shopStock.armaments[0]);
  commitArmamentPurchase(registries, run, quote);
  const ref = `armament/${quote.item.id}`;
  run.itemUpgradeLevels[ref] = 1;
  run.itemMounts = { [ref]: { 'mount:recorded': { card: 'quickstep', upgraded: true, extractions: 2 } } };
  run.deck.push({ instanceId: 'extracted:1:quickstep', cardId: 'quickstep', upgraded: true });
  run.deck.push({ instanceId: 'stale-grant', cardId: 'quickstep', grantedBy: quote.item.id, equipmentRole: 'granted' });
  const ledger = JSON.stringify([run.itemUpgradeLevels, run.itemMounts]);
  const sell = armamentSalePlan(registries, run, quote.item.id);
  assert(sell.ok);
  assert(sell.price < quote.cost, 'no profitable immediate buy/sell loop');
  commitArmamentSale(registries, run, sell);
  assert.equal(JSON.stringify([run.itemUpgradeLevels, run.itemMounts]), ledger);
  assert(run.deck.some((card) => card.instanceId === 'extracted:1:quickstep'));
  assert(!run.deck.some((card) => card.instanceId === 'stale-grant'));
  assert(!carriedIds(run.loadout).includes(quote.item.id));
  const sold = bytes(run);
  assert.throws(() => commitArmamentSale(registries, run, sell));
  assert.equal(bytes(run), sold);
  // A later merchant may stock the same identity. It keeps its bound ledger.
  run.shopStock.armaments.push({ ...quote.item });
  commitArmamentPurchase(registries, run, armamentPurchasePlan(registries, run, run.shopStock.armaments.at(-1)));
  assert.equal(JSON.stringify([run.itemUpgradeLevels, run.itemMounts]), ledger);
  assert.throws(() => commitArmamentSale(registries, run, sell), /changed/, 'old confirmation cannot sell a reacquired item');
});

test('equipped and stale package sales refuse without touching inventory or money', () => {
  const run = fixture();
  const equipped = carriedIds(run.loadout)[0];
  const before = bytes(run);
  const quote = armamentSalePlan(registries, run, equipped);
  assert.match(quote.reason, /Unequip/);
  assert.throws(() => commitArmamentSale(registries, run, quote), /Unequip/);
  assert.equal(bytes(run), before);
  const buy = armamentPurchasePlan(registries, run, run.shopStock.armaments[0]);
  commitArmamentPurchase(registries, run, buy);
  const sell = armamentSalePlan(registries, run, buy.item.id);
  run.itemUpgradeLevels[sell.itemRef] = 1;
  const changed = bytes(run);
  assert.throws(() => commitArmamentSale(registries, run, sell), /changed/);
  assert.equal(bytes(run), changed);
});

test('legacy shop stock lacks new shelves without rerolling or mutating on inspection', () => {
  const run = fixture();
  delete run.shopStock.armaments;
  delete run.shopStock.weaponArts;
  const before = bytes(run);
  assert.equal(armamentPurchasePlan(registries, run, { id: 'dagger', cost: 80 }).ok, false);
  assert.equal(bytes(run), before);
});

test('both shipped weapon arts are stocked and purchased cards can be seated through the real smith', () => {
  assert.deepEqual(new Set(eligibleWeaponArts(registries)), new Set(['katanaDrawCut', 'greatswordSunderingHew']));
  for (const [weaponId, cardId] of [['katana', 'katanaDrawCut'], ['greatsword', 'greatswordSunderingHew']]) {
    const run = fixture();
    assert.equal(run.shopStock.weaponArts.length, 2, 'two live offerings in normal content');
    assert(!run.shopStock.cards.some((offer) => eligibleWeaponArts(registries).includes(offer.id)), 'ordinary shelf does not duplicate weapon-art offers');
    run.loadout.storage.push(weaponId);
    const item = extractionPlan(registries, run).candidates.find((candidate) => candidate.itemRef === `armament/${weaponId}`);
    assert(item, 'source weapon has a real extractable mount');
    const mount = item.mounts.find((candidate) => candidate.cardId === cardId);
    const extracted = commitExtraction(registries, run, item.itemRef, mount.mountKey, undefined, { free: true });
    const offer = run.shopStock.weaponArts.find((row) => row.id === cardId);
    const receipt = commitArmamentPurchase(registries, run, armamentPurchasePlan(registries, run, offer, 'weaponArt'));
    assert.deepEqual(run.deck.find((card) => card.instanceId === receipt.instance.instanceId), receipt.instance);
    assert.equal(receipt.instance.grantedBy, undefined, 'purchase is run-owned');
    const plan = installPlan(registries, run);
    const candidate = plan.candidates.find((row) => row.itemRef === item.itemRef);
    assert(candidate.mounts.some((row) => row.cards.some((card) => card.instanceId === receipt.instance.instanceId)));
    commitInstall(registries, run, item.itemRef, mount.mountKey, receipt.instance.instanceId, undefined, { free: true });
    assert.equal(run.itemMounts[item.itemRef][mount.mountKey].card, cardId);
    assert(!run.deck.some((card) => card.instanceId === receipt.instance.instanceId), 'seating consumes purchased loose copy');
    assert(run.deck.some((card) => card.instanceId === extracted.instanceId), 'previously extracted copy stays owned');
  }
});

console.log(`armament trading: ${passed} passed`);