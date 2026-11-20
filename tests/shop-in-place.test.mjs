import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, gameProfileShopPurchasePlan, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSalePlans, gameProfileShopSaleGroups, commitGameProfileShopSale } from '../src/model/gameProfileShopSales.js';
import { mountConfiguredShop } from '../src/ui/screens/shop.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { openDeckEdit } from '../src/ui/models/DeckEditorModel.js';
import { addPurchasedCardToDeck } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function withDom(fn) {
  return withKitDom((dom) => {
    dom.document.documentElement = dom.document.body;
    dom.document.getSelection = () => null;
    const before = globalThis.HTMLElement;
    globalThis.HTMLElement = dom.document.body.constructor;
    const timers = [], timeout = globalThis.setTimeout;
    globalThis.setTimeout = (...args) => { const timer = timeout(...args); timers.push(timer); return timer; };
    try { return fn(dom); } finally {
      for (const timer of timers) clearTimeout(timer); globalThis.setTimeout = timeout;
      clearSelection(); if (before === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = before;
    }
  });
}
function fixture(prep = () => {}, callbacks = {}, prepareStock = () => {}) {
  const run = createRunState({ seed: 71, classId: 'reaver', registries }), rng = createRng(71);
  run.cinders = 100000;
  prep(run);
  const offer = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  prepareStock(offer);
  const app = document.createElement('main'); document.body.append(app);
  const shop = mountConfiguredShop(app, { registries, run, offer, meta: { settings: {} },
    onTake: (index, quote) => purchaseGameProfileShopOffer(registries, run, 'market', index, rng, quote),
    onSell: quote => commitGameProfileShopSale(registries, run, 'market', quote), onLeave() {}, ...callbacks });
  return { app, shop, run, rng, offer };
}
const row = (app, key) => [...app.querySelectorAll('[data-shop-key]')].find(node => node.dataset.shopKey === key);
const saleKey = quote => `sell:${quote.kind}:${quote.batch ? quote.groupKey : quote.identity}`;

test('every merchant Buy including rank-ups requires cancellable item and price confirmation', () => withDom(() => {
  let purchases = 0;
  const { app, run, rng, offer } = fixture(() => {}, { onTake() { purchases++; } }, stock => {
    if (!stock.options.some(option => option.kind === 'rankUps')) stock.options.push({ kind: 'rankUps', id: 'cardRank', price: 40 });
  });
  const kinds = new Set(offer.options.map(option => option.kind));
  assert.ok(kinds.has('rankUps'), 'the fixture includes the paid card-rank service');
  for (const kind of kinds) {
    const index = offer.options.findIndex(option => option.kind === kind);
    app.querySelector(`[data-shop-category="${kind}"]`).click();
    const control = row(app, `buy:${index}`).querySelector('[data-shop-action="buy"]');
    const before = JSON.stringify(run), counters = rng.getCounters();
    control.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    control.dispatchEvent(new Event('pointerup', { bubbles: true }));
    control.click(); control.click();
    assert.equal(purchases, 0, `${kind}: holding or repeating Buy cannot bypass confirmation`);
    assert.ok(document.querySelector('#confirmation-modal-target').childNodes.length);
    assert.match(document.querySelector('#confirmation-modal-copy').outerHTML, new RegExp(`${offer.options[index].price} cinders`));
    assert.equal(JSON.stringify(run), before); assert.deepEqual(rng.getCounters(), counters);
    document.querySelector('.confirmation-cancel').click();
    assert.equal(document.querySelector('.confirmation-modal'), null);
    assert.equal(JSON.stringify(run), before); assert.deepEqual(rng.getCounters(), counters);
  }
}));

test('a purchase revalidates its displayed quote and shows refusal without spending or rerolling', () => withDom(() => {
  const { app, run, offer } = fixture();
  const index = offer.options.findIndex(option => option.kind === 'combatCards');
  row(app, `buy:${index}`).querySelector('[data-shop-action="buy"]').click();
  run.cinders = 0;
  const before = JSON.stringify(run);
  document.querySelector('.confirmation-confirm').click();
  assert.equal(JSON.stringify(run), before);
  assert.ok(app.querySelector('.shop-foot-host [role="alert"]').textContent);
}));

test('identical sale cards share a bounded quantity stepper and sell the selected count after confirmation', () => withDom(() => {
  const { app, shop, run } = fixture(run => {
    run.sideboard = [0, 1, 2].map(index => ({ cardId: 'core.strike', instanceId: `plain:${index}`, upgraded: false }));
    run.sideboard.push({ cardId: 'core.strike', instanceId: 'upgraded:0', upgraded: true });
  });
  app.querySelector('[data-shop-category="sell"]').click();
  const groups = gameProfileShopSaleGroups(registries, run, 'market').filter(quote => quote.batch);
  assert.equal(groups.length, 2, 'upgraded cards stay separate');
  const group = groups.find(quote => quote.available === 3), key = saleKey(group);
  const tile = row(app, key), plus = tile.querySelector('[data-quantity-step="1"]'), minus = tile.querySelector('[data-quantity-step="-1"]');
  const shelf = app.querySelector('[data-shop-shelf="sell"]'); shelf.scrollTop = 222;
  assert.equal(tile.querySelector('.se-value').textContent, '1'); assert.equal(minus.disabled, true);
  const actions = [...tile.querySelector('.merchant-offer-actions').children];
  assert.ok(actions.indexOf(tile.querySelector('.merchant-sale-quantity')) < actions.indexOf(tile.querySelector('[data-shop-action="sell"]')));
  plus.focus(); plus.click(); plus.click(); plus.click();
  assert.equal(tile.querySelector('.se-value').textContent, '3'); assert.equal(plus.disabled, true);
  assert.equal(document.activeElement, plus); assert.equal(document.querySelector('.card-inspection-modal'), null);
  minus.click();
  assert.equal(tile.querySelector('.se-value').textContent, '2');
  assert.match(tile.querySelector('.merchant-offer-price').textContent, new RegExp(String(group.unitPrice * 2)));
  assert.equal(row(app, key), tile); assert.equal(shelf.scrollTop, 222);
  const before = JSON.stringify(run);
  tile.querySelector('.merchant-thumbnail').click();
  const inspectSale = document.querySelector('.card-inspection-modal [data-act="sell"]');
  assert.match(inspectSale.textContent, /Sell 2/);
  inspectSale.click();
  assert.match(document.querySelector('#confirmation-modal-copy').textContent, new RegExp(`Quantity: 2. Receive ${group.unitPrice * 2}`));
  document.querySelector('.confirmation-cancel').click();
  assert.equal(JSON.stringify(run), before);
  const purse = run.cinders;
  tile.querySelector('[data-shop-action="sell"]').click();
  document.querySelector('.confirmation-confirm').click();
  assert.equal(run.sideboard.length, 2); assert.equal(run.cinders, purse + group.unitPrice * 2);
  assert.equal(row(app, key), tile, 'remaining copies retain the same row');
  assert.equal(tile.querySelector('.se-value').textContent, '1'); assert.equal(plus.disabled, true);
  assert.equal(shelf.scrollTop, 222); assert.equal(shop.root.dataset.shopContent, 'sell');
}));

test('a sale confirmation preserves exact selected copies and refuses changed inventory visibly', () => withDom(() => {
  const { app, run } = fixture(run => {
    run.sideboard = [0, 1, 2].map(index => ({ cardId: 'core.strike', instanceId: `stale:${index}`, upgraded: false }));
  });
  const group = gameProfileShopSaleGroups(registries, run, 'market').find(quote => quote.batch);
  const tile = row(app, saleKey(group));
  tile.querySelector('[data-quantity-step="1"]').click();
  tile.querySelector('[data-shop-action="sell"]').click();
  run.sideboard.shift();
  const before = JSON.stringify(run);
  document.querySelector('.confirmation-confirm').click();
  assert.equal(JSON.stringify(run), before, 'another identical copy is never substituted at confirmation');
  assert.ok(app.querySelector('.shop-foot-host [role="alert"]').textContent);
}));

test('merchant deck edits refresh sell inventory without rerolling stock or moving the shelf', () => withDom(() => {
  let edit;
  const { app, shop, run, rng, offer } = fixture(() => {}, { onEditDeck: () => { edit = openDeckEdit(registries, run, { deckMinUnlimited: true }); } });
  const index = offer.options.findIndex(option => option.kind === 'combatCards');
  const purchase = purchaseGameProfileShopOffer(registries, run, 'market', index, rng);
  addPurchasedCardToDeck(registries, run, purchase.instanceId);
  shop.refresh();
  app.querySelector('[data-shop-category="sell"]').click();
  const shelf = app.querySelector('[data-shop-shelf="sell"]'); shelf.scrollTop = 127;
  const stock = run.gameProfileRewardOffers['shop:market'], purse = run.cinders;
  assert.equal(row(app, `sell:combatCards:${purchase.instanceId}`), undefined);
  app.querySelector('#shop-edit-deck').click();
  assert.ok(edit);
  assert.equal(edit.remove(purchase.instanceId).ok, true);
  assert.equal(edit.confirm().ok, true);
  shop.refresh();
  const group = gameProfileShopSaleGroups(registries, run, 'market').find(plan => plan.identities?.includes(purchase.instanceId));
  assert.ok(group && row(app, saleKey(group)), 'removed card becomes available to sell');
  assert.equal(run.gameProfileRewardOffers['shop:market'], stock, 'editor does not reroll merchant stock');
  assert.equal(run.cinders, purse, 'editing is free');
  assert.equal(shop.root.dataset.shopContent, 'sell');
  assert.equal(shelf.scrollTop, 127);
  const sale = gameProfileShopSalePlans(registries, run, 'market').find(plan => plan.identity === purchase.instanceId);
  assert.ok(sale?.ok);
  commitGameProfileShopSale(registries, run, 'market', sale); shop.refresh();
  assert.ok(!run.sideboard.some(card => card.instanceId === purchase.instanceId));
  assert.equal(run.cinders, purse + sale.price);
}));

test('cancelling a merchant deck edit restores the deck and keeps the merchant open', () => withDom(() => {
  let edit;
  const { app, shop, run } = fixture(() => {}, { onEditDeck: () => { edit = openDeckEdit(registries, run); } });
  const before = JSON.stringify(run), frame = app.querySelector('.shop-frame');
  app.querySelector('#shop-edit-deck').click();
  assert.equal(edit.remove(run.deck[0].instanceId).ok, true);
  edit.cancel(); shop.refresh();
  assert.equal(JSON.stringify(run), before);
  assert.equal(app.querySelector('.shop-frame'), frame);
}));

test('merchant refresh retains shell, shelf, unaffected rows and scroll after restocking a purchase slot', () => withDom(() => {
  const { app, shop, run, rng, offer } = fixture();
  const frame = app.querySelector('.shop-frame'), shelf = app.querySelector('[data-shop-shelf="combatCards"]');
  const index = offer.options.findIndex(option => option.kind === 'combatCards');
  const untouchedIndex = offer.options.findIndex((_, at) => at !== index);
  const before = row(app, `buy:${index}`), untouched = row(app, `buy:${untouchedIndex}`);
  app.querySelector('[data-shop-category="combatCards"]').click();
  shelf.scrollTop = 231;
  const originalStock = run.gameProfileRewardOffers['shop:market'];
  purchaseGameProfileShopOffer(registries, run, 'market', index, rng, gameProfileShopPurchasePlan(registries, run, 'market', index));
  assert.notEqual(run.gameProfileRewardOffers['shop:market'], originalStock, 'transaction replaces the persisted stock object');
  shop.refresh();
  assert.equal(app.querySelector('.shop-frame'), frame);
  assert.equal(app.querySelector('[data-shop-shelf="combatCards"]'), shelf);
  assert.equal(row(app, `buy:${untouchedIndex}`), untouched);
  assert.notEqual(row(app, `buy:${index}`), before, 'restocked option updates only that slot');
  assert.equal(shelf.scrollTop, 231);
  assert.equal(shop.root.dataset.shopContent, 'combatCards');
}));

test('sale removes its own row while retaining neighboring sales and active category', () => withDom(() => {
  const { app, shop, run } = fixture(run => {
    const defs = registries.cards.all().slice(0, 3);
    run.sideboard = defs.map((def, index) => ({ cardId: def.id, instanceId: `sale:${index}`, upgraded: false }));
  });
  app.querySelector('[data-shop-category="sell"]').click();
  const shelf = app.querySelector('[data-shop-shelf="sell"]'); shelf.scrollTop = 133;
  const sales = gameProfileShopSaleGroups(registries, run, 'market').filter(plan => plan.ok && plan.kind === 'combatCards');
  assert.ok(sales.length > 1);
  const sale = sales[0], keep = sales[1];
  const soldRow = row(app, saleKey(sale)), keptRow = row(app, saleKey(keep));
  commitGameProfileShopSale(registries, run, 'market', sale); shop.refresh({ focusKey: saleKey(sale) });
  assert.equal(soldRow.isConnected, false);
  assert.equal(row(app, saleKey(keep)), keptRow);
  assert.equal(shelf.scrollTop, 133);
  assert.equal(shop.root.dataset.shopContent, 'sell');
  assert.equal(document.activeElement, keptRow.querySelector('[data-shop-action="sell"]'), 'focus follows the next surviving sale');
}));

test('a balance change updates dependent affordability without recreating unrelated offer rows', () => withDom(() => {
  const { app, shop, run, offer } = fixture();
  const available = offer.options.map((option, index) => ({ index, price: option.price, quote: gameProfileShopPurchasePlan(registries, run, 'market', index) })).filter(row => row.quote.ok);
  const expensive = available.reduce((best, next) => next.price > best.price ? next : best);
  const cheap = available.find(next => next.price < expensive.price);
  assert.ok(cheap, 'fixture has offers at different prices');
  const kept = row(app, `buy:${cheap.index}`), changed = row(app, `buy:${expensive.index}`);
  run.cinders = cheap.price; shop.refresh();
  assert.equal(row(app, `buy:${cheap.index}`), kept);
  assert.notEqual(row(app, `buy:${expensive.index}`), changed);
  assert.equal(row(app, `buy:${expensive.index}`).querySelector('[data-shop-action="buy"]').disabled, true);
  assert.match(app.querySelector('.shop-frame .as-status').textContent, new RegExp(String(run.cinders)));
}));

test('a retained buy control commits with a refreshed quote after another purchase changes the trade revision', () => withDom(() => {
  const { app, shop, run, rng, offer } = fixture();
  const indices = offer.options.map((option, index) => ({ option, index })).filter(({ option }) => option.kind === 'combatCards');
  assert.ok(indices.length > 1);
  const first = indices[0].index, next = indices[1].index;
  const nextRow = row(app, `buy:${next}`), control = nextRow.querySelector('[data-shop-action="buy"]');
  const before = run.sideboard.length;
  purchaseGameProfileShopOffer(registries, run, 'market', first, rng, gameProfileShopPurchasePlan(registries, run, 'market', first));
  shop.refresh();
  assert.equal(row(app, `buy:${next}`), nextRow);
  const timers = [];
  const timeout = globalThis.setTimeout;
  globalThis.setTimeout = (...args) => { const timer = timeout(...args); timers.push(timer); return timer; };
  try {
    control.click();
    const confirm = document.querySelector('.confirmation-confirm');
    if (confirm) confirm.click();
    assert.equal(run.sideboard.length, before + 2);
    assert.equal(app.querySelector('.shop-foot-host [role="alert"]').textContent, '');
  } finally { for (const timer of timers) clearTimeout(timer); globalThis.setTimeout = timeout; }
}));


test('an asynchronous purchase refuses duplicate submissions and reports rejection without remounting', async () => {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  const timers = [], timeout = globalThis.setTimeout;
  globalThis.setTimeout = (...args) => { const timer = timeout(...args); timers.push(timer); return timer; };
  try {
    let calls = 0;
    let rejectPurchase;
    const { app, offer } = fixture(() => {}, { onTake() {
      calls++;
      return new Promise((_, reject) => { rejectPurchase = reject; });
    } });
    const frame = app.querySelector('.shop-frame');
    const index = offer.options.findIndex(option => option.kind === 'combatCards');
    const control = row(app, `buy:${index}`).querySelector('[data-shop-action="buy"]');
    control.click(); control.click();
    assert.equal(calls, 0, 'opening and repeating Buy never commits before confirmation');
    document.querySelector('.confirmation-confirm').click(); control.click();
    assert.equal(calls, 1, 'pending purchase owns the transaction until it settles');
    rejectPurchase(new Error('The selected card can no longer rank up.'));
    await new Promise(setImmediate);
    assert.equal(app.querySelector('.shop-frame'), frame);
    assert.equal(app.querySelector('.shop-foot-host [role="alert"]').textContent, 'The selected card can no longer rank up.');
    control.click();
    document.querySelector('.confirmation-confirm').click();
    assert.equal(calls, 2, 'failure releases the transaction gate for another attempt');
    rejectPurchase(new Error('Retry refused.'));
    await new Promise(setImmediate);
  } finally {
    for (const timer of timers) clearTimeout(timer);
    globalThis.setTimeout = timeout;
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
