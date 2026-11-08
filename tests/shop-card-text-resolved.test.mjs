import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { gameProfileShopSalePlans } from '../src/model/gameProfileShopSales.js';
import { mountConfiguredShop } from '../src/ui/screens/shop.js';
import { cardPlainText } from '../src/ui/components/card.js';
import { clearSelection } from '../src/ui/components/cardSelection.js';

// Bug: configured-shop rows printed def.textTemplate raw ("Deal {damage} damage…"). They must read what the card face reads.
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

function mount(offerOverride = null, prep = () => {}) {
  const run = createRunState({ seed: 71, classId: 'reaver', registries }), rng = createRng(71);
  run.cinders = 100000;
  prep(run);
  const offer = offerOverride ? offerOverride(run) : gameProfileShopStock(registries, run, rng, { shopId: 'market' });
  const app = document.createElement('main'); app.id = 'app'; document.body.append(app);
  mountConfiguredShop(app, { registries, run, offer, meta: { settings: {} }, onTake() {}, onSell() {}, onLeave() {} });
  return { app, run, offer };
}
const rowText = row => row.querySelector('.merchant-offer-details p')?.textContent || '';

test('buy rows for cards print resolved text, no braces', () => withGlobalDom(() => {
  const { app, offer } = mount();
  for (const kind of ['combatCards', 'weaponArts']) {
    const rows = [...app.querySelectorAll(`[data-shop-shelf="${kind}"] .merchant-offer`)];
    const ids = offer.options.filter(option => option.kind === kind).map(option => option.id);
    assert.equal(rows.length, ids.length);
    rows.forEach((row, at) => {
      const text = rowText(row);
      assert.ok(text.length > 0, `${kind} ${ids[at]} has text`);
      assert.doesNotMatch(text, /[{}]/, `${ids[at]}: ${text}`);
    });
  }
}));

test('a multi-key template (base.extra-weapon) and {damage} resolve to numbers, same as the card text', () => withGlobalDom(() => {
  const all = registries.cards.all();
  const multi = all.find(def => /\{base\.extra-weapon\}/.test(def.textTemplate || ''));
  const dmg = all.find(def => /\{damage\}/.test(def.textTemplate || ''));
  const ids = [dmg?.id, multi?.id].filter(Boolean);
  assert.ok(dmg, 'content has a {damage} card');
  assert.ok(multi, 'content has a base.extra-weapon card');
  const { app, run } = mount(r => ({ id: 'shop', options: ids.map(id => ({ kind: 'combatCards', id })), taken: [] }));
  const rows = [...app.querySelectorAll('[data-shop-shelf="combatCards"] .merchant-offer')];
  rows.forEach((row, at) => {
    const text = rowText(row);
    assert.doesNotMatch(text, /[{}]/, text);
    assert.match(text, /\d/, 'a number appears');
    assert.equal(text, cardPlainText(registries, { cardId: ids[at], instanceId: `shop:${at}`, upgraded: false }, { rules: run }));
  });
}));

test('sell rows for cards print resolved text, no braces', () => withGlobalDom(() => {
  const { app, run } = mount(null, r => {
    r.sideboard = registries.cards.all().filter(def => /\{[\w.-]+\}/.test(def.textTemplate || '')).slice(0, 6)
      .map((def, i) => ({ cardId: def.id, instanceId: `sb:${i}`, upgraded: false }));
  });
  const rows = [...app.querySelectorAll('[data-shop-shelf="sell"] .merchant-offer')].filter(row => row.querySelector('.card-info-button'));
  const sales = gameProfileShopSalePlans(registries, run, 'market').filter(q => ['combatCards', 'weaponArts'].includes(q.kind));
  assert.ok(rows.length > 0 && rows.length === sales.length, `sell shelf has card rows (${rows.length}/${sales.length})`);
  for (const row of rows) assert.doesNotMatch(rowText(row), /[{}]/, rowText(row));
}));
