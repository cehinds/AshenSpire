// Every purchase confirms (owner, 2026-11-19): a relic bought from a trader used to spend on one tap while other
// buys appeared to ask. Each trader shelf and each Blacksmith buy or rank-up now opens the shared confirmation modal
// (components/confirmationModal.js, modal kind 'confirm'), names the item and the price, and spends only on its
// confirm; Back spends nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { beatFor } from '../src/model/secondbeat.js';
import { purchaseReview, ShopPurchaseKind, SmithRankReview } from '../src/ui/models/ConfirmationReviewModel.js';
import { mountConfiguredShop } from '../src/ui/screens/shop.js';
import { mountBlacksmith } from '../src/ui/screens/blacksmith.js';
import { buildBlacksmithStock } from '../src/engine/shopKinds.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { CONFIRMATION_INPUT_SHIELD_MS } from '../src/ui/components/confirmationModal.js';
import '../src/engine/runCombat.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const TRADER_SHELVES = ['combatCards', 'weaponArts', 'weapons', 'armor', 'relics', 'potions', 'rankUps'];

// The confirmation modal focuses on a 0 ms timer and its input shield releases after
// CONFIRMATION_INPUT_SHIELD_MS; the globals stay until those have run.
const settle = () => new Promise(resolve => setTimeout(resolve, CONFIRMATION_INPUT_SHIELD_MS + 50));
async function withGlobalDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  // A browser's element.click() is a synthetic click with detail 0 (what the inspector's Buy sends to the row's
  // armed control); the kit DOM omits detail, which an armed control reads as a click with no press behind it.
  const proto = Object.getPrototypeOf(dom.document.createElement('button'));
  const click = proto.click;
  proto.click = function () { if (!this.disabled) this.dispatchEvent(new globals.Event('click', { bubbles: true, detail: 0 })); };
  try { fn(dom); await settle(); } finally {
    proto.click = click;
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
const review = () => document.querySelector('.confirmation-modal');
// The kit DOM keeps a text node's words on the node; read a subtree's words the way a browser's textContent does.
const words = node => !node ? '' : [node.textContent || '', ...(node.children || []).map(words)].join(' ');

test('buying from a trader or the Blacksmith is a confirm-form action, never a one-tap commit', () => {
  for (const id of ['shopBuy', 'smithBuy']) {
    const beat = beatFor(id);
    assert.equal(beat.form, 'confirm', id);
    assert.notEqual(beat.tap, true, `${id} does not commit on a tap`);
    assert.equal(beat.undo, 'none', `${id} wears the CANNOT BE UNDONE tag`);
  }
});

test('every trader shelf and Blacksmith rack has a purchase review naming the item and the cinders', () => {
  for (const shelf of [...TRADER_SHELVES, 'armaments']) {
    const r = purchaseReview({ kind: ShopPurchaseKind(shelf), name: 'Ember Idol', cost: 40, cinders: 100 });
    assert.match(r.question, /\?$/, shelf);
    assert.equal(r.target, 'Ember Idol');
    assert.match(r.message, /40 of your 100 cinders \(60 left\)/, shelf);
    assert.equal(r.policyAction, 'action.purchase');
  }
  assert.throws(() => ShopPurchaseKind('sell'), /unknown shelf 'sell'/);
  for (const kind of ['card', 'item']) {
    const r = SmithRankReview({ kind, name: 'Greatsword', price: '2 stones · 40 cinders', stones: 3, cinders: 90 });
    assert.match(r.question, /^Rank up this (card|item)\?$/);
    assert.match(r.message, /2 stones · 40 cinders.*3 Smithing Stones and 90 cinders/);
  }
});

function mountTrader() {
  const run = createRunState({ seed: 71, classId: 'reaver', registries }), rng = createRng(71);
  run.cinders = 100000;
  const offer = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const taken = [];
  mountConfiguredShop(app, { registries, run, offer, meta: { settings: {} }, onTake: (index) => taken.push(index), onLeave() {} });
  return { app, offer, taken };
}

test('each stocked trader shelf opens the buy review on Buy; Back spends nothing and Buy it spends once', () => withGlobalDom(() => {
  const { app, offer, taken } = mountTrader();
  const stocked = [...new Set(offer.options.map(option => option.kind))];
  assert.ok(stocked.includes('relics'), 'the seeded trader sells relics (the reported case)');
  for (const kind of stocked) {
    const row = app.querySelector(`[data-shop-shelf="${kind}"] .merchant-offer`);
    if (!row) continue;   // a shelf the dock leaves off draws no rows
    const name = row.querySelector('.merchant-offer-details h3').textContent;
    const buy = row.querySelector('[data-shop-action="buy"]');
    assert.equal(buy.dataset.beatAction, 'shopBuy', kind);
    const before = taken.length;
    buy.click();
    assert.ok(review(), `${kind}: Buy opens the confirmation modal`);
    assert.equal(taken.length, before, `${kind}: nothing is bought before the confirm`);
    assert.equal(words(review().querySelector('.confirmation-target')).trim(), name, `${kind}: the review names the offer`);
    assert.match(words(review()), /cinders/, `${kind}: the review states the price`);
    review().querySelector('.confirmation-cancel').click();
    assert.equal(review(), null);
    assert.equal(taken.length, before, `${kind}: Back spends nothing`);
    buy.click();
    review().querySelector('.confirmation-confirm').click();
    assert.equal(taken.length, before + 1, `${kind}: the confirm buys exactly once`);
  }
}));

function mountSmith() {
  const run = createRunState({ seed: 41, classId: 'reaver', registries, runId: 'purchase-confirm' });
  run.smithingStones = 12;
  run.cinders = 5000;
  run.seenEvents = [];
  run.shopStock = buildBlacksmithStock(registries, createRng(41), run);
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const bought = [];
  mountBlacksmith(app, { registries, run, meta: { settings: {} }, onChanged() {}, onLeave() {},
    onArmamentPurchased: (id) => bought.push(id), onCardPurchased: (receipt) => bought.push(receipt.id) });
  return { app, run, bought };
}

test('Blacksmith armament and weapon-art buys ask first; the purse moves only on confirm', () => withGlobalDom(() => {
  const { app, run, bought } = mountSmith();
  for (const shelf of ['armaments', 'weaponArts']) {
    const buy = app.querySelector(`[data-shop-shelf="${shelf}"] [data-shop-action="buy"]:not([disabled])`);
    assert.ok(buy, `${shelf} has an affordable Buy`);
    assert.equal(buy.dataset.beatAction, 'smithBuy');
    const purse = run.cinders;
    buy.click();
    assert.ok(review(), `${shelf}: Buy opens the confirmation modal`);
    assert.equal(run.cinders, purse, `${shelf}: nothing is spent before the confirm`);
    review().querySelector('.confirmation-cancel').click();
    assert.equal(run.cinders, purse, `${shelf}: Back spends nothing`);
    buy.click();
    review().querySelector('.confirmation-confirm').click();
    assert.ok(run.cinders < purse, `${shelf}: the confirm spends`);
    document.querySelectorAll('.what-changed-modal .modal-close, .run-receipt .modal-close').forEach(node => node.click());
  }
  assert.equal(bought.length, 2);
}));

test('Blacksmith rank-ups ask first, naming the stones and cinders', () => withGlobalDom(() => {
  const { app, run } = mountSmith();
  const rank = app.querySelector('[data-shop-shelf="rankUp"] .merchant-offer-action:not([disabled])');
  assert.ok(rank, 'a card can be ranked up');
  assert.equal(rank.dataset.beatAction, 'smithBuy');
  const before = JSON.stringify({ cinders: run.cinders, stones: run.smithingStones });
  rank.click();
  assert.ok(review(), 'Rank up opens the confirmation modal');
  assert.match(words(review()), /Rank up this card\?/);
  assert.match(words(review()), /Smithing Stone/);
  review().querySelector('.confirmation-cancel').click();
  assert.equal(JSON.stringify({ cinders: run.cinders, stones: run.smithingStones }), before, 'Back spends nothing');
}));

test('no Blacksmith row that spends on its own button is wired to a bare click', () => {
  const src = readFileSync(new URL('../src/ui/screens/blacksmith.js', import.meta.url), 'utf8');
  assert.match(src, /if \(first\.ok\) wireAction\(control, first\);/, 'the row button goes through wireAction');
  assert.match(src, /if \(action\.ok\) wireAction\(extra, action\);/, 'the extra buttons go through wireAction');
  assert.match(src, /commit: \(\) => buyShelf\.purchase\(plan\),\s*review: /, 'the buy racks pass a review');
  assert.match(src, /commitRankUp\(registries, run, plan, \{ priceMult \}\),\s*review: /, 'the card rank-up passes a review');
  assert.match(src, /third\.review = /, 'the item rank-up passes a review');
});
