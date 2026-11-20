// Owner 2026-11-05: each Core weapon has one default art (granted while worn) and two learnable arts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { WeaponCardPackageModel } from '../src/model/loadout.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
export const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const packages = () => (reg.equipment.armaments || []).filter(piece => piece.weaponCardPackage).map(piece => WeaponCardPackageModel.fromPiece(reg, piece));

test('every Core weapon has one default art and two distinct learnable arts', () => {
  const rows = packages();
  assert.equal(rows.length, 28);
  for (const pkg of rows) {
    assert.equal(pkg.weaponArtDefaults.length, 1, `${pkg.weaponId} default`);
    assert.equal(pkg.learnableArts.length, 2, `${pkg.weaponId} learnable`);
    const all = [...pkg.weaponArtDefaults, ...pkg.learnableArts];
    assert.equal(new Set(all).size, 3, `${pkg.weaponId} has three distinct arts`);
    for (const id of all) assert.ok(reg.cards.has(id), `${pkg.weaponId}: ${id} is a card`);
  }
});

test('no art card is listed on more than three weapons', () => {
  const uses = new Map();
  for (const pkg of packages()) for (const id of [...pkg.weaponArtDefaults, ...pkg.learnableArts]) uses.set(id, (uses.get(id) || 0) + 1);
  for (const [id, n] of uses) assert.ok(n <= 3, `${id} is on ${n} weapons`);
});

test('a package with a learnable art equal to a default or a repeat is refused', () => {
  const piece = (reg.equipment.armaments || []).find(row => row.id === 'katana');
  const bad = pkg => ({ ...piece, weaponCardPackage: { ...piece.weaponCardPackage, ...pkg } });
  assert.throws(() => WeaponCardPackageModel.fromPiece(reg, bad({ learnableArts: ['katanaDrawCut'] })), /already a default/);
  assert.throws(() => WeaponCardPackageModel.fromPiece(reg, bad({ learnableArts: ['quickCut', 'quickCut'] })), /duplicate learnable/);
  assert.throws(() => WeaponCardPackageModel.fromPiece(reg, bad({ learnableArts: ['noSuchCard'] })), /unknown/);
});

// ---- Pools: rewards, shops and the Blacksmith (owner 2026-11-05) ----
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardPools, gameProfileRewardOffers, gameProfileShopStock, claimGameProfileReward, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { coreBlacksmithShelves } from '../src/model/blacksmithStock.js';

const arts = (id) => { const pkg = packages().find(row => row.weaponId === id); return [...pkg.weaponArtDefaults, ...pkg.learnableArts]; };
const reaver = (carry = []) => { const run = createRunState({ seed: 1, classId: 'reaver', registries: reg }); run.loadout.storage.push(...carry); return run; };
const ownedIds = (run) => new Set([...run.deck, ...run.sideboard].map(card => card.cardId));

test('the art pool is the arts of carried weapons minus owned or granted ones', () => {
  const run = reaver(['ashStaff']);
  assert.ok(ownedIds(run).has('greatswordSunderingHew'), 'the worn greatsword grants its default art');
  // Owner 2026-11-14 (rewards.eligibility.playableOnly): a Reaver has no mana pool, so an art that costs mana is never in its pool.
  const payable = id => !(reg.cards.get(id).manaCost > 0);
  const expected = (...weapons) => weapons.flatMap(arts).filter(id => !ownedIds(run).has(id) && payable(id)).sort();
  assert.deepEqual([...gameProfileRewardPools(reg, run).weaponArts].sort(), expected('greatsword', 'ashStaff'));
  assert.ok(!gameProfileRewardPools(reg, run).weaponArts.includes('greatswordSunderingHew'), 'granted art is not offered');
  assert.ok(reg.cards.get('poiseBreaker').manaCost > 0 && !gameProfileRewardPools(reg, run).weaponArts.includes('poiseBreaker'), 'a Reaver is never offered the greatsword art that costs mana');
  run.sideboard.push({ instanceId: 'own-1', cardId: 'executioner', upgraded: false });
  assert.ok(!gameProfileRewardPools(reg, run).weaponArts.includes('executioner'), 'a sideboarded art counts as owned');
  assert.deepEqual([...gameProfileRewardPools(reg, run).weaponArts].sort(), expected('greatsword', 'ashStaff'));
  assert.ok(!gameProfileRewardPools(reg, run).weaponArts.includes('core.reaverSpecial'), 'the class special is not a weapon art');
  assert.ok(!gameProfileRewardPools(reg, reaver()).weaponArts.some(id => arts('katana').includes(id)), 'an uncarried weapon teaches nothing');
});

