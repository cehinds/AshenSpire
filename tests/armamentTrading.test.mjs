import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { carriedIds } from '../src/model/loadout.js';
import { armamentSalePlan, commitArmamentSale } from '../src/model/armamentTrading.js';

const registries = createRegistries(contentBundle);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`ok ${name}`); }
function fixture(reg = registries) {
  const run = createRunState({ seed: 671, classId: 'reaver', registries: reg });
  run.cinders = 1000;
  run.shopStock = { kind: 'blacksmith', offerings: [] }; // a visit is open: the sale needs a trader
  return run;
}
const bytes = (run) => JSON.stringify(run);
// A run that carries one more armament in storage (the shelf that sold it is not what the sale tests are about).
function acquire(run) {
  const piece = registries.equipment.armaments.find((row) => !carriedIds(run.loadout).includes(row.id) && Array.isArray(registries.balance.shop.armamentCost[row.rarity]));
  run.loadout.storage.push(piece.id);
  return { item: { id: piece.id, cost: registries.balance.shop.armamentCost[piece.rarity][0] } };
}

test('sale retains discovery-independent tier/mount ledgers and extracted cards, removes item grants', () => {
  const run = fixture();
  const quote = { ...acquire(run), cost: 0 };
  quote.cost = quote.item.cost;
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
  // A later shop may stock the same identity. It keeps its bound ledger.
  run.loadout.storage.push(quote.item.id);
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
  const buy = acquire(run);
  const sell = armamentSalePlan(registries, run, buy.item.id);
  run.itemUpgradeLevels[sell.itemRef] = 1;
  const changed = bytes(run);
  assert.throws(() => commitArmamentSale(registries, run, sell), /changed/);
  assert.equal(bytes(run), changed);
});

console.log(`armament trading: ${passed} passed`);
