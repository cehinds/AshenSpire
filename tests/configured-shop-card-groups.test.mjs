import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, gameProfileWeaponArtIds } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSaleGroups, gameProfileShopCardSalePlan, gameProfileShopSalePlan, commitGameProfileShopSale } from '../src/model/gameProfileShopSales.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const bytes = value => JSON.stringify(value);
function fixture() {
  const run = createRunState({ seed: 71, classId: 'reaver', registries }), rng = createRng(71);
  run.cinders = 10000;
  gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  const arts = gameProfileWeaponArtIds(registries, run);
  const cardId = run.deck.find(card => !arts.has(card.cardId)).cardId;
  const card = (instanceId, fields = {}) => ({ cardId, upgraded: false, instanceId, ...fields });
  run.sideboard = [card('copy:1'), card('copy:2'), card('copy:3')];
  const groups = () => gameProfileShopSaleGroups(registries, run, 'market');
  const group = () => groups().find(row => row.batch && row.ref.instanceId === 'copy:1');
  const quote = quantity => gameProfileShopCardSalePlan(registries, run, 'market', group().groupKey, quantity);
  return { run, rng, card, groups, group, quote };
}

test('identical cards stack while ranks, upgrades, modifiers, mechanical provenance and weapon arts stay distinct', () => {
  const f = fixture();
  f.run.sideboard[1] = { rank: 1, mods: [], ...f.run.sideboard[1], rewardReceiptId: 'reward:second' };
  f.run.sideboard.push(f.card('ranked', { rank: 2 }), f.card('modded', { mods: ['strike.damage=+1'] }),
    f.card('upgraded:2', { upgraded: true, upgradeSteps: [{ k: 'dmg', n: 2 }] }),
    f.card('upgraded:3', { upgraded: true, upgradeSteps: [{ k: 'dmg', n: 3 }] }),
    f.card('provenance', { sourceClassId: 'herald' }),
    f.card('bound', { grantedBy: 'armament/straightSword' }));
  const artId = [...gameProfileWeaponArtIds(registries, f.run)].find(id => registries.cards.has(id));
  assert.ok(artId);
  f.run.sideboard.push(f.card('art:1', { cardId: artId }), f.card('art:2', { cardId: artId }));
  assert.equal(f.group().available, 3);
  assert.equal(f.group().quantity, 1);
  assert.equal(f.groups().filter(row => row.batch).length, 7);
  assert.equal(f.groups().find(row => row.ref?.instanceId === 'art:1').kind, 'weaponArts');
  assert.equal(f.groups().find(row => row.identity === 'bound').ok, false);
  const key = f.group().groupKey;
  f.run.sideboard.reverse();
  assert.equal(f.groups().find(row => row.batch && row.ref.instanceId === 'copy:3').groupKey, key, 'group key does not depend on representative instance');
});

test('a quantity sale removes only quoted spare copies, credits their sum once, and survives a real save', () => {
  const f = fixture(), quote = f.quote(2), before = f.run.cinders;
  assert.equal(quote.ok, true);
  assert.deepEqual(quote.identities, ['copy:1', 'copy:2']);
  assert.equal(quote.price, quote.unitPrice * 2);
  const deck = bytes(f.run.deck), stock = structuredClone(f.run.gameProfileRewardOffers['shop:market']);
  f.run.classMilestones = { sale: { classId: f.run.class, level: 1, grants: { cards: { state: 'taken', selection: { instanceId: 'copy:2' } } } } };
  const receipt = commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.equal(receipt.quantity, 2);
  assert.equal(f.run.cinders, before + quote.price);
  assert.deepEqual(f.run.sideboard.map(card => card.instanceId), ['copy:3']);
  assert.equal(bytes(f.run.deck), deck, 'active deck copies are never sold');
  assert.equal(f.run.classMilestones.sale.grants.cards.state, 'spent');
  assert.equal(f.run.classMilestones.sale.grants.cards.spentReason, 'sold');
  assert.deepEqual(f.run.gameProfileRewardOffers['shop:market'], { ...stock, tradeRevision: (stock.tradeRevision || 0) + 1 });
  // This temporary provenance fixture is outside the authored milestone schema.
  delete f.run.classMilestones.sale;
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(f.run, f.rng);
  const restored = saves.loadRun(registries);
  assert.ok(restored, JSON.stringify(saves.runStatus()));
  assert.deepEqual(restored.sideboard.map(card => card.instanceId), ['copy:3']);
  assert.equal(restored.cinders, before + quote.price);
});