test('shops and the Blacksmith never stock an owned or granted art', () => {
  for (let seed = 0; seed < 40; seed++) {
    const run = reaver(['katana']);
    run.sideboard.push({ instanceId: 'own-1', cardId: 'quickCut', upgraded: false });
    const owned = ownedIds(run);
    const stock = gameProfileShopStock(reg, structuredClone(run), createRng(seed), { shopId: `s${seed}` });
    for (const row of stock.options.filter(option => option.kind === 'weaponArts')) assert.ok(!owned.has(row.id), `shop stocked owned ${row.id}`);
    const shelves = coreBlacksmithShelves(reg, createRng(seed), run);
    for (const row of shelves.weaponArts) assert.ok(!owned.has(row.id), `blacksmith stocked owned ${row.id}`);
    assert.deepEqual([...shelves.weaponArts.map(row => row.id)].sort(), ['executioner', 'hamstringRogue', 'katanaDrawCut'].sort());
  }
});

test('an art on the open door is not stocked by the shop, and a shop art is not offered on a door', () => {
  const run = reaver();
  run.gameProfileRewardOffers = { door: { id: 'door', source: 'combat', options: [{ kind: 'weaponArts', id: 'executioner' }], taken: [], claimed: null } };
  run.gameProfilePendingReward = { offerId: 'door', source: 'combat' };
  const stock = gameProfileShopStock(reg, run, createRng(3), { shopId: 'x' });
  // The greatsword's other learnable art costs mana a Reaver cannot pay (playableOnly), so the open door's art was the only one.
  assert.deepEqual(stock.options.filter(option => option.kind === 'weaponArts').map(option => option.id), []);
  const run2 = reaver();
  run2.gameProfileOpenShop = 'x';
  run2.gameProfileRewardOffers = { 'shop:x': { id: 'shop:x', source: 'shop', options: [{ kind: 'weaponArts', id: 'executioner' }], taken: [], claimed: null } };
  for (let seed = 0; seed < 100; seed++) {
    const door = gameProfileRewardOffers(reg, structuredClone(run2), createRng(seed), { offerId: 'd' });
    assert.ok(!door.options.some(option => option.id === 'executioner'), `seed ${seed}`);
  }
});

test('200 doors for a Reaver carrying a greatsword and a katana offer at least three arts, never Sundering Art', () => {
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const run = reaver(['katana']);
    const door = gameProfileRewardOffers(reg, run, createRng(seed), { offerId: 'fight' });
    for (const row of door.options) if (row.kind === 'weaponArts') seen.add(row.id);
  }
  assert.ok(seen.size >= 3, `only ${[...seen]} offered`);
  assert.ok(!seen.has('greatswordSunderingHew'), 'the granted default is never offered');
  assert.ok(!seen.has('core.reaverSpecial'));
  const only = new Set();
  for (let seed = 0; seed < 200; seed++) for (const row of gameProfileRewardOffers(reg, reaver(), createRng(seed), { offerId: 'fight' }).options) if (row.kind === 'weaponArts') only.add(row.id);
  assert.deepEqual([...only].sort(), ['executioner'], 'poiseBreaker costs mana a Reaver cannot pay');
});

test('the Blacksmith shelf skips an art on the open reward door but keeps its own earlier shelf', () => {
  const run = reaver(['katana']);
  run.gameProfileRewardOffers = { door: { id: 'door', source: 'combat', options: [{ kind: 'weaponArts', id: 'executioner' }], taken: [], claimed: null } };
  run.gameProfilePendingReward = { offerId: 'door', source: 'combat' };
  run.shopStock = { kind: 'blacksmith', offerings: ['weaponArts'], weaponArts: [{ id: 'hamstringRogue', cost: 70 }] };
  const shelf = coreBlacksmithShelves(reg, createRng(5), run).weaponArts.map(row => row.id).sort();
  assert.ok(!shelf.includes('executioner'), 'the art on the open door is skipped');
  assert.ok(shelf.includes('hamstringRogue'), 'an art already on the shelf stays stocked');
  assert.deepEqual(shelf, ['hamstringRogue', 'katanaDrawCut', 'quickCut']);
});

// ---- Deck eligibility: a worn weapon's arts can always join the deck ----
import { equipPiece } from '../src/model/loadout.js';
import { deckCardEquipmentEligible, moveFromSideboard } from '../src/model/deckRules.js';

test('with only its weapon worn, every default and learnable art is deck-eligible and moves from the sideboard', () => {
  const owns = { has: () => true };
  for (const pkg of packages()) {
    const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    for (const slot of ['rightHand', 'leftHand']) equipPiece(reg, run.loadout, slot, 0, null, owns, { inCombat: false, classId: 'reaver', attributes: run.attributes });
    const worn = ['rightHand', 'leftHand'].some(hand => equipPiece(reg, run.loadout, hand, 0, pkg.weaponId, owns, { inCombat: false, classId: 'reaver', attributes: run.attributes }));
    assert.ok(worn, `${pkg.weaponId} could be worn`);
    run.deck = run.deck.filter(card => !card.grantedBy);
    for (const id of [...pkg.weaponArtDefaults, ...pkg.learnableArts]) {
      const card = { instanceId: `t:${id}`, cardId: id, upgraded: false };
      assert.ok(deckCardEquipmentEligible(reg, run, card), `${pkg.weaponId}: ${id} eligible`);
      run.sideboard = [card];
      assert.ok(moveFromSideboard(reg, run, card.instanceId, {}), `${pkg.weaponId}: ${id} moves to the deck`);
      run.deck = run.deck.filter(c => c.instanceId !== card.instanceId);
    }
  }
});

