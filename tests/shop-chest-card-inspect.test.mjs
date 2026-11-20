import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { mountConfiguredShop } from '../src/ui/screens/shop.js';
import { MountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { renderCard } from '../src/ui/components/card.js';

// Merchant thumbnails and reward choices open the shared contextual inspector.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function withGlobalDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  const timers = [], timeout = globalThis.setTimeout;
  globalThis.setTimeout = (...args) => { const timer = timeout(...args); timers.push(timer); return timer; };
  try { return fn(dom); } finally {
    for (const timer of timers) clearTimeout(timer);
    globalThis.setTimeout = timeout;
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
const modal = () => document.querySelector('.card-inspection-modal');
const tap = face => { face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true })); face.click(); };

function mountShop(kind = 'combatCards', cinders = 100000) {
  const run = createRunState({ seed: 71, classId: 'reaver', registries }), rng = createRng(71);
  run.cinders = cinders;
  const offer = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const taken = [], sold = [];
  mountConfiguredShop(app, { registries, run, offer, meta: { settings: {} }, onTake: (...args) => taken.push(args), onSell: (...args) => sold.push(args), onLeave() {} });
  const shelf = app.querySelector(`[data-shop-shelf="${kind}"]`);
  return { app, shelf, rows: [...shelf.querySelectorAll('.merchant-offer')], offer, taken, sold };
}

test('shop card thumbnails preserve complete artwork without a separate info button', () => withGlobalDom(() => {
  const { rows, offer } = mountShop('combatCards');
  const cards = offer.options.filter(option => option.kind === 'combatCards');
  assert.ok(rows.length > 0, 'the stock has card offers');
  rows.forEach((row, index) => {
    assert.equal(row.querySelector('.card-info-button'), null);
    const face = renderCard(registries, { cardId: cards[index].id, instanceId: 'reference', upgraded: false }, { inspection: false });
    assert.equal(row.querySelector('.playing-card-art')?.getAttribute('src'), face.querySelector('.playing-card-art')?.getAttribute('src'));
    assert.equal(row.querySelectorAll('[data-card-art-component]').length, face.querySelectorAll('[data-card-art-component]').length, 'all object/effect layers survive');
    assert.equal(row.querySelector('.merchant-thumbnail .card'), null, 'no miniature card text');
  });
}));

test('non-card shop offers get no (i)', () => withGlobalDom(() => {
  const { app } = mountShop('combatCards');
  for (const kind of ['relics', 'potions', 'weapons', 'armor']) {
    const shelf = app.querySelector(`[data-shop-shelf="${kind}"]`);
    if (shelf) assert.equal(shelf.querySelectorAll('.card-info-button').length, 0, kind);
  }
}));

test('row text and thumbnail repeatedly open the card inspector without buying', () => withGlobalDom(() => {
  const { rows, offer, taken } = mountShop('combatCards');
  const cardIds = offer.options.filter(option => option.kind === 'combatCards').map(option => option.id);
  rows.forEach((row, at) => {
    const thumb = row.querySelector('.merchant-thumbnail');
    row.querySelector('.merchant-offer-details').click();
    const dialog = modal();
    assert.ok(dialog, 'row text opens the shared inspector');
    assert.equal(dialog.querySelector('.card[data-level="inspect"]')?.dataset.cardId, cardIds[at], 'it shows that row\'s card');
    assert.ok(dialog.querySelector('[data-act="buy"]'), 'Buy is offered');
    dialog.querySelector('.card-inspection-back').click();
    assert.equal(modal(), null);
    assert.equal(document.activeElement, thumb, 'closing returns focus to the thumbnail');
    thumb.click();
    assert.ok(modal(), 'thumbnail reopens the same reading');
    modal().querySelector('.modal-close').click();
    assert.ok(thumb.querySelector('.playing-card-art'), 'thumbnail keeps its artwork');
  });
  assert.deepEqual(taken, [], 'inspecting never buys');
  // No buy review is opened either: nothing but the inspector appeared.
  assert.equal(document.querySelector('.beat-review, [data-shop-review]'), null);
}));

test('armament and collectible rows inspect with Back and Buy', () => withGlobalDom(() => {
  const { app, taken } = mountShop();
  for (const kind of ['weapons', 'armor', 'relics', 'potions']) {
    for (const row of app.querySelectorAll(`[data-shop-shelf="${kind}"] .merchant-offer`)) {
      row.querySelector('.merchant-offer-details').click();
      assert.ok(modal(), kind);
      assert.ok(modal().querySelector('[data-act="buy"]'), `${kind} offers Buy`);
      modal().querySelector('.card-inspection-back').click();
    }
  }
  assert.deepEqual(taken, []);
}));