test('batch quotes revalidate exact copies atomically when a member moves, becomes bound, changes or stock advances', () => {
  for (const mutate of [
    f => { f.run.deck.push(f.run.sideboard.splice(1, 1)[0]); },
    f => { f.run.sideboard[1].grantedBy = 'armament/straightSword'; },
    f => { f.run.sideboard[1].rank = 2; },
    f => { f.run.sideboard.splice(1, 1); },
    f => { f.run.gameProfileRewardOffers['shop:market'].tradeRevision = 1; },
  ]) {
    const f = fixture(), quote = f.quote(2);
    mutate(f);
    const before = bytes(f.run);
    assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', quote));
    assert.equal(bytes(f.run), before);
  }
});

test('quantity validation rejects zero, fractions, unavailable copies, forged IDs and cinder overflow without mutation', () => {
  const f = fixture(), before = bytes(f.run);
  for (const quantity of [0, -1, 1.5, 4, NaN, Infinity, '2']) assert.equal(f.quote(quantity).ok, false);
  assert.equal(bytes(f.run), before);
  const quote = f.quote(2);
  for (const identities of [['copy:1', 'copy:1'], ['copy:1', f.run.deck[0].instanceId], undefined]) {
    assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', { ...quote, identities }));
    assert.equal(bytes(f.run), before);
  }
  f.run.cinders = Number.MAX_SAFE_INTEGER - quote.unitPrice;
  assert.equal(f.quote(1).ok, true);
  assert.equal(f.quote(2).ok, false);
  const overflow = bytes(f.run);
  assert.throws(() => commitGameProfileShopSale(registries, f.run, 'market', quote));
  assert.equal(bytes(f.run), overflow);
});

test('selected-copy quotes survive spare-copy reordering and legacy one-copy sales remain compatible', () => {
  const f = fixture(), quote = f.quote(2);
  f.run.sideboard.reverse();
  commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.deepEqual(f.run.sideboard.map(card => card.instanceId), ['copy:3']);
  const legacy = gameProfileShopSalePlan(registries, f.run, 'market', 'combatCards', 'copy:3');
  assert(legacy.ok);
  commitGameProfileShopSale(registries, f.run, 'market', legacy);
  assert.deepEqual(f.run.sideboard, []);
});

test('selling every copy uses one transaction and rejects a total beyond the safe integer range', () => {
  const f = fixture(), quote = f.quote(3), before = f.run.cinders;
  const receipt = commitGameProfileShopSale(registries, f.run, 'market', quote);
  assert.equal(receipt.quantity, 3);
  assert.deepEqual(f.run.sideboard, []);
  assert.equal(f.run.cinders, before + quote.unitPrice * 3);
  assert.equal(f.run.gameProfileRewardOffers['shop:market'].tradeRevision, 1);
  const expensive = fixture();
  expensive.run.cinders = 0;
  const profile = structuredClone(expensive.run.gameProfile);
  profile.modules.shops.priceTable = { ...profile.modules.shops.priceTable, card: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] };
  expensive.run.gameProfile = profile;
  const richRegistries = { ...registries, balance: { ...registries.balance, shop: { ...registries.balance.shop, sellFraction: 0.9 } } };
  const group = gameProfileShopSaleGroups(richRegistries, expensive.run, 'market').find(row => row.batch);
  assert.ok(group?.ok);
  const overflow = gameProfileShopCardSalePlan(richRegistries, expensive.run, 'market', group.groupKey, 3);
  assert.equal(overflow.ok, false);
  assert.match(overflow.reason, /balance/);
  const saved = bytes(expensive.run);
  assert.throws(() => commitGameProfileShopSale(richRegistries, expensive.run, 'market', overflow));
  assert.equal(bytes(expensive.run), saved);
});