test('a learnable art of a carried but unworn weapon stays refused by the tag rule', () => {
  const run = reaver(['lantern']);
  const card = { instanceId: 't:lucidity', cardId: 'lucidity', upgraded: false };
  assert.equal(deckCardEquipmentEligible(reg, run, card), false);
  run.sideboard = [card];
  assert.equal(moveFromSideboard(reg, run, card.instanceId, {}), false);
});

test('a skipped door (no pending reward) does not hide its arts from the next shop or Blacksmith', () => {
  const run = reaver();
  run.gameProfileRewardOffers = { door: { id: 'door', source: 'combat', options: [{ kind: 'weaponArts', id: 'executioner' }, { kind: 'weaponArts', id: 'poiseBreaker' }], taken: [], claimed: null } };
  const stock = gameProfileShopStock(reg, run, createRng(3), { shopId: 'y' });
  // poiseBreaker costs mana a Reaver cannot pay (playableOnly), so only executioner is ever stocked.
  assert.deepEqual(stock.options.filter(option => option.kind === 'weaponArts').map(option => option.id).sort(), ['executioner']);
  assert.deepEqual(coreBlacksmithShelves(reg, createRng(5), run).weaponArts.map(row => row.id).sort(), ['executioner']);
});

test('an old save holding core.reaverSpecial on a pending door or shop shelf still claims and buys it; fresh offers never include it', () => {
  const run = reaver();
  run.gameProfileRewardOffers = { door: { id: 'door', source: 'combat', options: [{ kind: 'weaponArts', id: 'core.reaverSpecial' }], takeCount: 1, taken: [], claimed: null } };
  run.gameProfilePendingReward = { offerId: 'door', source: 'combat' };
  claimGameProfileReward(reg, run, 'door', 0);
  assert.ok(run.sideboard.some(card => card.cardId === 'core.reaverSpecial'), 'claimed into the sideboard');
  const shop = reaver();
  shop.cinders = 100000;
  shop.gameProfileRewardOffers = { 'shop:old': { id: 'shop:old', source: 'shop', price: 10, options: [{ kind: 'weaponArts', id: 'core.reaverSpecial', price: 50 }], takeCount: 1, taken: [], claimed: null } };
  purchaseGameProfileShopOffer(reg, shop, 'old', 0, null);
  assert.ok(shop.sideboard.some(card => card.cardId === 'core.reaverSpecial'), 'bought into the sideboard');
  for (let seed = 0; seed < 100; seed++) {
    const door = gameProfileRewardOffers(reg, reaver(['katana']), createRng(seed), { offerId: 'fresh' });
    assert.ok(!door.options.some(option => option.kind === 'weaponArts' && option.id === 'core.reaverSpecial'));
  }
  assert.ok(!gameProfileRewardPools(reg, reaver()).weaponArts.includes('core.reaverSpecial'));
});

import { gameProfileShopSalePlans } from '../src/model/gameProfileShopSales.js';

test('a bought learnable art and a legacy reaverSpecial resell against their weaponArts purchase price, never above it', () => {
  const run = reaver();
  run.cinders = 100000;
  run.gameProfileRewardOffers = { 'shop:d': { id: 'shop:d', source: 'shop', price: 10, options: [
    { kind: 'weaponArts', id: 'executioner', price: 10 }, { kind: 'weaponArts', id: 'core.reaverSpecial', price: 10 }], takeCount: 2, taken: [], claimed: null } };
  run.gameProfileOpenShop = 'd';
  purchaseGameProfileShopOffer(reg, run, 'd', 0, null);
  purchaseGameProfileShopOffer(reg, run, 'd', 1, null);
  assert.equal(run.gameProfileShopPurchasePrices['weaponArts:executioner'], 10);
  const plans = gameProfileShopSalePlans(reg, run, 'd').filter(plan => ['executioner', 'core.reaverSpecial'].includes(plan.def.id));
  assert.equal(plans.length, 2);
  for (const plan of plans) {
    assert.equal(plan.kind, 'weaponArts', `${plan.def.id} is classified as a weapon art`);
    assert.ok(plan.price > 0 && plan.price <= Math.floor(10 * reg.balance.shop.sellFraction), `${plan.def.id} resale ${plan.price} within the purchase ceiling`);
  }
});