test('inspector Buy forwards one guarded row purchase and row Buy never inspects', () => withGlobalDom(() => {
  const { rows, taken } = mountShop();
  rows[0].querySelector('.merchant-thumbnail').click();
  modal().querySelector('[data-act="buy"]').click();
  assert.equal(modal(), null);
  assert.equal(taken.length, 0, 'inspector Buy first asks for confirmation');
  document.querySelector('.confirmation-confirm').click();
  assert.equal(taken.length, 1);
  rows[1].querySelector('[data-shop-action="buy"]').click();
  assert.equal(taken.length, 1);
  document.querySelector('.confirmation-confirm').click();
  assert.equal(taken.length, 2);
  assert.equal(modal(), null);
}));

test('unaffordable and newly disabled merchant actions cannot buy from inspection', () => withGlobalDom(() => {
  const { rows, taken } = mountShop('combatCards', 0);
  const row = rows[0];
  row.querySelector('.merchant-thumbnail').click();
  const buy = modal().querySelector('[data-act="buy"]');
  assert.equal(buy.disabled, true);
  assert.ok(modal().querySelector('.card-action-reason')?.textContent, 'disabled Buy explains why');
  buy.click();
  assert.deepEqual(taken, []);
  modal().querySelector('.card-inspection-back').click();
}));

test('merchant inspection rereads the live row disabled state before committing', () => withGlobalDom(() => {
  const { rows, taken } = mountShop();
  rows[0].querySelector('.merchant-thumbnail').click();
  rows[0].querySelector('[data-shop-action="buy"]').disabled = true;
  const buy = modal().querySelector('[data-act="buy"]');
  buy.click();
  assert.equal(buy.disabled, true);
  assert.deepEqual(taken, []);
  modal().querySelector('.card-inspection-back').click();
}));

test('merchant keyboard activation opens inspection', () => withGlobalDom(() => {
  const { rows, taken } = mountShop();
  rows[0].dispatchEvent(new Event('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.ok(modal());
  modal().querySelector('.card-inspection-back').click();
  rows[0].querySelector('[data-shop-action="buy"]').dispatchEvent(new Event('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  assert.equal(modal(), null);
  assert.deepEqual(taken, []);
}));

// ---- Chest / treasure card picks inspect before taking a card. ----
function mountChest() {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 0, xp: 0, skills: {} };
  const ids = ['frostNova', 'scholarsInsight', 'guardCounter'];
  const claims = [];
  const offer = { id: '1:node:treasure', options: ids.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount: 1 };
  MountGameProfileOffers(app, { registries, run, offer, title: 'Treasure', onTake: (...a) => claims.push(a), onContinue() {}, onAddToDeck() {} });
  return { faces: [...app.querySelectorAll('.reward-choice-face')], ids, claims };
}
const chosen = faces => faces.map(face => face.classList.contains('is-chosen'));

test('chest card picks inspect on first tap without claiming', () => withGlobalDom(() => {
  const { faces, ids, claims } = mountChest();
  assert.equal(faces.length, 3);
  assert.deepEqual(chosen(faces), [false, false, false]);
  tap(faces[1]);
  assert.deepEqual(chosen(faces), [false, true, false]);
  assert.equal(faces[1].querySelector('.card-info-button'), null);
  assert.equal(modal().querySelector('.card[data-level="inspect"]')?.dataset.cardId, ids[1]);
  assert.ok(modal().querySelector('[data-act="addToDeck"]'));
  assert.ok(modal().querySelector('[data-act="addToLibrary"]'));
  modal().querySelector('.card-inspection-back').click();
  assert.deepEqual(claims, []);
}));

test('chest card picks inspect the tapped card and Back preserves selection', () => withGlobalDom(() => {
  const { faces, claims } = mountChest();
  tap(faces[0]);
  assert.ok(modal(), 'first tap inspects');
  modal().querySelector('.card-inspection-back').click();
  tap(faces[0]);
  assert.ok(modal(), 'second tap inspects');
  modal().querySelector('.modal-close').click();
  tap(faces[2]);
  assert.ok(modal(), 'another card opens its own inspector');
  modal().querySelector('.card-inspection-back').click();
  assert.deepEqual(chosen(faces), [false, false, true]);
  assert.deepEqual(claims, []);
}));
