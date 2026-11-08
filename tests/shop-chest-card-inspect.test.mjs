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
import { mountGameProfileOffers } from '../src/ui/components/gameProfileOffers.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';
import { readFileSync } from 'node:fs';

// Owner 2026-11-05: "add the (i) to shop and chest cards too". A chest (treasure) card pick is the reward
// chooser, so it has the selected-card (i) from #2539. A shop has no selection step (a row's own button buys), so
// every card offer there shows the same badge always, and the badge only ever inspects.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function withGlobalDom(fn) {
  const { dom, globals } = withKitDom((dom, globals) => ({ dom, globals }));
  const saved = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  dom.document.documentElement = dom.document.body;
  dom.document.getSelection = () => null;
  try { return fn(dom); } finally {
    clearSelection();
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
}
const modal = () => document.querySelector('.card-inspection-modal');
const tap = face => { face.dispatchEvent(new Event('pointerdown', { pointerType: 'touch', bubbles: true })); face.click(); };

function mountShop(kind = 'combatCards') {
  const run = createRunState({ seed: 71, classId: 'reaver', registries }), rng = createRng(71);
  run.cinders = 100000;
  const offer = gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const taken = [], sold = [];
  mountConfiguredShop(app, { registries, run, offer, meta: { settings: {} }, onTake: (...args) => taken.push(args), onSell: (...args) => sold.push(args), onLeave() {} });
  const shelf = app.querySelector(`[data-shop-shelf="${kind}"]`);
  return { app, shelf, rows: [...shelf.querySelectorAll('.merchant-offer')], offer, taken, sold };
}

test('every shop card offer shows the shared (i), always, beside its thumbnail', () => withGlobalDom(() => {
  const { rows } = mountShop('combatCards');
  assert.ok(rows.length > 0, 'the stock has card offers');
  for (const row of rows) {
    const badges = row.querySelectorAll('.card-info-button');
    assert.equal(badges.length, 1, 'one (i) per card row');
    assert.equal(badges[0].parentNode.className.includes('merchant-offer-media'), true, 'it sits with the thumbnail, not inside the thumbnail button');
  }
  const css = readFileSync(new URL('../styles/kit.css', import.meta.url), 'utf8');
  assert.match(css, /\.merchant-offer-media > \.card-info-button \{[^}]*visibility:visible; pointer-events:auto;/, 'always visible, no selection needed');
}));

test('non-card shop offers get no (i)', () => withGlobalDom(() => {
  const { app } = mountShop('combatCards');
  for (const kind of ['relics', 'potions', 'weapons', 'armor']) {
    const shelf = app.querySelector(`[data-shop-shelf="${kind}"]`);
    if (shelf) assert.equal(shelf.querySelectorAll('.card-info-button').length, 0, kind);
  }
}));

test('the shop (i) opens the card inspector for that card and never buys', () => withGlobalDom(() => {
  const { rows, offer, taken } = mountShop('combatCards');
  const cardIds = offer.options.filter(option => option.kind === 'combatCards').map(option => option.id);
  rows.forEach((row, at) => {
    const info = row.querySelector('.card-info-button');
    info.click();
    const dialog = modal();
    assert.ok(dialog, 'the (i) opens the shared inspector');
    assert.equal(dialog.querySelector('.card[data-level="inspect"]')?.dataset.cardId, cardIds[at], 'it shows that row\'s card');
    dialog.querySelector('.modal-close').click();
    assert.equal(modal(), null);
    assert.equal(document.activeElement, info, 'closing returns focus to the (i)');
  });
  assert.deepEqual(taken, [], 'inspecting never buys');
  // No buy review is opened either: nothing but the inspector appeared.
  assert.equal(document.querySelector('.beat-review, [data-shop-review]'), null);
}));

// ---- Chest / treasure card picks use the reward chooser: the (i) belongs to the selected card only. ----
function mountChest() {
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  const run = { class: 'reaver', deck: [], sideboard: [], cinders: 0, xp: 0, skills: {} };
  const ids = ['frostNova', 'scholarsInsight', 'guardCounter'];
  const claims = [];
  const offer = { id: '1:node:treasure', options: ids.map(id => ({ kind: 'combatCards', id })), taken: [], claimed: null, takeCount: 1 };
  mountGameProfileOffers(app, { registries, run, offer, title: 'Treasure', onTake: (...a) => claims.push(a), onContinue() {}, onAddToDeck() {} });
  return { faces: [...app.querySelectorAll('.reward-choice-face')], ids, claims };
}
const chosen = faces => faces.map(face => face.classList.contains('is-chosen'));

test('chest card picks: the (i) shows on the selected card only, and opens that card without claiming it', () => withGlobalDom(() => {
  const { faces, ids, claims } = mountChest();
  assert.equal(faces.length, 3);
  assert.deepEqual(chosen(faces), [false, false, false]);
  tap(faces[1]);
  assert.deepEqual(chosen(faces), [false, true, false], 'badge keyed to the single chosen card');
  assert.equal(modal(), null, 'the first tap only selects');
  faces[1].querySelector('.card-info-button').click();
  assert.equal(modal().querySelector('.card[data-level="inspect"]')?.dataset.cardId, ids[1]);
  modal().querySelector('.modal-close').click();
  assert.deepEqual(claims, [], 'the (i) never claims');
}));

test('chest card picks: a second tap on the selected face inspects, a tap elsewhere only selects', () => withGlobalDom(() => {
  const { faces, claims } = mountChest();
  tap(faces[0]);
  assert.equal(modal(), null);
  tap(faces[0]);
  assert.ok(modal(), 'second tap inspects');
  modal().querySelector('.modal-close').click();
  tap(faces[2]);
  assert.equal(modal(), null, 'another card only selects');
  assert.deepEqual(chosen(faces), [false, false, true]);
  assert.deepEqual(claims, []);
}));
