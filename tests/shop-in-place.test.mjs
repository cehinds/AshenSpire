import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock, gameProfileShopPurchasePlan, purchaseGameProfileShopOffer } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSalePlans, commitGameProfileShopSale } from '../src/model/gameProfileShopSales.js';
import { mountConfiguredShop } from '../src/ui/screens/shop.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';

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
const saleKey = quote => `sell:${quote.kind}:${quote.identity}`;

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
  const sales = gameProfileShopSalePlans(registries, run, 'market').filter(plan => plan.ok && plan.kind === 'combatCards');
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
  // A browser's element.click() is a synthetic click with detail 0, which the armed Buy reads as a tap that opens
  // its review (tests/purchase-confirm.test.mjs); the kit DOM omits detail.
  const proto = Object.getPrototypeOf(dom.document.createElement('button'));
  const click = proto.click;
  proto.click = function () { if (!this.disabled) this.dispatchEvent(new globals.Event('click', { bubbles: true, detail: 0 })); };
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
    proto.click = click;
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
