import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, purchaseGameProfileShopOffer, addPurchasedCardToDeck, shopCardDeckRefusal, movePurchasedCardToLibrary } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function buyCard(seed = 71) {
  const run = createRunState({ seed, classId: 'reaver', registries }), rng = createRng(seed);
  run.cinders = 100000;
  const stock = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  const index = stock.options.findIndex(option => option.kind === 'combatCards');
  assert.ok(index >= 0);
  const receipt = purchaseGameProfileShopOffer(registries, run, 'market', index, rng);
  return { run, receipt };
}

test('a bought card lands in the library by default and the receipt names its instance', () => {
  const { run, receipt } = buyCard();
  assert.ok(receipt.instanceId);
  assert.ok(run.sideboard.some(card => card.instanceId === receipt.instanceId));
  assert.ok(!run.deck.some(card => card.instanceId === receipt.instanceId));
});

test('Add to deck moves exactly that bought card from the library to the deck', () => {
  const { run, receipt } = buyCard();
  const deck = run.deck.length, side = run.sideboard.length;
  assert.equal(shopCardDeckRefusal(registries, run, receipt.instanceId), '');
  assert.equal(addPurchasedCardToDeck(registries, run, receipt.instanceId), true);
  assert.equal(run.deck.length, deck + 1);
  assert.equal(run.sideboard.length, side - 1);
  assert.equal(run.deck.at(-1).instanceId, receipt.instanceId);
  assert.equal(addPurchasedCardToDeck(registries, run, receipt.instanceId), false, 'repeat changes nothing');
});

test('a full deck refuses Add to deck and leaves the run untouched', () => {
  const { run, receipt } = buyCard();
  const settings = { deckMaxSize: run.deck.length, deckMaxUnlimited: false };
  const before = JSON.stringify(run);
  const code = shopCardDeckRefusal(registries, run, receipt.instanceId, settings);
  assert.equal(code, 'full');
  assert.throws(() => addPurchasedCardToDeck(registries, run, receipt.instanceId, settings)); assert.equal(JSON.stringify(run), before);
  assert.equal(shopCardDeckRefusal(registries, run, 'reward:none'), 'notCard');
});

test('the host offers equip through the Armoury and keeps inventory as the dismissal', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /\['weapons', 'armor'\]\.includes\(receipt\?\.kind\)\) return offerShopEquip/);
  assert.match(main, /showArmoury\(\{ equipItemId: id \}, showShop\)/);
  assert.equal((main.match(/onArmamentPurchased: shopArmamentBought/g) || []).length, 4);
  assert.equal((main.match(/onCardPurchased: offerShopCardDestination/g) || []).length, 2);
  const smith = readFileSync(new URL('../src/ui/screens/blacksmith.js', import.meta.url), 'utf8');
  assert.match(smith, /onCardPurchased\?*\.?\(\{[^}]*instanceId: receipt\.instanceId/);
  const modal = readFileSync(new URL('../src/ui/components/shopBuyChoice.js', import.meta.url), 'utf8');
  assert.match(modal, /onClose: \(\) => \{ if \(!settled\)/);
  const equipment = readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
  assert.match(equipment, /beginInventoryEquip\(row, null\)/);
});

test('movePurchasedCardToLibrary moves exactly a bought weapon art from the deck to the library and refuses a stranger', async () => {
  const { buildMarketStock } = await import('../src/engine/shopKinds.js');
  const { armamentPurchasePlan, commitArmamentPurchase } = await import('../src/model/armamentTrading.js');
  const reg = createRegistries(contentBundle);
  const run = createRunState({ seed: 671, classId: 'reaver', registries: reg });
  run.cinders = 100000; run.shopStock = buildMarketStock(reg, createRng(671), run);
  const offer = run.shopStock.weaponArts[0];
  const receipt = commitArmamentPurchase(reg, run, armamentPurchasePlan(reg, run, offer, 'weaponArt'));
  const id = receipt.instance.instanceId;
  assert.ok(run.deck.some(card => card.instanceId === id), 'a Master art lands in the deck');
  const others = run.deck.filter(card => card.instanceId !== id).map(card => card.instanceId);
  const side = run.sideboard.length;
  assert.equal(movePurchasedCardToLibrary(reg, run, id), true);
  assert.equal(run.sideboard.length, side + 1);
  assert.ok(run.sideboard.some(card => card.instanceId === id));
  assert.deepEqual(run.deck.map(card => card.instanceId), others);
  const before = JSON.stringify(run);
  assert.throws(() => movePurchasedCardToLibrary(reg, run, id), { code: 'notCard' });
  assert.equal(JSON.stringify(run), before);
});

test('the Master art choice setting is off by default and names its row', async () => {
  const { settingOn, settingsRow } = await import('../src/ui/screens/settings.js');
  assert.equal(settingOn({}, 'masterArtChoice'), false);
  assert.equal(settingOn({ masterArtChoice: true }, 'masterArtChoice'), true);
  assert.equal(settingsRow('masterArtChoice').label, 'Ask where Master weapon arts go');
});

test('the Master offers the destination choice only under the masterArtChoice setting, and dismissing keeps the deck', () => {
  const master = readFileSync(new URL('../src/ui/screens/master.js', import.meta.url), 'utf8');
  assert.match(master, /if \(settingOn\(\(meta \|\| \{\}\)\.settings, 'masterArtChoice'\) && receipt\.instance\) onArtPurchased\(receipt\)/);
  assert.equal((master.match(/onArtPurchased\(/g) || []).length, 1, 'one call site, behind the setting');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.equal((main.match(/onArtPurchased: offerMasterArtDestination/g) || []).length, 1);
  assert.match(main, /onDismiss: \(\) => \{\},\s*onLibrary: \(\) => \{ movePurchasedCardToLibrary\(registries, run, instanceId\)/);
  const modal = readFileSync(new URL('../src/ui/components/shopBuyChoice.js', import.meta.url), 'utf8');
  assert.match(modal, /\(onDismiss \|\| onSecondary\)\?\.\(\)/);
});

test('a reward\'s Equip opens the Armoury with the offered item, so a slot choice equips it directly', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /onEditEquipment: \(index, back\) => showArmoury\(\{ equipItemId: run\.gameProfileRewardOffers\[pending\.offerId\]\?\.options\?\.\[index\]\?\.id \|\| '' \}, back\)/);
  // The Armoury's item flow lists only the slots the item fits, then equips into the chosen one (requestEquip), never the slot's picker.
  const equipment = readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
  assert.match(equipment, /filter\(candidate => fitsSlot\(candidate, row\.item\)\)/);
  assert.match(equipment, /requestEquip\(slot\.id, position\.index, row\.id, `Equip \$\{row\.name\} to \$\{label\}`/);
});
