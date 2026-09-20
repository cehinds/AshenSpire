import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOP_CATEGORIES, shopCategories, shopCategoryStatus, offerRefs, resolveShopSelection,
  offerAvailability, shopFooterActions, shopWorkspaceLayout,
} from '../src/ui/models/ShopWorkspaceModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

test('the rail holds every shelf in order, and SELL only while its toggle is on', () => {
  assert.deepEqual([...shopCategories({ sellOn: true })], [...SHOP_CATEGORIES]);
  const off = shopCategories({ sellOn: false });
  assert.equal(off.includes('sell'), false);
  assert.deepEqual([...off], SHOP_CATEGORIES.filter((key) => key !== 'sell'));
});

test('each category status speaks from its own counts', () => {
  assert.deepEqual(shopCategoryStatus('cards', { offered: 3 }), { id: 'shop.status.forSale', tokens: { n: 3 } });
  assert.deepEqual(shopCategoryStatus('relics', { offered: 0 }), { id: 'shop.status.soldOut', tokens: null });
  assert.deepEqual(shopCategoryStatus('sell', { offered: 2, available: 1 }), { id: 'shop.status.willTake', tokens: { n: 1 } });
  assert.deepEqual(shopCategoryStatus('sell', { offered: 1, available: 0 }), { id: 'shop.status.nothingWanted', tokens: null });
  assert.deepEqual(shopCategoryStatus('services', { offered: 3, available: 2 }), { id: 'shop.status.servicesOpen', tokens: { n: 2, total: 3 } });
});

test('offer identities are stable and distinguish repeated ids', () => {
  assert.deepEqual([...offerRefs('cards', ['strike', 'bash', 'strike'])], ['cards:strike#0', 'cards:bash#0', 'cards:strike#1']);
});

test('selection survives while offered, then moves to the offer now in its place', () => {
  const refs = ['a#0', 'b#0', 'c#0'];
  assert.equal(resolveShopSelection(refs, null), 'a#0');
  assert.equal(resolveShopSelection(refs, { ref: 'c#0', index: 2 }), 'c#0');
  // b was bought: the shelf is now [a, c] and the selection takes c, not a.
  assert.equal(resolveShopSelection(['a#0', 'c#0'], { ref: 'b#0', index: 1 }), 'c#0');
  // The last offer was bought: clamp to the new last.
  assert.equal(resolveShopSelection(['a#0'], { ref: 'c#0', index: 2 }), 'a#0');
  assert.equal(resolveShopSelection([], { ref: 'a#0', index: 0 }), null);
});

test('a first visit selects the first offer the player can take, else the first', () => {
  const refs = ['a#0', 'b#0', 'c#0'];
  assert.equal(resolveShopSelection(refs, null, ['b#0', 'c#0']), 'b#0');
  assert.equal(resolveShopSelection(refs, null, []), 'a#0');
  // An existing selection is never moved to a more available offer.
  assert.equal(resolveShopSelection(refs, { ref: 'a#0', index: 0 }, ['c#0']), 'a#0');
});

test('availability comes only from the plan, the belt and the purse, in that order', () => {
  assert.deepEqual({ ...offerAvailability({ price: 50, cinders: 80 }) }, { available: true, because: null, reason: null });
  assert.equal(offerAvailability({ price: 50, cinders: 40 }).because, 'cinders');
  assert.equal(offerAvailability({ price: 50, cinders: 80, capacityFull: true }).because, 'capacity');
  const refused = offerAvailability({ price: 50, cinders: 80, reason: 'Equipped armaments must be unequipped first.' });
  assert.deepEqual([refused.available, refused.because, refused.reason], [false, 'plan', 'Equipped armaments must be unequipped first.']);
  // A sale has no price to afford.
  assert.equal(offerAvailability({ price: null, cinders: 0 }).available, true);
});

test('the footer is Leave plus the selected action, or Leave alone', () => {
  assert.deepEqual([...shopFooterActions({ action: 'buy' })], ['leave', 'primary']);
  assert.deepEqual([...shopFooterActions({ action: null })], ['leave']);
  assert.deepEqual([...shopFooterActions(null)], ['leave']);
});

// The columns were EVEN here until 2026-09-20, when `offersFraction` stopped
// being the answer and became the floor: the offers column is sized for the
// shelf of cards standing in it (tests/card-shelf.test.mjs owns that
// arithmetic). What this test still owns is the frame — rail or no rail,
// columns or stacked — and the one invariant that survived the change: the two
// fractions divide ONE pane.
test('wide frames put the rail beside two columns; compact frames stack', () => {
  const ui = wireframeUi.shop;
  const wide = shopWorkspaceLayout({ width: 1368, bodyHeight: 520, rem: 16 });
  assert.deepEqual([wide.mode, wide.rail, wide.pane], ['wide', 'side', 'columns']);
  assert.equal(wide.railWidth, Math.round(Math.min(Math.max(1368 * ui.railFraction, ui.railMinRem * 16), ui.railMaxRem * 16)));
  assert.equal(wide.offersFr + wide.detailFr, 1);
  assert.ok(wide.offersFr >= ui.offersFraction, 'the authored share is a floor, never a ceiling');
  assert.equal(wide.detailMax, null);
  const phone = shopWorkspaceLayout({ width: 356, bodyHeight: 400, rem: 16 });
  assert.deepEqual([phone.mode, phone.rail, phone.pane, phone.railWidth], ['compact', 'top', 'stacked', 0]);
  assert.equal(phone.detailMax, Math.floor(400 * ui.detailMaxFraction));
  // The switch is the configured frame width, in the measured rem.
  assert.equal(shopWorkspaceLayout({ width: ui.wideMinRem * 16, rem: 16 }).mode, 'wide');
  assert.equal(shopWorkspaceLayout({ width: ui.wideMinRem * 16 - 1, rem: 16 }).mode, 'compact');
  // The rail width is clamped to readable rems at both ends.
  assert.equal(shopWorkspaceLayout({ width: 4000, rem: 16 }).railWidth, ui.railMaxRem * 16);
});
