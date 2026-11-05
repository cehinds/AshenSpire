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
import { gameProfileRewardPools, gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { coreBlacksmithShelves } from '../src/model/blacksmithStock.js';

const arts = (id) => { const pkg = packages().find(row => row.weaponId === id); return [...pkg.weaponArtDefaults, ...pkg.learnableArts]; };
const reaver = (carry = []) => { const run = createRunState({ seed: 1, classId: 'reaver', registries: reg }); run.loadout.storage.push(...carry); return run; };
const ownedIds = (run) => new Set([...run.deck, ...run.sideboard].map(card => card.cardId));

test('the art pool is the arts of carried weapons minus owned or granted ones', () => {
  const run = reaver(['ashStaff']);
  assert.ok(ownedIds(run).has('greatswordSunderingHew'), 'the worn greatsword grants its default art');
  const expected = (...weapons) => weapons.flatMap(arts).filter(id => !ownedIds(run).has(id)).sort();
  assert.deepEqual([...gameProfileRewardPools(reg, run).weaponArts].sort(), expected('greatsword', 'ashStaff'));
  assert.ok(!gameProfileRewardPools(reg, run).weaponArts.includes('greatswordSunderingHew'), 'granted art is not offered');
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
    assert.deepEqual([...shelves.weaponArts.map(row => row.id)].sort(), ['executioner', 'hamstringRogue', 'katanaDrawCut', 'poiseBreaker'].sort());
  }
});

test('an art on the open door is not stocked by the shop, and a shop art is not offered on a door', () => {
  const run = reaver();
  run.gameProfileRewardOffers = { door: { id: 'door', source: 'combat', options: [{ kind: 'weaponArts', id: 'executioner' }], taken: [], claimed: null } };
  const stock = gameProfileShopStock(reg, run, createRng(3), { shopId: 'x' });
  assert.deepEqual(stock.options.filter(option => option.kind === 'weaponArts').map(option => option.id), ['poiseBreaker']);
  const run2 = reaver();
  run2.gameProfileOpenShop = 'x';
  run2.gameProfileRewardOffers = { 'shop:x': { id: 'shop:x', source: 'shop', options: [{ kind: 'weaponArts', id: 'poiseBreaker' }], taken: [], claimed: null } };
  for (let seed = 0; seed < 100; seed++) {
    const door = gameProfileRewardOffers(reg, structuredClone(run2), createRng(seed), { offerId: 'd' });
    assert.ok(!door.options.some(option => option.id === 'poiseBreaker'), `seed ${seed}`);
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
  assert.deepEqual([...only].sort(), ['executioner', 'poiseBreaker']);
});

test('the Blacksmith shelf skips an art on the open reward door but keeps its own earlier shelf', () => {
  const run = reaver();
  run.gameProfileRewardOffers = { door: { id: 'door', source: 'combat', options: [{ kind: 'weaponArts', id: 'executioner' }], taken: [], claimed: null } };
  run.shopStock = { kind: 'blacksmith', offerings: ['weaponArts'], weaponArts: [{ id: 'poiseBreaker', cost: 70 }] };
  assert.deepEqual(coreBlacksmithShelves(reg, createRng(5), run).weaponArts.map(row => row.id), ['poiseBreaker']);
});
